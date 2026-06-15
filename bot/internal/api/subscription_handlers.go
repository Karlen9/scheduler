package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"scheduler-bot/internal/config"
	"scheduler-bot/internal/crypto"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
	"scheduler-bot/internal/payments"
)

// ErrInvalidPromo is returned by CreateSubscriptionCheckout when the promo code is invalid.
var ErrInvalidPromo = errors.New("invalid promo code")

// ErrPaymentNotConfigured is returned by CreateSubscriptionCheckout when ЮКасса is not configured.
var ErrPaymentNotConfigured = errors.New("payment provider not configured")

// YooKassaClient is the package-level ЮКасса client, wired from main.go.
// When nil or unconfigured, checkout returns 503.
var YooKassaClient *payments.Client

// Receipt configuration, wired from main.go.
var (
	ReceiptEmail         string
	ReceiptVATCode       int
	ReceiptTaxSystemCode int
)

// ---------------------------------------------------------------------------
// GET /api/admin/subscription
// ---------------------------------------------------------------------------

// subscriptionStatusResponse is the shape returned to the billing UI.
type subscriptionStatusResponse struct {
	Status             string                `json:"status"`
	Plan               string                `json:"plan"`
	IsPro              bool                  `json:"isPro"`
	TrialEndsAt        *string               `json:"trialEndsAt,omitempty"`
	CurrentPeriodEnd   *string               `json:"currentPeriodEndAt,omitempty"`
	AutoRenew          bool                  `json:"autoRenew"`
	CancelAtPeriodEnd  bool                  `json:"cancelAtPeriodEnd"`
	RecurringAvailable bool                  `json:"recurringAvailable"`
	Plans              []subscriptionPlanDTO `json:"plans"`
}

type subscriptionPlanDTO struct {
	Code         string `json:"code"`
	PriceKopecks int    `json:"priceKopecks"`
	DurationDays int    `json:"durationDays"`
}

// HandleGetSubscriptionStatus returns the current subscription state and available plans.
// Route: GET /api/admin/subscription  (AdminAuth required — registered in router.go)
func HandleGetSubscriptionStatus(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	resp := buildSubscriptionStatusResponse(specialist)
	writeJSON(w, resp)
}

func buildSubscriptionStatusResponse(s *models.Specialist) subscriptionStatusResponse {
	ent := s.Entitlement(time.Now())

	recurringAvailable, err := db.GetRecurringPaymentsEnabled()
	if err != nil {
		log.Printf("subscription status: read recurring-payments flag failed (specialist=%s): %v", s.ID, err)
		recurringAvailable = false
	}

	resp := subscriptionStatusResponse{
		Status:             s.SubscriptionStatus,
		Plan:               s.SubscriptionPlan,
		IsPro:              ent.IsPro,
		AutoRenew:          s.AutoRenew,
		CancelAtPeriodEnd:  s.CancelAtPeriodEnd,
		RecurringAvailable: recurringAvailable,
	}

	if s.TrialEndsAt != nil {
		ts := s.TrialEndsAt.Format(time.RFC3339)
		resp.TrialEndsAt = &ts
	}
	if s.CurrentPeriodEndAt != nil {
		ts := s.CurrentPeriodEndAt.Format(time.RFC3339)
		resp.CurrentPeriodEnd = &ts
	}

	plans := config.SubscriptionPlans()
	resp.Plans = make([]subscriptionPlanDTO, 0, len(plans))
	for _, p := range plans {
		resp.Plans = append(resp.Plans, subscriptionPlanDTO{
			Code:         p.Code,
			PriceKopecks: p.PriceKopecks,
			DurationDays: p.DurationDays,
		})
	}

	return resp
}

// ---------------------------------------------------------------------------
// POST /api/admin/subscription/checkout
// ---------------------------------------------------------------------------

type checkoutRequest struct {
	Plan      string `json:"plan"`
	PromoCode string `json:"promoCode,omitempty"` // Step 3 seam — ignored for now
	AutoRenew bool   `json:"autoRenew"`
}

type checkoutResponse struct {
	ConfirmationURL string `json:"confirmationUrl,omitempty"`
	Granted         bool   `json:"granted,omitempty"`
}

// CreateSubscriptionCheckout validates an optional promo, then either grants the
// subscription immediately (100%-off → granted=true, empty url) or creates a ЮКасса
// payment and returns its confirmation URL. Used by both the HTTP handler and the master bot.
//
// autoRenew expresses the caller's preference to save the payment method for auto-renewal.
// The method is saved only when the global recurring-payments flag is also enabled.
//
// Sentinel errors: ErrInvalidPromo (bad promo code), ErrPaymentNotConfigured (YooKassa absent).
// Any other error is an internal failure.
func CreateSubscriptionCheckout(ctx context.Context, specialist *models.Specialist, planCode, promoCode string, autoRenew bool) (confirmationURL string, granted bool, err error) {
	plan, ok := config.SubscriptionPlanByCode(planCode)
	if !ok {
		return "", false, errors.New("unknown plan: " + planCode)
	}

	// Promo code validation.
	finalKopecks := plan.PriceKopecks
	discountKopecks := 0
	var promo *models.PromoCode

	if promoCode != "" {
		var reason string
		var promoOK bool
		promo, finalKopecks, discountKopecks, reason, promoOK = ValidatePromoForSpecialist(
			promoCode, plan.Code, specialist.ID,
		)
		if !promoOK {
			return "", false, fmt.Errorf("%w: %s", ErrInvalidPromo, reason)
		}
	}

	now := time.Now().UTC()

	// 100% short-circuit: grant without touching ЮКасса.
	if finalKopecks == 0 {
		durationDays := plan.DurationDays
		if promo != nil && promo.DurationDays > 0 {
			durationDays = promo.DurationDays
		}
		base := now
		if specialist.CurrentPeriodEndAt != nil && specialist.CurrentPeriodEndAt.After(now) {
			base = *specialist.CurrentPeriodEndAt
		}
		periodEnd := base.Add(time.Duration(durationDays) * 24 * time.Hour)

		payment := models.SubscriptionPayment{
			ID:                uuid.New().String(),
			SpecialistID:      specialist.ID,
			YooKassaPaymentID: "promo_" + uuid.New().String(),
			AmountKopecks:     0,
			Currency:          "RUB",
			Status:            "succeeded",
			PlanCode:          plan.Code,
			PromoCode:         promoCode,
			DiscountKopecks:   discountKopecks,
			PeriodStart:       now,
			PeriodEnd:         periodEnd,
			IsRenewal:         false,
			CreatedAt:         now,
			PaidAt:            &now,
		}

		if err := db.CreateSubscriptionPayment(payment); err != nil {
			log.Printf("subscription checkout (100%% promo): persist payment failed (specialist=%s): %v",
				specialist.ID, err)
			return "", false, err
		}

		if err := finalizeSuccessfulPayment(specialist, &payment, ""); err != nil {
			log.Printf("subscription checkout (100%% promo): finalize error (specialist=%s): %v",
				specialist.ID, err)
			// Subscription may be partially activated — do not surface internal error.
		}

		return "", true, nil
	}

	// Normal paid path: ЮКасса must be configured.
	if YooKassaClient == nil || !YooKassaClient.Configured() {
		log.Printf("subscription checkout: YooKassa not configured (specialist=%s)", specialist.ID)
		return "", false, ErrPaymentNotConfigured
	}

	returnURL := strings.TrimRight(WebAppURL, "/") + "/admin/settings/subscription"

	recurringEnabled, err := db.GetRecurringPaymentsEnabled()
	if err != nil {
		log.Printf("subscription checkout: read recurring-payments flag failed (specialist=%s): %v", specialist.ID, err)
		recurringEnabled = false
	}
	saveMethod := recurringEnabled && autoRenew

	receiptEmail := specialist.Email
	if receiptEmail == "" {
		receiptEmail = ReceiptEmail // configured fallback
	}

	createParams := payments.CreatePaymentParams{
		AmountKopecks: finalKopecks,
		Description:   "Подписка Pro — " + plan.Code,
		Metadata: map[string]string{
			"specialist_id": specialist.ID,
			"plan_code":     plan.Code,
		},
		ReturnURL:         returnURL,
		SavePaymentMethod: saveMethod,
		// PaymentMethodID is empty → new purchase flow.
		Receipt: &payments.Receipt{
			CustomerEmail: receiptEmail,
			CustomerPhone: specialist.Phone,
			TaxSystemCode: ReceiptTaxSystemCode,
			Items: []payments.ReceiptItem{{
				Description:    "Подписка Pro — " + plan.Code,
				AmountKopecks:  finalKopecks,
				Quantity:       "1.00",
				VATCode:        ReceiptVATCode,
				PaymentSubject: "service",
				PaymentMode:    "full_payment",
			}},
		},
	}

	ykPayment, err := YooKassaClient.CreatePayment(ctx, createParams)
	if err != nil {
		log.Printf("subscription checkout: create payment error (specialist=%s): %v", specialist.ID, err)
		return "", false, err
	}

	periodEnd := now.Add(time.Duration(plan.DurationDays) * 24 * time.Hour)

	payment := models.SubscriptionPayment{
		SpecialistID:      specialist.ID,
		YooKassaPaymentID: ykPayment.ID,
		AmountKopecks:     finalKopecks,
		Currency:          "RUB",
		Status:            ykPayment.Status,
		PlanCode:          plan.Code,
		PromoCode:         promoCode,
		DiscountKopecks:   discountKopecks,
		PeriodStart:       now,
		PeriodEnd:         periodEnd,
		IsRenewal:         false,
		CreatedAt:         now,
	}

	if err := db.CreateSubscriptionPayment(payment); err != nil {
		log.Printf("subscription checkout: persist payment row failed (specialist=%s ykID=%s): %v",
			specialist.ID, ykPayment.ID, err)
		// Fatal: without a local row the webhook cannot activate the subscription.
		return "", false, err
	}

	return ykPayment.ConfirmationURL, false, nil
}

// HandleSubscriptionCheckout initiates a new ЮКасса payment for the requested plan.
// If a valid 100%-off promo code is supplied, the payment is granted immediately without
// calling ЮКасса.
// Route: POST /api/admin/subscription/checkout  (AdminAuth required)
func HandleSubscriptionCheckout(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req checkoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Plan == "" {
		http.Error(w, "plan is required", http.StatusBadRequest)
		return
	}

	confirmationURL, granted, err := CreateSubscriptionCheckout(r.Context(), specialist, req.Plan, req.PromoCode, req.AutoRenew)
	if err != nil {
		if errors.Is(err, ErrInvalidPromo) {
			// Strip the sentinel prefix; the reason string follows after ": ".
			reason := strings.TrimPrefix(err.Error(), ErrInvalidPromo.Error()+": ")
			w.WriteHeader(http.StatusBadRequest)
			writeJSON(w, map[string]string{"error": reason})
			return
		}
		if errors.Is(err, ErrPaymentNotConfigured) {
			http.Error(w, "payment provider not configured", http.StatusServiceUnavailable)
			return
		}
		// Unknown plan or internal error.
		if strings.HasPrefix(err.Error(), "unknown plan") {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		log.Printf("subscription checkout: internal error (specialist=%s): %v", specialist.ID, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if granted {
		writeJSON(w, checkoutResponse{Granted: true})
		return
	}
	writeJSON(w, checkoutResponse{ConfirmationURL: confirmationURL})
}

// ---------------------------------------------------------------------------
// POST /api/payments/yookassa/webhook   (NO auth — server-to-server callback)
// ---------------------------------------------------------------------------

// ykWebhookPayload is the JSON body ЮКасса sends to the webhook.
type ykWebhookPayload struct {
	Event  string          `json:"event"`
	Object json.RawMessage `json:"object"`
}

// ykPaymentObject is the minimal subset of the payment object inside the webhook.
type ykPaymentObject struct {
	ID string `json:"id"`
}

// HandleYooKassaWebhook processes incoming ЮКасса webhook events.
// Route: POST /api/payments/yookassa/webhook  (no auth middleware — registered outside /api/admin)
//
// Verification strategy: re-fetch the payment via the API and treat the fetched status as
// authoritative (ЮКасса does not sign webhook payloads).
func HandleYooKassaWebhook(w http.ResponseWriter, r *http.Request) {
	rawBody, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1 MiB limit
	if err != nil {
		log.Printf("yookassa webhook: read body error: %v", err)
		w.WriteHeader(http.StatusOK)
		return
	}

	var payload ykWebhookPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		log.Printf("yookassa webhook: unmarshal error: %v", err)
		w.WriteHeader(http.StatusOK)
		return
	}

	var obj ykPaymentObject
	if err := json.Unmarshal(payload.Object, &obj); err != nil || obj.ID == "" {
		log.Printf("yookassa webhook: missing object.id (event=%s)", payload.Event)
		w.WriteHeader(http.StatusOK)
		return
	}

	log.Printf("yookassa webhook: event=%s payment_id=%s", payload.Event, obj.ID)

	// Only handle payment events; silently ignore refunds, etc.
	if !strings.HasPrefix(payload.Event, "payment.") {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Guard: client must be configured to re-fetch.
	if YooKassaClient == nil || !YooKassaClient.Configured() {
		log.Printf("yookassa webhook: client not configured, cannot re-fetch payment %s", obj.ID)
		w.WriteHeader(http.StatusOK)
		return
	}

	// Re-fetch the payment — this is the verification step.
	fetched, err := YooKassaClient.GetPayment(r.Context(), obj.ID)
	if err != nil {
		log.Printf("yookassa webhook: re-fetch error for payment %s: %v", obj.ID, err)
		// Return 200 anyway so ЮКасса does not keep retrying — log is sufficient for ops.
		w.WriteHeader(http.StatusOK)
		return
	}

	// Look up our local record.
	localPayment, err := db.GetSubscriptionPaymentByYooKassaID(obj.ID)
	if err != nil {
		log.Printf("yookassa webhook: db lookup error (yk_id=%s): %v", obj.ID, err)
		w.WriteHeader(http.StatusOK)
		return
	}
	if localPayment == nil {
		// Primary lookup by ЮКасса ID found nothing. Try the metadata fallback: the renewal
		// worker embeds payment_row_id in the metadata before charging, so the row may exist
		// with an empty yookassa_payment_id if the worker died between CreatePayment and the
		// subsequent UpdateSubscriptionPaymentYooKassaID call.
		if rowID := fetched.Metadata["payment_row_id"]; rowID != "" {
			fallback, fbErr := db.GetSubscriptionPaymentByID(rowID)
			if fbErr != nil {
				log.Printf("yookassa webhook: metadata fallback db error (payment_row_id=%s): %v", rowID, fbErr)
			} else if fallback != nil && fallback.YooKassaPaymentID == "" {
				// Associate the ЮКасса ID with this row so future lookups work by yk id.
				if updErr := db.UpdateSubscriptionPaymentYooKassaID(rowID, obj.ID); updErr != nil {
					log.Printf("yookassa webhook: update yk id via fallback error (row=%s yk=%s): %v",
						rowID, obj.ID, updErr)
				} else {
					fallback.YooKassaPaymentID = obj.ID
				}
				localPayment = fallback
			}
		}
		if localPayment == nil {
			// Genuinely unknown — not ours.
			log.Printf("yookassa webhook: unknown payment %s — ignoring", obj.ID)
			w.WriteHeader(http.StatusOK)
			return
		}
	}

	switch fetched.Status {
	case "succeeded":
		now := time.Now().UTC()
		rawStr := string(rawBody)

		// Atomically flip pending→succeeded. Only the goroutine that wins the claim
		// (rows affected == 1) proceeds to activate; concurrent duplicate deliveries
		// see rows affected == 0 and return early without double-activating.
		claimed, err := db.MarkSubscriptionPaymentSucceeded(localPayment.ID, now, rawStr)
		if err != nil {
			log.Printf("yookassa webhook: atomic claim error (%s): %v", localPayment.ID, err)
			w.WriteHeader(http.StatusOK)
			return
		}
		if !claimed {
			log.Printf("yookassa webhook: payment %s already succeeded — skipping re-activation", obj.ID)
			w.WriteHeader(http.StatusOK)
			return
		}

		// Re-fetch specialist after marking payment succeeded.
		specialist, err := db.GetSpecialistByID(localPayment.SpecialistID)
		if err != nil || specialist == nil {
			log.Printf("yookassa webhook: specialist not found (id=%s)", localPayment.SpecialistID)
			w.WriteHeader(http.StatusOK)
			return
		}

		// Encrypt the payment method ID before passing to finalize.
		var encryptedMethodID string
		if fetched.PaymentMethodID != "" {
			encrypted, encErr := crypto.Encrypt(fetched.PaymentMethodID)
			if encErr != nil {
				log.Printf("yookassa webhook: encrypt payment_method_id error: %v", encErr)
				// Proceed without saving the method ID rather than blocking activation.
			} else {
				encryptedMethodID = encrypted
			}
		}

		localPayment.PaidAt = &now
		if err := finalizeSuccessfulPayment(specialist, localPayment, encryptedMethodID); err != nil {
			log.Printf("yookassa webhook: finalize error (specialist=%s): %v",
				localPayment.SpecialistID, err)
			w.WriteHeader(http.StatusOK)
			return
		}

		log.Printf("yookassa webhook: subscription activated (specialist=%s plan=%s)",
			localPayment.SpecialistID, localPayment.PlanCode)

	case "canceled":
		if localPayment.Status == "failed" {
			w.WriteHeader(http.StatusOK)
			return
		}
		rawStr := string(rawBody)
		if err := db.UpdateSubscriptionPaymentStatus(localPayment.ID, "failed", nil, rawStr); err != nil {
			log.Printf("yookassa webhook: mark failed error (%s): %v", localPayment.ID, err)
		}
		log.Printf("yookassa webhook: payment canceled (yk_id=%s specialist=%s)", obj.ID, localPayment.SpecialistID)

	default:
		// pending, waiting_for_capture, etc. — no action needed.
		log.Printf("yookassa webhook: unhandled status %q for payment %s", fetched.Status, obj.ID)
	}

	w.WriteHeader(http.StatusOK)
}

// ---------------------------------------------------------------------------
// finalizeSuccessfulPayment — shared between webhook and 100%-off short-circuit
// ---------------------------------------------------------------------------

// finalizeSuccessfulPayment activates the subscription, records any promo redemption,
// marks the specialist's first payment, and (on first payment only) grants the referral
// reward to the referrer.
//
// encryptedMethodID may be empty (promo-only grants never have a payment method).
func finalizeSuccessfulPayment(
	specialist *models.Specialist,
	payment *models.SubscriptionPayment,
	encryptedMethodID string,
) error {
	plan, ok := config.SubscriptionPlanByCode(payment.PlanCode)
	if !ok {
		log.Printf("finalize: unknown plan %s for payment %s", payment.PlanCode, payment.ID)
		return nil // best-effort; log and move on
	}

	// 1. Compute period end: extend from the current period end if already active.
	now := time.Now().UTC()
	durationDays := plan.DurationDays
	if payment.PromoCode != "" {
		if p, err := db.GetPromoCodeByCode(payment.PromoCode); err == nil && p != nil && p.DurationDays > 0 {
			durationDays = p.DurationDays
		}
	}
	base := now
	if specialist.CurrentPeriodEndAt != nil && specialist.CurrentPeriodEndAt.After(now) {
		base = *specialist.CurrentPeriodEndAt
	}
	periodEnd := base.Add(time.Duration(durationDays) * 24 * time.Hour)

	// 2. Activate subscription.
	if err := db.ActivateSubscription(specialist.ID, plan.Code, periodEnd, encryptedMethodID); err != nil {
		return err
	}

	// Fire activation/renewal notification.
	if NotifySubscriptionEventFunc != nil {
		event := "subscription_activated"
		if payment.IsRenewal {
			event = "subscription_renewed"
		}
		NotifySubscriptionEventFunc(specialist.TelegramUserID, event)
	}

	// 3. Record promo redemption (if any).
	if payment.PromoCode != "" {
		p, err := db.GetPromoCodeByCode(payment.PromoCode)
		if err != nil {
			log.Printf("finalize: promo lookup error (code=%s): %v", payment.PromoCode, err)
		} else if p != nil {
			paidAt := now
			if payment.PaidAt != nil {
				paidAt = *payment.PaidAt
			}
			redemption := models.PromoRedemption{
				PromoCodeID:     p.ID,
				SpecialistID:    specialist.ID,
				PaymentID:       payment.ID,
				DiscountKopecks: payment.DiscountKopecks,
				CreatedAt:       paidAt,
			}
			if err := db.RecordPromoRedemption(redemption); err != nil {
				if err == models.ErrPromoExhausted {
					// Slot was validated at checkout but cap was reached before this
					// finalize ran. Log it but do not block activation.
					log.Printf("finalize: promo %s exhausted between validation and redemption (specialist=%s)",
						payment.PromoCode, specialist.ID)
				} else {
					log.Printf("finalize: record promo redemption error (code=%s): %v", payment.PromoCode, err)
				}
			}
		}
	}

	// 4. Mark first payment (idempotent).
	paidAt := now
	if payment.PaidAt != nil {
		paidAt = *payment.PaidAt
	}
	wasFirst, err := db.MarkFirstPaymentIfUnset(specialist.ID, paidAt)
	if err != nil {
		log.Printf("finalize: mark first payment error (specialist=%s): %v", specialist.ID, err)
	}

	// 5. Referral reward — only fires once, on the referred specialist's first payment that
	// actually generated revenue. A 100%-off promo (AmountKopecks == 0) does not count;
	// the referrer must not receive free days for a zero-revenue activation.
	if wasFirst && specialist.ReferredViaCode != "" && payment.AmountKopecks > 0 {
		referrer, err := db.GetSpecialistByReferralCode(specialist.ReferredViaCode)
		if err != nil {
			log.Printf("finalize: referral lookup error (code=%s): %v", specialist.ReferredViaCode, err)
		} else if referrer != nil && referrer.ID != specialist.ID {
			rewardDays := config.ReferralRewardDays()
			if err := db.GrantBonusSubscriptionDays(referrer.ID, rewardDays); err != nil {
				log.Printf("finalize: grant referral bonus error (referrer=%s days=%d): %v",
					referrer.ID, rewardDays, err)
			} else {
				log.Printf("finalize: granted %d bonus Pro days to referrer=%s (new subscriber=%s)",
					rewardDays, referrer.ID, specialist.ID)
				// Step 6: notify referrer about their bonus.
				if NotifySubscriptionEventFunc != nil {
					NotifySubscriptionEventFunc(referrer.TelegramUserID, "referral_reward")
				}
			}
		}
	}

	return nil
}

// ---------------------------------------------------------------------------
// POST /api/admin/subscription/cancel  (AdminAuth)
// ---------------------------------------------------------------------------

// HandleCancelSubscription sets auto_renew=false, cancel_at_period_end=true for the
// context specialist. The specialist retains Pro access until current_period_end_at;
// the expiry sweep then downgrades them.
// Route: POST /api/admin/subscription/cancel  (AdminAuth required)
func HandleCancelSubscription(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	if err := db.SetAutoRenew(specialist.ID, false, true); err != nil {
		log.Printf("cancel subscription: db error (specialist=%s): %v", specialist.ID, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	updated, err := db.GetSpecialistByID(specialist.ID)
	if err != nil || updated == nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, buildSubscriptionStatusResponse(updated))
}

// ---------------------------------------------------------------------------
// POST /api/admin/subscription/resume  (AdminAuth)
// ---------------------------------------------------------------------------

// HandleResumeSubscription sets auto_renew=true, cancel_at_period_end=false for the
// context specialist, re-enabling auto-renewal before the period ends.
// Route: POST /api/admin/subscription/resume  (AdminAuth required)
func HandleResumeSubscription(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	if err := db.SetAutoRenew(specialist.ID, true, false); err != nil {
		log.Printf("resume subscription: db error (specialist=%s): %v", specialist.ID, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	updated, err := db.GetSpecialistByID(specialist.ID)
	if err != nil || updated == nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, buildSubscriptionStatusResponse(updated))
}

// ---------------------------------------------------------------------------
// POST /api/admin/promocode/validate  (AdminAuth)
// ---------------------------------------------------------------------------

type promoValidateRequest struct {
	Code string `json:"code"`
	Plan string `json:"plan"`
}

type promoValidateResponse struct {
	Valid           bool   `json:"valid"`
	DiscountType    string `json:"discountType,omitempty"`
	DiscountValue   int    `json:"discountValue,omitempty"`
	FinalKopecks    int    `json:"finalKopecks,omitempty"`
	DiscountKopecks int    `json:"discountKopecks,omitempty"`
	Reason          string `json:"reason,omitempty"`
}

// HandleValidatePromoCode validates a promo code for the requesting specialist.
// Route: POST /api/admin/promocode/validate  (AdminAuth required)
func HandleValidatePromoCode(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req promoValidateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	promo, finalKopecks, discountKopecks, reason, ok := ValidatePromoForSpecialist(
		req.Code, req.Plan, specialist.ID,
	)

	if !ok {
		writeJSON(w, promoValidateResponse{Valid: false, Reason: reason})
		return
	}

	writeJSON(w, promoValidateResponse{
		Valid:           true,
		DiscountType:    promo.DiscountType,
		DiscountValue:   promo.DiscountValue,
		FinalKopecks:    finalKopecks,
		DiscountKopecks: discountKopecks,
	})
}

// ---------------------------------------------------------------------------
// Superadmin promo management endpoints
// ---------------------------------------------------------------------------

type createPromoRequest struct {
	Code                 string  `json:"code"`
	DiscountType         string  `json:"discountType"`
	DiscountValue        int     `json:"discountValue"`
	DurationDays         int     `json:"durationDays"`
	MaxRedemptions       *int    `json:"maxRedemptions,omitempty"`
	ValidFrom            *string `json:"validFrom,omitempty"`
	ValidUntil           *string `json:"validUntil,omitempty"`
	AppliesToPlan        string  `json:"appliesToPlan"`
	ReferralSpecialistID string  `json:"referralSpecialistId,omitempty"`
}

// HandleSuperadminCreatePromoCode creates a new promo code.
// Route: POST /superadmin/promocodes  (SuperadminAuthMiddleware)
func HandleSuperadminCreatePromoCode(w http.ResponseWriter, r *http.Request) {
	var req createPromoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Code == "" {
		http.Error(w, "code is required", http.StatusBadRequest)
		return
	}
	if req.DiscountType != "percent" && req.DiscountType != "amount" {
		http.Error(w, "discountType must be 'percent' or 'amount'", http.StatusBadRequest)
		return
	}
	if req.DiscountType == "percent" && (req.DiscountValue < 0 || req.DiscountValue > 100) {
		http.Error(w, "percent discountValue must be 0-100", http.StatusBadRequest)
		return
	}
	if req.DiscountType == "amount" && req.DiscountValue < 0 {
		http.Error(w, "amount discountValue must be >= 0", http.StatusBadRequest)
		return
	}

	p := models.PromoCode{
		Code:                 req.Code,
		DiscountType:         req.DiscountType,
		DiscountValue:        req.DiscountValue,
		DurationDays:         req.DurationDays,
		MaxRedemptions:       req.MaxRedemptions,
		AppliesToPlan:        req.AppliesToPlan,
		ReferralSpecialistID: req.ReferralSpecialistID,
		IsActive:             true,
	}

	if req.ValidFrom != nil {
		t, err := time.Parse(time.RFC3339, *req.ValidFrom)
		if err != nil {
			http.Error(w, "invalid validFrom format (RFC3339 required)", http.StatusBadRequest)
			return
		}
		p.ValidFrom = &t
	}
	if req.ValidUntil != nil {
		t, err := time.Parse(time.RFC3339, *req.ValidUntil)
		if err != nil {
			http.Error(w, "invalid validUntil format (RFC3339 required)", http.StatusBadRequest)
			return
		}
		p.ValidUntil = &t
	}

	if err := db.CreatePromoCode(p); err != nil {
		log.Printf("superadmin create promo: db error: %v", err)
		http.Error(w, "failed to create promo code", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	created, _ := db.GetPromoCodeByCode(p.Code)
	if created != nil {
		writeJSON(w, created)
	}
}

// HandleSuperadminListPromoCodes lists all promo codes.
// Route: GET /superadmin/promocodes  (SuperadminAuthMiddleware)
func HandleSuperadminListPromoCodes(w http.ResponseWriter, r *http.Request) {
	codes, err := db.ListPromoCodes()
	if err != nil {
		log.Printf("superadmin list promos: db error: %v", err)
		http.Error(w, "failed to list promo codes", http.StatusInternalServerError)
		return
	}
	if codes == nil {
		codes = []models.PromoCode{}
	}
	writeJSON(w, codes)
}

// HandleSuperadminDeactivatePromoCode deactivates a promo code by id.
// Route: DELETE /superadmin/promocodes/{id}  (SuperadminAuthMiddleware)
func HandleSuperadminDeactivatePromoCode(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "id is required", http.StatusBadRequest)
		return
	}
	if err := db.DeactivatePromoCode(id); err != nil {
		log.Printf("superadmin deactivate promo: db error: %v", err)
		http.Error(w, "failed to deactivate promo code", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
