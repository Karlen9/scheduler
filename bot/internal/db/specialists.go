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

func generateWebhookSecret() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func scanSpecialist(row interface{ Scan(...any) error }) (*models.Specialist, error) {
	var t models.Specialist
	var telegramHandle, phone, specialization, bio, photoURL, locationAddress, availableDurations, language sql.NullString
	var notifyNewBookings, notifyCancellations sql.NullInt64
	err := row.Scan(
		&t.ID, &t.TelegramUserID, &t.BotToken, &t.BotUsername,
		&t.WebhookSecret, &t.Name, &t.Timezone, &t.CancelCutoffHrs,
		&telegramHandle, &phone, &specialization, &bio, &photoURL,
		&t.LocationLatitude, &t.LocationLongitude, &locationAddress,
		&availableDurations,
		&notifyNewBookings, &notifyCancellations,
		&t.IsActive, &t.CreatedAt,
		&language,
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

	// Decrypt bot token (passthrough for plain text)
	t.BotToken, err = crypto.Decrypt(t.BotToken)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt bot token for specialist %s: %w", t.ID, err)
	}

	return &t, nil
}

const specialistColumns = `id, telegram_user_id, bot_token, bot_username, webhook_secret, name, timezone, cancel_cutoff_hrs, telegram_handle, phone, specialization, bio, photo_url, location_latitude, location_longitude, location_address, available_durations, notify_new_bookings, notify_cancellations, is_active, created_at, language`

func GetSpecialistByTelegramID(telegramUserID int64) (*models.Specialist, error) {
	row := DB.QueryRow(Q(`
		SELECT `+specialistColumns+`
		FROM specialists
		WHERE telegram_user_id = ?
	`), telegramUserID)
	return scanSpecialist(row)
}

func GetSpecialistByID(id string) (*models.Specialist, error) {
	row := DB.QueryRow(Q(`
		SELECT `+specialistColumns+`
		FROM specialists
		WHERE id = ?
	`), id)
	return scanSpecialist(row)
}

func GetSpecialistByWebhookSecret(secret string) (*models.Specialist, error) {
	row := DB.QueryRow(Q(`
		SELECT `+specialistColumns+`
		FROM specialists
		WHERE webhook_secret = ? AND is_active = 1
	`), secret)
	return scanSpecialist(row)
}

func GetSpecialistByBotToken(botToken string) (*models.Specialist, error) {
	tokenHash := crypto.HashToken(botToken)
	row := DB.QueryRow(Q(`
		SELECT `+specialistColumns+`
		FROM specialists
		WHERE bot_token_hash = ?
	`), tokenHash)
	return scanSpecialist(row)
}

func GetFirstSpecialist() (*models.Specialist, error) {
	row := DB.QueryRow(`
		SELECT ` + specialistColumns + `
		FROM specialists
		WHERE is_active = 1
		LIMIT 1
	`)
	return scanSpecialist(row)
}

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

func CreateSpecialist(telegramUserID int64, botToken, botUsername, name, timezone string, cancelCutoffHrs int) (*models.Specialist, error) {
	id := uuid.New().String()
	webhookSecret := generateWebhookSecret()

	encryptedToken, err := crypto.Encrypt(botToken)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt bot token: %w", err)
	}
	tokenHash := crypto.HashToken(botToken)

	_, err = DB.Exec(Q(`
		INSERT INTO specialists (id, telegram_user_id, bot_token, bot_token_hash, bot_username, webhook_secret, name, timezone, cancel_cutoff_hrs)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`), id, telegramUserID, encryptedToken, tokenHash, botUsername, webhookSecret, name, timezone, cancelCutoffHrs)
	if err != nil {
		return nil, err
	}

	return GetSpecialistByID(id)
}

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

func UpdateSpecialistProfile(id, telegramHandle, phone, specialization, bio, photoURL string, locationLatitude, locationLongitude float64) (*models.Specialist, error) {
	_, err := DB.Exec(Q(`
		UPDATE specialists
		SET telegram_handle = ?, phone = ?, specialization = ?, bio = ?, photo_url = ?,
		    location_latitude = ?, location_longitude = ?
		WHERE id = ?
	`), telegramHandle, phone, specialization, bio, photoURL, locationLatitude, locationLongitude, id)
	if err != nil {
		return nil, err
	}
	return GetSpecialistByID(id)
}

func UpdateSpecialistAvailableDurations(id, durations string) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET available_durations = ? WHERE id = ?`), durations, id)
	return err
}

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

func UpdateSpecialistLanguage(specialistID, language string) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET language = ? WHERE id = ?`), language, specialistID)
	return err
}

func DeactivateSpecialist(id string) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET is_active = 0 WHERE id = ?`), id)
	return err
}

func ActivateSpecialist(id string) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET is_active = 1 WHERE id = ?`), id)
	return err
}
