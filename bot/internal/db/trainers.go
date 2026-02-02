package db

import (
	"database/sql"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

func GetTrainerByTelegramID(telegramUserID int64) (*models.Trainer, error) {
	var t models.Trainer
	err := DB.QueryRow(`
		SELECT id, telegram_user_id, bot_token, name, timezone, cancel_cutoff_hrs, created_at
		FROM trainers
		WHERE telegram_user_id = ?
	`, telegramUserID).Scan(&t.ID, &t.TelegramUserID, &t.BotToken, &t.Name, &t.Timezone, &t.CancelCutoffHrs, &t.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func GetTrainerByID(id string) (*models.Trainer, error) {
	var t models.Trainer
	err := DB.QueryRow(`
		SELECT id, telegram_user_id, bot_token, name, timezone, cancel_cutoff_hrs, created_at
		FROM trainers
		WHERE id = ?
	`, id).Scan(&t.ID, &t.TelegramUserID, &t.BotToken, &t.Name, &t.Timezone, &t.CancelCutoffHrs, &t.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func GetFirstTrainer() (*models.Trainer, error) {
	var t models.Trainer
	err := DB.QueryRow(`
		SELECT id, telegram_user_id, bot_token, name, timezone, cancel_cutoff_hrs, created_at
		FROM trainers
		LIMIT 1
	`).Scan(&t.ID, &t.TelegramUserID, &t.BotToken, &t.Name, &t.Timezone, &t.CancelCutoffHrs, &t.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func CreateTrainer(telegramUserID int64, botToken, name, timezone string, cancelCutoffHrs int) (*models.Trainer, error) {
	id := uuid.New().String()

	_, err := DB.Exec(`
		INSERT INTO trainers (id, telegram_user_id, bot_token, name, timezone, cancel_cutoff_hrs)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, telegramUserID, botToken, name, timezone, cancelCutoffHrs)
	if err != nil {
		return nil, err
	}

	return GetTrainerByID(id)
}

func UpsertTrainer(telegramUserID int64, botToken, name, timezone string, cancelCutoffHrs int) (*models.Trainer, error) {
	// Check if exists
	existing, err := GetTrainerByTelegramID(telegramUserID)
	if err != nil {
		return nil, err
	}

	if existing != nil {
		// Update existing
		_, err = DB.Exec(`
			UPDATE trainers
			SET bot_token = ?, name = ?, timezone = ?, cancel_cutoff_hrs = ?
			WHERE id = ?
		`, botToken, name, timezone, cancelCutoffHrs, existing.ID)
		if err != nil {
			return nil, err
		}
		return GetTrainerByID(existing.ID)
	}

	return CreateTrainer(telegramUserID, botToken, name, timezone, cancelCutoffHrs)
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
