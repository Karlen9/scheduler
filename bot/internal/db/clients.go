package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

func scanClient(row interface {
	Scan(dest ...interface{}) error
}) (*models.Client, error) {
	var c models.Client
	var phone, photoURL sql.NullString
	var preferredDuration sql.NullInt64
	var isGhost sql.NullInt64
	var language sql.NullString
	var notifyBookingStatus, notifyReminders, notifyDaysOff, notifyCancellations sql.NullInt64
	err := row.Scan(&c.ID, &c.TelegramUserID, &c.TrainerID, &c.Name, &phone, &photoURL, &preferredDuration,
		&isGhost, &notifyBookingStatus, &notifyReminders, &notifyDaysOff, &notifyCancellations, &c.CreatedAt, &language)
	if err != nil {
		return nil, err
	}
	if phone.Valid {
		c.Phone = phone.String
	}
	if photoURL.Valid {
		c.PhotoURL = photoURL.String
	}
	if preferredDuration.Valid {
		c.PreferredDuration = int(preferredDuration.Int64)
	}
	c.IsGhost = isGhost.Valid && isGhost.Int64 == 1
	c.NotifyBookingStatus = !notifyBookingStatus.Valid || notifyBookingStatus.Int64 == 1
	c.NotifyReminders = !notifyReminders.Valid || notifyReminders.Int64 == 1
	c.NotifyDaysOff = notifyDaysOff.Valid && notifyDaysOff.Int64 == 1
	c.NotifyCancellations = !notifyCancellations.Valid || notifyCancellations.Int64 == 1
	c.Language = language.String
	if c.Language == "" {
		c.Language = "ru"
	}
	return &c, nil
}

func GetClientByTelegramID(telegramUserID int64, trainerID string) (*models.Client, error) {
	row := DB.QueryRow(Q(`
		SELECT id, telegram_user_id, trainer_id, name, phone, photo_url, preferred_duration, is_ghost, notify_booking_status, notify_reminders, notify_days_off, notify_cancellations, created_at, language
		FROM clients
		WHERE telegram_user_id = ? AND trainer_id = ?
	`), telegramUserID, trainerID)

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
	row := DB.QueryRow(Q(`
		SELECT id, telegram_user_id, trainer_id, name, phone, photo_url, preferred_duration, is_ghost, notify_booking_status, notify_reminders, notify_days_off, notify_cancellations, created_at, language
		FROM clients
		WHERE id = ?
	`), id)

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

	_, err := DB.Exec(Q(`
		INSERT INTO clients (id, telegram_user_id, trainer_id, name)
		VALUES (?, ?, ?, ?)
	`), id, telegramUserID, trainerID, name)
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
	_, err := DB.Exec(Q(`UPDATE clients SET name = ? WHERE id = ?`), name, clientID)
	return err
}

func UpdateClientProfile(clientID string, name string, phone string, preferredDuration int) error {
	_, err := DB.Exec(Q(`UPDATE clients SET name = ?, phone = ?, preferred_duration = ? WHERE id = ?`), name, phone, preferredDuration, clientID)
	return err
}

func UpdateClientNotificationPrefs(clientID string, notifyBookingStatus, notifyReminders, notifyDaysOff, notifyCancellations bool) error {
	_, err := DB.Exec(Q(`UPDATE clients SET notify_booking_status = ?, notify_reminders = ?, notify_days_off = ?, notify_cancellations = ? WHERE id = ?`),
		boolToInt(notifyBookingStatus), boolToInt(notifyReminders), boolToInt(notifyDaysOff), boolToInt(notifyCancellations), clientID)
	return err
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func UpdateClientPhoto(clientID, fileID string) error {
	_, err := DB.Exec(Q(`UPDATE clients SET photo_url = ? WHERE id = ?`), fileID, clientID)
	return err
}

func UpdateTrainerPhoto(trainerID, fileID string) error {
	_, err := DB.Exec(Q(`UPDATE trainers SET photo_url = ? WHERE id = ?`), fileID, trainerID)
	return err
}

func GetClientsByTrainerID(trainerID string) ([]models.Client, error) {
	rows, err := DB.Query(Q(`
		SELECT id, telegram_user_id, trainer_id, name, phone, photo_url, preferred_duration, is_ghost, notify_booking_status, notify_reminders, notify_days_off, notify_cancellations, created_at, language
		FROM clients
		WHERE trainer_id = ?
		ORDER BY name ASC
	`), trainerID)
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

func DeleteClient(clientID string) error {
	_, err := DB.Exec(Q(`DELETE FROM clients WHERE id = ?`), clientID)
	return err
}

func UpdateClientLanguage(clientID, language string) error {
	_, err := DB.Exec(Q(`UPDATE clients SET language = ? WHERE id = ?`), language, clientID)
	return err
}

func CreateGhostClient(trainerID, name string) (*models.Client, error) {
	id := uuid.New().String()
	fakeTelegramID := -time.Now().UnixNano()

	_, err := DB.Exec(Q(`
		INSERT INTO clients (id, telegram_user_id, trainer_id, name, is_ghost)
		VALUES (?, ?, ?, ?, 1)
	`), id, fakeTelegramID, trainerID, name)
	if err != nil {
		return nil, err
	}

	return GetClientByID(id)
}
