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

func scanTrainer(row interface{ Scan(...any) error }) (*models.Trainer, error) {
	var t models.Trainer
	var telegramHandle, phone, specialization, bio, photoURL, gymAddress sql.NullString
	err := row.Scan(
		&t.ID, &t.TelegramUserID, &t.BotToken, &t.BotUsername,
		&t.WebhookSecret, &t.Name, &t.Timezone, &t.CancelCutoffHrs,
		&telegramHandle, &phone, &specialization, &bio, &photoURL,
		&t.GymLatitude, &t.GymLongitude, &gymAddress, // gymAddress scanned but unused
		&t.IsActive, &t.CreatedAt,
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

	// Decrypt bot token (passthrough for plain text)
	t.BotToken, err = crypto.Decrypt(t.BotToken)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt bot token for trainer %s: %w", t.ID, err)
	}

	return &t, nil
}

const trainerColumns = `id, telegram_user_id, bot_token, bot_username, webhook_secret, name, timezone, cancel_cutoff_hrs, telegram_handle, phone, specialization, bio, photo_url, gym_latitude, gym_longitude, gym_address, is_active, created_at`

func GetTrainerByTelegramID(telegramUserID int64) (*models.Trainer, error) {
	row := DB.QueryRow(`
		SELECT `+trainerColumns+`
		FROM trainers
		WHERE telegram_user_id = ?
	`, telegramUserID)
	return scanTrainer(row)
}

func GetTrainerByID(id string) (*models.Trainer, error) {
	row := DB.QueryRow(`
		SELECT `+trainerColumns+`
		FROM trainers
		WHERE id = ?
	`, id)
	return scanTrainer(row)
}

func GetTrainerByWebhookSecret(secret string) (*models.Trainer, error) {
	row := DB.QueryRow(`
		SELECT `+trainerColumns+`
		FROM trainers
		WHERE webhook_secret = ? AND is_active = 1
	`, secret)
	return scanTrainer(row)
}

func GetTrainerByBotToken(botToken string) (*models.Trainer, error) {
	tokenHash := crypto.HashToken(botToken)
	row := DB.QueryRow(`
		SELECT `+trainerColumns+`
		FROM trainers
		WHERE bot_token_hash = ?
	`, tokenHash)
	return scanTrainer(row)
}

func GetFirstTrainer() (*models.Trainer, error) {
	row := DB.QueryRow(`
		SELECT ` + trainerColumns + `
		FROM trainers
		WHERE is_active = 1
		LIMIT 1
	`)
	return scanTrainer(row)
}

func GetAllActiveTrainers() ([]models.Trainer, error) {
	rows, err := DB.Query(`
		SELECT ` + trainerColumns + `
		FROM trainers
		WHERE is_active = 1
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trainers []models.Trainer
	for rows.Next() {
		t, err := scanTrainer(rows)
		if err != nil {
			return nil, err
		}
		if t != nil {
			trainers = append(trainers, *t)
		}
	}
	return trainers, rows.Err()
}

func CreateTrainer(telegramUserID int64, botToken, botUsername, name, timezone string, cancelCutoffHrs int) (*models.Trainer, error) {
	id := uuid.New().String()
	webhookSecret := generateWebhookSecret()

	encryptedToken, err := crypto.Encrypt(botToken)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt bot token: %w", err)
	}
	tokenHash := crypto.HashToken(botToken)

	_, err = DB.Exec(`
		INSERT INTO trainers (id, telegram_user_id, bot_token, bot_token_hash, bot_username, webhook_secret, name, timezone, cancel_cutoff_hrs)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, telegramUserID, encryptedToken, tokenHash, botUsername, webhookSecret, name, timezone, cancelCutoffHrs)
	if err != nil {
		return nil, err
	}

	return GetTrainerByID(id)
}

func UpdateTrainer(id, name, timezone string, cancelCutoffHrs int) (*models.Trainer, error) {
	_, err := DB.Exec(`
		UPDATE trainers
		SET name = ?, timezone = ?, cancel_cutoff_hrs = ?
		WHERE id = ?
	`, name, timezone, cancelCutoffHrs, id)
	if err != nil {
		return nil, err
	}
	return GetTrainerByID(id)
}

func UpdateTrainerProfile(id, telegramHandle, phone, specialization, bio, photoURL string, gymLatitude, gymLongitude float64) (*models.Trainer, error) {
	_, err := DB.Exec(`
		UPDATE trainers
		SET telegram_handle = ?, phone = ?, specialization = ?, bio = ?, photo_url = ?,
		    gym_latitude = ?, gym_longitude = ?
		WHERE id = ?
	`, telegramHandle, phone, specialization, bio, photoURL, gymLatitude, gymLongitude, id)
	if err != nil {
		return nil, err
	}
	return GetTrainerByID(id)
}

func DeactivateTrainer(id string) error {
	_, err := DB.Exec(`UPDATE trainers SET is_active = 0 WHERE id = ?`, id)
	return err
}

func ActivateTrainer(id string) error {
	_, err := DB.Exec(`UPDATE trainers SET is_active = 1 WHERE id = ?`, id)
	return err
}
