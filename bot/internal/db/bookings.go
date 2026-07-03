package db

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Creates booking.
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - specialistID: Identifier used to target the current record.
* - startsAt: Starts at used by the current operation.
* - sessionTypeID: Identifier used to target the current record.
* - clientName: Client name used by the current operation.
* - endsAt: Ends at used by the current operation.
* - clientMessage: Client message used by the current operation.
* - durationMinutes: Duration value used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CreateBooking(specialistID, clientID, sessionTypeID string, startsAt, endsAt time.Time, clientName, clientMessage string, durationMinutes int) (*models.Booking, error) {
	id := uuid.New().String()

	if err := insertBooking(id, specialistID, clientID, sessionTypeID, "", startsAt, endsAt, clientName, clientMessage, models.BookingStatusPending, durationMinutes, "", "", ""); err != nil {
		return nil, err
	}

	return GetBookingByID(id)
}

func insertBooking(id, specialistID, clientID, sessionTypeID, clientBatchID string, startsAt, endsAt time.Time, clientName, clientMessage string, status models.BookingStatus, durationMinutes int, createdBy, recurringScheduleID, replacesBookingID string) error {
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	batchID := sql.NullString{}
	if clientBatchID != "" {
		batchID = sql.NullString{String: clientBatchID, Valid: true}
	} else {
		batchID, err = attachClientBatchForServiceTx(tx, clientID, specialistID, sessionTypeID)
		if err != nil {
			return err
		}
	}

	var createdByValue interface{}
	if createdBy != "" {
		createdByValue = createdBy
	}
	var recurringScheduleValue interface{}
	if recurringScheduleID != "" {
		recurringScheduleValue = recurringScheduleID
	}
	var replacesBookingValue interface{}
	if replacesBookingID != "" {
		replacesBookingValue = replacesBookingID
	}
	var clientBatchValue interface{}
	if batchID.Valid {
		clientBatchValue = batchID.String
	}

	_, err = tx.Exec(Q(`
		INSERT INTO bookings (id, specialist_id, client_id, session_type_id, client_batch_id, starts_at, ends_at, client_name, client_message, status, duration_minutes, created_by, recurring_schedule_id, replaces_booking_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`), id, specialistID, clientID, sessionTypeID, clientBatchValue, startsAt, endsAt, clientName, clientMessage, status, durationMinutes, createdByValue, recurringScheduleValue, replacesBookingValue)
	if err != nil {
		return err
	}

	return tx.Commit()
}

/***************************************************************************************************
* bookingColumns is the standard column list for booking queries. Must match scanBookingRow field
* order exactly.
*
* Usage context:
* - Reused by the database layer to keep shared values centralized.
***************************************************************************************************/
var bookingColumns = `b.id, b.specialist_id, b.client_id, b.session_type_id, b.starts_at, b.ends_at,
	b.client_name, b.client_message, b.status, b.cancel_reason, b.cancelled_by, b.created_at,
	b.duration_minutes, b.created_by, b.recurring_schedule_id, b.replaces_booking_id, b.client_batch_id, ` +
	clientMetadataSelectColumns("c") + `, COALESCE(c.is_ghost, 0), COALESCE(c.telegram_user_id, 0), COALESCE(c.telegram_username, ''), ` + sessionTypeSelectColumns("st") +
	`, CASE WHEN c.telegram_user_id = sp.telegram_user_id THEN 1 ELSE 0 END`

/***************************************************************************************************
* Stores the shared SQL FROM clause reused by related queries.
*
* Usage context:
* - Reused by the database layer to keep shared values centralized.
***************************************************************************************************/
const bookingFromClause = `
	FROM bookings b
	LEFT JOIN clients c ON c.id = b.client_id
	LEFT JOIN session_types st ON st.id = b.session_type_id
	LEFT JOIN specialists sp ON sp.id = b.specialist_id
`

/***************************************************************************************************
* Implements the booking select query logic used by this module.
*
* Parameters:
* - whereClause: Where clause used by the current operation.
* - orderBy: Order by used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func bookingSelectQuery(whereClause, orderBy string) string {
	query := `SELECT ` + bookingColumns + bookingFromClause
	if whereClause != "" {
		query += "\nWHERE " + whereClause
	}
	if orderBy != "" {
		query += "\nORDER BY " + orderBy
	}
	return query
}

/***************************************************************************************************
* Scans booking row.
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
func scanBookingRow(row interface{ Scan(...interface{}) error }) (*models.Booking, error) {
	var b models.Booking
	var clientMessage sql.NullString
	var cancelReason sql.NullString
	var cancelledBy sql.NullString
	var durationMinutes sql.NullInt64
	var createdBy sql.NullString
	var recurringScheduleID sql.NullString
	var replacesBookingID sql.NullString
	var clientBatchID sql.NullString
	var clientIsGhost sql.NullInt64
	var clientTelegramID sql.NullInt64
	var clientTelegramUsername sql.NullString
	var clientIsSelf sql.NullInt64
	sessionType := nullableSessionType{}

	dest := append([]interface{}{
		&b.ID, &b.SpecialistID, &b.ClientID, &b.SessionTypeID, &b.StartsAt, &b.EndsAt,
		&b.ClientName, &clientMessage, &b.Status, &cancelReason, &cancelledBy, &b.CreatedAt,
		&durationMinutes, &createdBy, &recurringScheduleID, &replacesBookingID, &clientBatchID, &b.ClientPhotoURL, &b.ClientDisplayName,
		&clientIsGhost, &clientTelegramID, &clientTelegramUsername,
	}, append(sessionType.scanDest(), &clientIsSelf)...)

	err := row.Scan(dest...)
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
	if clientBatchID.Valid {
		b.ClientBatchID = clientBatchID.String
	}
	b.ClientIsGhost = clientIsGhost.Valid && clientIsGhost.Int64 == 1
	b.ClientIsSelf = clientIsSelf.Valid && clientIsSelf.Int64 == 1
	if clientTelegramID.Valid {
		b.ClientTelegramID = clientTelegramID.Int64
	}
	if clientTelegramUsername.Valid {
		b.ClientTelegramUsername = clientTelegramUsername.String
	}
	b.SessionType = sessionType.model()

	return &b, nil
}

/***************************************************************************************************
* Scans a booking reminder row, replicating scanBookingRow's dest order exactly before scanning the
* trailing client/specialist reminder columns.
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
func scanBookingReminderRow(row interface{ Scan(...interface{}) error }) (*models.Booking, int64, string, string, bool, string, string, error) {
	var b models.Booking
	var clientMessage sql.NullString
	var cancelReason sql.NullString
	var cancelledBy sql.NullString
	var durationMinutes sql.NullInt64
	var createdBy sql.NullString
	var recurringScheduleID sql.NullString
	var replacesBookingID sql.NullString
	var clientBatchID sql.NullString
	var clientIsGhost sql.NullInt64
	var clientTelegramID sql.NullInt64
	var clientTelegramUsername sql.NullString
	var clientIsSelf sql.NullInt64
	sessionType := nullableSessionType{}

	var reminderClientTelegramUserID int64
	var reminderClientLanguage string
	var reminderClientName string
	var reminderClientNotifyReminders bool
	var reminderSpecialistName string
	var reminderSpecialistWebhookSecret string

	dest := append([]interface{}{
		&b.ID, &b.SpecialistID, &b.ClientID, &b.SessionTypeID, &b.StartsAt, &b.EndsAt,
		&b.ClientName, &clientMessage, &b.Status, &cancelReason, &cancelledBy, &b.CreatedAt,
		&durationMinutes, &createdBy, &recurringScheduleID, &replacesBookingID, &clientBatchID, &b.ClientPhotoURL, &b.ClientDisplayName,
		&clientIsGhost, &clientTelegramID, &clientTelegramUsername,
	}, append(sessionType.scanDest(), &clientIsSelf,
		&reminderClientTelegramUserID, &reminderClientLanguage, &reminderClientName, &reminderClientNotifyReminders,
		&reminderSpecialistName, &reminderSpecialistWebhookSecret)...)

	err := row.Scan(dest...)
	if err != nil {
		return nil, 0, "", "", false, "", "", err
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
	if clientBatchID.Valid {
		b.ClientBatchID = clientBatchID.String
	}
	b.ClientIsGhost = clientIsGhost.Valid && clientIsGhost.Int64 == 1
	b.ClientIsSelf = clientIsSelf.Valid && clientIsSelf.Int64 == 1
	if clientTelegramID.Valid {
		b.ClientTelegramID = clientTelegramID.Int64
	}
	if clientTelegramUsername.Valid {
		b.ClientTelegramUsername = clientTelegramUsername.String
	}
	b.SessionType = sessionType.model()

	return &b, reminderClientTelegramUserID, reminderClientLanguage, reminderClientName, reminderClientNotifyReminders, reminderSpecialistName, reminderSpecialistWebhookSecret, nil
}

/***************************************************************************************************
* Returns booking by id.
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
func GetBookingByID(id string) (*models.Booking, error) {
	booking, err := scanBookingRow(DB.QueryRow(Q(bookingSelectQuery("b.id = ?", "")), id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return booking, nil
}

func GetBookingsByClientIDPaged(clientID string, limit, offset int) ([]models.Booking, int, error) {
	var total int
	if err := DB.QueryRow(Q(`
		SELECT COUNT(*)
		FROM bookings
		WHERE client_id = ?
	`), clientID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := bookingSelectQuery("b.client_id = ?", "b.starts_at DESC") + "\nLIMIT ? OFFSET ?"
	rows, err := DB.Query(Q(query), clientID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	bookings, err := scanBookings(rows)
	if err != nil {
		return nil, 0, err
	}

	return bookings, total, nil
}

/***************************************************************************************************
* Returns bookings by specialist idand date range.
*
* Parameters:
* - start: Start used by the current operation.
* - specialistID: Identifier used to target the current record.
* - end: End used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetBookingsBySpecialistIDAndDateRange(specialistID string, start, end time.Time) ([]models.Booking, error) {
	rows, err := DB.Query(Q(bookingSelectQuery(
		"b.specialist_id = ? AND b.starts_at >= ? AND b.starts_at < ? AND b.status IN ('pending', 'confirmed')",
		"b.starts_at ASC",
	)), specialistID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanBookings(rows)
}

/***************************************************************************************************
* Scans bookings.
*
* Parameters:
* - rows: Rows used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func scanBookings(rows *sql.Rows) ([]models.Booking, error) {
	var bookings []models.Booking
	for rows.Next() {
		booking, err := scanBookingRow(rows)
		if err != nil {
			return nil, err
		}

		bookings = append(bookings, *booking)
	}

	return bookings, rows.Err()
}

/***************************************************************************************************
* Updates booking status.
*
* Parameters:
* - bookingID: Identifier used to target the current record.
* - status: Status used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateBookingStatus(bookingID string, status models.BookingStatus) error {
	return updateBookingStatus(bookingID, status, nil, nil)
}

func updateBookingStatus(bookingID string, status models.BookingStatus, reason *string, cancelledBy *models.CancelledBy) error {
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var oldStatus models.BookingStatus
	var clientBatchID sql.NullString
	var clientID, specialistID, sessionTypeID string
	var serviceType sql.NullString
	err = tx.QueryRow(Q(`
		SELECT b.status, b.client_batch_id, b.client_id, b.specialist_id, b.session_type_id, st.type
		FROM bookings b
		LEFT JOIN session_types st ON st.id = b.session_type_id
		WHERE b.id = ?
	`), bookingID).Scan(&oldStatus, &clientBatchID, &clientID, &specialistID, &sessionTypeID, &serviceType)
	if err != nil {
		return err
	}

	var reasonValue interface{}
	if reason != nil && *reason != "" {
		reasonValue = *reason
	}
	var cancelledByValue interface{}
	if cancelledBy != nil && *cancelledBy != "" {
		cancelledByValue = *cancelledBy
	}

	switch status {
	case models.BookingStatusRejected:
		_, err = tx.Exec(Q(`UPDATE bookings SET status = ?, cancel_reason = ?, cancelled_by = NULL WHERE id = ?`), status, reasonValue, bookingID)
	case models.BookingStatusCancelled:
		_, err = tx.Exec(Q(`UPDATE bookings SET status = ?, cancel_reason = ?, cancelled_by = ? WHERE id = ?`), status, reasonValue, cancelledByValue, bookingID)
	default:
		_, err = tx.Exec(Q(`UPDATE bookings SET status = ? WHERE id = ?`), status, bookingID)
	}
	if err != nil {
		return err
	}

	if oldStatus != models.BookingStatusCompleted && status == models.BookingStatusCompleted && serviceType.String == "batch" {
		if err := consumeClientBatchForBookingTx(tx, bookingID, clientID, specialistID, sessionTypeID); err != nil {
			return err
		}
	}

	if oldStatus == models.BookingStatusCompleted &&
		(status == models.BookingStatusCancelled || status == models.BookingStatusRejected) &&
		clientBatchID.Valid {
		if err := refundClientBatchTx(tx, clientBatchID.String); err != nil {
			return err
		}
	}

	return tx.Commit()
}

/***************************************************************************************************
* Completes confirmed bookings whose start time has passed for one specialist.
*
* Parameters:
* - specialistID: Identifier used to target the current specialist records.
* - now: Current time threshold used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CompletePastConfirmedBookingsForSpecialist(specialistID string, now time.Time) (int, error) {
	tx, err := DB.Begin()
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()

	rows, err := tx.Query(Q(`
		SELECT b.id, b.client_id, b.session_type_id, COALESCE(st.type, '')
		FROM bookings b
		LEFT JOIN session_types st ON st.id = b.session_type_id
		WHERE b.specialist_id = ?
		  AND b.status = 'confirmed'
		  AND b.starts_at <= ?
	`), specialistID, now)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type completionCandidate struct {
		id            string
		clientID      string
		sessionTypeID string
		serviceType   string
	}

	candidates := make([]completionCandidate, 0)
	for rows.Next() {
		var candidate completionCandidate
		if err := rows.Scan(&candidate.id, &candidate.clientID, &candidate.sessionTypeID, &candidate.serviceType); err != nil {
			return 0, err
		}
		candidates = append(candidates, candidate)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	if len(candidates) == 0 {
		return 0, tx.Commit()
	}

	if _, err := tx.Exec(Q(`
		UPDATE bookings
		SET status = ?
		WHERE specialist_id = ?
		  AND status = 'confirmed'
		  AND starts_at <= ?
	`), models.BookingStatusCompleted, specialistID, now); err != nil {
		return 0, err
	}

	for _, candidate := range candidates {
		if candidate.serviceType != "batch" {
			continue
		}
		if err := consumeClientBatchForBookingTx(tx, candidate.id, candidate.clientID, specialistID, candidate.sessionTypeID); err != nil {
			return 0, err
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return len(candidates), nil
}

/***************************************************************************************************
* Implements the cancel booking logic used by this module.
*
* Parameters:
* - bookingID: Identifier used to target the current record.
* - reason: Reason used by the current operation.
* - cancelledBy: Boolean flag that influences the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CancelBooking(bookingID string, reason string, cancelledBy models.CancelledBy) error {
	return updateBookingStatus(bookingID, models.BookingStatusCancelled, &reason, &cancelledBy)
}

// CompleteBooking marks a booking as completed without a cancellation reason.
// Used for late cancellations when the specialist has a cutoff policy enabled.
func CompleteBooking(bookingID string) error {
	_, err := DB.Exec(Q(`UPDATE bookings SET status = 'completed' WHERE id = ?`), bookingID)
	return err
}

/***************************************************************************************************
* RejectBookingWithReason marks a booking as rejected (not cancelled) and records the reason.
* Leaves cancelled_by NULL — rejections are a distinct outcome from cancellations. Kept separate
* from CancelBooking so downstream consumers (notifications, analytics) can tell them apart.
***************************************************************************************************/
func RejectBookingWithReason(bookingID, reason string) error {
	return updateBookingStatus(bookingID, models.BookingStatusRejected, &reason, nil)
}

/***************************************************************************************************
* Updates booking date time.
*
* Parameters:
* - startsAt: Starts at used by the current operation.
* - bookingID: Identifier used to target the current record.
* - endsAt: Ends at used by the current operation.
* - durationMinutes: Duration value used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func UpdateBookingDateTime(bookingID string, startsAt, endsAt time.Time, durationMinutes int) error {
	_, err := DB.Exec(Q(`
		UPDATE bookings SET starts_at = ?, ends_at = ?, duration_minutes = ? WHERE id = ?
	`), startsAt, endsAt, durationMinutes, bookingID)
	return err
}

/***************************************************************************************************
* Checks whether conflicting booking.
*
* Parameters:
* - startsAt: Starts at used by the current operation.
* - specialistID: Identifier used to target the current record.
* - endsAt: Ends at used by the current operation.
* - excludeBookingID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func HasConflictingBooking(specialistID string, startsAt, endsAt time.Time, excludeBookingID string) (bool, error) {
	var count int
	err := DB.QueryRow(Q(`
		SELECT COUNT(*) FROM bookings
		WHERE specialist_id = ?
		  AND id != ?
		  AND status IN ('pending', 'confirmed')
		  AND starts_at < ?
		  AND ends_at > ?
	`), specialistID, excludeBookingID, endsAt, startsAt).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

/***************************************************************************************************
* bookingInterval is a lightweight starts_at/ends_at pair used for in-memory conflict checks.
***************************************************************************************************/
type bookingInterval struct {
	startsAt time.Time
	endsAt   time.Time
}

/***************************************************************************************************
* getBookingIntervalsInRange returns the starts_at/ends_at intervals of pending/confirmed bookings
* for a specialist that overlap the given range, so callers can run many in-memory conflict checks
* instead of one query per candidate slot.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - rangeStart: Start used by the current operation.
* - rangeEnd: End used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func getBookingIntervalsInRange(specialistID string, rangeStart, rangeEnd time.Time) ([]bookingInterval, error) {
	rows, err := DB.Query(Q(`
		SELECT starts_at, ends_at FROM bookings
		WHERE specialist_id = ? AND status IN ('pending', 'confirmed')
		  AND starts_at < ? AND ends_at > ?
	`), specialistID, rangeEnd, rangeStart)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var intervals []bookingInterval
	for rows.Next() {
		var interval bookingInterval
		if err := rows.Scan(&interval.startsAt, &interval.endsAt); err != nil {
			return nil, err
		}
		intervals = append(intervals, interval)
	}
	return intervals, rows.Err()
}

type BookingListFilters struct {
	Status         string
	Statuses       []string
	ClientID       string
	ClientIDs      []string
	ClientSearch   string
	SessionTypeID  string
	SessionTypeIDs []string
	DateFrom       *time.Time
	DateTo         *time.Time
	Sort           string
	Limit          int
	Offset         int
}

func bookingListAppendInClause(clauses []string, args []interface{}, column string, values []string) ([]string, []interface{}) {
	if len(values) == 0 {
		return clauses, args
	}

	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(values)), ",")
	clauses = append(clauses, fmt.Sprintf("%s IN (%s)", column, placeholders))
	for _, value := range values {
		args = append(args, value)
	}
	return clauses, args
}

func bookingListAppendInOrEquals(clauses []string, args []interface{}, column string, values []string, value string) ([]string, []interface{}) {
	if len(values) > 0 {
		return bookingListAppendInClause(clauses, args, column, values)
	}
	if value == "" {
		return clauses, args
	}

	clauses = append(clauses, fmt.Sprintf("%s = ?", column))
	args = append(args, value)
	return clauses, args
}

func bookingListWhereClause(specialistID string, filters BookingListFilters) (string, []interface{}) {
	clauses := []string{"b.specialist_id = ?"}
	args := []interface{}{specialistID}

	clauses, args = bookingListAppendInOrEquals(clauses, args, "b.status", filters.Statuses, filters.Status)
	if filters.DateFrom != nil {
		clauses = append(clauses, "b.starts_at >= ?")
		args = append(args, *filters.DateFrom)
	}
	if filters.DateTo != nil {
		clauses = append(clauses, "b.starts_at < ?")
		args = append(args, *filters.DateTo)
	}
	clauses, args = bookingListAppendInOrEquals(clauses, args, "b.session_type_id", filters.SessionTypeIDs, filters.SessionTypeID)
	clauses, args = bookingListAppendInOrEquals(clauses, args, "b.client_id", filters.ClientIDs, filters.ClientID)
	if filters.ClientSearch != "" {
		like := "%" + strings.ToLower(filters.ClientSearch) + "%"
		clauses = append(clauses, `(LOWER(b.client_name) LIKE ? OR LOWER(COALESCE(c.name, '')) LIKE ? OR LOWER(COALESCE(c.display_name, '')) LIKE ? OR LOWER(COALESCE(c.phone, '')) LIKE ?)`)
		args = append(args, like, like, like, like)
	}

	return strings.Join(clauses, " AND "), args
}

func bookingListOrderBy(sortKey string) string {
	switch sortKey {
	case "starts_at_asc":
		return "b.starts_at ASC"
	case "starts_at_desc":
		return "b.starts_at DESC"
	case "status_asc":
		return "b.status ASC, b.starts_at DESC"
	default:
		return "b.created_at DESC"
	}
}

func GetBookingsBySpecialistIDFiltered(specialistID string, filters BookingListFilters) ([]models.Booking, int, error) {
	whereClause, args := bookingListWhereClause(specialistID, filters)

	var total int
	countQuery := `SELECT COUNT(*)` + bookingFromClause + "\nWHERE " + whereClause
	if err := DB.QueryRow(Q(countQuery), args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := bookingSelectQuery(whereClause, bookingListOrderBy(filters.Sort))
	queryArgs := append([]interface{}{}, args...)
	if filters.Limit > 0 {
		query += "\nLIMIT ? OFFSET ?"
		queryArgs = append(queryArgs, filters.Limit, filters.Offset)
	}

	rows, err := DB.Query(Q(query), queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	bookings, err := scanBookings(rows)
	if err != nil {
		return nil, 0, err
	}

	return bookings, total, nil
}

/***************************************************************************************************
* BookingReminder pairs a due booking with the client and specialist fields the reminder worker
* needs, fetched via a single joined query instead of per-booking lookups.
***************************************************************************************************/
type BookingReminder struct {
	Booking                 models.Booking
	ClientTelegramUserID    int64
	ClientLanguage          string
	ClientName              string
	ClientNotifyReminders   bool
	SpecialistName          string
	SpecialistWebhookSecret string
}

/***************************************************************************************************
* GetBookingRemindersDue returns confirmed bookings starting within the next hour that haven't had
* a reminder sent yet, together with the client and specialist fields needed to send it. Bookings
* whose client or specialist row is missing are skipped (INNER JOIN).
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
func GetBookingRemindersDue() ([]BookingReminder, error) {
	now := time.Now().UTC()
	oneHourLater := now.Add(time.Hour)

	query := `SELECT ` + bookingColumns + `,
		c.telegram_user_id, COALESCE(c.language, ''), c.name, c.notify_reminders,
		s.name, s.webhook_secret
		` + bookingFromClause + `
		JOIN clients c ON c.id = b.client_id
		JOIN specialists s ON s.id = b.specialist_id
		WHERE b.status = 'confirmed' AND b.reminder_sent = 0 AND b.starts_at > ? AND b.starts_at <= ?
		ORDER BY b.starts_at ASC`

	rows, err := DB.Query(Q(query), now, oneHourLater)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reminders []BookingReminder
	for rows.Next() {
		booking, clientTelegramUserID, clientLanguage, clientName, clientNotifyReminders, specialistName, specialistWebhookSecret, err := scanBookingReminderRow(rows)
		if err != nil {
			return nil, err
		}
		reminders = append(reminders, BookingReminder{
			Booking:                 *booking,
			ClientTelegramUserID:    clientTelegramUserID,
			ClientLanguage:          clientLanguage,
			ClientName:              clientName,
			ClientNotifyReminders:   clientNotifyReminders,
			SpecialistName:          specialistName,
			SpecialistWebhookSecret: specialistWebhookSecret,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return reminders, nil
}

/***************************************************************************************************
* Implements the mark reminder sent logic used by this module.
*
* Parameters:
* - bookingID: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func MarkReminderSent(bookingID string) error {
	_, err := DB.Exec(Q(`UPDATE bookings SET reminder_sent = 1 WHERE id = ?`), bookingID)
	return err
}

/***************************************************************************************************
* Implements the client has booking on date logic used by this module.
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - date: Date value used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
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

/***************************************************************************************************
* Creates booking by specialist.
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - specialistID: Identifier used to target the current record.
* - startsAt: Starts at used by the current operation.
* - sessionTypeID: Identifier used to target the current record.
* - clientName: Client name used by the current operation.
* - endsAt: Ends at used by the current operation.
* - clientMessage: Client message used by the current operation.
* - durationMinutes: Duration value used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CreateBookingBySpecialist(specialistID, clientID, sessionTypeID string, startsAt, endsAt time.Time, clientName, clientMessage string, durationMinutes int) (*models.Booking, error) {
	id := uuid.New().String()

	if err := insertBooking(id, specialistID, clientID, sessionTypeID, "", startsAt, endsAt, clientName, clientMessage, models.BookingStatusPending, durationMinutes, "specialist", "", ""); err != nil {
		return nil, err
	}

	return GetBookingByID(id)
}

/***************************************************************************************************
* Creates recurring booking.
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - specialistID: Identifier used to target the current record.
* - startsAt: Starts at used by the current operation.
* - sessionTypeID: Identifier used to target the current record.
* - endsAt: Ends at used by the current operation.
* - clientName: Client name used by the current operation.
* - durationMinutes: Duration value used by the current operation.
* - recurringScheduleID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CreateRecurringBooking(specialistID, clientID, sessionTypeID string, startsAt, endsAt time.Time, clientName string, durationMinutes int, recurringScheduleID string) (*models.Booking, error) {
	id := uuid.New().String()

	if err := insertBooking(id, specialistID, clientID, sessionTypeID, "", startsAt, endsAt, clientName, "", models.BookingStatusConfirmed, durationMinutes, "", recurringScheduleID, ""); err != nil {
		return nil, err
	}

	return GetBookingByID(id)
}

/***************************************************************************************************
* CreateRescheduleBooking creates a new booking that replaces an existing one (status =
* reschedule_pending).
*
* Parameters:
* - clientID: Identifier used to target the current record.
* - specialistID: Identifier used to target the current record.
* - startsAt: Starts at used by the current operation.
* - sessionTypeID: Identifier used to target the current record.
* - endsAt: Ends at used by the current operation.
* - clientName: Client name used by the current operation.
* - recurringScheduleID: Identifier used to target the current record.
* - durationMinutes: Duration value used by the current operation.
* - replacesBookingID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CreateRescheduleBooking(specialistID, clientID, sessionTypeID string, startsAt, endsAt time.Time, clientName, message, createdBy string, durationMinutes int, recurringScheduleID, replacesBookingID string) (*models.Booking, error) {
	id := uuid.New().String()
	var clientBatchID string
	if replacesBookingID != "" {
		var batchID sql.NullString
		if err := DB.QueryRow(Q(`SELECT client_batch_id FROM bookings WHERE id = ?`), replacesBookingID).Scan(&batchID); err == nil && batchID.Valid {
			clientBatchID = batchID.String
		}
	}

	if err := insertBooking(id, specialistID, clientID, sessionTypeID, clientBatchID, startsAt, endsAt, clientName, message, models.BookingStatusReschedulePending, durationMinutes, createdBy, recurringScheduleID, replacesBookingID); err != nil {
		return nil, err
	}

	return GetBookingByID(id)
}

/***************************************************************************************************
* DeleteReschedulePendingFor deletes any reschedule_pending shadows whose replaces_booking_id
* points to the given booking. Used to supersede an in-flight reschedule proposal before
* creating a new one, so we never accumulate duplicate shadows for the same original booking.
***************************************************************************************************/
func DeleteReschedulePendingFor(originalBookingID string) error {
	_, err := DB.Exec(Q(`DELETE FROM bookings WHERE replaces_booking_id = ? AND status = 'reschedule_pending'`), originalBookingID)
	return err
}

/***************************************************************************************************
* ApproveRescheduleBooking confirms the new booking and cancels the old one.
*
* Parameters:
* - newBookingID: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func ApproveRescheduleBooking(newBookingID string) error {
	newBooking, err := GetBookingByID(newBookingID)
	if err != nil || newBooking == nil {
		return fmt.Errorf("reschedule booking not found")
	}
	if newBooking.Status != models.BookingStatusReschedulePending {
		return fmt.Errorf("booking is not pending reschedule")
	}

	/***************************************************************************************************
	* Cancel the old booking.
	***************************************************************************************************/
	if newBooking.ReplacesBookingID != "" {
		DB.Exec(Q(`UPDATE bookings SET status = 'cancelled', cancel_reason = 'rescheduled' WHERE id = ?`), newBooking.ReplacesBookingID)
	}

	/***************************************************************************************************
	* Confirm the new booking.
	***************************************************************************************************/
	_, err = DB.Exec(Q(`UPDATE bookings SET status = 'confirmed' WHERE id = ?`), newBookingID)
	return err
}

/***************************************************************************************************
* DeclineRescheduleBooking rejects the reschedule by deleting the new pending booking.
*
* Parameters:
* - newBookingID: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func DeclineRescheduleBooking(newBookingID string) error {
	_, err := DB.Exec(Q(`DELETE FROM bookings WHERE id = ? AND status = 'reschedule_pending'`), newBookingID)
	return err
}

/***************************************************************************************************
* SaveBookingNotificationInfo stores the Telegram message ID for the specialist notification.
*
* Parameters:
* - bookingID: Identifier used to target the current record.
* - chatID: Identifier used to target the current record.
* - messageID: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func SaveBookingNotificationInfo(bookingID string, chatID int64, messageID int) error {
	_, err := DB.Exec(Q(`UPDATE bookings SET telegram_notification_chat_id = ?, telegram_notification_msg_id = ? WHERE id = ?`),
		chatID, messageID, bookingID)
	return err
}

/***************************************************************************************************
* GetBookingNotificationInfo returns the stored Telegram notification message info.
*
* Parameters:
* - bookingID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetBookingNotificationInfo(bookingID string) (chatID int64, messageID int, err error) {
	var chatIDNull, msgIDNull sql.NullInt64
	err = DB.QueryRow(Q(`SELECT telegram_notification_chat_id, telegram_notification_msg_id FROM bookings WHERE id = ?`),
		bookingID).Scan(&chatIDNull, &msgIDNull)
	if err != nil {
		return 0, 0, err
	}
	if chatIDNull.Valid {
		chatID = chatIDNull.Int64
	}
	if msgIDNull.Valid {
		messageID = int(msgIDNull.Int64)
	}
	return chatID, messageID, nil
}

/***************************************************************************************************
* SaveClientNotificationInfo stores the Telegram message ID for the client notification.
*
* Parameters:
* - bookingID: Identifier used to target the current record.
* - chatID: Identifier used to target the current record.
* - messageID: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func SaveClientNotificationInfo(bookingID string, chatID int64, messageID int) error {
	_, err := DB.Exec(Q(`UPDATE bookings SET client_notification_chat_id = ?, client_notification_msg_id = ? WHERE id = ?`),
		chatID, messageID, bookingID)
	return err
}

/***************************************************************************************************
* GetClientNotificationInfo returns the stored client Telegram notification message info.
*
* Parameters:
* - bookingID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetClientNotificationInfo(bookingID string) (chatID int64, messageID int, err error) {
	var chatIDNull, msgIDNull sql.NullInt64
	err = DB.QueryRow(Q(`SELECT client_notification_chat_id, client_notification_msg_id FROM bookings WHERE id = ?`),
		bookingID).Scan(&chatIDNull, &msgIDNull)
	if err != nil {
		return 0, 0, err
	}
	if chatIDNull.Valid {
		chatID = chatIDNull.Int64
	}
	if msgIDNull.Valid {
		messageID = int(msgIDNull.Int64)
	}
	return
}
