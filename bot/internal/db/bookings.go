package db

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

func CreateBooking(trainerID, clientID, sessionTypeID string, startsAt, endsAt time.Time, clientName, clientMessage string, durationMinutes int) (*models.Booking, error) {
	id := uuid.New().String()

	_, err := DB.Exec(Q(`
		INSERT INTO bookings (id, trainer_id, client_id, session_type_id, starts_at, ends_at, client_name, client_message, status, duration_minutes)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
	`), id, trainerID, clientID, sessionTypeID, startsAt, endsAt, clientName, clientMessage, durationMinutes)
	if err != nil {
		return nil, err
	}

	return GetBookingByID(id)
}

// bookingColumns is the standard column list for booking queries.
// Must match scanBookingRow field order exactly.
const bookingColumns = `id, trainer_id, client_id, session_type_id, starts_at, ends_at,
	client_name, client_message, status, cancel_reason, cancelled_by, created_at,
	duration_minutes, created_by, recurring_schedule_id, replaces_booking_id`

func GetBookingByID(id string) (*models.Booking, error) {
	var b models.Booking
	var clientMessage sql.NullString
	var cancelReason sql.NullString
	var cancelledBy sql.NullString
	var durationMinutes sql.NullInt64
	var createdBy sql.NullString
	var recurringScheduleID sql.NullString
	var replacesBookingID sql.NullString

	err := DB.QueryRow(Q(`
		SELECT `+bookingColumns+`
		FROM bookings
		WHERE id = ?
	`), id).Scan(&b.ID, &b.TrainerID, &b.ClientID, &b.SessionTypeID, &b.StartsAt, &b.EndsAt,
		&b.ClientName, &clientMessage, &b.Status, &cancelReason, &cancelledBy, &b.CreatedAt,
		&durationMinutes, &createdBy, &recurringScheduleID, &replacesBookingID)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if clientMessage.Valid {
		b.ClientMessage = clientMessage.String
	}
	if cancelReason.Valid {
		b.CancelReason = cancelReason.String
	}
	if cancelledBy.Valid {
		b.CancelledBy = models.CancelledBy(cancelledBy.String)
	}
	if durationMinutes.Valid {
		b.DurationMinutes = int(durationMinutes.Int64)
	}
	if createdBy.Valid {
		b.CreatedBy = createdBy.String
	}
	if recurringScheduleID.Valid {
		b.RecurringScheduleID = recurringScheduleID.String
	}
	if replacesBookingID.Valid {
		b.ReplacesBookingID = replacesBookingID.String
	}

	// Load session type
	st, err := GetSessionTypeByID(b.SessionTypeID)
	if err != nil {
		return nil, err
	}
	b.SessionType = st

	return &b, nil
}

func GetBookingsByClientID(clientID string) ([]models.Booking, error) {
	rows, err := DB.Query(Q(`
		SELECT `+bookingColumns+`
		FROM bookings
		WHERE client_id = ?
		ORDER BY starts_at DESC
	`), clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanBookings(rows)
}

func GetActiveBookingsByClientID(clientID string) ([]models.Booking, error) {
	rows, err := DB.Query(Q(`
		SELECT `+bookingColumns+`
		FROM bookings
		WHERE client_id = ? AND status IN ('pending', 'confirmed')
		ORDER BY starts_at ASC
	`), clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanBookings(rows)
}

func GetBookingsByTrainerIDAndDateRange(trainerID string, start, end time.Time) ([]models.Booking, error) {
	rows, err := DB.Query(Q(`
		SELECT `+bookingColumns+`
		FROM bookings
		WHERE trainer_id = ? AND starts_at >= ? AND starts_at < ? AND status IN ('pending', 'confirmed')
		ORDER BY starts_at ASC
	`), trainerID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanBookings(rows)
}

func scanBookings(rows *sql.Rows) ([]models.Booking, error) {
	var bookings []models.Booking
	for rows.Next() {
		var b models.Booking
		var clientMessage sql.NullString
		var cancelReason sql.NullString
		var cancelledBy sql.NullString
		var durationMinutes sql.NullInt64
		var createdBy sql.NullString
		var recurringScheduleID sql.NullString
		var replacesBookingID sql.NullString

		if err := rows.Scan(&b.ID, &b.TrainerID, &b.ClientID, &b.SessionTypeID, &b.StartsAt, &b.EndsAt,
			&b.ClientName, &clientMessage, &b.Status, &cancelReason, &cancelledBy, &b.CreatedAt,
			&durationMinutes, &createdBy, &recurringScheduleID, &replacesBookingID); err != nil {
			return nil, err
		}

		if clientMessage.Valid {
			b.ClientMessage = clientMessage.String
		}
		if cancelReason.Valid {
			b.CancelReason = cancelReason.String
		}
		if cancelledBy.Valid {
			b.CancelledBy = models.CancelledBy(cancelledBy.String)
		}
		if durationMinutes.Valid {
			b.DurationMinutes = int(durationMinutes.Int64)
		}
		if createdBy.Valid {
			b.CreatedBy = createdBy.String
		}
		if recurringScheduleID.Valid {
			b.RecurringScheduleID = recurringScheduleID.String
		}
		if replacesBookingID.Valid {
			b.ReplacesBookingID = replacesBookingID.String
		}

		// Load session type
		st, err := GetSessionTypeByID(b.SessionTypeID)
		if err != nil {
			return nil, err
		}
		b.SessionType = st

		bookings = append(bookings, b)
	}

	return bookings, rows.Err()
}

func UpdateBookingStatus(bookingID string, status models.BookingStatus) error {
	_, err := DB.Exec(Q(`UPDATE bookings SET status = ? WHERE id = ?`), status, bookingID)
	return err
}

func CancelBooking(bookingID string, reason string, cancelledBy models.CancelledBy) error {
	_, err := DB.Exec(Q(`
		UPDATE bookings
		SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?
		WHERE id = ?
	`), reason, cancelledBy, bookingID)
	return err
}

func HasConflictingBooking(trainerID string, startsAt, endsAt time.Time, excludeBookingID string) (bool, error) {
	var count int
	err := DB.QueryRow(Q(`
		SELECT COUNT(*) FROM bookings
		WHERE trainer_id = ?
		  AND id != ?
		  AND status IN ('pending', 'confirmed')
		  AND starts_at < ?
		  AND ends_at > ?
	`), trainerID, excludeBookingID, endsAt, startsAt).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func GetBookingsByTrainerID(trainerID string, status string) ([]models.Booking, error) {
	var rows *sql.Rows
	var err error

	if status != "" {
		rows, err = DB.Query(Q(`
			SELECT `+bookingColumns+`
			FROM bookings
			WHERE trainer_id = ? AND status = ?
			ORDER BY starts_at DESC
		`), trainerID, status)
	} else {
		rows, err = DB.Query(Q(`
			SELECT `+bookingColumns+`
			FROM bookings
			WHERE trainer_id = ?
			ORDER BY starts_at DESC
		`), trainerID)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanBookings(rows)
}

// GetBookingsNeedingReminder returns confirmed bookings starting within the next hour
// that haven't had a reminder sent yet.
func GetBookingsNeedingReminder() ([]models.Booking, error) {
	now := time.Now().UTC()
	oneHourLater := now.Add(time.Hour)

	rows, err := DB.Query(Q(`
		SELECT `+bookingColumns+`
		FROM bookings
		WHERE status = 'confirmed'
		  AND reminder_sent = 0
		  AND starts_at > ?
		  AND starts_at <= ?
		ORDER BY starts_at ASC
	`), now, oneHourLater)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanBookings(rows)
}

func MarkReminderSent(bookingID string) error {
	_, err := DB.Exec(Q(`UPDATE bookings SET reminder_sent = 1 WHERE id = ?`), bookingID)
	return err
}

func ClientHasBookingOnDate(clientID string, date time.Time) (bool, error) {
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	endOfDay := startOfDay.AddDate(0, 0, 1)

	var count int
	err := DB.QueryRow(Q(`
		SELECT COUNT(*) FROM bookings
		WHERE client_id = ?
		  AND status IN ('pending', 'confirmed')
		  AND starts_at >= ?
		  AND starts_at < ?
	`), clientID, startOfDay, endOfDay).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func CreateBookingByTrainer(trainerID, clientID, sessionTypeID string, startsAt, endsAt time.Time, clientName, clientMessage string, durationMinutes int) (*models.Booking, error) {
	id := uuid.New().String()

	_, err := DB.Exec(Q(`
		INSERT INTO bookings (id, trainer_id, client_id, session_type_id, starts_at, ends_at, client_name, client_message, status, duration_minutes, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'trainer')
	`), id, trainerID, clientID, sessionTypeID, startsAt, endsAt, clientName, clientMessage, durationMinutes)
	if err != nil {
		return nil, err
	}

	return GetBookingByID(id)
}

func CreateRecurringBooking(trainerID, clientID, sessionTypeID string, startsAt, endsAt time.Time, clientName string, durationMinutes int, recurringScheduleID string) (*models.Booking, error) {
	id := uuid.New().String()

	_, err := DB.Exec(Q(`
		INSERT INTO bookings (id, trainer_id, client_id, session_type_id, starts_at, ends_at, client_name, client_message, status, duration_minutes, recurring_schedule_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, '', 'confirmed', ?, ?)
	`), id, trainerID, clientID, sessionTypeID, startsAt, endsAt, clientName, durationMinutes, recurringScheduleID)
	if err != nil {
		return nil, err
	}

	return GetBookingByID(id)
}

func ConfirmBookingsByRecurringScheduleID(scheduleID string) (int, error) {
	result, err := DB.Exec(Q(`UPDATE bookings SET status = 'confirmed' WHERE recurring_schedule_id = ? AND status = 'pending'`), scheduleID)
	if err != nil {
		return 0, err
	}
	n, err := result.RowsAffected()
	return int(n), err
}

func RejectBookingsByRecurringScheduleID(scheduleID string) (int, error) {
	result, err := DB.Exec(Q(`UPDATE bookings SET status = 'rejected' WHERE recurring_schedule_id = ? AND status = 'pending'`), scheduleID)
	if err != nil {
		return 0, err
	}
	n, err := result.RowsAffected()
	return int(n), err
}

// RequestCancelBooking sets booking status to cancel_requested
func RequestCancelBooking(bookingID string, requestedBy models.CancelledBy) error {
	_, err := DB.Exec(Q(`UPDATE bookings SET status = 'cancel_requested', cancelled_by = ? WHERE id = ?`), requestedBy, bookingID)
	return err
}

// ApproveCancelBooking cancels the booking (approving a cancel request)
func ApproveCancelBooking(bookingID string) error {
	_, err := DB.Exec(Q(`UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status = 'cancel_requested'`), bookingID)
	return err
}

// DeclineCancelBooking reverts a cancel request back to confirmed
func DeclineCancelBooking(bookingID string) error {
	_, err := DB.Exec(Q(`UPDATE bookings SET status = 'confirmed', cancelled_by = NULL WHERE id = ? AND status = 'cancel_requested'`), bookingID)
	return err
}

// CreateRescheduleBooking creates a new booking that replaces an existing one (status = reschedule_pending)
func CreateRescheduleBooking(trainerID, clientID, sessionTypeID string, startsAt, endsAt time.Time, clientName string, durationMinutes int, recurringScheduleID, replacesBookingID string) (*models.Booking, error) {
	id := uuid.New().String()

	_, err := DB.Exec(Q(`
		INSERT INTO bookings (id, trainer_id, client_id, session_type_id, starts_at, ends_at, client_name, client_message, status, duration_minutes, recurring_schedule_id, replaces_booking_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, '', 'reschedule_pending', ?, ?, ?)
	`), id, trainerID, clientID, sessionTypeID, startsAt, endsAt, clientName, durationMinutes, recurringScheduleID, replacesBookingID)
	if err != nil {
		return nil, err
	}

	return GetBookingByID(id)
}

// ApproveRescheduleBooking confirms the new booking and cancels the old one
func ApproveRescheduleBooking(newBookingID string) error {
	newBooking, err := GetBookingByID(newBookingID)
	if err != nil || newBooking == nil {
		return fmt.Errorf("reschedule booking not found")
	}
	if newBooking.Status != models.BookingStatusReschedulePending {
		return fmt.Errorf("booking is not pending reschedule")
	}

	// Cancel the old booking
	if newBooking.ReplacesBookingID != "" {
		DB.Exec(Q(`UPDATE bookings SET status = 'cancelled', cancel_reason = 'Перенесена' WHERE id = ?`), newBooking.ReplacesBookingID)
	}

	// Confirm the new booking
	_, err = DB.Exec(Q(`UPDATE bookings SET status = 'confirmed' WHERE id = ?`), newBookingID)
	return err
}

// DeclineRescheduleBooking rejects the reschedule by deleting the new pending booking
func DeclineRescheduleBooking(newBookingID string) error {
	_, err := DB.Exec(Q(`DELETE FROM bookings WHERE id = ? AND status = 'reschedule_pending'`), newBookingID)
	return err
}

func BookingExistsForRecurring(scheduleID string, date time.Time) (bool, error) {
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	endOfDay := startOfDay.AddDate(0, 0, 1)

	var count int
	err := DB.QueryRow(Q(`
		SELECT COUNT(*) FROM bookings
		WHERE recurring_schedule_id = ?
		  AND starts_at >= ?
		  AND starts_at < ?
		  AND status IN ('pending', 'confirmed')
	`), scheduleID, startOfDay, endOfDay).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
