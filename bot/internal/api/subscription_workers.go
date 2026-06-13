package api

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/config"
	"scheduler-bot/internal/crypto"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
	"scheduler-bot/internal/payments"
)

// NotifySubscriptionEventFunc is wired by main.go in Step 6 to message the specialist via
// the master bot. It is nil until wired; all call-sites guard with a nil check.
var NotifySubscriptionEventFunc func(specialistTelegramID int64, event string)

// renewalWindow is how far ahead we look for expiring subscriptions when deciding to renew.
const renewalWindow = 24 * time.Hour

// ProcessRenewals attempts autopay for every specialist whose subscription expires within
// the renewal window and who has a saved payment method. Safe to call on a ticker; any
// per-specialist error is logged and the loop continues.
func ProcessRenewals(ctx context.Context) {
	specialists, err := db.SpecialistsDueForRenewal(renewalWindow)
	if err != nil {
		log.Printf("ProcessRenewals: list due specialists error: %v", err)
		return
	}
	if len(specialists) == 0 {
		return
	}

	log.Printf("ProcessRenewals: %d specialist(s) due for renewal", len(specialists))

	for i := range specialists {
		if ctx.Err() != nil {
			return
		}
		processOneRenewal(ctx, &specialists[i])
	}
}

func processOneRenewal(ctx context.Context, s *models.Specialist) {
	if s.CurrentPeriodEndAt == nil {
		log.Printf("ProcessRenewals: specialist %s has no current_period_end_at, skipping", s.ID)
		return
	}

	// Dedup guard: skip if a renewal row already exists for this cycle.
	// Because we now persist the row BEFORE charging, this guard reliably prevents
	// re-charging on the next tick even if the process died mid-flight.
	hasPending, err := db.HasPendingRenewal(s.ID, *s.CurrentPeriodEndAt)
	if err != nil {
		log.Printf("ProcessRenewals: HasPendingRenewal error (specialist=%s): %v", s.ID, err)
		return
	}
	if hasPending {
		log.Printf("ProcessRenewals: renewal already in flight for specialist %s, skipping", s.ID)
		return
	}

	// Determine plan.
	planCode := s.SubscriptionPlan
	if planCode == "" {
		planCode = "pro_monthly"
	}
	plan, ok := config.SubscriptionPlanByCode(planCode)
	if !ok {
		// Fallback to the first available plan.
		plans := config.SubscriptionPlans()
		if len(plans) == 0 {
			log.Printf("ProcessRenewals: no plans configured (specialist=%s)", s.ID)
			return
		}
		plan = plans[0]
		log.Printf("ProcessRenewals: unknown plan %q for specialist %s, falling back to %s",
			planCode, s.ID, plan.Code)
	}

	// Guard: YooKassa must be configured.
	if YooKassaClient == nil || !YooKassaClient.Configured() {
		log.Printf("ProcessRenewals: YooKassa not configured, cannot renew specialist %s", s.ID)
		return
	}

	// Decrypt the saved payment method.
	plainMethodID, err := crypto.Decrypt(s.YooKassaPaymentMethodID)
	if err != nil || plainMethodID == "" {
		log.Printf("ProcessRenewals: decrypt payment_method_id error (specialist=%s): %v", s.ID, err)
		return
	}

	// Compute the renewal period.
	periodStart := *s.CurrentPeriodEndAt
	periodEnd := periodStart.Add(time.Duration(plan.DurationDays) * 24 * time.Hour)

	now := time.Now().UTC()

	// Pre-generate the local row ID so we can embed it in ЮКасса metadata before the charge.
	rowID := uuid.New().String()

	// Build a STABLE idempotency key tied to this specialist + cycle.
	// Using the same key on retry makes ЮКасса return the original payment instead of
	// creating a second charge, eliminating the double-charge window.
	stableKey := fmt.Sprintf("renewal:%s:%d", s.ID, s.CurrentPeriodEndAt.Unix())

	// PERSIST THE ROW FIRST — before any money moves.
	// If this insert fails we skip the charge entirely (safe). If it succeeds and the
	// process dies before charging, HasPendingRenewal on the next tick sees the row and
	// skips re-charging. The yookassa_payment_id starts as an empty placeholder and is
	// filled in after a successful CreatePayment call.
	paymentRow := models.SubscriptionPayment{
		ID:                rowID,
		SpecialistID:      s.ID,
		YooKassaPaymentID: "", // placeholder; set below after CreatePayment
		AmountKopecks:     plan.PriceKopecks,
		Currency:          "RUB",
		Status:            "pending",
		PlanCode:          plan.Code,
		PeriodStart:       periodStart,
		PeriodEnd:         periodEnd,
		IsRenewal:         true,
		CreatedAt:         now,
	}

	if err := db.CreateSubscriptionPayment(paymentRow); err != nil {
		log.Printf("ProcessRenewals: persist pending row error (specialist=%s): %v", s.ID, err)
		// Do not charge — safe to skip; next tick will retry (no row means no dedup guard).
		return
	}

	// Now charge, embedding the row ID so the webhook can locate our row even if the
	// yookassa_payment_id update below hasn't run yet.
	ykPayment, err := YooKassaClient.CreatePayment(ctx, payments.CreatePaymentParams{
		AmountKopecks:   plan.PriceKopecks,
		Description:     "Продление подписки Pro — " + plan.Code,
		PaymentMethodID: plainMethodID,
		IdempotenceKey:  stableKey,
		Metadata: map[string]string{
			"specialist_id":  s.ID,
			"plan_code":      plan.Code,
			"renewal":        "1",
			"payment_row_id": rowID,
		},
	})
	if err != nil {
		log.Printf("ProcessRenewals: CreatePayment error (specialist=%s): %v", s.ID, err)
		// Mark row failed; leave specialist status 'active' so the next tick retries
		// within the renewal window. The pending row just created will be 'failed', so
		// HasPendingRenewal (which only counts status='pending') won't block the retry.
		// The expiry sweep will set 'expired' if the period genuinely lapses.
		if updErr := db.UpdateSubscriptionPaymentStatus(rowID, "failed", nil, ""); updErr != nil {
			log.Printf("ProcessRenewals: mark row failed error (specialist=%s): %v", s.ID, updErr)
		}
		if NotifySubscriptionEventFunc != nil {
			NotifySubscriptionEventFunc(s.TelegramUserID, "subscription_payment_failed")
		}
		return
	}

	// Write the ЮКасса payment ID back onto our row now that we have it.
	if updErr := db.UpdateSubscriptionPaymentYooKassaID(rowID, ykPayment.ID); updErr != nil {
		log.Printf("ProcessRenewals: UpdateSubscriptionPaymentYooKassaID error (specialist=%s ykID=%s): %v",
			s.ID, ykPayment.ID, updErr)
		// Non-fatal: the webhook will find the row via metadata["payment_row_id"] fallback.
	}

	// Synchronous success handling: autopay sometimes returns succeeded immediately.
	if ykPayment.Status == "succeeded" || ykPayment.Paid {
		paidNow := now
		paymentRow.YooKassaPaymentID = ykPayment.ID
		paymentRow.PaidAt = &paidNow

		claimed, err := db.MarkSubscriptionPaymentSucceeded(rowID, now, "")
		if err != nil {
			log.Printf("ProcessRenewals: MarkSubscriptionPaymentSucceeded error (specialist=%s): %v", s.ID, err)
			return
		}
		if !claimed {
			// Already finalized (unlikely this fast, but guard anyway).
			return
		}

		// Re-fetch specialist to have the latest state.
		fresh, err := db.GetSpecialistByID(s.ID)
		if err != nil || fresh == nil {
			log.Printf("ProcessRenewals: re-fetch specialist error (id=%s): %v", s.ID, err)
			return
		}

		// Re-encrypt the method ID from the response if present; otherwise keep the
		// existing encrypted value stored on the specialist.
		encryptedMethodID := s.YooKassaPaymentMethodID // already encrypted
		if ykPayment.PaymentMethodID != "" && ykPayment.PaymentMethodID != plainMethodID {
			if enc, encErr := crypto.Encrypt(ykPayment.PaymentMethodID); encErr == nil {
				encryptedMethodID = enc
			}
		}

		if err := finalizeSuccessfulPayment(fresh, &paymentRow, encryptedMethodID); err != nil {
			log.Printf("ProcessRenewals: finalize error (specialist=%s): %v", s.ID, err)
			return
		}

		log.Printf("ProcessRenewals: subscription renewed synchronously (specialist=%s plan=%s)",
			s.ID, plan.Code)

		if NotifySubscriptionEventFunc != nil {
			NotifySubscriptionEventFunc(s.TelegramUserID, "subscription_renewed")
		}
		return
	}

	// Payment is pending — the webhook will finalize it.
	log.Printf("ProcessRenewals: renewal payment pending (specialist=%s ykID=%s)", s.ID, ykPayment.ID)
}

// ProcessExpirations sets subscription_status='expired' for specialists whose trial or paid
// period has lapsed and no renewal is in flight. Idempotent: only affects non-expired rows
// whose cutoff timestamp is in the past.
func ProcessExpirations(ctx context.Context) {
	// Lapsed trials.
	lapsedTrials, err := db.SpecialistsWithLapsedTrials()
	if err != nil {
		log.Printf("ProcessExpirations: lapsed trials query error: %v", err)
	} else {
		for i := range lapsedTrials {
			if ctx.Err() != nil {
				return
			}
			s := &lapsedTrials[i]
			if err := db.SetSubscriptionStatus(s.ID, "expired"); err != nil {
				log.Printf("ProcessExpirations: expire trial error (specialist=%s): %v", s.ID, err)
				continue
			}
			log.Printf("ProcessExpirations: trial expired (specialist=%s)", s.ID)
			if NotifySubscriptionEventFunc != nil {
				NotifySubscriptionEventFunc(s.TelegramUserID, "trial_expired")
			}
		}
	}

	// Lapsed paid periods (active/cancelled/past_due with no pending renewal).
	lapsedPeriods, err := db.SpecialistsWithLapsedPeriods()
	if err != nil {
		log.Printf("ProcessExpirations: lapsed periods query error: %v", err)
	} else {
		for i := range lapsedPeriods {
			if ctx.Err() != nil {
				return
			}
			s := &lapsedPeriods[i]
			if err := db.SetSubscriptionStatus(s.ID, "expired"); err != nil {
				log.Printf("ProcessExpirations: expire period error (specialist=%s): %v", s.ID, err)
				continue
			}
			log.Printf("ProcessExpirations: subscription expired (specialist=%s)", s.ID)
			if NotifySubscriptionEventFunc != nil {
				NotifySubscriptionEventFunc(s.TelegramUserID, "subscription_expired")
			}
		}
	}
}
