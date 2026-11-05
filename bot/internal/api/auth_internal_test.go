package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"testing"
	"time"
)

// signInitData signs a fresh initData payload exactly as Telegram would for the given bot token.
func signInitData(botToken string) string {
	authDate := fmt.Sprintf("%d", time.Now().Unix())
	user := `{"id":42,"first_name":"Forger"}`
	check := "auth_date=" + authDate + "\nuser=" + user

	key := hmac.New(sha256.New, []byte("WebAppData"))
	key.Write([]byte(botToken))
	mac := hmac.New(sha256.New, key.Sum(nil))
	mac.Write([]byte(check))

	v := url.Values{}
	v.Set("auth_date", authDate)
	v.Set("user", user)
	v.Set("hash", hex.EncodeToString(mac.Sum(nil)))
	return v.Encode()
}

func TestValidateInitDataRejectsEmptyBotToken(t *testing.T) {
	// Sanity: the helper produces payloads that a real token accepts.
	if _, ok := validateInitData(signInitData("real-token"), "real-token"); !ok {
		t.Fatal("helper produced initData that does not validate under its own token")
	}

	// The payload is perfectly signed under the empty key, so only the explicit guard rejects it.
	if user, ok := validateInitData(signInitData(""), ""); ok || user != nil {
		t.Fatal("validateInitData must reject an empty bot token")
	}
}
