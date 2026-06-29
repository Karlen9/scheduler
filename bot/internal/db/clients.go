package db

import (
	"database/sql"
	"strings"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Scans client.
*
* Parameters:
* - None.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func scanClient(row interface {
	Scan(dest ...interface{}) error
}) (*models.Client, error) {
	var c models.Client
	var phone, photoURL sql.NullString
	var preferredDuration sql.NullInt64
	var isGhost sql.NullInt64
	var isBlocked sql.NullInt64
	var photoRemoved sql.NullInt64
	var language, displayName, telegramUsername sql.NullString
	var notifyBookingStatus, notifyReminders, notifyDaysOff, notifyCancellations sql.NullInt64
	err := row.Scan(&c.ID, &c.TelegramUserID, &c.SpecialistID, &c.Name, &phone, &photoURL, &photoRemoved, &preferredDuration,
		&isGhost, &isBlocked, &notifyBookingStatus, &notifyReminders, &notifyDaysOff, &notifyCancellations, &c.CreatedAt, &language, &displayName, &telegramUsername)
	if err != nil {
		return nil, err
	}
	if phone.Valid {
		c.Phone = phone.String
	}
	if photoURL.Valid {
		c.PhotoURL = photoURL.String
	}
	c.PhotoRemoved = photoRemoved.Valid && photoRemoved.Int64 == 1
	if preferredDuration.Valid {
		c.PreferredDuration = int(preferredDuration.Int64)
	}
	c.IsGhost = isGhost.Valid && isGhost.Int64 == 1
	c.IsBlocked = isBlocked.Valid && isBlocked.Int64 == 1
	c.NotifyBookingStatus = !notifyBookingStatus.Valid || notifyBookingStatus.Int64 == 1
	c.NotifyReminders = !notifyReminders.Valid || notifyReminders.Int64 == 1
	c.NotifyDaysOff = notifyDaysOff.Valid && notifyDaysOff.Int64 == 1
	c.NotifyCancellations = !notifyCancellations.Valid || notifyCancellations.Int64 == 1
	c.Language = language.String
	if c.Language == "" {
		c.Language = "ru"
	}
	c.DisplayName = displayName.String
	c.TelegramUsername = telegramUsername.String
	return &c, nil
}

/***************************************************************************************************
* scanClientWithRef is used by queries that include the referred_via_code column appended to the
* standard client column list.
***************************************************************************************************/
func scanClientWithRef(row interface {
	Scan(dest ...interface{}) error
}) (*models.Client, error) {
	var c models.Client
	var phone, photoURL sql.NullString
	var preferredDuration sql.NullInt64
	var isGhost sql.NullInt64
	var isBlocked sql.NullInt64
	var photoRemoved sql.NullInt64
	var language, displayName, referredViaCode, telegramUsername sql.NullString
	var notifyBookingStatus, notifyReminders, notifyDaysOff, notifyCancellations sql.NullInt64
	err := row.Scan(&c.ID, &c.TelegramUserID, &c.SpecialistID, &c.Name, &phone, &photoURL, &photoRemoved, &preferredDuration,
		&isGhost, &isBlocked, &notifyBookingStatus, &notifyReminders, &notifyDaysOff, &notifyCancellations, &c.CreatedAt, &language, &displayName, &referredViaCode, &telegramUsername)
	if err != nil {
		return nil, err
	}
	if phone.Valid {
		c.Phone = phone.String
	}
	if photoURL.Valid {
		c.PhotoURL = photoURL.String
	}
	c.PhotoRemoved = photoRemoved.Valid && photoRemoved.Int64 == 1
	if preferredDuration.Valid {
		c.PreferredDuration = int(preferredDuration.Int64)
	}
	c.IsGhost = isGhost.Valid && isGhost.Int64 == 1
	c.IsBlocked = isBlocked.Valid && isBlocked.Int64 == 1
	c.NotifyBookingStatus = !notifyBookingStatus.Valid || notifyBookingStatus.Int64 == 1
	c.NotifyReminders = !notifyReminders.Valid || notifyReminders.Int64 == 1
	c.NotifyDaysOff = notifyDaysOff.Valid && notifyDaysOff.Int64 == 1
	c.NotifyCancellations = !notifyCancellations.Valid || notifyCancellations.Int64 == 1
	c.Language = language.String
	if c.Language == "" {
		c.Language = "ru"
	}
	c.DisplayName = displayName.String
	c.ReferredViaCode = referredViaCode.String
	c.TelegramUsername = telegramUsername.String
	return &c, nil
}

/***************************************************************************************************
* Returns client by telegram id.
*
* Parameters:
* - telegramUserID: Identifier used to target the current record.
* - specialistID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetClientByTelegramID(telegramUserID int64, specialistID string) (*models.Client, error) {
	row := DB.QueryRow(Q(`
		SELECT id, telegram_user_id, specialist_id, name, phone, photo_url, photo_removed, preferred_duration, is_ghost, is_blocked, notify_booking_status, notify_reminders, notify_days_off, notify_cancellations, created_at, language, display_name, telegram_username
		FROM clients
		WHERE telegram_user_id = ? AND specialist_id = ?
	`), telegramUserID, specialistID)

	c, err := scanClient(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

/***************************************************************************************************
* Returns client by id.
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
func GetClientByID(id string) (*models.Client, error) {
	row := DB.QueryRow(Q(`
		SELECT id, telegram_user_id, specialist_id, name, phone, photo_url, photo_removed, preferred_duration, is_ghost, is_blocked, notify_booking_status, notify_reminders, notify_days_off, notify_cancellations, created_at, language, display_name, telegram_username
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

/***************************************************************************************************
* Creates client.
*
* Parameters:
* - telegramUserID: Identifier used to target the current record.
* - specialistID: Identifier used to target the current record.
* - name: Name used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CreateClient(telegramUserID int64, specialistID string, name string) (*models.Client, error) {
	return CreateClientWithReferral(telegramUserID, specialistID, name, "")
}

/***************************************************************************************************
* CreateClientWithReferral creates a client and records the referral code used to acquire them
* (empty string means organic signup).
***************************************************************************************************/
func CreateClientWithReferral(telegramUserID int64, specialistID string, name string, referralCode string) (*models.Client, error) {
	id := uuid.New().String()

	if referralCode == "" {
		_, err := DB.Exec(Q(`
			INSERT INTO clients (id, telegram_user_id, specialist_id, name)
			VALUES (?, ?, ?, ?)
		`), id, telegramUserID, specialistID, name)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := DB.Exec(Q(`
			INSERT INTO clients (id, telegram_user_id, specialist_id, name, referred_via_code)
			VALUES (?, ?, ?, ?, ?)
		`), id, telegramUserID, specialistID, name, referralCode)
		if err != nil {
			return nil, err
		}
	}

	return GetClientByID(id)
}

/***************************************************************************************************
* Returns or create client.
*
* Parameters:
* - telegramUserID: Identifier used to target the current record.
* - specialistID: Identifier used to target the current record.
* - name: Name used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetOrCreateClient(telegramUserID int64, specialistID string, name string) (*models.Client, error) {
	return GetOrCreateClientWithReferral(telegramUserID, specialistID, name, "")
}

/***************************************************************************************************
* GetOrCreateClientWithReferral returns the existing client or creates a new one tagged with the
* referral code. Existing clients never have their referral code overwritten — referrals are only
* credited on initial signup.
***************************************************************************************************/
func GetOrCreateClientWithReferral(telegramUserID int64, specialistID string, name string, referralCode string) (*models.Client, error) {
	client, err := GetClientByTelegramID(telegramUserID, specialistID)
	if err != nil {
		return nil, err
	}
	if client != nil {
		return client, nil
	}
	return CreateClientWithReferral(telegramUserID, specialistID, name, referralCode)
}

/***************************************************************************************************
* Updates client name.
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - name: Name used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateClientName(clientID string, name string) error {
	_, err := DB.Exec(Q(`UPDATE clients SET name = ? WHERE id = ?`), name, clientID)
	return err
}

/***************************************************************************************************
* UpdateClientTelegramUsername refreshes the cached Telegram @username when the bot observes a new
* value from an incoming update. Stored stripped of any leading `@` so the mini app can compose
* `https://t.me/<username>` links without extra parsing.
***************************************************************************************************/
func UpdateClientTelegramUsername(clientID string, username string) error {
	_, err := DB.Exec(Q(`UPDATE clients SET telegram_username = ? WHERE id = ?`), username, clientID)
	return err
}

/***************************************************************************************************
* Updates client profile.
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - name: Name used by the current operation.
* - phone: Phone used by the current operation.
* - preferredDuration: Duration value used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateClientProfile(clientID string, name string, phone string, preferredDuration int) error {
	_, err := DB.Exec(Q(`UPDATE clients SET name = ?, phone = ?, preferred_duration = ? WHERE id = ?`), name, phone, preferredDuration, clientID)
	return err
}

/***************************************************************************************************
* Updates client notification prefs.
*
* Parameters:
* - notifyDaysOff: Notify days off used by the current operation.
* - notifyReminders: Notify reminders used by the current operation.
* - notifyBookingStatus: Notify booking status used by the current operation.
* - clientID: Identifier used to target the current record.
* - notifyCancellations: Notify cancellations used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateClientNotificationPrefs(clientID string, notifyBookingStatus, notifyReminders, notifyDaysOff, notifyCancellations bool) error {
	_, err := DB.Exec(Q(`UPDATE clients SET notify_booking_status = ?, notify_reminders = ?, notify_days_off = ?, notify_cancellations = ? WHERE id = ?`),
		boolToInt(notifyBookingStatus), boolToInt(notifyReminders), boolToInt(notifyDaysOff), boolToInt(notifyCancellations), clientID)
	return err
}

/***************************************************************************************************
* Implements the bool to int logic used by this module.
*
* Parameters:
* - b: B used by the current operation.
*
* Returns:
* - The computed value for the current operation as int.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

/***************************************************************************************************
* Updates client photo.
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - fileID: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateClientPhoto(clientID, fileID string) error {
	_, err := DB.Exec(Q(`UPDATE clients SET photo_url = ?, photo_removed = 0 WHERE id = ?`), fileID, clientID)
	return err
}

/***************************************************************************************************
* Updates specialist photo.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - fileID: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateSpecialistPhoto(specialistID, fileID string) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET photo_url = ?, photo_removed = 0 WHERE id = ?`), fileID, specialistID)
	return err
}

/***************************************************************************************************
* MarkSpecialistPhotoRemoved clears the specialist's photo and records the explicit removal so the
* middleware does not silently restore a Telegram profile photo on subsequent requests.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func MarkSpecialistPhotoRemoved(specialistID string) error {
	_, err := DB.Exec(Q(`UPDATE specialists SET photo_url = '', photo_removed = 1 WHERE id = ?`), specialistID)
	return err
}

/***************************************************************************************************
* Returns clients by specialist id.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetClientsBySpecialistID(specialistID string) ([]models.Client, error) {
	rows, err := DB.Query(Q(`
		SELECT id, telegram_user_id, specialist_id, name, phone, photo_url, photo_removed, preferred_duration, is_ghost, is_blocked, notify_booking_status, notify_reminders, notify_days_off, notify_cancellations, created_at, language, display_name, telegram_username
		FROM clients
		WHERE specialist_id = ?
		ORDER BY name ASC
	`), specialistID)
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

func GetClientsBySpecialistIDPaged(specialistID, search string, limit, offset int) ([]models.Client, int, error) {
	whereClauses := []string{"specialist_id = ?"}
	args := []interface{}{specialistID}

	if trimmed := strings.TrimSpace(search); trimmed != "" {
		like := "%" + trimmed + "%"
		whereClauses = append(whereClauses, `(name LIKE ? OR COALESCE(display_name, '') LIKE ? OR COALESCE(phone, '') LIKE ? OR COALESCE(telegram_username, '') LIKE ?)`)
		args = append(args, like, like, like, like)
	}

	whereClause := strings.Join(whereClauses, " AND ")

	var total int
	if err := DB.QueryRow(Q(`
		SELECT COUNT(*)
		FROM clients
		WHERE `+whereClause), args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	queryArgs := append([]interface{}{}, args...)
	queryArgs = append(queryArgs, limit, offset)

	rows, err := DB.Query(Q(`
		SELECT id, telegram_user_id, specialist_id, name, phone, photo_url, photo_removed, preferred_duration, is_ghost, is_blocked, notify_booking_status, notify_reminders, notify_days_off, notify_cancellations, created_at, language, display_name, telegram_username
		FROM clients
		WHERE `+whereClause+`
		ORDER BY
			(telegram_user_id = (SELECT telegram_user_id FROM specialists WHERE id = clients.specialist_id)) DESC,
			name ASC
		LIMIT ? OFFSET ?
	`), queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var clients []models.Client
	for rows.Next() {
		c, err := scanClient(rows)
		if err != nil {
			return nil, 0, err
		}
		clients = append(clients, *c)
	}

	return clients, total, rows.Err()
}

/***************************************************************************************************
* DeleteClientCascade removes a client along with all records that reference it
* (bookings, recurring_schedules). Runs in a single transaction so a mid-delete
* failure leaves no orphaned rows.
***************************************************************************************************/
func DeleteClientCascade(clientID string) error {
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(Q(`DELETE FROM bookings WHERE client_id = ?`), clientID); err != nil {
		return err
	}
	if _, err := tx.Exec(Q(`DELETE FROM recurring_schedules WHERE client_id = ?`), clientID); err != nil {
		return err
	}
	if _, err := tx.Exec(Q(`DELETE FROM client_batches WHERE client_id = ?`), clientID); err != nil {
		return err
	}
	if _, err := tx.Exec(Q(`DELETE FROM clients WHERE id = ?`), clientID); err != nil {
		return err
	}

	return tx.Commit()
}

/***************************************************************************************************
* Updates client display name.
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - displayName: Display name used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateClientDisplayName(clientID string, displayName string) error {
	_, err := DB.Exec(Q(`UPDATE clients SET display_name = ? WHERE id = ?`), displayName, clientID)
	return err
}

/***************************************************************************************************
* Updates ghost client name.
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - name: Name used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateGhostClientName(clientID string, name string) error {
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(Q(`UPDATE clients SET name = ? WHERE id = ?`), name, clientID); err != nil {
		return err
	}
	if _, err := tx.Exec(Q(`UPDATE bookings SET client_name = ? WHERE client_id = ?`), name, clientID); err != nil {
		return err
	}
	if _, err := tx.Exec(Q(`UPDATE recurring_schedules SET client_name = ? WHERE client_id = ?`), name, clientID); err != nil {
		return err
	}
	return tx.Commit()
}

/***************************************************************************************************
* Updates client language.
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - language: Language used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateClientLanguage(clientID, language string) error {
	_, err := DB.Exec(Q(`UPDATE clients SET language = ? WHERE id = ?`), language, clientID)
	return err
}

/***************************************************************************************************
* Creates ghost client.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - name: Name used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CreateGhostClient(specialistID, name string) (*models.Client, error) {
	id := uuid.New().String()
	fakeTelegramID := -time.Now().UnixNano()

	_, err := DB.Exec(Q(`
		INSERT INTO clients (id, telegram_user_id, specialist_id, name, is_ghost)
		VALUES (?, ?, ?, ?, 1)
	`), id, fakeTelegramID, specialistID, name)
	if err != nil {
		return nil, err
	}

	return GetClientByID(id)
}

func SetClientBlocked(clientID string, blocked bool) error {
	_, err := DB.Exec(Q(`UPDATE clients SET is_blocked = ? WHERE id = ?`), boolToInt(blocked), clientID)
	return err
}

func CancelAllClientBookings(clientID, specialistID string) (int, error) {
	result, err := DB.Exec(Q(`UPDATE bookings SET status = 'cancelled', cancelled_by = 'specialist' WHERE client_id = ? AND specialist_id = ? AND status IN ('pending', 'confirmed')`), clientID, specialistID)
	if err != nil {
		return 0, err
	}
	n, _ := result.RowsAffected()
	return int(n), nil
}

func CancelAllClientRecurring(clientID, specialistID string) (int, error) {
	result, err := DB.Exec(Q(`UPDATE recurring_schedules SET status = 'cancelled' WHERE client_id = ? AND specialist_id = ? AND status IN ('pending', 'active')`), clientID, specialistID)
	if err != nil {
		return 0, err
	}
	n, _ := result.RowsAffected()
	return int(n), nil
}
