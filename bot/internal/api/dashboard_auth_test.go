package api_test

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"scheduler-bot/internal/api"
)

func buildDashboardLoginPayload(userID int64, botToken string, authDate int64) map[string]interface{} {
	payload := map[string]interface{}{
		"id":         strconv.FormatInt(userID, 10),
		"first_name": "Owner",
		"username":   "owner",
		"auth_date":  strconv.FormatInt(authDate, 10),
	}

	keys := make([]string, 0, len(payload))
	for key := range payload {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+payload[key].(string))
	}

	secret := sha256.Sum256([]byte(botToken))
	mac := hmac.New(sha256.New, secret[:])
	mac.Write([]byte(strings.Join(parts, "\n")))
	payload["hash"] = hex.EncodeToString(mac.Sum(nil))
	return payload
}

func postDashboardAuth(t *testing.T, payload map[string]interface{}) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("Marshal payload: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/dashboard/auth/telegram", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestDashboardTelegramAuth(t *testing.T) {
	api.MasterBotToken = "master-auth-token"
	api.AdminIDs = []int64{9001}

	valid := buildDashboardLoginPayload(9001, api.MasterBotToken, time.Now().Unix())
	w := postDashboardAuth(t, valid)
	if w.Code != http.StatusOK {
		t.Fatalf("expected valid login to return 200, got %d: %s", w.Code, w.Body.String())
	}

	forbidden := buildDashboardLoginPayload(9002, api.MasterBotToken, time.Now().Unix())
	w = postDashboardAuth(t, forbidden)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected non-admin login to return 403, got %d: %s", w.Code, w.Body.String())
	}

	invalidHash := buildDashboardLoginPayload(9001, api.MasterBotToken, time.Now().Unix())
	invalidHash["hash"] = "bad"
	w = postDashboardAuth(t, invalidHash)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected invalid hash to return 401, got %d: %s", w.Code, w.Body.String())
	}

	expired := buildDashboardLoginPayload(9001, api.MasterBotToken, time.Now().Add(-25*time.Hour).Unix())
	w = postDashboardAuth(t, expired)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected expired login to return 401, got %d: %s", w.Code, w.Body.String())
	}

	future := buildDashboardLoginPayload(9001, api.MasterBotToken, time.Now().Add(10*time.Minute).Unix())
	w = postDashboardAuth(t, future)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected future login to return 401, got %d: %s", w.Code, w.Body.String())
	}

	missingUser := buildDashboardLoginPayload(9001, api.MasterBotToken, time.Now().Unix())
	delete(missingUser, "id")
	w = postDashboardAuth(t, missingUser)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected missing user id to return 401, got %d: %s", w.Code, w.Body.String())
	}
}
