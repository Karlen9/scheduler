package db

import (
	"database/sql"
	"time"
)

// GetMasterUserLanguage returns the UI language a Telegram user picked in the master bot.
// Returns "ru" (the product default) when no row exists, so callers never need to nil-check.
func GetMasterUserLanguage(telegramUserID int64) string {
	var lang string
	err := DB.QueryRow(Q(`SELECT language FROM master_users WHERE telegram_user_id = ?`), telegramUserID).Scan(&lang)
	if err == sql.ErrNoRows || err != nil || lang == "" {
		return "ru"
	}
	return lang
}

// SetMasterUserLanguage upserts the language preference for a master-bot user.
// Accepted codes: "ru", "en" (the only locales the bundle carries); anything else is coerced to "ru".
func SetMasterUserLanguage(telegramUserID int64, language string) error {
	if language != "ru" && language != "en" {
		language = "ru"
	}
	now := time.Now().UTC()
	// Try update first; fall back to insert. Done this way (instead of ON CONFLICT) so the same
	// code runs on SQLite and Postgres without driver-specific upsert syntax.
	res, err := DB.Exec(Q(`
		UPDATE master_users
		SET language = ?, last_seen_at = ?
		WHERE telegram_user_id = ?
	`), language, now, telegramUserID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n > 0 {
		return nil
	}
	_, err = DB.Exec(Q(`
		INSERT INTO master_users (telegram_user_id, language, first_seen_at, last_seen_at)
		VALUES (?, ?, ?, ?)
	`), telegramUserID, language, now, now)
	return err
}

// TouchMasterUser records that a Telegram user interacted with the master bot without changing
// their language. Creates the row with the product-default language if it does not exist.
func TouchMasterUser(telegramUserID int64) {
	now := time.Now().UTC()
	res, err := DB.Exec(Q(`UPDATE master_users SET last_seen_at = ? WHERE telegram_user_id = ?`), now, telegramUserID)
	if err != nil {
		return
	}
	if n, _ := res.RowsAffected(); n > 0 {
		return
	}
	_, _ = DB.Exec(Q(`
		INSERT INTO master_users (telegram_user_id, language, first_seen_at, last_seen_at)
		VALUES (?, 'ru', ?, ?)
	`), telegramUserID, now, now)
}
