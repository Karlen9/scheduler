package db

import (
	"database/sql"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

func scanClient(row interface{ Scan(dest ...interface{}) error }) (*models.Client, error) {
	var c models.Client
	var phone sql.NullString
	var preferredDuration sql.NullInt64
	var notifyBookingStatus, notifyReminders, notifyDaysOff sql.NullInt64
	err := row.Scan(&c.ID, &c.TelegramUserID, &c.TrainerID, &c.Name, &phone, &preferredDuration,
		&notifyBookingStatus, &notifyReminders, &notifyDaysOff, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	if phone.Valid {
		c.Phone = phone.String
	}
	if preferredDuration.Valid {
		c.PreferredDuration = int(preferredDuration.Int64)
	}
	c.NotifyBookingStatus = !notifyBookingStatus.Valid || notifyBookingStatus.Int64 == 1
	c.NotifyReminders = !notifyReminders.Valid || notifyReminders.Int64 == 1
	c.NotifyDaysOff = notifyDaysOff.Valid && notifyDaysOff.Int64 == 1
	return &c, nil
}

func GetClientByTelegramID(telegramUserID int64, trainerID string) (*models.Client, error) {
	row := DB.QueryRow(`
		SELECT id, telegram_user_id, trainer_id, name, phone, preferred_duration, notify_booking_status, notify_reminders, notify_days_off, created_at
		FROM clients
		WHERE telegram_user_id = ? AND trainer_id = ?
	`, telegramUserID, trainerID)

	c, err := scanClient(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func GetClientByID(id string) (*models.Client, error) {
	row := DB.QueryRow(`
		SELECT id, telegram_user_id, trainer_id, name, phone, preferred_duration, notify_booking_status, notify_reminders, notify_days_off, created_at
		FROM clients
		WHERE id = ?
	`, id)

	c, err := scanClient(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return c, nil
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

func UpdateClientProfile(clientID string, name string, phone string, preferredDuration int) error {
	_, err := DB.Exec(`UPDATE clients SET name = ?, phone = ?, preferred_duration = ? WHERE id = ?`, name, phone, preferredDuration, clientID)
	return err
}

func UpdateClientNotificationPrefs(clientID string, notifyBookingStatus, notifyReminders, notifyDaysOff bool) error {
	_, err := DB.Exec(`UPDATE clients SET notify_booking_status = ?, notify_reminders = ?, notify_days_off = ? WHERE id = ?`,
		boolToInt(notifyBookingStatus), boolToInt(notifyReminders), boolToInt(notifyDaysOff), clientID)
	return err
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func GetClientsByTrainerID(trainerID string) ([]models.Client, error) {
	rows, err := DB.Query(`
		SELECT id, telegram_user_id, trainer_id, name, phone, preferred_duration, notify_booking_status, notify_reminders, notify_days_off, created_at
		FROM clients
		WHERE trainer_id = ?
		ORDER BY name ASC
	`, trainerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clients []models.Client
	for rows.Next() {
		c, err := scanClient(rows)
		if err != nil {
			return nil, err
		}
		clients = append(clients, *c)
	}
	return clients, rows.Err()
}
