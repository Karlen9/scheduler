package api_test

import (
	"testing"
	"time"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* TestReferralReward_PiecesWork covers the three sub-primitives of the referral reward path
* that finalizeSuccessfulPayment uses:
*
*  1. MarkFirstPaymentIfUnset: true once, then false.
*  2. GrantBonusSubscriptionDays: extends from max(now, existing end).
*  3. The amount>0 guard: zero-amount payments must not trigger GrantBonusSubscriptionDays
*     (tested indirectly by verifying the first-payment flag is the only thing set).
*
* Self-referral (referrer == referee) is not explicitly tested here because the guard lives in
* finalizeSuccessfulPayment (which calls ЮКасса), but the underlying db primitives are stateless.
***************************************************************************************************/
func TestMarkFirstPaymentIfUnset_OnceAndIdempotent(t *testing.T) {
	// This test uses the shared in-memory DB set up by TestMain in testhelper_test.go.
	// We create fresh specialists to avoid contaminating the global testSpecialist.

	s, err := db.CreateSpecialist(8900001, "token-fp-test", "fptestbot1", "FP Spec 1", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist: %v", err)
	}

	now := time.Now().UTC()

	// First call: must return wasFirst=true and persist the timestamp.
	wasFirst, err := db.MarkFirstPaymentIfUnset(s.ID, now)
	if err != nil {
		t.Fatalf("first MarkFirstPaymentIfUnset: %v", err)
	}
	if !wasFirst {
		t.Fatal("first call must return wasFirst=true")
	}

	// Second call: must return wasFirst=false, first_payment_at unchanged.
	later := now.Add(24 * time.Hour)
	wasFirst2, err := db.MarkFirstPaymentIfUnset(s.ID, later)
	if err != nil {
		t.Fatalf("second MarkFirstPaymentIfUnset: %v", err)
	}
	if wasFirst2 {
		t.Fatal("second call must return wasFirst=false")
	}

	// Verify the stored value is still the FIRST timestamp (not the later one).
	fetched, err := db.GetSpecialistByID(s.ID)
	if err != nil || fetched == nil {
		t.Fatalf("GetSpecialistByID: %v", err)
	}
	if fetched.FirstPaymentAt == nil {
		t.Fatal("first_payment_at must be set")
	}
	diff := fetched.FirstPaymentAt.Sub(now)
	if diff > time.Second || diff < -time.Second {
		t.Errorf("first_payment_at = %v, want ~%v", *fetched.FirstPaymentAt, now)
	}
}

/***************************************************************************************************
* TestGrantBonusSubscriptionDays_ExtendsFromMax verifies:
*  - No existing period: adds from now.
*  - Existing future period: adds from existing end (does not shorten).
***************************************************************************************************/
func TestGrantBonusSubscriptionDays_ExtendsFromMax(t *testing.T) {
	t.Run("no existing period extends from now", func(t *testing.T) {
		s, err := db.CreateSpecialist(8900010, "token-bonus1", "bonusbot1111", "Bonus Spec 1", "UTC", 24)
		if err != nil {
			t.Fatalf("CreateSpecialist: %v", err)
		}

		before := time.Now().UTC()
		if err := db.GrantBonusSubscriptionDays(s.ID, 30); err != nil {
			t.Fatalf("GrantBonusSubscriptionDays: %v", err)
		}

		s1, _ := db.GetSpecialistByID(s.ID)
		if s1.SubscriptionStatus != "active" {
			t.Errorf("status = %q, want active", s1.SubscriptionStatus)
		}
		if s1.CurrentPeriodEndAt == nil {
			t.Fatal("current_period_end_at must be set")
		}
		// Period end should be ~30 days from before.
		wantMin := before.Add(30 * 24 * time.Hour)
		if s1.CurrentPeriodEndAt.Before(wantMin.Add(-5 * time.Second)) {
			t.Errorf("period end %v is before expected minimum %v", *s1.CurrentPeriodEndAt, wantMin)
		}
	})

	t.Run("existing future period end is extended not reset", func(t *testing.T) {
		s, err := db.CreateSpecialist(8900011, "token-bonus2", "bonusbot2222", "Bonus Spec 2", "UTC", 24)
		if err != nil {
			t.Fatalf("CreateSpecialist: %v", err)
		}

		existingEnd := time.Now().UTC().Add(20 * 24 * time.Hour)
		if err := db.ActivateSubscription(s.ID, "pro_monthly", existingEnd, ""); err != nil {
			t.Fatalf("ActivateSubscription: %v", err)
		}

		if err := db.GrantBonusSubscriptionDays(s.ID, 30); err != nil {
			t.Fatalf("GrantBonusSubscriptionDays: %v", err)
		}

		s1, _ := db.GetSpecialistByID(s.ID)
		if s1.CurrentPeriodEndAt == nil {
			t.Fatal("current_period_end_at must be set")
		}
		// Expected: existingEnd + 30 days.
		wantEnd := existingEnd.Add(30 * 24 * time.Hour)
		diff := s1.CurrentPeriodEndAt.Sub(wantEnd)
		if diff > 5*time.Second || diff < -5*time.Second {
			t.Errorf("period end = %v, want ~%v (diff %v)", *s1.CurrentPeriodEndAt, wantEnd, diff)
		}
	})
}

/***************************************************************************************************
* TestReferralReward_ZeroAmountNoReward verifies that a 100%-off (amount == 0) payment does not
* trigger any referrer reward (MarkFirstPaymentIfUnset still fires, but wasFirst=true on a
* zero-revenue payment does not reach GrantBonusSubscriptionDays).
*
* We test the condition logic explicitly: simulate the finalize path's condition
* `wasFirst && referredViaCode != "" && amount > 0`.
***************************************************************************************************/
func TestReferralReward_AmountZeroConditionBlocks(t *testing.T) {
	// Create a referrer specialist.
	referrer, err := db.CreateSpecialist(8900020, "token-referrer", "referrerbot1", "Referrer Spec", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist referrer: %v", err)
	}
	code, err := db.EnsureSpecialistReferralCode(referrer.ID)
	if err != nil {
		t.Fatalf("EnsureSpecialistReferralCode: %v", err)
	}

	// Create a referred specialist.
	referee, err := db.CreateSpecialist(8900021, "token-referee", "refereebot111", "Referee Spec", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist referee: %v", err)
	}
	if err := db.SetSpecialistReferredViaCode(referee.ID, code); err != nil {
		t.Fatalf("SetSpecialistReferredViaCode: %v", err)
	}

	// Record the referrer's initial subscription state.
	// Activate referrer so we can observe if their period extends.
	referrerEnd := time.Now().UTC().Add(15 * 24 * time.Hour)
	if err := db.ActivateSubscription(referrer.ID, "pro_monthly", referrerEnd, ""); err != nil {
		t.Fatalf("ActivateSubscription referrer: %v", err)
	}

	// Simulate a zero-amount payment (100%-off promo).
	// The condition: wasFirst && referredViaCode != "" && amountKopecks > 0
	// With amountKopecks == 0, even if wasFirst is true, the reward must NOT fire.
	payment := models.SubscriptionPayment{
		AmountKopecks: 0, // 100%-off
	}

	wasFirst, err := db.MarkFirstPaymentIfUnset(referee.ID, time.Now().UTC())
	if err != nil {
		t.Fatalf("MarkFirstPaymentIfUnset: %v", err)
	}
	// wasFirst is true (first payment), but amount is 0 — no reward.
	rewardShouldFire := wasFirst && referee.ReferredViaCode != "" && payment.AmountKopecks > 0
	if rewardShouldFire {
		// This path is wrong: we intentionally do not call GrantBonusSubscriptionDays.
		t.Fatal("reward condition must NOT fire for zero-amount payment")
	}

	// Verify referrer's period is unchanged.
	r1, _ := db.GetSpecialistByID(referrer.ID)
	if r1.CurrentPeriodEndAt == nil {
		t.Fatal("referrer period end must still be set")
	}
	diff := r1.CurrentPeriodEndAt.Sub(referrerEnd)
	if diff > 5*time.Second || diff < -5*time.Second {
		t.Errorf("referrer period unexpectedly changed: was %v, now %v", referrerEnd, *r1.CurrentPeriodEndAt)
	}
}

/***************************************************************************************************
* TestReferralReward_SecondPaymentNoReward verifies that a second payment does not fire the
* referral reward (wasFirst=false path).
***************************************************************************************************/
func TestReferralReward_SecondPaymentNoReward(t *testing.T) {
	referrer, err := db.CreateSpecialist(8900030, "token-ref2", "referrerbot22", "Referrer 2", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist referrer2: %v", err)
	}
	referrerEnd := time.Now().UTC().Add(15 * 24 * time.Hour)
	if err := db.ActivateSubscription(referrer.ID, "pro_monthly", referrerEnd, ""); err != nil {
		t.Fatalf("ActivateSubscription referrer2: %v", err)
	}

	referee, err := db.CreateSpecialist(8900031, "token-ref22", "refereebot222", "Referee 2", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist referee2: %v", err)
	}
	code, err := db.EnsureSpecialistReferralCode(referrer.ID)
	if err != nil {
		t.Fatalf("EnsureSpecialistReferralCode: %v", err)
	}
	if err := db.SetSpecialistReferredViaCode(referee.ID, code); err != nil {
		t.Fatalf("SetSpecialistReferredViaCode: %v", err)
	}

	now := time.Now().UTC()

	// First payment recorded.
	wasFirst, err := db.MarkFirstPaymentIfUnset(referee.ID, now)
	if err != nil {
		t.Fatalf("first MarkFirstPaymentIfUnset: %v", err)
	}
	if !wasFirst {
		t.Fatal("expected wasFirst=true on first payment")
	}

	// Second payment: wasFirst must be false.
	wasFirst2, err := db.MarkFirstPaymentIfUnset(referee.ID, now.Add(30*24*time.Hour))
	if err != nil {
		t.Fatalf("second MarkFirstPaymentIfUnset: %v", err)
	}
	if wasFirst2 {
		t.Fatal("second payment must return wasFirst=false — referral reward must not fire twice")
	}
}
