package api

import (
	"time"

	"scheduler-bot/internal/config"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

// ApplyPromo computes the final price and discount amount in kopecks for a given plan and
// promo code. Integer math only — no floats.
func ApplyPromo(plan config.SubscriptionPlan, promo *models.PromoCode) (finalKopecks int, discountKopecks int) {
	price := plan.PriceKopecks
	var discount int
	switch promo.DiscountType {
	case "percent":
		discount = price * promo.DiscountValue / 100
	case "amount":
		discount = promo.DiscountValue
	default:
		// Unknown discount type — should never be stored (creation validates the type),
		// but treat as zero discount as a safety net rather than panicking.
		discount = 0
	}
	final := price - discount
	if final < 0 {
		final = 0
	}
	return final, price - final
}

// ValidatePromoForSpecialist checks whether a promo code is valid for the given plan and
// specialist at the current moment. On success, it returns the promo, finalKopecks, and
// discountKopecks. On failure, ok is false and reason is a human-readable key (e.g.
// "Promo.NotFound") describing why.
func ValidatePromoForSpecialist(
	code, planCode, specialistID string,
) (promo *models.PromoCode, finalKopecks, discountKopecks int, reason string, ok bool) {
	plan, planOK := config.SubscriptionPlanByCode(planCode)
	if !planOK {
		return nil, 0, 0, "Promo.InvalidPlan", false
	}

	p, err := db.GetPromoCodeByCode(code)
	if err != nil {
		return nil, 0, 0, "Promo.LookupError", false
	}
	if p == nil {
		return nil, 0, 0, "Promo.NotFound", false
	}

	if !p.IsActive {
		return nil, 0, 0, "Promo.Inactive", false
	}

	now := time.Now().UTC()
	if p.ValidFrom != nil && now.Before(*p.ValidFrom) {
		return nil, 0, 0, "Promo.NotYetValid", false
	}
	if p.ValidUntil != nil && now.After(*p.ValidUntil) {
		return nil, 0, 0, "Promo.Expired", false
	}

	if p.AppliesToPlan != "" && p.AppliesToPlan != planCode {
		return nil, 0, 0, "Promo.WrongPlan", false
	}

	// Check redemption cap — uses the count already stored to avoid a race; the real
	// atomic cap enforcement happens in RecordPromoRedemption.
	if p.MaxRedemptions != nil && p.RedemptionsCount >= *p.MaxRedemptions {
		return nil, 0, 0, "Promo.Exhausted", false
	}

	redeemed, err := db.HasSpecialistRedeemed(p.ID, specialistID)
	if err != nil {
		return nil, 0, 0, "Promo.LookupError", false
	}
	if redeemed {
		return nil, 0, 0, "Promo.AlreadyUsed", false
	}

	final, discount := ApplyPromo(plan, p)
	return p, final, discount, "", true
}
