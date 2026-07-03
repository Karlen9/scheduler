package db

import (
	"database/sql"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Lists the SQL columns used by the related query helpers.
*
* Usage context:
* - Reused by the database layer to keep shared values centralized.
***************************************************************************************************/
const sessionTypeColumns = `id, specialist_id, type, name, duration_minutes, price, currency, image_url, sessions_count, is_active`

/***************************************************************************************************
* Defines the nullable session type type used by the database layer.
***************************************************************************************************/
type nullableSessionType struct {
	id              sql.NullString
	specialistID    sql.NullString
	sessionType     sql.NullString
	name            sql.NullString
	durationMinutes sql.NullInt64
	price           sql.NullInt64
	currency        sql.NullString
	imageURL        sql.NullString
	sessionsCount   sql.NullInt64
	isActive        sql.NullInt64
}

/***************************************************************************************************
* Scans dest.
*
* Parameters:
* - None.
*
* Returns:
* - The computed value for the current operation as []interface{}.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func (n *nullableSessionType) scanDest() []interface{} {
	return []interface{}{
		&n.id,
		&n.specialistID,
		&n.sessionType,
		&n.name,
		&n.durationMinutes,
		&n.price,
		&n.currency,
		&n.imageURL,
		&n.sessionsCount,
		&n.isActive,
	}
}

/***************************************************************************************************
* Implements the model logic used by this module.
*
* Parameters:
* - None.
*
* Returns:
* - The computed value for the current operation as *models.SessionType.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func (n nullableSessionType) model() *models.SessionType {
	if !n.id.Valid {
		return nil
	}

	st := &models.SessionType{
		ID:           n.id.String,
		SpecialistID: n.specialistID.String,
		Type:         n.sessionType.String,
		Name:         n.name.String,
		Currency:     n.currency.String,
		ImageURL:     n.imageURL.String,
		IsActive:     !n.isActive.Valid || n.isActive.Int64 == 1,
	}
	if n.durationMinutes.Valid {
		st.DurationMinutes = int(n.durationMinutes.Int64)
	}
	if n.price.Valid {
		st.Price = int(n.price.Int64)
	}
	if n.sessionsCount.Valid {
		st.SessionsCount = int(n.sessionsCount.Int64)
	}
	return st
}

/***************************************************************************************************
* Scans session type.
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
func scanSessionType(row interface{ Scan(...interface{}) error }) (models.SessionType, error) {
	var st models.SessionType
	var sessionsCount sql.NullInt64
	err := row.Scan(&st.ID, &st.SpecialistID, &st.Type, &st.Name, &st.DurationMinutes, &st.Price, &st.Currency, &st.ImageURL, &sessionsCount, &st.IsActive)
	if sessionsCount.Valid {
		st.SessionsCount = int(sessionsCount.Int64)
	}
	return st, err
}

/***************************************************************************************************
* Returns session types by specialist id.
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
func GetSessionTypesBySpecialistID(specialistID string) ([]models.SessionType, error) {
	rows, err := DB.Query(Q(`
		SELECT `+sessionTypeColumns+`
		FROM session_types
		WHERE specialist_id = ? AND is_active = 1
		ORDER BY type
	`), specialistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessionTypes []models.SessionType
	for rows.Next() {
		st, err := scanSessionType(rows)
		if err != nil {
			return nil, err
		}
		sessionTypes = append(sessionTypes, st)
	}

	return sessionTypes, rows.Err()
}

/***************************************************************************************************
* Returns session type by id.
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
func GetSessionTypeByID(id string) (*models.SessionType, error) {
	row := DB.QueryRow(Q(`
		SELECT `+sessionTypeColumns+`
		FROM session_types
		WHERE id = ?
	`), id)
	st, err := scanSessionType(row)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

/***************************************************************************************************
* Returns session type by type.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - sessionType: Session type used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetSessionTypeByType(specialistID, sessionType string) (*models.SessionType, error) {
	row := DB.QueryRow(Q(`
		SELECT `+sessionTypeColumns+`
		FROM session_types
		WHERE specialist_id = ? AND type = ? AND is_active = 1
	`), specialistID, sessionType)
	st, err := scanSessionType(row)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

/***************************************************************************************************
* Creates session type.
*
* Parameters:
* - sessionType: Session type used by the current operation.
* - specialistID: Identifier used to target the current record.
* - durationMinutes: Duration value used by the current operation.
* - name: Name used by the current operation.
* - currency: Currency used by the current operation.
* - price: Price used by the current operation.
* - imageURL: Image url used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func CreateSessionType(specialistID, sessionType, name string, durationMinutes, price int, currency, imageURL string) (*models.SessionType, error) {
	return CreateSessionTypeWithSessionsCount(specialistID, sessionType, name, durationMinutes, price, currency, imageURL, 0)
}

/***************************************************************************************************
* Creates session type with optional batch sessions count.
***************************************************************************************************/
func CreateSessionTypeWithSessionsCount(specialistID, sessionType, name string, durationMinutes, price int, currency, imageURL string, sessionsCount int) (*models.SessionType, error) {
	id := uuid.New().String()
	if sessionType != "batch" {
		sessionType = "common"
	}
	var sessionsCountValue interface{}
	if sessionType == "batch" && sessionsCount > 1 {
		sessionsCountValue = sessionsCount
	}

	_, err := DB.Exec(Q(`
		INSERT INTO session_types (id, specialist_id, type, name, duration_minutes, price, currency, image_url, sessions_count)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`), id, specialistID, sessionType, name, durationMinutes, price, currency, imageURL, sessionsCountValue)
	if err != nil {
		return nil, err
	}

	return GetSessionTypeByID(id)
}

/***************************************************************************************************
* Returns all session types by specialist id.
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
func GetAllSessionTypesBySpecialistID(specialistID string) ([]models.SessionType, error) {
	rows, err := DB.Query(Q(`
		SELECT `+sessionTypeColumns+`
		FROM session_types
		WHERE specialist_id = ?
		ORDER BY type
	`), specialistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessionTypes []models.SessionType
	for rows.Next() {
		st, err := scanSessionType(rows)
		if err != nil {
			return nil, err
		}
		sessionTypes = append(sessionTypes, st)
	}

	return sessionTypes, rows.Err()
}

/***************************************************************************************************
* Updates session type with optional batch sessions count.
***************************************************************************************************/
func UpdateSessionTypeWithSessionsCount(id, sessionType, name string, durationMinutes, price int, currency, imageURL string, sessionsCount int, isActive bool) (*models.SessionType, error) {
	if sessionType != "batch" {
		sessionType = "common"
	}
	var sessionsCountValue interface{}
	if sessionType == "batch" && sessionsCount > 1 {
		sessionsCountValue = sessionsCount
	}

	_, err := DB.Exec(Q(`
		UPDATE session_types
		SET type = ?, name = ?, duration_minutes = ?, price = ?, currency = ?, image_url = ?, sessions_count = ?, is_active = ?
		WHERE id = ?
	`), sessionType, name, durationMinutes, price, currency, imageURL, sessionsCountValue, BoolVal(isActive), id)
	if err != nil {
		return nil, err
	}
	return GetSessionTypeByID(id)
}

/***************************************************************************************************
* Implements the deactivate session type logic used by this module.
*
* Parameters:
* - id: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func DeactivateSessionType(id string) error {
	_, err := DB.Exec(Q(`UPDATE session_types SET is_active = 0 WHERE id = ?`), id)
	return err
}
