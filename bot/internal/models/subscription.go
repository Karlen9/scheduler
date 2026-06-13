package models

import "time"

// PromoCode represents a discount code that can be applied at checkout.
type PromoCode struct {
	ID                   string     `json:"id"`
	Code                 string     `json:"code"`
	DiscountType         string     `json:"discountType"`  // "percent" | "amount"
	DiscountValue        int        `json:"discountValue"` // percent 0-100, or kopecks
	DurationDays         int        `json:"durationDays"`  // 0 = use plan's own duration
	MaxRedemptions       *int       `json:"maxRedemptions,omitempty"`
	RedemptionsCount     int        `json:"redemptionsCount"`
	ValidFrom            *time.Time `json:"validFrom,omitempty"`
	ValidUntil           *time.Time `json:"validUntil,omitempty"`
	AppliesToPlan        string     `json:"appliesToPlan"` // empty = any plan
	ReferralSpecialistID string     `json:"referralSpecialistId,omitempty"`
	IsActive             bool       `json:"isActive"`
	CreatedAt            time.Time  `json:"createdAt"`
}

// PromoRedemption records a single use of a promo code by a specialist.
type PromoRedemption struct {
	ID              string    `json:"id"`
	PromoCodeID     string    `json:"promoCodeId"`
	SpecialistID    string    `json:"specialistId"`
	PaymentID       string    `json:"paymentId,omitempty"`
	DiscountKopecks int       `json:"discountKopecks"`
	CreatedAt       time.Time `json:"createdAt"`
}

// ErrPromoExhausted is returned by RecordPromoRedemption when the code has hit its
// max_redemptions cap and the slot cannot be claimed.
var ErrPromoExhausted = &promoError{"promo code exhausted"}

type promoError struct{ msg string }

func (e *promoError) Error() string { return e.msg }

// SubscriptionPayment records a single ЮКасса payment attempt (new purchase or renewal).
type SubscriptionPayment struct {
	ID                string
	SpecialistID      string
	YooKassaPaymentID string
	AmountKopecks     int
	Currency          string
	Status            string // pending | succeeded | canceled | failed
	PlanCode          string
	PromoCode         string
	DiscountKopecks   int
	PeriodStart       time.Time
	PeriodEnd         time.Time
	IsRenewal         bool
	PaymentMethodID   string // encrypted; non-empty after payment succeeds
	CreatedAt         time.Time
	PaidAt            *time.Time
	RawPayload        string
}

// Entitlement describes a specialist's current Pro access status.
type Entitlement struct {
	IsPro  bool
	Until  time.Time
	Reason string
}

// Entitlement computes the specialist's Pro access status at the given point in time.
// All timestamp comparisons are nil-safe.
func (s *Specialist) Entitlement(now time.Time) Entitlement {
	switch s.SubscriptionStatus {
	case "trialing":
		if s.TrialEndsAt != nil && now.Before(*s.TrialEndsAt) {
			return Entitlement{IsPro: true, Until: *s.TrialEndsAt, Reason: "trial"}
		}
		return Entitlement{}
	case "active", "cancelled":
		if s.CurrentPeriodEndAt != nil && now.Before(*s.CurrentPeriodEndAt) {
			return Entitlement{IsPro: true, Until: *s.CurrentPeriodEndAt, Reason: s.SubscriptionStatus}
		}
		return Entitlement{}
	default:
		// none / past_due / expired / empty
		return Entitlement{}
	}
}

// IsPro returns true if the specialist has active Pro access at the given point in time.
func (s *Specialist) IsPro(now time.Time) bool {
	return s.Entitlement(now).IsPro
}
