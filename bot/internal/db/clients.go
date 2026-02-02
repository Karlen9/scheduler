package db

import (
	"database/sql"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

func GetClientByTelegramID(telegramUserID int64, trainerID string) (*models.Client, error) {
	var c models.Client
	err := DB.QueryRow(`
		SELECT id, telegram_user_id, trainer_id, name, created_at
		FROM clients
		WHERE telegram_user_id = ? AND trainer_id = ?
	`, telegramUserID, trainerID).Scan(&c.ID, &c.TelegramUserID, &c.TrainerID, &c.Name, &c.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func GetClientByID(id string) (*models.Client, error) {
	var c models.Client
	err := DB.QueryRow(`
		SELECT id, telegram_user_id, trainer_id, name, created_at
		FROM clients
		WHERE id = ?
	`, id).Scan(&c.ID, &c.TelegramUserID, &c.TrainerID, &c.Name, &c.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func CreateClient(telegramUserID int64, trainerID string, name string) (*models.Client, error) {
	id := uuid.New().String()

	_, err := DB.Exec(`
		INSERT INTO clients (id, telegram_user_id, trainer_id, name)
		VALUES (?, ?, ?, ?)
	`, id, telegramUserID, trainerID, name)
	if err != nil {
		return nil, err
	}

	return GetClientByID(id)
}

func GetOrCreateClient(telegramUserID int64, trainerID string, name string) (*models.Client, error) {
	client, err := GetClientByTelegramID(telegramUserID, trainerID)
	if err != nil {
		return nil, err
	}
	if client != nil {
		return client, nil
	}
	return CreateClient(telegramUserID, trainerID, name)
}

func UpdateClientName(clientID string, name string) error {
	_, err := DB.Exec(`UPDATE clients SET name = ? WHERE id = ?`, name, clientID)
	return err
}
