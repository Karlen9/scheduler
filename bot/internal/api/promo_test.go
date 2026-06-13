package api_test

import (
	"testing"
	"time"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/config"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

// ---------------------------------------------------------------------------
// ApplyPromo — pure arithmetic; no DB needed
// ---------------------------------------------------------------------------

/***************************************************************************************************
* TestApplyPromo verifies the discount arithmetic for percent, amount, 100%, over-cap, and
* unknown discount_type cases.
***************************************************************************************************/
func TestApplyPromo(t *testing.T) {
	monthly, _ := config.SubscriptionPlanByCode("pro_monthly")

	tests := []struct {
		name         string
		plan         config.SubscriptionPlan
		promo        models.PromoCode
		wantFinal    int
		wantDiscount int
	}{
		{
			name: "50% off monthly gives correct half-price",
			plan: monthly, // 59000 kopecks
			promo: models.PromoCode{
				DiscountType:  "percent",
				DiscountValue: 50,
			},
			wantFinal:    29500,
			wantDiscount: 29500,
		},
		{
			name: "100% off yields final 0 and discount equals full price",
			plan: monthly,
			promo: models.PromoCode{
				DiscountType:  "percent",
				DiscountValue: 100,
			},
			wantFinal:    0,
			wantDiscount: 59000,
		},
		{
			name: "fixed amount discount",
			plan: monthly,
			promo: models.PromoCode{
				DiscountType:  "amount",
				DiscountValue: 10000,
			},
			wantFinal:    49000,
			wantDiscount: 10000,
		},
		{
			name: "amount discount >= price clamps final to 0",
			plan: monthly,
			promo: models.PromoCode{
				DiscountType:  "amount",
				DiscountValue: 99999,
			},
			wantFinal:    0,
			wantDiscount: 59000,
		},
		{
			name: "unknown discount_type applies zero discount",
			plan: monthly,
			promo: models.PromoCode{
				DiscountType:  "bogus",
				DiscountValue: 50,
			},
			wantFinal:    59000,
			wantDiscount: 0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			final, discount := api.ApplyPromo(tc.plan, &tc.promo)
			if final != tc.wantFinal {
				t.Errorf("finalKopecks = %d, want %d", final, tc.wantFinal)
			}
			if discount != tc.wantDiscount {
				t.Errorf("discountKopecks = %d, want %d", discount, tc.wantDiscount)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// ValidatePromoForSpecialist — requires DB (uses testSpecialist via TestMain)
// ---------------------------------------------------------------------------

// seedPromo inserts a promo_codes row and returns the stored object.
func seedPromo(t *testing.T, p models.PromoCode) models.PromoCode {
	t.Helper()
	if err := db.CreatePromoCode(p); err != nil {
		t.Fatalf("seedPromo CreatePromoCode: %v", err)
	}
	got, err := db.GetPromoCodeByCode(p.Code)
	if err != nil || got == nil {
		t.Fatalf("seedPromo GetPromoCodeByCode: err=%v got=%v", err, got)
	}
	return *got
}

/***************************************************************************************************
* TestValidatePromoForSpecialist covers valid and all invalid-code scenarios.
***************************************************************************************************/
func TestValidatePromoForSpecialist(t *testing.T) {
	now := time.Now().UTC()
	past := now.Add(-48 * time.Hour)
	future := now.Add(48 * time.Hour)

	// Create a throwaway specialist for the "already redeemed" case.
	throwaway, err := db.CreateSpecialist(8800001, "token-promo-test", "promobottest", "Promo Test Specialist", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}

	planCode := "pro_monthly"

	// ---- valid code ----
	validPromo := seedPromo(t, models.PromoCode{
		Code:          "VALID10",
		DiscountType:  "percent",
		DiscountValue: 10,
		IsActive:      true,
	})

	t.Run("valid code returns ok=true and correct prices", func(t *testing.T) {
		p, final, discount, reason, ok := api.ValidatePromoForSpecialist("VALID10", planCode, throwaway.ID)
		if !ok {
			t.Fatalf("expected ok=true, got reason=%q", reason)
		}
		if p == nil {
			t.Fatal("expected non-nil promo")
		}
		if p.ID != validPromo.ID {
			t.Errorf("promo ID mismatch")
		}
		monthly, _ := config.SubscriptionPlanByCode(planCode)
		wantDiscount := monthly.PriceKopecks * 10 / 100
		wantFinal := monthly.PriceKopecks - wantDiscount
		if final != wantFinal {
			t.Errorf("final = %d, want %d", final, wantFinal)
		}
		if discount != wantDiscount {
			t.Errorf("discount = %d, want %d", discount, wantDiscount)
		}
	})

	// ---- inactive code ----
	seedPromo(t, models.PromoCode{
		Code:          "INACTIVE1",
		DiscountType:  "percent",
		DiscountValue: 10,
		IsActive:      false,
	})

	t.Run("inactive code returns reason Promo.Inactive", func(t *testing.T) {
		_, _, _, reason, ok := api.ValidatePromoForSpecialist("INACTIVE1", planCode, throwaway.ID)
		if ok {
			t.Fatal("expected ok=false for inactive code")
		}
		if reason != "Promo.Inactive" {
			t.Errorf("reason = %q, want Promo.Inactive", reason)
		}
	})

	// ---- expired code (valid_until in the past) ----
	seedPromo(t, models.PromoCode{
		Code:          "EXPIRED1",
		DiscountType:  "percent",
		DiscountValue: 10,
		IsActive:      true,
		ValidUntil:    &past,
	})

	t.Run("expired code returns reason Promo.Expired", func(t *testing.T) {
		_, _, _, reason, ok := api.ValidatePromoForSpecialist("EXPIRED1", planCode, throwaway.ID)
		if ok {
			t.Fatal("expected ok=false for expired code")
		}
		if reason != "Promo.Expired" {
			t.Errorf("reason = %q, want Promo.Expired", reason)
		}
	})

	// ---- not-yet-valid code (valid_from in the future) ----
	seedPromo(t, models.PromoCode{
		Code:          "FUTURE1",
		DiscountType:  "percent",
		DiscountValue: 10,
		IsActive:      true,
		ValidFrom:     &future,
	})

	t.Run("not-yet-valid code returns reason Promo.NotYetValid", func(t *testing.T) {
		_, _, _, reason, ok := api.ValidatePromoForSpecialist("FUTURE1", planCode, throwaway.ID)
		if ok {
			t.Fatal("expected ok=false for not-yet-valid code")
		}
		if reason != "Promo.NotYetValid" {
			t.Errorf("reason = %q, want Promo.NotYetValid", reason)
		}
	})

	// ---- wrong applies_to_plan ----
	seedPromo(t, models.PromoCode{
		Code:          "WRONGPLAN",
		DiscountType:  "percent",
		DiscountValue: 10,
		IsActive:      true,
		AppliesToPlan: "pro_annual",
	})

	t.Run("wrong plan code returns reason Promo.WrongPlan", func(t *testing.T) {
		_, _, _, reason, ok := api.ValidatePromoForSpecialist("WRONGPLAN", planCode, throwaway.ID)
		if ok {
			t.Fatal("expected ok=false for wrong plan")
		}
		if reason != "Promo.WrongPlan" {
			t.Errorf("reason = %q, want Promo.WrongPlan", reason)
		}
	})

	// ---- max_redemptions exhausted ----
	maxOne := 1
	exhaustedPromo := seedPromo(t, models.PromoCode{
		Code:           "EXHAUST1",
		DiscountType:   "percent",
		DiscountValue:  10,
		IsActive:       true,
		MaxRedemptions: &maxOne,
	})
	// Record one redemption to hit the cap.
	if err := db.RecordPromoRedemption(models.PromoRedemption{
		PromoCodeID:  exhaustedPromo.ID,
		SpecialistID: throwaway.ID,
	}); err != nil {
		t.Fatalf("seed redemption: %v", err)
	}

	t.Run("exhausted code returns reason Promo.Exhausted", func(t *testing.T) {
		// Use a different specialist so "already redeemed" doesn't fire first.
		other, err := db.CreateSpecialist(8800002, "token-promo-other", "promootherbott", "Other Promo Spec", "UTC", 24)
		if err != nil {
			t.Fatalf("CreateSpecialist: %v", err)
		}
		_, _, _, reason, ok := api.ValidatePromoForSpecialist("EXHAUST1", planCode, other.ID)
		if ok {
			t.Fatal("expected ok=false for exhausted code")
		}
		if reason != "Promo.Exhausted" {
			t.Errorf("reason = %q, want Promo.Exhausted", reason)
		}
	})

	// ---- already redeemed by this specialist ----
	t.Run("already-redeemed code returns reason Promo.AlreadyUsed", func(t *testing.T) {
		// throwaway already redeemed EXHAUST1 above. Use VALID10 — re-seed redemption for throwaway.
		if err := db.RecordPromoRedemption(models.PromoRedemption{
			PromoCodeID:  validPromo.ID,
			SpecialistID: throwaway.ID,
		}); err != nil {
			t.Fatalf("seed second redemption: %v", err)
		}
		_, _, _, reason, ok := api.ValidatePromoForSpecialist("VALID10", planCode, throwaway.ID)
		if ok {
			t.Fatal("expected ok=false for already used code")
		}
		if reason != "Promo.AlreadyUsed" {
			t.Errorf("reason = %q, want Promo.AlreadyUsed", reason)
		}
	})
}
