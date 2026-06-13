package models

import (
	"testing"
	"time"
)

// ptr returns a pointer to a time.Time value, for readable test setup.
func ptr(t time.Time) *time.Time { return &t }

var (
	past   = time.Now().UTC().Add(-24 * time.Hour)
	future = time.Now().UTC().Add(24 * time.Hour)
)

/***************************************************************************************************
* TestEntitlement verifies that Entitlement() correctly grants/denies Pro access for every
* subscription status variant.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
***************************************************************************************************/
func TestEntitlement(t *testing.T) {
	now := time.Now().UTC()

	tests := []struct {
		name    string
		spec    Specialist
		wantPro bool
		reason  string // non-empty only when wantPro == true
	}{
		// trialing — active
		{
			name:    "trialing with future trial_ends_at is Pro",
			spec:    Specialist{SubscriptionStatus: "trialing", TrialEndsAt: ptr(future)},
			wantPro: true,
			reason:  "trial",
		},
		// trialing — expired
		{
			name: "trialing with past trial_ends_at is not Pro",
			spec: Specialist{SubscriptionStatus: "trialing", TrialEndsAt: ptr(past)},
		},
		// trialing — nil
		{
			name: "trialing with nil trial_ends_at is not Pro",
			spec: Specialist{SubscriptionStatus: "trialing"},
		},
		// active — current period valid
		{
			name:    "active with future period end is Pro",
			spec:    Specialist{SubscriptionStatus: "active", CurrentPeriodEndAt: ptr(future)},
			wantPro: true,
			reason:  "active",
		},
		// active — period expired
		{
			name: "active with past period end is not Pro",
			spec: Specialist{SubscriptionStatus: "active", CurrentPeriodEndAt: ptr(past)},
		},
		// active — nil period
		{
			name: "active with nil period end is not Pro",
			spec: Specialist{SubscriptionStatus: "active"},
		},
		// cancelled — still within period
		{
			name:    "cancelled with future period end is Pro",
			spec:    Specialist{SubscriptionStatus: "cancelled", CurrentPeriodEndAt: ptr(future)},
			wantPro: true,
			reason:  "cancelled",
		},
		// cancelled — period expired
		{
			name: "cancelled with past period end is not Pro",
			spec: Specialist{SubscriptionStatus: "cancelled", CurrentPeriodEndAt: ptr(past)},
		},
		// none / expired / past_due / empty
		{
			name: "status none is not Pro",
			spec: Specialist{SubscriptionStatus: "none"},
		},
		{
			name: "status expired is not Pro",
			spec: Specialist{SubscriptionStatus: "expired", CurrentPeriodEndAt: ptr(future)},
		},
		{
			name: "status past_due is not Pro",
			spec: Specialist{SubscriptionStatus: "past_due", CurrentPeriodEndAt: ptr(future)},
		},
		{
			name: "empty status is not Pro",
			spec: Specialist{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ent := tc.spec.Entitlement(now)
			if ent.IsPro != tc.wantPro {
				t.Errorf("Entitlement().IsPro = %v, want %v", ent.IsPro, tc.wantPro)
			}
			if tc.wantPro && ent.Reason != tc.reason {
				t.Errorf("Entitlement().Reason = %q, want %q", ent.Reason, tc.reason)
			}
		})
	}
}

/***************************************************************************************************
* TestIsProMatchesEntitlement verifies that IsPro(now) always equals Entitlement(now).IsPro.
***************************************************************************************************/
func TestIsProMatchesEntitlement(t *testing.T) {
	now := time.Now().UTC()

	specs := []Specialist{
		{SubscriptionStatus: "trialing", TrialEndsAt: ptr(future)},
		{SubscriptionStatus: "trialing", TrialEndsAt: ptr(past)},
		{SubscriptionStatus: "active", CurrentPeriodEndAt: ptr(future)},
		{SubscriptionStatus: "active", CurrentPeriodEndAt: ptr(past)},
		{SubscriptionStatus: "cancelled", CurrentPeriodEndAt: ptr(future)},
		{SubscriptionStatus: "expired"},
		{SubscriptionStatus: "none"},
		{},
	}

	for _, s := range specs {
		isPro := s.IsPro(now)
		entIsPro := s.Entitlement(now).IsPro
		if isPro != entIsPro {
			t.Errorf("IsPro=%v but Entitlement().IsPro=%v for status=%q", isPro, entIsPro, s.SubscriptionStatus)
		}
	}
}
