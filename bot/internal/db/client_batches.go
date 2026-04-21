package db

import (
	"database/sql"
	"errors"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

var ErrNoActiveClientBatch = errors.New("no active client batch")
var ErrServiceIsNotBatch = errors.New("service is not a batch")

const clientBatchColumns = `cb.id, cb.client_id, cb.specialist_id, cb.service_id, cb.total_sessions, cb.remaining_sessions, cb.created_at, cb.status`

func scanClientBatch(row interface{ Scan(...interface{}) error }, withService bool) (*models.ClientBatch, error) {
	var batch models.ClientBatch
	dest := []interface{}{
		&batch.ID,
		&batch.ClientID,
		&batch.SpecialistID,
		&batch.ServiceID,
		&batch.TotalSessions,
		&batch.RemainingSessions,
		&batch.CreatedAt,
		&batch.Status,
	}

	service := nullableSessionType{}
	if withService {
		dest = append(dest, service.scanDest()...)
	}

	if err := row.Scan(dest...); err != nil {
		return nil, err
	}
	if withService {
		batch.Service = service.model()
	}
	return &batch, nil
}

func scanClientBatches(rows *sql.Rows, withService bool) ([]models.ClientBatch, error) {
	var batches []models.ClientBatch
	for rows.Next() {
		batch, err := scanClientBatch(rows, withService)
		if err != nil {
			return nil, err
		}
		batches = append(batches, *batch)
	}
	return batches, rows.Err()
}

func GetClientBatchesByClientID(clientID, specialistID string) ([]models.ClientBatch, error) {
	rows, err := DB.Query(Q(`
		SELECT `+clientBatchColumns+`, `+sessionTypeSelectColumns("st")+`
		FROM client_batches cb
		LEFT JOIN session_types st ON st.id = cb.service_id
		WHERE cb.client_id = ? AND cb.specialist_id = ?
		ORDER BY cb.created_at ASC, cb.id ASC
	`), clientID, specialistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanClientBatches(rows, true)
}

func AssignClientBatch(clientID, specialistID, serviceID string) (*models.ClientBatch, error) {
	service, err := GetSessionTypeByID(serviceID)
	if err != nil {
		return nil, err
	}
	if service == nil || service.SpecialistID != specialistID || !service.IsActive || service.Type != "batch" || service.SessionsCount <= 1 {
		return nil, ErrServiceIsNotBatch
	}

	id := uuid.New().String()
	_, err = DB.Exec(Q(`
		INSERT INTO client_batches (id, client_id, specialist_id, service_id, total_sessions, remaining_sessions, status)
		VALUES (?, ?, ?, ?, ?, ?, 'active')
	`), id, clientID, specialistID, serviceID, service.SessionsCount, service.SessionsCount)
	if err != nil {
		return nil, err
	}

	row := DB.QueryRow(Q(`
		SELECT `+clientBatchColumns+`, `+sessionTypeSelectColumns("st")+`
		FROM client_batches cb
		LEFT JOIN session_types st ON st.id = cb.service_id
		WHERE cb.id = ?
	`), id)
	return scanClientBatch(row, true)
}

func getOldestActiveClientBatchTx(tx *sql.Tx, clientID, specialistID, serviceID string) (string, error) {
	var id string
	err := tx.QueryRow(Q(`
		SELECT id
		FROM client_batches
		WHERE client_id = ?
		  AND specialist_id = ?
		  AND service_id = ?
		  AND status = 'active'
		  AND remaining_sessions > 0
		ORDER BY created_at ASC, id ASC
		LIMIT 1
	`), clientID, specialistID, serviceID).Scan(&id)
	if err == sql.ErrNoRows {
		return "", ErrNoActiveClientBatch
	}
	if err != nil {
		return "", err
	}
	return id, nil
}

func attachClientBatchForServiceTx(tx *sql.Tx, clientID, specialistID, serviceID string) (sql.NullString, error) {
	var serviceType string
	err := tx.QueryRow(Q(`
		SELECT type
		FROM session_types
		WHERE id = ? AND specialist_id = ? AND is_active = 1
	`), serviceID, specialistID).Scan(&serviceType)
	if err != nil {
		return sql.NullString{}, err
	}
	if serviceType != "batch" {
		return sql.NullString{}, nil
	}

	batchID, err := getOldestActiveClientBatchTx(tx, clientID, specialistID, serviceID)
	if err != nil {
		return sql.NullString{}, err
	}
	return sql.NullString{String: batchID, Valid: true}, nil
}

func consumeClientBatchForBookingTx(tx *sql.Tx, bookingID, clientID, specialistID, serviceID string) error {
	batchID, err := getOldestActiveClientBatchTx(tx, clientID, specialistID, serviceID)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(Q(`
		UPDATE client_batches
		SET remaining_sessions = remaining_sessions - 1,
		    status = CASE WHEN remaining_sessions - 1 <= 0 THEN 'exhausted' ELSE status END
		WHERE id = ?
		  AND remaining_sessions > 0
		  AND status = 'active'
	`), batchID); err != nil {
		return err
	}

	_, err = tx.Exec(Q(`UPDATE bookings SET client_batch_id = ? WHERE id = ?`), batchID, bookingID)
	return err
}

func refundClientBatchTx(tx *sql.Tx, batchID string) error {
	if batchID == "" {
		return nil
	}

	_, err := tx.Exec(Q(`
		UPDATE client_batches
		SET remaining_sessions = CASE
		        WHEN remaining_sessions < total_sessions THEN remaining_sessions + 1
		        ELSE remaining_sessions
		    END,
		    status = CASE
		        WHEN remaining_sessions < total_sessions THEN 'active'
		        ELSE status
		    END
		WHERE id = ?
	`), batchID)
	return err
}
