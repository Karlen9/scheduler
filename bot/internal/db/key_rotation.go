package db

import (
	"database/sql"
	"fmt"
	"log"

	"scheduler-bot/internal/crypto"
)

/***************************************************************************************************
* RotateEncryptionKey re-encrypts every encrypted specialist secret (bot_token and
* yookassa_payment_method_id) from oldHexKey to the currently active global key. The whole run is
* one transaction: any failure rolls back and leaves the database untouched. Values already
* readable with the new key are skipped, so the call is idempotent across restarts.
*
* Parameters:
* - oldHexKey: Hex-encoded previous AES key.
*
* Returns:
* - An error when the keys are unusable, a value cannot be decrypted with either key, or the
*   transaction fails.
*
* Side effects:
* - Updates specialists rows and logs the number of rotated values (never keys or plaintext).
***************************************************************************************************/
func RotateEncryptionKey(oldHexKey string) error {
	if !crypto.Enabled() {
		return fmt.Errorf("key rotation requires ENCRYPTION_KEY (the new key) to be set")
	}
	oldCipher, err := crypto.NewCipher(oldHexKey)
	if err != nil {
		return fmt.Errorf("invalid old encryption key: %w", err)
	}

	// Same key as the active one: detected by a probe round trip, so no key material is compared.
	if probe, err := oldCipher.Encrypt("rotation-probe"); err == nil {
		if got, err := crypto.Decrypt(probe); err == nil && got == "rotation-probe" {
			log.Printf("Encryption key rotation skipped: old key equals the current key")
			return nil
		}
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	rows, err := tx.Query(`SELECT id, bot_token, yookassa_payment_method_id FROM specialists ORDER BY id`)
	if err != nil {
		return err
	}
	type row struct {
		id    string
		token sql.NullString
		pm    sql.NullString
	}
	var all []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.token, &r.pm); err != nil {
			rows.Close()
			return err
		}
		all = append(all, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	// rotate returns the re-encrypted value and whether it changed.
	rotate := func(id, column string, v sql.NullString) (string, bool, error) {
		if !v.Valid || !crypto.IsEncrypted(v.String) {
			return "", false, nil
		}
		plain, err := oldCipher.Decrypt(v.String)
		if err != nil {
			if _, newErr := crypto.Decrypt(v.String); newErr == nil {
				return "", false, nil // already encrypted with the new key
			}
			return "", false, fmt.Errorf("specialist %s column %s: cannot decrypt with old or new key", id, column)
		}
		enc, err := crypto.Encrypt(plain)
		if err != nil {
			return "", false, fmt.Errorf("specialist %s column %s: %w", id, column, err)
		}
		check, err := crypto.Decrypt(enc)
		if err != nil || check != plain {
			return "", false, fmt.Errorf("specialist %s column %s: re-encrypted value failed verification", id, column)
		}
		return enc, true, nil
	}

	rotated := 0
	for _, r := range all {
		for _, col := range []struct {
			name string
			val  sql.NullString
		}{{"bot_token", r.token}, {"yookassa_payment_method_id", r.pm}} {
			enc, changed, err := rotate(r.id, col.name, col.val)
			if err != nil {
				return err
			}
			if !changed {
				continue
			}
			// col.name is one of two constants above, never user input.
			if _, err := tx.Exec(Q(`UPDATE specialists SET `+col.name+` = ? WHERE id = ?`), enc, r.id); err != nil {
				return fmt.Errorf("specialist %s column %s: %w", r.id, col.name, err)
			}
			rotated++
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("Encryption key rotation: re-encrypted %d value(s)", rotated)
	return nil
}
