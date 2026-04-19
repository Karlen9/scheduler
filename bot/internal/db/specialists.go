package db

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"

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
	var telegramHandle, phone, specialization, bio, photoURL, availableDurations, language, wallpaper, referralCode sql.NullString
	var notifyNewBookings, notifyCancellations sql.NullInt64
	err := row.Scan(
		&t.ID, &t.TelegramUserID, &t.BotToken, &t.BotUsername,
		&t.WebhookSecret, &t.Name, &t.Timezone, &t.CancelCutoffHrs,
		&telegramHandle, &phone, &specialization, &bio, &photoURL,
		&t.LocationLatitude, &t.LocationLongitude,
		&availableDurations,
		&notifyNewBookings, &notifyCancellations,
		&t.IsActive, &t.CreatedAt,
		&language,
		&wallpaper,
		&referralCode,
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
	t.AvailableDurations = availableDurations.String
	t.NotifyNewBookings = !notifyNewBookings.Valid || notifyNewBookings.Int64 == 1
	t.NotifyCancellations = !notifyCancellations.Valid || notifyCancellations.Int64 == 1
	t.Language = language.String
	if t.Language == "" {
		t.Language = "ru"
	}
	t.Wallpaper = wallpaper.String
	t.ReferralCode = referralCode.String

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
const specialistColumns = `id, telegram_user_id, bot_token, bot_username, webhook_secret, name, timezone, cancel_cutoff_hrs, telegram_handle, phone, specialization, bio, photo_url, location_latitude, location_longitude, available_durations, notify_new_bookings, notify_cancellations, is_active, created_at, language, wallpaper, referral_code`

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
func CreateSpecialist(telegramUserID int64, botToken, botUsername, name, timezone string, cancelCutoffHrs int) (*models.Specialist, error) {
	id := uuid.New().String()
	webhookSecret := generateWebhookSecret()
	referralCode := generateReferralCode()

	encryptedToken, err := crypto.Encrypt(botToken)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt bot token: %w", err)
	}
	tokenHash := crypto.HashToken(botToken)

	_, err = DB.Exec(Q(`
		INSERT INTO specialists (id, telegram_user_id, bot_token, bot_token_hash, bot_username, webhook_secret, name, timezone, cancel_cutoff_hrs, referral_code)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`), id, telegramUserID, encryptedToken, tokenHash, botUsername, webhookSecret, name, timezone, cancelCutoffHrs, referralCode)
	if err != nil {
		return nil, err
	}

	return GetSpecialistByID(id)
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
		SELECT id, telegram_user_id, specialist_id, name, phone, photo_url, preferred_duration, is_ghost, is_blocked, notify_booking_status, notify_reminders, notify_days_off, notify_cancellations, created_at, language, display_name, referred_via_code
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
func UpdateSpecialistProfile(id, telegramHandle, phone, specialization, bio, photoURL string, locationLatitude, locationLongitude float64, wallpaper string) (*models.Specialist, error) {
	_, err := DB.Exec(Q(`
		UPDATE specialists
		SET telegram_handle = ?, phone = ?, specialization = ?, bio = ?, photo_url = ?,
		    location_latitude = ?, location_longitude = ?, wallpaper = ?
		WHERE id = ?
	`), telegramHandle, phone, specialization, bio, photoURL, locationLatitude, locationLongitude, wallpaper, id)
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
