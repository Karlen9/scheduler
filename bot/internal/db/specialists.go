package db

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/crypto"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Implements the generate webhook secret logic used by this module.
*
* Parameters:
* - None.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func generateWebhookSecret() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

/***************************************************************************************************
* generateReferralCode returns a short random referral code (8 bytes → 16 hex chars). Kept
* compact because it ends up inside shared t.me/bot?start= links.
***************************************************************************************************/
func generateReferralCode() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

/***************************************************************************************************
* Scans specialist.
*
* Parameters:
* - row: Row used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func scanSpecialist(row interface{ Scan(...any) error }) (*models.Specialist, error) {
	var t models.Specialist
	var telegramHandle, phone, specialization, bio, photoURL, availableDurations, language, wallpaper, referralCode, referredViaCode sql.NullString
	var notifyNewBookings, notifyCancellations, photoRemoved sql.NullInt64
	var deletedAt, firstPaymentAt sql.NullTime
	var subscriptionStatus, subscriptionPlan, yookassaPaymentMethodID sql.NullString
	var email sql.NullString
	var trialEndsAt, subscriptionStartedAt, currentPeriodEndAt sql.NullTime
	var autoRenew, cancelAtPeriodEnd sql.NullInt64
	err := row.Scan(
		&t.ID, &t.TelegramUserID, &t.BotToken, &t.BotUsername,
		&t.WebhookSecret, &t.Name, &t.Timezone, &t.CancelCutoffHrs,
		&telegramHandle, &phone, &specialization, &bio, &photoURL, &photoRemoved,
		&t.LocationLatitude, &t.LocationLongitude,
		&availableDurations,
		&notifyNewBookings, &notifyCancellations,
		&t.IsActive, &t.CreatedAt,
		&language,
		&wallpaper,
		&referralCode,
		&referredViaCode,
		&firstPaymentAt,
		&deletedAt,
		&subscriptionStatus,
		&subscriptionPlan,
		&trialEndsAt,
		&subscriptionStartedAt,
		&currentPeriodEndAt,
		&autoRenew,
		&cancelAtPeriodEnd,
		&yookassaPaymentMethodID,
		&email,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	t.TelegramHandle = telegramHandle.String
	t.Phone = phone.String
	t.Specialization = specialization.String
	t.Bio = bio.String
	t.PhotoURL = photoURL.String
	t.PhotoRemoved = photoRemoved.Valid && photoRemoved.Int64 == 1
	t.AvailableDurations = availableDurations.String
	t.NotifyNewBookings = !notifyNewBookings.Valid || notifyNewBookings.Int64 == 1
	t.NotifyCancellations = !notifyCancellations.Valid || notifyCancellations.Int64 == 1
	t.Language = language.String
	if t.Language == "" {
		t.Language = "ru"
	}
	t.Wallpaper = wallpaper.String
	t.ReferralCode = referralCode.String
	t.ReferredViaCode = referredViaCode.String
	if firstPaymentAt.Valid {
		paid := firstPaymentAt.Time
		t.FirstPaymentAt = &paid
	}
	if deletedAt.Valid {
		deleted := deletedAt.Time
		t.DeletedAt = &deleted
	}
	t.SubscriptionStatus = subscriptionStatus.String
	t.SubscriptionPlan = subscriptionPlan.String
	if trialEndsAt.Valid {
		v := trialEndsAt.Time
		t.TrialEndsAt = &v
	}
	if subscriptionStartedAt.Valid {
		v := subscriptionStartedAt.Time
		t.SubscriptionStartedAt = &v
	}
	if currentPeriodEndAt.Valid {
		v := currentPeriodEndAt.Time
		t.CurrentPeriodEndAt = &v
	}
	t.AutoRenew = autoRenew.Valid && autoRenew.Int64 == 1
	t.CancelAtPeriodEnd = cancelAtPeriodEnd.Valid && cancelAtPeriodEnd.Int64 == 1
	t.YooKassaPaymentMethodID = yookassaPaymentMethodID.String
	t.Email = email.String

	/***************************************************************************************************
	* Decrypt bot token (passthrough for plain text).
	***************************************************************************************************/
	t.BotToken, err = crypto.Decrypt(t.BotToken)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt bot token for specialist %s: %w", t.ID, err)
	}

	return &t, nil
}

/***************************************************************************************************
* Lists the SQL columns used by the related query helpers.
*
* Usage context:
* - Reused by the database layer to keep shared values centralized.
***************************************************************************************************/
const specialistColumns = `id, telegram_user_id, bot_token, bot_username, webhook_secret, name, timezone, cancel_cutoff_hrs, telegram_handle, phone, specialization, bio, photo_url, photo_removed, location_latitude, location_longitude, available_durations, notify_new_bookings, notify_cancellations, is_active, created_at, language, wallpaper, referral_code, referred_via_code, first_payment_at, deleted_at, subscription_status, subscription_plan, trial_ends_at, subscription_started_at, current_period_end_at, auto_renew, cancel_at_period_end, yookassa_payment_method_id, email`

/***************************************************************************************************
* Returns specialist by telegram id.
*
* Parameters:
* - telegramUserID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetSpecialistByTelegramID(telegramUserID int64) (*models.Specialist, error) {
	row := DB.QueryRow(Q(`
		SELECT `+specialistColumns+`
		FROM specialists
		WHERE telegram_user_id = ?
	`), telegramUserID)
	return scanSpecialist(row)
}

/***************************************************************************************************
* Returns specialist by id.
*
* Parameters:
* - id: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetSpecialistByID(id string) (*models.Specialist, error) {
	row := DB.QueryRow(Q(`
		SELECT `+specialistColumns+`
		FROM specialists
		WHERE id = ?
	`), id)
	return scanSpecialist(row)
}

/***************************************************************************************************
* Returns specialist by webhook secret.
*
* Parameters:
* - secret: Secret used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetSpecialistByWebhookSecret(secret string) (*models.Specialist, error) {
	row := DB.QueryRow(Q(`
		SELECT `+specialistColumns+`
		FROM specialists
		WHERE webhook_secret = ? AND is_active = 1
	`), secret)
	return scanSpecialist(row)
}

/***************************************************************************************************
* Returns specialist by bot token.
*
* Parameters:
* - botToken: Bot token used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetSpecialistByBotToken(botToken string) (*models.Specialist, error) {
	tokenHash := crypto.HashToken(botToken)
	row := DB.QueryRow(Q(`
		SELECT `+specialistColumns+`
		FROM specialists
		WHERE bot_token_hash = ?
	`), tokenHash)
	return scanSpecialist(row)
}

/***************************************************************************************************
* Returns first specialist.
*
* Parameters:
* - None.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetFirstSpecialist() (*models.Specialist, error) {
	row := DB.QueryRow(`
		SELECT ` + specialistColumns + `
		FROM specialists
		WHERE is_active = 1
		LIMIT 1
	`)
	return scanSpecialist(row)
}

/***************************************************************************************************
* Returns all active specialists.
*
* Parameters:
* - None.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetAllActiveSpecialists() ([]models.Specialist, error) {
	rows, err := DB.Query(`
		SELECT ` + specialistColumns + `
		FROM specialists
		WHERE is_active = 1
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var specialists []models.Specialist
	for rows.Next() {
		t, err := scanSpecialist(rows)
		if err != nil {
			return nil, err
		}
		if t != nil {
			specialists = append(specialists, *t)
		}
	}
	return specialists, rows.Err()
}

/***************************************************************************************************
* Creates specialist.
*
* Parameters:
* - name: Name used by the current operation.
* - botUsername: Bot username used by the current operation.
* - botToken: Bot token used by the current operation.
* - telegramUserID: Identifier used to target the current record.
* - timezone: Time value used by the current operation.
* - cancelCutoffHrs: Boolean flag that influences the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
// CreateSpecialist creates a new specialist row, OR reactivates a soft-deleted row for the same
// Telegram user (upsert). The 14-day Pro trial is granted only once per Telegram user: new rows
// receive the trial immediately; reactivated rows receive it only if has_trialed is 0. If the
// user already trialed (has_trialed = 1) their prior subscription state is preserved unchanged.
func CreateSpecialist(telegramUserID int64, botToken, botUsername, name, timezone string, cancelCutoffHrs int) (*models.Specialist, error) {
	webhookSecret := generateWebhookSecret()
	referralCode := generateReferralCode()

	encryptedToken, err := crypto.Encrypt(botToken)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt bot token: %w", err)
	}
	tokenHash := crypto.HashToken(botToken)

	// Check whether this Telegram user already has a row (active or soft-deleted).
	var existingID string
	var hasTrialed int
	err = DB.QueryRow(Q(`SELECT id, has_trialed FROM specialists WHERE telegram_user_id = ?`), telegramUserID).Scan(&existingID, &hasTrialed)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("failed to check existing specialist: %w", err)
	}

	if err == sql.ErrNoRows {
		// Brand-new user: INSERT a fresh row with trial.
		id := uuid.New().String()
		trialEndsAt := time.Now().UTC().Add(time.Duration(TrialDays) * 24 * time.Hour)
		_, err = DB.Exec(Q(`
			INSERT INTO specialists (id, telegram_user_id, bot_token, bot_token_hash, bot_username, webhook_secret, name, timezone, cancel_cutoff_hrs, referral_code, subscription_status, trial_ends_at, has_trialed)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'trialing', ?, 1)
		`), id, telegramUserID, encryptedToken, tokenHash, botUsername, webhookSecret, name, timezone, cancelCutoffHrs, referralCode, trialEndsAt)
		if err != nil {
			return nil, err
		}
		return GetSpecialistByID(id)
	}

	// Returning/soft-deleted user: REACTIVATE the existing row.
	if hasTrialed == 0 {
		// Never trialed before — grant trial now.
		trialEndsAt := time.Now().UTC().Add(time.Duration(TrialDays) * 24 * time.Hour)
		_, err = DB.Exec(Q(`
			UPDATE specialists
			SET bot_token = ?, bot_token_hash = ?, bot_username = ?, webhook_secret = ?,
			    name = ?, timezone = ?, cancel_cutoff_hrs = ?, referral_code = ?,
			    is_active = 1, deleted_at = NULL,
			    subscription_status = 'trialing', trial_ends_at = ?, has_trialed = 1
			WHERE id = ?
		`), encryptedToken, tokenHash, botUsername, webhookSecret, name, timezone, cancelCutoffHrs, referralCode, trialEndsAt, existingID)
	} else {
		// Already trialed — preserve prior subscription state, do not touch trial columns.
		_, err = DB.Exec(Q(`
			UPDATE specialists
			SET bot_token = ?, bot_token_hash = ?, bot_username = ?, webhook_secret = ?,
			    name = ?, timezone = ?, cancel_cutoff_hrs = ?, referral_code = ?,
			    is_active = 1, deleted_at = NULL
			WHERE id = ?
		`), encryptedToken, tokenHash, botUsername, webhookSecret, name, timezone, cancelCutoffHrs, referralCode, existingID)
	}
	if err != nil {
		return nil, err
	}
	return GetSpecialistByID(existingID)
}

// SetSpecialistReferredViaCode records which existing specialist's referral code brought this
// user to the master bot. Only applied once per row (NULL → code) so a returning specialist
// can't accidentally rewrite their referral attribution by reusing the link.
func SetSpecialistReferredViaCode(specialistID, code string) error {
	_, err := DB.Exec(Q(`
		UPDATE specialists
		SET referred_via_code = ?
		WHERE id = ? AND (referred_via_code IS NULL OR referred_via_code = '')
	`), code, specialistID)
	return err
}

// SetSpecialistEmail stores the specialist's contact email (used for payment receipts).
func SetSpecialistEmail(specialistID, email string) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET email = ? WHERE id = ?`), email, specialistID)
	return err
}

// SetSpecialistConsent records that the specialist accepted the terms/privacy docs.
// The timestamp is set to the current time; version identifies the document revision accepted.
func SetSpecialistConsent(specialistID, version string) error {
	_, err := DB.Exec(
		Q(`UPDATE specialists SET consent_accepted_at = ?, consent_version = ? WHERE id = ?`),
		time.Now().UTC(), version, specialistID,
	)
	return err
}

// ReferredSpecialistStat is a row in the specialist-referral listing.
type ReferredSpecialistStat struct {
	ID             string
	Name           string
	BotUsername    string
	CreatedAt      time.Time
	FirstPaymentAt *time.Time
}

// ListReferredSpecialists returns every specialist whose referred_via_code matches the given
// code, sorted by most recent signup first. Used by the admin referrals endpoint to power the
// active vs passive breakdown.
func ListReferredSpecialists(code string) ([]ReferredSpecialistStat, error) {
	if code == "" {
		return nil, nil
	}
	rows, err := DB.Query(Q(`
		SELECT id, name, bot_username, created_at, first_payment_at
		FROM specialists
		WHERE referred_via_code = ?
		ORDER BY created_at DESC
	`), code)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ReferredSpecialistStat
	for rows.Next() {
		var item ReferredSpecialistStat
		var firstPayment sql.NullTime
		if err := rows.Scan(&item.ID, &item.Name, &item.BotUsername, &item.CreatedAt, &firstPayment); err != nil {
			return nil, err
		}
		if firstPayment.Valid {
			v := firstPayment.Time
			item.FirstPaymentAt = &v
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

// UpdateSpecialistBotToken swaps the encrypted bot_token + bot_token_hash for a specialist
// whose BotFather token was regenerated (typically after an accidental /revoke). The
// bot_username, webhook_secret and all downstream data (bookings, clients, etc.) are left
// untouched — this is a pure auth-credential rotation.
func UpdateSpecialistBotToken(specialistID, newBotToken string) error {
	encrypted, err := crypto.Encrypt(newBotToken)
	if err != nil {
		return fmt.Errorf("encrypt new bot token: %w", err)
	}
	hash := crypto.HashToken(newBotToken)
	if _, err := DB.Exec(Q(`
		UPDATE specialists
		SET bot_token = ?, bot_token_hash = ?
		WHERE id = ?
	`), encrypted, hash, specialistID); err != nil {
		return err
	}
	return nil
}

/***************************************************************************************************
* GetSpecialistByReferralCode looks up a specialist by their referral code. Returns nil if no
* match or the code is empty.
***************************************************************************************************/
func GetSpecialistByReferralCode(code string) (*models.Specialist, error) {
	if code == "" {
		return nil, nil
	}
	row := DB.QueryRow(Q(`
		SELECT `+specialistColumns+`
		FROM specialists
		WHERE referral_code = ? AND is_active = 1
	`), code)
	return scanSpecialist(row)
}

/***************************************************************************************************
* EnsureSpecialistReferralCode assigns and persists a fresh random referral code if the specialist
* does not already have one. Returns the active code.
***************************************************************************************************/
func EnsureSpecialistReferralCode(specialistID string) (string, error) {
	specialist, err := GetSpecialistByID(specialistID)
	if err != nil {
		return "", err
	}
	if specialist == nil {
		return "", fmt.Errorf("specialist not found")
	}
	if specialist.ReferralCode != "" {
		return specialist.ReferralCode, nil
	}

	for attempt := 0; attempt < 5; attempt++ {
		code := generateReferralCode()
		_, err := DB.Exec(Q(`UPDATE specialists SET referral_code = ? WHERE id = ? AND (referral_code IS NULL OR referral_code = '')`), code, specialistID)
		if err != nil {
			continue
		}
		current, err := GetSpecialistByID(specialistID)
		if err == nil && current != nil && current.ReferralCode != "" {
			return current.ReferralCode, nil
		}
	}
	return "", fmt.Errorf("failed to assign referral code")
}

/***************************************************************************************************
* GetReferralCountBySpecialist returns the number of real (non-ghost) clients acquired via the
* specialist's referral link.
***************************************************************************************************/
func GetReferralCountBySpecialist(specialistID, referralCode string) (int, error) {
	if referralCode == "" {
		return 0, nil
	}
	var n int
	err := DB.QueryRow(Q(`
		SELECT COUNT(*) FROM clients
		WHERE specialist_id = ? AND referred_via_code = ? AND COALESCE(is_ghost, 0) = 0
	`), specialistID, referralCode).Scan(&n)
	if err != nil {
		return 0, err
	}
	return n, nil
}

/***************************************************************************************************
* GetReferredClientsBySpecialist returns the list of clients acquired via the specialist's
* referral link, ordered by newest first.
***************************************************************************************************/
func GetReferredClientsBySpecialist(specialistID, referralCode string) ([]models.Client, error) {
	if referralCode == "" {
		return []models.Client{}, nil
	}
	rows, err := DB.Query(Q(`
		SELECT id, telegram_user_id, specialist_id, name, phone, photo_url, photo_removed, preferred_duration, is_ghost, is_blocked, notify_booking_status, notify_reminders, notify_days_off, notify_cancellations, created_at, language, display_name, referred_via_code, telegram_username
		FROM clients
		WHERE specialist_id = ? AND referred_via_code = ? AND COALESCE(is_ghost, 0) = 0
		ORDER BY created_at DESC
	`), specialistID, referralCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clients []models.Client
	for rows.Next() {
		c, err := scanClientWithRef(rows)
		if err != nil {
			return nil, err
		}
		clients = append(clients, *c)
	}
	return clients, rows.Err()
}

/***************************************************************************************************
* Updates specialist.
*
* Parameters:
* - name: Name used by the current operation.
* - id: Identifier used to target the current record.
* - timezone: Time value used by the current operation.
* - cancelCutoffHrs: Boolean flag that influences the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateSpecialist(id, name, timezone string, cancelCutoffHrs int) (*models.Specialist, error) {
	_, err := DB.Exec(Q(`
		UPDATE specialists
		SET name = ?, timezone = ?, cancel_cutoff_hrs = ?
		WHERE id = ?
	`), name, timezone, cancelCutoffHrs, id)
	if err != nil {
		return nil, err
	}
	return GetSpecialistByID(id)
}

/***************************************************************************************************
* Updates specialist profile.
*
* Parameters:
* - bio: Bio used by the current operation.
* - specialization: Specialization used by the current operation.
* - phone: Phone used by the current operation.
* - telegramHandle: Telegram handle used by the current operation.
* - id: Identifier used to target the current record.
* - locationLatitude: Location latitude used by the current operation.
* - photoURL: Photo url used by the current operation.
* - locationLongitude: Location longitude used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateSpecialistProfile(id, telegramHandle, phone, specialization, bio string, locationLatitude, locationLongitude float64, wallpaper string) (*models.Specialist, error) {
	_, err := DB.Exec(Q(`
		UPDATE specialists
		SET telegram_handle = ?, phone = ?, specialization = ?, bio = ?,
		    location_latitude = ?, location_longitude = ?, wallpaper = ?
		WHERE id = ?
	`), telegramHandle, phone, specialization, bio, locationLatitude, locationLongitude, wallpaper, id)
	if err != nil {
		return nil, err
	}
	return GetSpecialistByID(id)
}

/***************************************************************************************************
* Updates specialist available durations.
*
* Parameters:
* - id: Identifier used to target the current record.
* - durations: Duration value used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateSpecialistAvailableDurations(id, durations string) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET available_durations = ? WHERE id = ?`), durations, id)
	return err
}

/***************************************************************************************************
* Updates specialist notification prefs.
*
* Parameters:
* - notifyNewBookings: Notify new bookings used by the current operation.
* - id: Identifier used to target the current record.
* - notifyCancellations: Notify cancellations used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateSpecialistNotificationPrefs(id string, notifyNewBookings, notifyCancellations bool) error {
	nb := 0
	if notifyNewBookings {
		nb = 1
	}
	nc := 0
	if notifyCancellations {
		nc = 1
	}
	_, err := DB.Exec(Q(`UPDATE specialists SET notify_new_bookings = ?, notify_cancellations = ? WHERE id = ?`), nb, nc, id)
	return err
}

/***************************************************************************************************
* Updates specialist language.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - language: Language used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateSpecialistLanguage(specialistID, language string) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET language = ? WHERE id = ?`), language, specialistID)
	return err
}

/***************************************************************************************************
* Implements the deactivate specialist logic used by this module.
*
* Parameters:
* - id: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func DeactivateSpecialist(id string) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET is_active = 0 WHERE id = ?`), id)
	return err
}

/***************************************************************************************************
* Implements the activate specialist logic used by this module.
*
* Parameters:
* - id: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func ActivateSpecialist(id string) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET is_active = 1 WHERE id = ?`), id)
	return err
}

/***************************************************************************************************
* SoftDeleteSpecialistCascade removes all bot data associated with a specialist and marks the
* specialist row itself as deleted while preserving id/name/telegram_user_id/created_at so future
* reporting still has a record the bot existed. Wrapped in a single transaction — either every
* referenced row disappears or nothing changes.
*
* What gets deleted: bookings, recurring_schedules, days_off, working_hours, session_types,
* clients (bookings and recurring_schedules reference clients via FK so they go first).
*
* What gets cleared on the specialists row: bot_token, bot_token_hash, webhook_secret,
* referral_code, photo_url, available_durations, phone, telegram_handle, specialization, bio,
* location_latitude, location_longitude, wallpaper. is_active is set to 0 and deleted_at is set
* to NOW() so ongoing active queries ignore the row without losing it.
***************************************************************************************************/
func SoftDeleteSpecialistCascade(specialistID string) error {
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	deletions := []string{
		`DELETE FROM bookings WHERE specialist_id = ?`,
		`DELETE FROM recurring_schedules WHERE specialist_id = ?`,
		`DELETE FROM client_batches WHERE specialist_id = ?`,
		`DELETE FROM days_off WHERE specialist_id = ?`,
		`DELETE FROM working_hours WHERE specialist_id = ?`,
		`DELETE FROM session_types WHERE specialist_id = ?`,
		`DELETE FROM clients WHERE specialist_id = ?`,
	}
	for _, stmt := range deletions {
		if _, err := tx.Exec(Q(stmt), specialistID); err != nil {
			return err
		}
	}

	/***************************************************************************************************
	* bot_token / bot_token_hash / webhook_secret carry UNIQUE constraints and are left intact so
	* a second soft-delete does not collide on an empty-string row. Personal data is cleared; the
	* row is flipped to is_active=0 so GetAllActiveSpecialists and friends ignore it naturally.
	* referral_code is cleared to free the code for reuse by any surviving bot.
	***************************************************************************************************/
	if _, err := tx.Exec(Q(`
		UPDATE specialists
		SET is_active = 0,
		    deleted_at = CURRENT_TIMESTAMP,
		    referral_code = NULL,
		    photo_url = '',
		    available_durations = '',
		    phone = '',
		    telegram_handle = '',
		    specialization = '',
		    bio = '',
		    location_latitude = 0,
		    location_longitude = 0,
		    wallpaper = ''
		WHERE id = ?
	`), specialistID); err != nil {
		return err
	}

	return tx.Commit()
}
