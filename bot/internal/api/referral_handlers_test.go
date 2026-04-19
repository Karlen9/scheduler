package api_test

import (
	"net/http"
	"strings"
	"testing"

	"scheduler-bot/internal/api"
	"scheduler-bot/internal/db"
)

func TestAdminGetReferrals_InitialState(t *testing.T) {
	w := doAdminRequest(t, "GET", "/api/admin/referrals", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", w.Code, w.Body.String())
	}

	var resp api.ReferralsResponse
	parseJSON(t, w, &resp)

	if resp.Code == "" {
		t.Fatal("referral code must be auto-populated on first request")
	}
	if !strings.Contains(resp.Link, resp.Code) {
		t.Fatalf("link %q does not contain code %q", resp.Link, resp.Code)
	}
	if !strings.HasPrefix(resp.Link, "https://t.me/") {
		t.Fatalf("link should point to t.me, got %q", resp.Link)
	}
	if resp.Count != 0 {
		t.Fatalf("expected 0 referrals on fresh specialist, got %d", resp.Count)
	}
	if len(resp.Referrals) != 0 {
		t.Fatalf("expected empty referral list, got %d", len(resp.Referrals))
	}
}

func TestAdminGetReferrals_CountsReferredClientsOnly(t *testing.T) {
	// Seed: three clients — one referred via the correct code, one organic,
	// one referred via a different code.
	spec, err := db.GetSpecialistByID(testSpecialist.ID)
	if err != nil || spec == nil {
		t.Fatalf("get specialist: %v", err)
	}
	code, err := db.EnsureSpecialistReferralCode(spec.ID)
	if err != nil {
		t.Fatalf("ensure code: %v", err)
	}

	if _, err := db.CreateClientWithReferral(900001, spec.ID, "Referred Alice", code); err != nil {
		t.Fatalf("create referred client: %v", err)
	}
	if _, err := db.CreateClientWithReferral(900002, spec.ID, "Organic Bob", ""); err != nil {
		t.Fatalf("create organic client: %v", err)
	}
	if _, err := db.CreateClientWithReferral(900003, spec.ID, "Other-code Carol", "other-code"); err != nil {
		t.Fatalf("create other-code client: %v", err)
	}

	w := doAdminRequest(t, "GET", "/api/admin/referrals", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d (body: %s)", w.Code, w.Body.String())
	}

	var resp api.ReferralsResponse
	parseJSON(t, w, &resp)

	if resp.Count != 1 {
		t.Fatalf("expected 1 referral, got %d (referrals: %+v)", resp.Count, resp.Referrals)
	}
	if len(resp.Referrals) != 1 || resp.Referrals[0].Name != "Referred Alice" {
		t.Fatalf("expected only Referred Alice, got %+v", resp.Referrals)
	}
}

func TestGetOrCreateClientWithReferral_DoesNotOverwriteExisting(t *testing.T) {
	spec := testSpecialist

	// First call: no referral.
	client1, err := db.GetOrCreateClientWithReferral(910000, spec.ID, "Test", "")
	if err != nil {
		t.Fatalf("create client: %v", err)
	}
	if client1.ReferredViaCode != "" {
		t.Fatalf("unexpected referral on fresh organic client: %q", client1.ReferredViaCode)
	}

	// Second call with a referral code: must not overwrite the existing record.
	client2, err := db.GetOrCreateClientWithReferral(910000, spec.ID, "Test", "late-code")
	if err != nil {
		t.Fatalf("second get: %v", err)
	}
	if client2.ReferredViaCode != "" {
		t.Fatalf("referral code should not be applied to existing client, got %q", client2.ReferredViaCode)
	}
}

func TestGetSpecialistByReferralCode_EmptyReturnsNil(t *testing.T) {
	s, err := db.GetSpecialistByReferralCode("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s != nil {
		t.Fatalf("expected nil specialist for empty code")
	}
}
