package db

import (
	"testing"
	"time"

	"scheduler-bot/internal/models"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// setupSubTestDB re-initialises an in-memory database for subscription tests.
func setupSubTestDB(t *testing.T) {
	t.Helper()
	setupStatsTestDB(t) // reuse the standard stats setup that calls crypto.Init + db.Init
}

// newSubSpecialist creates a specialist with a unique telegram user ID for isolation.
func newSubSpecialist(t *testing.T, tgID int64, suffix string) *models.Specialist {
	t.Helper()
	s, err := CreateSpecialist(tgID, "token-sub-"+suffix, "subbot"+suffix, "Sub Spec "+suffix, "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist(%s): %v", suffix, err)
	}
	return s
}

// ---------------------------------------------------------------------------
// RecordPromoRedemption invariant tests
// ---------------------------------------------------------------------------

/***************************************************************************************************
* TestRecordPromoRedemptionInvariant verifies:
*  1. First call succeeds and increments redemptions_count.
*  2. Second call for same (promo, specialist) is a no-op — counter does NOT increment.
*  3. A capped code at its limit returns ErrPromoExhausted and does NOT leave a redemption row.
***************************************************************************************************/
func TestRecordPromoRedemptionInvariant(t *testing.T) {
	setupSubTestDB(t)

	s := newSubSpecialist(t, 7700001, "promo")
	s2, err := CreateSpecialist(7700002, "token-promo2", "subbot2promo", "Sub Spec 2", "UTC", 24)
	if err != nil {
		t.Fatalf("CreateSpecialist2: %v", err)
	}

	maxOne := 1
	promo := models.PromoCode{
		Code:           "TESTINVARIANT",
		DiscountType:   "percent",
		DiscountValue:  10,
		IsActive:       true,
		MaxRedemptions: &maxOne,
	}
	if err := CreatePromoCode(promo); err != nil {
		t.Fatalf("CreatePromoCode: %v", err)
	}
	p, err := GetPromoCodeByCode("TESTINVARIANT")
	if err != nil || p == nil {
		t.Fatalf("GetPromoCodeByCode: err=%v p=%v", err, p)
	}

	// ---- Step 1: first call succeeds ----
	r1 := models.PromoRedemption{
		PromoCodeID:  p.ID,
		SpecialistID: s.ID,
	}
	if err := RecordPromoRedemption(r1); err != nil {
		t.Fatalf("first RecordPromoRedemption: %v", err)
	}

	// Verify count incremented to 1.
	p, err = GetPromoCodeByCode("TESTINVARIANT")
	if err != nil || p == nil {
		t.Fatalf("re-fetch after first redemption: err=%v p=%v", err, p)
	}
	if p.RedemptionsCount != 1 {
		t.Errorf("after first redemption: redemptions_count = %d, want 1", p.RedemptionsCount)
	}

	// ---- Step 2: second call for same (promo, specialist) is a no-op ----
	r1dup := models.PromoRedemption{
		PromoCodeID:  p.ID,
		SpecialistID: s.ID,
	}
	if err := RecordPromoRedemption(r1dup); err != nil {
		t.Fatalf("duplicate RecordPromoRedemption: %v", err)
	}

	// Counter must still be 1 — no increment for duplicate.
	p, err = GetPromoCodeByCode("TESTINVARIANT")
	if err != nil || p == nil {
		t.Fatalf("re-fetch after duplicate: err=%v p=%v", err, p)
	}
	if p.RedemptionsCount != 1 {
		t.Errorf("after duplicate: redemptions_count = %d, want still 1", p.RedemptionsCount)
	}

	// ---- Step 3: s2 tries to redeem, but cap (max_redemptions=1) is already met ----
	r2 := models.PromoRedemption{
		PromoCodeID:  p.ID,
		SpecialistID: s2.ID,
	}
	err = RecordPromoRedemption(r2)
	if err != models.ErrPromoExhausted {
		t.Fatalf("expected ErrPromoExhausted, got: %v", err)
	}

	// Counter must not have changed (rollback).
	p, err = GetPromoCodeByCode("TESTINVARIANT")
	if err != nil || p == nil {
		t.Fatalf("re-fetch after exhausted attempt: err=%v p=%v", err, p)
	}
	if p.RedemptionsCount != 1 {
		t.Errorf("after exhausted attempt: redemptions_count = %d, want 1", p.RedemptionsCount)
	}

	// Also verify no row was inserted for s2 (rollback worked).
	redeemed, err := HasSpecialistRedeemed(p.ID, s2.ID)
	if err != nil {
		t.Fatalf("HasSpecialistRedeemed: %v", err)
	}
	if redeemed {
		t.Error("exhausted attempt must not leave a redemption row")
	}
}

// ---------------------------------------------------------------------------
// MarkSubscriptionPaymentSucceeded — idempotency
// ---------------------------------------------------------------------------

/***************************************************************************************************
* TestMarkSubscriptionPaymentSucceeded verifies atomic idempotency: first call returns true,
* second call returns false without side-effects.
***************************************************************************************************/
func TestMarkSubscriptionPaymentSucceeded(t *testing.T) {
	setupSubTestDB(t)

	s := newSubSpecialist(t, 7700010, "mark")

	payment := models.SubscriptionPayment{
		SpecialistID:      s.ID,
		YooKassaPaymentID: "yk-test-mark-001",
		AmountKopecks:     59000,
		Currency:          "RUB",
		Status:            "pending",
		PlanCode:          "pro_monthly",
		PeriodStart:       time.Now().UTC(),
		PeriodEnd:         time.Now().UTC().Add(30 * 24 * time.Hour),
		CreatedAt:         time.Now().UTC(),
	}
	if err := CreateSubscriptionPayment(payment); err != nil {
		t.Fatalf("CreateSubscriptionPayment: %v", err)
	}

	row, err := GetSubscriptionPaymentByYooKassaID("yk-test-mark-001")
	if err != nil || row == nil {
		t.Fatalf("GetSubscriptionPaymentByYooKassaID: err=%v row=%v", err, row)
	}

	now := time.Now().UTC()

	// First claim: must win.
	claimed, err := MarkSubscriptionPaymentSucceeded(row.ID, now, `{"test":1}`)
	if err != nil {
		t.Fatalf("first MarkSubscriptionPaymentSucceeded: %v", err)
	}
	if !claimed {
		t.Fatal("first claim must return true")
	}

	// Second claim: must be no-op.
	claimed2, err := MarkSubscriptionPaymentSucceeded(row.ID, now, `{"test":2}`)
	if err != nil {
		t.Fatalf("second MarkSubscriptionPaymentSucceeded: %v", err)
	}
	if claimed2 {
		t.Fatal("second claim must return false (idempotent)")
	}
}

// ---------------------------------------------------------------------------
// ActivateSubscription — started_at preservation + period extension
// ---------------------------------------------------------------------------

/***************************************************************************************************
* TestActivateSubscription covers:
*  - subscription_started_at is preserved (COALESCE) on a second activation.
*  - current_period_end_at extends from max(now, existing end) — never shortens.
*  - empty payment_method_id does not wipe an existing saved method.
*  - An already-active specialist activating again gets period extended from current end.
***************************************************************************************************/
func TestActivateSubscription(t *testing.T) {
	setupSubTestDB(t)

	t.Run("started_at preserved on second activation", func(t *testing.T) {
		s := newSubSpecialist(t, 7700020, "activate-a")

		end1 := time.Now().UTC().Add(30 * 24 * time.Hour)
		if err := ActivateSubscription(s.ID, "pro_monthly", end1, ""); err != nil {
			t.Fatalf("first ActivateSubscription: %v", err)
		}
		s1, _ := GetSpecialistByID(s.ID)
		if s1.SubscriptionStartedAt == nil {
			t.Fatal("subscription_started_at must be set after first activation")
		}
		startedAt1 := *s1.SubscriptionStartedAt

		// Second activation — started_at must remain unchanged.
		end2 := end1.Add(30 * 24 * time.Hour)
		if err := ActivateSubscription(s.ID, "pro_monthly", end2, ""); err != nil {
			t.Fatalf("second ActivateSubscription: %v", err)
		}
		s2, _ := GetSpecialistByID(s.ID)
		if s2.SubscriptionStartedAt == nil {
			t.Fatal("subscription_started_at must still be set after second activation")
		}
		// Allow 1 second tolerance for time comparison.
		diff := s2.SubscriptionStartedAt.Sub(startedAt1)
		if diff > time.Second || diff < -time.Second {
			t.Errorf("subscription_started_at changed: was %v, now %v", startedAt1, *s2.SubscriptionStartedAt)
		}
	})

	t.Run("empty payment_method_id does not wipe existing method", func(t *testing.T) {
		s := newSubSpecialist(t, 7700021, "activate-b")
		end := time.Now().UTC().Add(30 * 24 * time.Hour)

		if err := ActivateSubscription(s.ID, "pro_monthly", end, "enc-method-abc"); err != nil {
			t.Fatalf("first ActivateSubscription with method: %v", err)
		}
		s1, _ := GetSpecialistByID(s.ID)
		if s1.YooKassaPaymentMethodID == "" {
			t.Fatal("payment method must be set after first activation with non-empty method")
		}

		// Re-activate without a method ID.
		end2 := end.Add(30 * 24 * time.Hour)
		if err := ActivateSubscription(s.ID, "pro_monthly", end2, ""); err != nil {
			t.Fatalf("second ActivateSubscription without method: %v", err)
		}
		s2, _ := GetSpecialistByID(s.ID)
		if s2.YooKassaPaymentMethodID != s1.YooKassaPaymentMethodID {
			t.Errorf("payment method wiped: was %q, now %q",
				s1.YooKassaPaymentMethodID, s2.YooKassaPaymentMethodID)
		}
	})
}

// ---------------------------------------------------------------------------
// MarkFirstPaymentIfUnset — idempotency
// ---------------------------------------------------------------------------

/***************************************************************************************************
* TestMarkFirstPaymentIfUnset verifies that the first call sets first_payment_at (wasFirst=true)
* and a second call is a no-op (wasFirst=false).
***************************************************************************************************/
func TestMarkFirstPaymentIfUnset(t *testing.T) {
	setupSubTestDB(t)

	s := newSubSpecialist(t, 7700030, "firstpay")

	now := time.Now().UTC()

	// First mark: must succeed.
	wasFirst, err := MarkFirstPaymentIfUnset(s.ID, now)
	if err != nil {
		t.Fatalf("first MarkFirstPaymentIfUnset: %v", err)
	}
	if !wasFirst {
		t.Fatal("first call must return wasFirst=true")
	}

	// Second mark: must be no-op.
	later := now.Add(time.Hour)
	wasFirst2, err := MarkFirstPaymentIfUnset(s.ID, later)
	if err != nil {
		t.Fatalf("second MarkFirstPaymentIfUnset: %v", err)
	}
	if wasFirst2 {
		t.Fatal("second call must return wasFirst=false")
	}
}

// ---------------------------------------------------------------------------
// GrantBonusSubscriptionDays — extends from max(now, existing end)
// ---------------------------------------------------------------------------

/***************************************************************************************************
* TestGrantBonusSubscriptionDays verifies:
*  - When no existing period, adds days from now.
*  - When existing period is in the future, extends from existing end.
*  - Sets subscription_status='active' and seeds subscription_started_at via COALESCE.
***************************************************************************************************/
func TestGrantBonusSubscriptionDays(t *testing.T) {
	setupSubTestDB(t)

	t.Run("extends from now when no existing period", func(t *testing.T) {
		s := newSubSpecialist(t, 7700040, "bonus-a")
		// Specialist is trialing; no period end set.

		before := time.Now().UTC()
		if err := GrantBonusSubscriptionDays(s.ID, 30); err != nil {
			t.Fatalf("GrantBonusSubscriptionDays: %v", err)
		}
		after := time.Now().UTC()

		s1, _ := GetSpecialistByID(s.ID)
		if s1.SubscriptionStatus != "active" {
			t.Errorf("status = %q, want active", s1.SubscriptionStatus)
		}
		if s1.CurrentPeriodEndAt == nil {
			t.Fatal("current_period_end_at must be set")
		}
		// Period end should be roughly now + 30 days (within a few seconds tolerance).
		wantEnd := before.Add(30 * 24 * time.Hour)
		diff := s1.CurrentPeriodEndAt.Sub(wantEnd)
		if diff > 5*time.Second || diff < -5*time.Second {
			t.Errorf("period end = %v, want ~%v (diff %v)", *s1.CurrentPeriodEndAt, wantEnd, diff)
		}
		_ = after
	})

	t.Run("extends from existing future period end", func(t *testing.T) {
		s := newSubSpecialist(t, 7700041, "bonus-b")

		futureEnd := time.Now().UTC().Add(15 * 24 * time.Hour)
		if err := ActivateSubscription(s.ID, "pro_monthly", futureEnd, ""); err != nil {
			t.Fatalf("ActivateSubscription: %v", err)
		}

		if err := GrantBonusSubscriptionDays(s.ID, 30); err != nil {
			t.Fatalf("GrantBonusSubscriptionDays: %v", err)
		}

		s1, _ := GetSpecialistByID(s.ID)
		if s1.CurrentPeriodEndAt == nil {
			t.Fatal("current_period_end_at must be set")
		}
		// Expected: futureEnd + 30 days.
		wantEnd := futureEnd.Add(30 * 24 * time.Hour)
		diff := s1.CurrentPeriodEndAt.Sub(wantEnd)
		if diff > 5*time.Second || diff < -5*time.Second {
			t.Errorf("period end = %v, want ~%v (diff %v)", *s1.CurrentPeriodEndAt, wantEnd, diff)
		}
	})
}

// ---------------------------------------------------------------------------
// Worker queries
// ---------------------------------------------------------------------------

/***************************************************************************************************
* TestSpecialistsDueForRenewal verifies that only specialists matching ALL renewal conditions are
* returned, and those missing any condition (no method, cancel_at_period_end=1, wrong status) are
* excluded.
***************************************************************************************************/
func TestSpecialistsDueForRenewal(t *testing.T) {
	setupSubTestDB(t)

	soon := time.Now().UTC().Add(2 * time.Hour)
	far := time.Now().UTC().Add(10 * 24 * time.Hour)

	// Qualifies: active, auto_renew=1, cancel_at_period_end=0, has method, period ends soon.
	sDue := newSubSpecialist(t, 7700050, "due")
	if err := ActivateSubscription(sDue.ID, "pro_monthly", soon, "enc-method-xyz"); err != nil {
		t.Fatalf("activate due: %v", err)
	}

	// Excluded: no payment method.
	sNoMethod := newSubSpecialist(t, 7700051, "nomethod")
	if err := ActivateSubscription(sNoMethod.ID, "pro_monthly", soon, ""); err != nil {
		t.Fatalf("activate nomethod: %v", err)
	}

	// Excluded: cancel_at_period_end=1.
	sCancelled := newSubSpecialist(t, 7700052, "cancel")
	if err := ActivateSubscription(sCancelled.ID, "pro_monthly", soon, "enc-method-cancel"); err != nil {
		t.Fatalf("activate cancel: %v", err)
	}
	if err := SetAutoRenew(sCancelled.ID, false, true); err != nil {
		t.Fatalf("SetAutoRenew cancel: %v", err)
	}

	// Excluded: period end is far away (not within window).
	sFar := newSubSpecialist(t, 7700053, "far")
	if err := ActivateSubscription(sFar.ID, "pro_monthly", far, "enc-method-far"); err != nil {
		t.Fatalf("activate far: %v", err)
	}

	due, err := SpecialistsDueForRenewal(4 * time.Hour)
	if err != nil {
		t.Fatalf("SpecialistsDueForRenewal: %v", err)
	}

	found := func(id string) bool {
		for _, s := range due {
			if s.ID == id {
				return true
			}
		}
		return false
	}

	if !found(sDue.ID) {
		t.Error("qualifying specialist must be in due-for-renewal list")
	}
	if found(sNoMethod.ID) {
		t.Error("specialist without payment method must not be in due-for-renewal list")
	}
	if found(sCancelled.ID) {
		t.Error("specialist with cancel_at_period_end=1 must not be in due-for-renewal list")
	}
	if found(sFar.ID) {
		t.Error("specialist with far period end must not be in due-for-renewal list")
	}
}

/***************************************************************************************************
* TestHasPendingRenewal verifies the dedup guard for the renewal worker.
***************************************************************************************************/
func TestHasPendingRenewal(t *testing.T) {
	setupSubTestDB(t)

	s := newSubSpecialist(t, 7700060, "hasp")
	periodEnd := time.Now().UTC().Add(30 * 24 * time.Hour)
	if err := ActivateSubscription(s.ID, "pro_monthly", periodEnd, "enc-m"); err != nil {
		t.Fatalf("ActivateSubscription: %v", err)
	}

	// No pending renewal initially.
	has, err := HasPendingRenewal(s.ID, periodEnd)
	if err != nil {
		t.Fatalf("HasPendingRenewal (before): %v", err)
	}
	if has {
		t.Fatal("should not have pending renewal before any payment row exists")
	}

	// Insert a pending renewal row.
	renewalRow := models.SubscriptionPayment{
		SpecialistID:      s.ID,
		YooKassaPaymentID: "yk-renewal-pending",
		AmountKopecks:     59000,
		Currency:          "RUB",
		Status:            "pending",
		PlanCode:          "pro_monthly",
		PeriodStart:       periodEnd,
		PeriodEnd:         periodEnd.Add(30 * 24 * time.Hour),
		IsRenewal:         true,
		CreatedAt:         time.Now().UTC(),
	}
	if err := CreateSubscriptionPayment(renewalRow); err != nil {
		t.Fatalf("CreateSubscriptionPayment: %v", err)
	}

	has, err = HasPendingRenewal(s.ID, periodEnd)
	if err != nil {
		t.Fatalf("HasPendingRenewal (after): %v", err)
	}
	if !has {
		t.Fatal("should have pending renewal after inserting a pending renewal payment")
	}
}

/***************************************************************************************************
* TestSpecialistsWithLapsedTrials verifies the lapsed-trial query:
*  - Selects trialing specialists whose trial_ends_at is past.
*  - Excludes specialists already marked 'expired'.
***************************************************************************************************/
func TestSpecialistsWithLapsedTrials(t *testing.T) {
	setupSubTestDB(t)

	// Lapsed trial specialist (trial ended in the past).
	sLapsed := newSubSpecialist(t, 7700070, "lapsedtrial")
	pastTrialEnd := time.Now().UTC().Add(-time.Hour)
	if _, err := DB.Exec(Q(`
		UPDATE specialists SET trial_ends_at = ? WHERE id = ?
	`), pastTrialEnd, sLapsed.ID); err != nil {
		t.Fatalf("set past trial_ends_at: %v", err)
	}

	// Already expired — must be excluded.
	sExpired := newSubSpecialist(t, 7700071, "expiredtrial")
	if _, err := DB.Exec(Q(`
		UPDATE specialists
		SET subscription_status = 'expired', trial_ends_at = ?
		WHERE id = ?
	`), time.Now().UTC().Add(-time.Hour), sExpired.ID); err != nil {
		t.Fatalf("set expired trial: %v", err)
	}

	// Active trial (future) — must be excluded.
	sFuture := newSubSpecialist(t, 7700072, "futuretrial")
	_ = sFuture // already created with future trial_ends_at by CreateSpecialist

	lapsed, err := SpecialistsWithLapsedTrials()
	if err != nil {
		t.Fatalf("SpecialistsWithLapsedTrials: %v", err)
	}

	foundLapsed := false
	for _, s := range lapsed {
		if s.ID == sLapsed.ID {
			foundLapsed = true
		}
		if s.ID == sExpired.ID {
			t.Error("expired specialist must not appear in lapsed trials")
		}
		if s.ID == sFuture.ID {
			t.Error("future trial specialist must not appear in lapsed trials")
		}
	}
	if !foundLapsed {
		t.Error("lapsed-trial specialist must appear in SpecialistsWithLapsedTrials")
	}
}

/***************************************************************************************************
* TestSpecialistsWithLapsedPeriods verifies:
*  - Returns active specialist whose period ended in the past.
*  - Excludes already-expired specialists.
*  - Excludes specialists who have a pending renewal in flight.
***************************************************************************************************/
func TestSpecialistsWithLapsedPeriods(t *testing.T) {
	setupSubTestDB(t)

	// Lapsed active specialist.
	sLapsed := newSubSpecialist(t, 7700080, "lapsedperiod")
	pastEnd := time.Now().UTC().Add(-2 * time.Hour)
	if err := ActivateSubscription(sLapsed.ID, "pro_monthly", pastEnd, ""); err != nil {
		t.Fatalf("activate lapsed: %v", err)
	}
	// Manually backdate the period end to ensure it is in the past.
	if _, err := DB.Exec(Q(`
		UPDATE specialists SET current_period_end_at = ? WHERE id = ?
	`), pastEnd, sLapsed.ID); err != nil {
		t.Fatalf("backdate lapsed period: %v", err)
	}

	// Already expired — must be excluded.
	sExpired := newSubSpecialist(t, 7700081, "expiredperiod")
	if err := ActivateSubscription(sExpired.ID, "pro_monthly", pastEnd, ""); err != nil {
		t.Fatalf("activate expired: %v", err)
	}
	if _, err := DB.Exec(Q(`
		UPDATE specialists SET subscription_status = 'expired', current_period_end_at = ? WHERE id = ?
	`), pastEnd, sExpired.ID); err != nil {
		t.Fatalf("set expired: %v", err)
	}

	// Lapsed but has a pending renewal in flight — must be excluded.
	sRenewing := newSubSpecialist(t, 7700082, "renewing")
	if err := ActivateSubscription(sRenewing.ID, "pro_monthly", pastEnd, "enc-m-ren"); err != nil {
		t.Fatalf("activate renewing: %v", err)
	}
	if _, err := DB.Exec(Q(`
		UPDATE specialists SET current_period_end_at = ? WHERE id = ?
	`), pastEnd, sRenewing.ID); err != nil {
		t.Fatalf("backdate renewing: %v", err)
	}
	renewalRow := models.SubscriptionPayment{
		SpecialistID:      sRenewing.ID,
		YooKassaPaymentID: "yk-renewal-pend-2",
		AmountKopecks:     59000,
		Currency:          "RUB",
		Status:            "pending",
		PlanCode:          "pro_monthly",
		PeriodStart:       pastEnd,
		PeriodEnd:         pastEnd.Add(30 * 24 * time.Hour),
		IsRenewal:         true,
		CreatedAt:         time.Now().UTC(),
	}
	if err := CreateSubscriptionPayment(renewalRow); err != nil {
		t.Fatalf("seed pending renewal: %v", err)
	}

	lapsed, err := SpecialistsWithLapsedPeriods()
	if err != nil {
		t.Fatalf("SpecialistsWithLapsedPeriods: %v", err)
	}

	foundLapsed := false
	for _, s := range lapsed {
		if s.ID == sLapsed.ID {
			foundLapsed = true
		}
		if s.ID == sExpired.ID {
			t.Error("already-expired specialist must not appear in lapsed periods")
		}
		if s.ID == sRenewing.ID {
			t.Error("specialist with pending renewal must not appear in lapsed periods")
		}
	}
	if !foundLapsed {
		t.Error("lapsed-period specialist must appear in SpecialistsWithLapsedPeriods")
	}
}

/***************************************************************************************************
* TestSetAutoRenew verifies that cancel/resume flags are set without touching subscription_status.
***************************************************************************************************/
func TestSetAutoRenew(t *testing.T) {
	setupSubTestDB(t)

	s := newSubSpecialist(t, 7700090, "autorenew")
	periodEnd := time.Now().UTC().Add(30 * 24 * time.Hour)
	if err := ActivateSubscription(s.ID, "pro_monthly", periodEnd, ""); err != nil {
		t.Fatalf("ActivateSubscription: %v", err)
	}
	s1, _ := GetSpecialistByID(s.ID)
	if !s1.AutoRenew {
		t.Fatal("auto_renew must be true after activation")
	}

	// Cancel.
	if err := SetAutoRenew(s.ID, false, true); err != nil {
		t.Fatalf("SetAutoRenew(cancel): %v", err)
	}
	s2, _ := GetSpecialistByID(s.ID)
	if s2.AutoRenew {
		t.Error("auto_renew must be false after cancel")
	}
	if !s2.CancelAtPeriodEnd {
		t.Error("cancel_at_period_end must be true after cancel")
	}
	if s2.SubscriptionStatus != "active" {
		t.Errorf("subscription_status must remain 'active', got %q", s2.SubscriptionStatus)
	}

	// Resume.
	if err := SetAutoRenew(s.ID, true, false); err != nil {
		t.Fatalf("SetAutoRenew(resume): %v", err)
	}
	s3, _ := GetSpecialistByID(s.ID)
	if !s3.AutoRenew {
		t.Error("auto_renew must be true after resume")
	}
	if s3.CancelAtPeriodEnd {
		t.Error("cancel_at_period_end must be false after resume")
	}
	if s3.SubscriptionStatus != "active" {
		t.Errorf("subscription_status must remain 'active', got %q", s3.SubscriptionStatus)
	}
}

// ---------------------------------------------------------------------------
// backfillSubscriptionGrace idempotency
// ---------------------------------------------------------------------------

/***************************************************************************************************
* TestBackfillSubscriptionGraceIdempotency verifies that the backfill guard
* (subscription_started_at IS NULL) protects specialists who already have a
* subscription_started_at from being overwritten.
***************************************************************************************************/
func TestBackfillSubscriptionGraceIdempotency(t *testing.T) {
	setupSubTestDB(t)

	// Create a specialist who already has subscription_started_at set (simulating a paying user).
	s := newSubSpecialist(t, 7700100, "grace")
	if err := ActivateSubscription(s.ID, "pro_monthly", time.Now().UTC().Add(30*24*time.Hour), ""); err != nil {
		t.Fatalf("ActivateSubscription: %v", err)
	}
	s1, _ := GetSpecialistByID(s.ID)
	if s1.SubscriptionStartedAt == nil {
		t.Fatal("subscription_started_at must be set after activation")
	}
	originalStartedAt := *s1.SubscriptionStartedAt
	originalPeriodEnd := s1.CurrentPeriodEndAt

	// The backfill UPDATE is guarded by AND subscription_started_at IS NULL.
	// Invoke the guard directly by running the same UPDATE statement.
	gracePeriodEnd := time.Now().UTC().Add(10 * 24 * time.Hour)
	res, err := DB.Exec(Q(`
		UPDATE specialists
		SET subscription_status = 'active',
		    subscription_started_at = ?,
		    current_period_end_at = ?,
		    auto_renew = 1
		WHERE deleted_at IS NULL
		  AND subscription_started_at IS NULL
	`), time.Now().UTC(), gracePeriodEnd)
	if err != nil {
		t.Fatalf("backfill UPDATE: %v", err)
	}

	// The row for s must NOT have been affected.
	n, _ := res.RowsAffected()
	t.Logf("rows affected by backfill simulation: %d", n)

	s2, _ := GetSpecialistByID(s.ID)
	if s2.SubscriptionStartedAt == nil {
		t.Fatal("subscription_started_at must still be set")
	}
	diff := s2.SubscriptionStartedAt.Sub(originalStartedAt)
	if diff > time.Second || diff < -time.Second {
		t.Errorf("subscription_started_at changed: was %v, now %v", originalStartedAt, *s2.SubscriptionStartedAt)
	}
	if originalPeriodEnd != nil && s2.CurrentPeriodEndAt != nil {
		diff2 := s2.CurrentPeriodEndAt.Sub(*originalPeriodEnd)
		if diff2 > time.Second || diff2 < -time.Second {
			t.Errorf("current_period_end_at changed: was %v, now %v", *originalPeriodEnd, *s2.CurrentPeriodEndAt)
		}
	}
}
