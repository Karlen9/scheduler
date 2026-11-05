package db

import (
	"database/sql"
	"encoding/hex"
	"strings"
	"testing"

	"scheduler-bot/internal/crypto"
)

/***************************************************************************************************
* Builds a deterministic hex key whose bytes start at the given seed.
***************************************************************************************************/
func rotationKey(seed byte) string {
	key := make([]byte, 32)
	for i := range key {
		key[i] = seed + byte(i)
	}
	return hex.EncodeToString(key)
}

/***************************************************************************************************
* Inserts a specialist row with raw (already encrypted or plain) column values.
***************************************************************************************************/
func insertRotationSpecialist(t *testing.T, id string, telegramID int64, token string, pm interface{}) {
	t.Helper()
	if _, err := DB.Exec(
		Q(`INSERT INTO specialists (id, telegram_user_id, name, bot_username, webhook_secret, bot_token, bot_token_hash, yookassa_payment_method_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
		id, telegramID, "S "+id, "bot_"+id, "secret-"+id, token, crypto.HashToken("hash-"+id), pm,
	); err != nil {
		t.Fatalf("insert specialist %s: %v", id, err)
	}
}

/***************************************************************************************************
* Reads the raw bot_token, hash and payment method columns of a specialist.
***************************************************************************************************/
func readRotationRow(t *testing.T, id string) (token, hash string, pm sql.NullString) {
	t.Helper()
	if err := DB.QueryRow(Q(`SELECT bot_token, bot_token_hash, yookassa_payment_method_id FROM specialists WHERE id = ?`), id).Scan(&token, &hash, &pm); err != nil {
		t.Fatalf("read specialist %s: %v", id, err)
	}
	return
}

/***************************************************************************************************
* Verifies rotation re-encrypts values, leaves other rows alone, is idempotent and rolls back on a
* wrong old key.
***************************************************************************************************/
func TestRotateEncryptionKey(t *testing.T) {
	setupStatsTestDB(t)

	oldKey, newKey := rotationKey(1), rotationKey(100)
	oldCipher, err := crypto.NewCipher(oldKey)
	if err != nil {
		t.Fatal(err)
	}
	if err := crypto.Init(newKey); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = crypto.Init("") })

	encTok := func(s string) string {
		v, err := oldCipher.Encrypt(s)
		if err != nil {
			t.Fatal(err)
		}
		return v
	}

	insertRotationSpecialist(t, "a", 9001, encTok("tok-a"), encTok("pm-a"))
	insertRotationSpecialist(t, "b", 9002, encTok("tok-b"), nil)
	insertRotationSpecialist(t, "c", 9003, "plain-token", "")

	if err := RotateEncryptionKey(oldKey); err != nil {
		t.Fatalf("RotateEncryptionKey: %v", err)
	}

	tokA, hashA, pmA := readRotationRow(t, "a")
	if got, err := crypto.Decrypt(tokA); err != nil || got != "tok-a" {
		t.Fatalf("a token = %q, %v", got, err)
	}
	if got, err := crypto.Decrypt(pmA.String); err != nil || got != "pm-a" {
		t.Fatalf("a pm = %q, %v", got, err)
	}
	if hashA != crypto.HashToken("hash-a") {
		t.Fatal("bot_token_hash changed")
	}
	tokB, _, pmB := readRotationRow(t, "b")
	if got, err := crypto.Decrypt(tokB); err != nil || got != "tok-b" {
		t.Fatalf("b token = %q, %v", got, err)
	}
	if pmB.Valid {
		t.Fatal("NULL payment method should stay NULL")
	}
	tokC, _, pmC := readRotationRow(t, "c")
	if tokC != "plain-token" || pmC.String != "" {
		t.Fatalf("plaintext row modified: %q %q", tokC, pmC.String)
	}

	// Idempotent: values already under the new key are left unchanged.
	if err := RotateEncryptionKey(oldKey); err != nil {
		t.Fatalf("second run: %v", err)
	}
	tokA2, _, _ := readRotationRow(t, "a")
	if tokA2 != tokA {
		t.Fatal("second run re-encrypted an already rotated value")
	}
}

/***************************************************************************************************
* Verifies a wrong old key aborts with the specialist id and column, and leaves the DB unchanged.
***************************************************************************************************/
func TestRotateEncryptionKeyWrongKeyRollsBack(t *testing.T) {
	setupStatsTestDB(t)

	realOld, thirdKey, newKey := rotationKey(1), rotationKey(50), rotationKey(100)
	oldCipher, _ := crypto.NewCipher(realOld)
	thirdCipher, _ := crypto.NewCipher(thirdKey)
	if err := crypto.Init(newKey); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = crypto.Init("") })

	// Rows are processed ORDER BY id: "a-good" rotates (its UPDATE runs), then "b-bad" fails.
	goodTok, _ := oldCipher.Encrypt("tok-good")
	goodPM, _ := oldCipher.Encrypt("pm-good")
	badTok, _ := thirdCipher.Encrypt("tok-bad")
	insertRotationSpecialist(t, "a-good", 9001, goodTok, goodPM)
	insertRotationSpecialist(t, "b-bad", 9002, badTok, nil)

	err := RotateEncryptionKey(realOld)
	if err == nil {
		t.Fatal("expected error for a value encrypted under an unrelated key")
	}
	if !strings.Contains(err.Error(), "specialist b-bad") || !strings.Contains(err.Error(), "bot_token") {
		t.Fatalf("error should name failing specialist and column: %v", err)
	}
	gotTok, _, gotPM := readRotationRow(t, "a-good")
	if gotTok != goodTok || gotPM.String != goodPM {
		t.Fatal("good row changed: rollback did not undo the earlier UPDATE")
	}
	if badGot, _, _ := readRotationRow(t, "b-bad"); badGot != badTok {
		t.Fatal("bad row changed")
	}

	if err := RotateEncryptionKey(""); err == nil {
		t.Fatal("expected error for empty old key")
	}
	if err := RotateEncryptionKey(newKey); err != nil {
		t.Fatalf("same key should be a no-op: %v", err)
	}
}
