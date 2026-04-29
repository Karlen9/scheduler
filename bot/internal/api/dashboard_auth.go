package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

var (
	MasterBotToken string
	AdminIDs       []int64
)

const dashboardLoginMaxAge = 24 * time.Hour

type DashboardTelegramUser struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Username  string `json:"username,omitempty"`
	PhotoURL  string `json:"photo_url,omitempty"`
	AuthDate  int64  `json:"auth_date"`
}

type DashboardAuthResponse struct {
	User DashboardTelegramUser `json:"user"`
}

func dashboardValueAsString(value interface{}) (string, bool) {
	switch v := value.(type) {
	case string:
		return v, true
	case json.Number:
		return v.String(), true
	case float64:
		return strconv.FormatInt(int64(v), 10), true
	case bool:
		if v {
			return "true", true
		}
		return "false", true
	default:
		return "", false
	}
}

func dashboardInt64Field(payload map[string]interface{}, key string) (int64, bool) {
	raw, ok := payload[key]
	if !ok {
		return 0, false
	}
	value, ok := dashboardValueAsString(raw)
	if !ok || value == "" {
		return 0, false
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	return parsed, err == nil
}

func dashboardStringField(payload map[string]interface{}, key string) string {
	raw, ok := payload[key]
	if !ok {
		return ""
	}
	value, ok := dashboardValueAsString(raw)
	if !ok {
		return ""
	}
	return value
}

func isDashboardAllowedUser(userID int64) bool {
	for _, allowedID := range AdminIDs {
		if allowedID == userID {
			return true
		}
	}
	return false
}

func validateDashboardTelegramPayload(payload map[string]interface{}) (DashboardTelegramUser, bool) {
	if MasterBotToken == "" {
		log.Printf("Dashboard auth rejected: MASTER_BOT_TOKEN is not configured")
		return DashboardTelegramUser{}, false
	}

	hash := dashboardStringField(payload, "hash")
	if hash == "" {
		return DashboardTelegramUser{}, false
	}

	id, ok := dashboardInt64Field(payload, "id")
	if !ok {
		return DashboardTelegramUser{}, false
	}
	authDate, ok := dashboardInt64Field(payload, "auth_date")
	if !ok {
		return DashboardTelegramUser{}, false
	}

	age := time.Since(time.Unix(authDate, 0))
	if age > dashboardLoginMaxAge || age < -5*time.Minute {
		log.Printf("Dashboard auth rejected: auth_date out of range")
		return DashboardTelegramUser{}, false
	}

	keys := make([]string, 0, len(payload))
	for key := range payload {
		if key == "hash" {
			continue
		}
		if _, ok := dashboardValueAsString(payload[key]); ok {
			keys = append(keys, key)
		}
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		value, _ := dashboardValueAsString(payload[key])
		parts = append(parts, key+"="+value)
	}

	secret := sha256.Sum256([]byte(MasterBotToken))
	mac := hmac.New(sha256.New, secret[:])
	mac.Write([]byte(strings.Join(parts, "\n")))
	expectedHash := hex.EncodeToString(mac.Sum(nil))
	if !secureCompare(expectedHash, hash) {
		log.Printf("Dashboard auth rejected: hash mismatch")
		return DashboardTelegramUser{}, false
	}

	return DashboardTelegramUser{
		ID:        id,
		FirstName: dashboardStringField(payload, "first_name"),
		LastName:  dashboardStringField(payload, "last_name"),
		Username:  dashboardStringField(payload, "username"),
		PhotoURL:  dashboardStringField(payload, "photo_url"),
		AuthDate:  authDate,
	}, true
}

func HandleDashboardTelegramAuth(w http.ResponseWriter, r *http.Request) {
	var payload map[string]interface{}
	decoder := json.NewDecoder(r.Body)
	decoder.UseNumber()
	if err := decoder.Decode(&payload); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	user, ok := validateDashboardTelegramPayload(payload)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !isDashboardAllowedUser(user.ID) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	writeJSON(w, DashboardAuthResponse{User: user})
}
