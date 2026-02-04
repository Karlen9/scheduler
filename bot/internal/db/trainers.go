package db

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

func generateWebhookSecret() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func scanTrainer(row interface{ Scan(...any) error }) (*models.Trainer, error) {
	var t models.Trainer
	err := row.Scan(
		&t.ID, &t.TelegramUserID, &t.BotToken, &t.BotUsername,
		&t.WebhookSecret, &t.Name, &t.Timezone, &t.CancelCutoffHrs,
		&t.IsActive, &t.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

const trainerColumns = `id, telegram_user_id, bot_token, bot_username, webhook_secret, name, timezone, cancel_cutoff_hrs, is_active, created_at`

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
	row := DB.QueryRow(`
		SELECT `+trainerColumns+`
		FROM trainers
		WHERE bot_token = ?
	`, botToken)
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

	_, err := DB.Exec(`
		INSERT INTO trainers (id, telegram_user_id, bot_token, bot_username, webhook_secret, name, timezone, cancel_cutoff_hrs)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, id, telegramUserID, botToken, botUsername, webhookSecret, name, timezone, cancelCutoffHrs)
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

func DeactivateTrainer(id string) error {
	_, err := DB.Exec(`UPDATE trainers SET is_active = 0 WHERE id = ?`, id)
	return err
}

func ActivateTrainer(id string) error {
	_, err := DB.Exec(`UPDATE trainers SET is_active = 1 WHERE id = ?`, id)
	return err
}
