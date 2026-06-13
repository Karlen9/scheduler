package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

// CreateSubscriptionPayment inserts a new subscription_payments row.
// p.ID may be left empty — a new UUID will be generated.
func CreateSubscriptionPayment(p models.SubscriptionPayment) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	if p.Currency == "" {
		p.Currency = "RUB"
	}
	isRenewal := 0
	if p.IsRenewal {
		isRenewal = 1
	}
	_, err := DB.Exec(Q(`
		INSERT INTO subscription_payments
			(id, specialist_id, yookassa_payment_id, amount_kopecks, currency, status,
			 plan_code, promo_code, discount_kopecks,
			 period_start, period_end, is_renewal, payment_method_id,
			 created_at, paid_at, raw_payload)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`),
		p.ID, p.SpecialistID, p.YooKassaPaymentID, p.AmountKopecks, p.Currency, p.Status,
		p.PlanCode, p.PromoCode, p.DiscountKopecks,
		p.PeriodStart, p.PeriodEnd, isRenewal, p.PaymentMethodID,
		p.CreatedAt, p.PaidAt, p.RawPayload,
	)
	return err
}

// GetSubscriptionPaymentByYooKassaID looks up a payment row by the ЮКасса payment ID.
// Returns nil, nil if not found.
func GetSubscriptionPaymentByYooKassaID(ykID string) (*models.SubscriptionPayment, error) {
	row := DB.QueryRow(Q(`
		SELECT id, specialist_id, yookassa_payment_id, amount_kopecks, currency, status,
		       plan_code, promo_code, discount_kopecks,
		       period_start, period_end, is_renewal, payment_method_id,
		       created_at, paid_at, raw_payload
		FROM subscription_payments
		WHERE yookassa_payment_id = ?
	`), ykID)
	return scanSubscriptionPayment(row)
}

// MarkSubscriptionPaymentSucceeded atomically flips a payment row from any non-succeeded
// status to "succeeded", setting paid_at and raw_payload at the same time.
// It returns true only for the single goroutine that wins the claim (rows affected == 1).
// Concurrent duplicate webhook deliveries will see rows affected == 0 and receive false,
// preventing double-activation of the subscription.
func MarkSubscriptionPaymentSucceeded(id string, paidAt time.Time, rawPayload string) (bool, error) {
	res, err := DB.Exec(Q(`
		UPDATE subscription_payments
		SET status = 'succeeded', paid_at = ?, raw_payload = ?
		WHERE id = ? AND status <> 'succeeded'
	`), paidAt, rawPayload, id)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return n == 1, nil
}

// UpdateSubscriptionPaymentStatus updates the status, paid_at, and raw_payload of a payment row.
// paidAt may be nil (e.g. when marking as "failed").
func UpdateSubscriptionPaymentStatus(id, status string, paidAt *time.Time, rawPayload string) error {
	_, err := DB.Exec(Q(`
		UPDATE subscription_payments
		SET status = ?, paid_at = ?, raw_payload = ?
		WHERE id = ?
	`), status, paidAt, rawPayload, id)
	return err
}

// UpdateSubscriptionPaymentYooKassaID sets the yookassa_payment_id on a row whose placeholder
// value is empty or not yet set. Used by the renewal worker (persist-before-charge) and the
// webhook metadata fallback to associate the ЮКасса payment ID with the pre-created row.
func UpdateSubscriptionPaymentYooKassaID(id, ykID string) error {
	_, err := DB.Exec(Q(`
		UPDATE subscription_payments
		SET yookassa_payment_id = ?
		WHERE id = ?
	`), ykID, id)
	return err
}

// ActivateSubscription updates the specialist row with an active subscription after a successful
// payment.
//
// Rules:
//   - subscription_status is set to 'active'.
//   - subscription_plan is set to planCode.
//   - current_period_end_at is set to periodEnd.
//   - subscription_started_at is set to now only if it was previously NULL (first activation).
//   - auto_renew is set to 1.
//   - yookassa_payment_method_id is only overwritten when encryptedPaymentMethodID is non-empty.
func ActivateSubscription(specialistID, planCode string, periodEnd time.Time, encryptedPaymentMethodID string) error {
	now := time.Now().UTC()
	if encryptedPaymentMethodID != "" {
		_, err := DB.Exec(Q(`
			UPDATE specialists
			SET subscription_status = 'active',
			    subscription_plan = ?,
			    current_period_end_at = ?,
			    subscription_started_at = COALESCE(subscription_started_at, ?),
			    auto_renew = 1,
			    yookassa_payment_method_id = ?
			WHERE id = ?
		`), planCode, periodEnd, now, encryptedPaymentMethodID, specialistID)
		return err
	}
	_, err := DB.Exec(Q(`
		UPDATE specialists
		SET subscription_status = 'active',
		    subscription_plan = ?,
		    current_period_end_at = ?,
		    subscription_started_at = COALESCE(subscription_started_at, ?),
		    auto_renew = 1
		WHERE id = ?
	`), planCode, periodEnd, now, specialistID)
	return err
}

// GetSubscriptionPaymentByID looks up a payment row by its internal UUID.
// Returns nil, nil if not found.
func GetSubscriptionPaymentByID(id string) (*models.SubscriptionPayment, error) {
	row := DB.QueryRow(Q(`
		SELECT id, specialist_id, yookassa_payment_id, amount_kopecks, currency, status,
		       plan_code, promo_code, discount_kopecks,
		       period_start, period_end, is_renewal, payment_method_id,
		       created_at, paid_at, raw_payload
		FROM subscription_payments
		WHERE id = ?
	`), id)
	return scanSubscriptionPayment(row)
}

// SpecialistsDueForRenewal returns active specialists whose current period ends within the
// given window and who have autopay enabled with a saved payment method.
func SpecialistsDueForRenewal(within time.Duration) ([]models.Specialist, error) {
	cutoff := time.Now().UTC().Add(within)
	rows, err := DB.Query(Q(`
		SELECT `+specialistColumns+`
		FROM specialists
		WHERE subscription_status = 'active'
		  AND auto_renew = 1
		  AND cancel_at_period_end = 0
		  AND yookassa_payment_method_id <> ''
		  AND yookassa_payment_method_id IS NOT NULL
		  AND current_period_end_at <= ?
		  AND is_active = 1
		  AND deleted_at IS NULL
	`), cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var specialists []models.Specialist
	for rows.Next() {
		s, err := scanSpecialist(rows)
		if err != nil {
			return nil, err
		}
		if s != nil {
			specialists = append(specialists, *s)
		}
	}
	return specialists, rows.Err()
}

// HasPendingRenewal returns true if there is already an in-flight renewal charge for the
// specialist's current period (is_renewal=1, status='pending', period_end >= currentPeriodEnd).
func HasPendingRenewal(specialistID string, currentPeriodEnd time.Time) (bool, error) {
	var n int
	err := DB.QueryRow(Q(`
		SELECT COUNT(*) FROM subscription_payments
		WHERE specialist_id = ?
		  AND is_renewal = 1
		  AND status = 'pending'
		  AND period_end >= ?
	`), specialistID, currentPeriodEnd).Scan(&n)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// SetSubscriptionStatus sets the subscription_status field on a specialist row.
func SetSubscriptionStatus(specialistID, status string) error {
	_, err := DB.Exec(Q(`
		UPDATE specialists SET subscription_status = ? WHERE id = ?
	`), status, specialistID)
	return err
}

// SpecialistsWithLapsedTrials returns trialing specialists whose trial_ends_at is in the past
// (i.e. trial has expired). Only returns rows not already 'expired'.
func SpecialistsWithLapsedTrials() ([]models.Specialist, error) {
	now := time.Now().UTC()
	rows, err := DB.Query(Q(`
		SELECT `+specialistColumns+`
		FROM specialists
		WHERE subscription_status = 'trialing'
		  AND trial_ends_at IS NOT NULL
		  AND trial_ends_at < ?
		  AND is_active = 1
		  AND deleted_at IS NULL
	`), now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var specialists []models.Specialist
	for rows.Next() {
		s, err := scanSpecialist(rows)
		if err != nil {
			return nil, err
		}
		if s != nil {
			specialists = append(specialists, *s)
		}
	}
	return specialists, rows.Err()
}

// SpecialistsWithLapsedPeriods returns active/cancelled/past_due specialists whose
// current_period_end_at is in the past AND have no pending renewal in flight.
func SpecialistsWithLapsedPeriods() ([]models.Specialist, error) {
	now := time.Now().UTC()
	rows, err := DB.Query(Q(`
		SELECT `+specialistColumns+`
		FROM specialists
		WHERE subscription_status IN ('active','cancelled','past_due')
		  AND current_period_end_at IS NOT NULL
		  AND current_period_end_at < ?
		  AND is_active = 1
		  AND deleted_at IS NULL
		  AND id NOT IN (
		      SELECT specialist_id FROM subscription_payments
		      WHERE is_renewal = 1
		        AND status = 'pending'
		        AND period_end >= current_period_end_at
		  )
	`), now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var specialists []models.Specialist
	for rows.Next() {
		s, err := scanSpecialist(rows)
		if err != nil {
			return nil, err
		}
		if s != nil {
			specialists = append(specialists, *s)
		}
	}
	return specialists, rows.Err()
}

// SetAutoRenew updates auto_renew and cancel_at_period_end on a specialist row without
// touching subscription_status. Used by the cancel and resume endpoints.
func SetAutoRenew(specialistID string, autoRenew, cancelAtPeriodEnd bool) error {
	ar := 0
	if autoRenew {
		ar = 1
	}
	cap := 0
	if cancelAtPeriodEnd {
		cap = 1
	}
	_, err := DB.Exec(Q(`
		UPDATE specialists
		SET auto_renew = ?, cancel_at_period_end = ?
		WHERE id = ?
	`), ar, cap, specialistID)
	return err
}

func scanSubscriptionPayment(row interface{ Scan(...any) error }) (*models.SubscriptionPayment, error) {
	var p models.SubscriptionPayment
	var isRenewalInt int
	var paidAt sql.NullTime
	var promoCode, paymentMethodID, rawPayload sql.NullString
	var discountKopecks sql.NullInt64

	err := row.Scan(
		&p.ID, &p.SpecialistID, &p.YooKassaPaymentID, &p.AmountKopecks, &p.Currency, &p.Status,
		&p.PlanCode, &promoCode, &discountKopecks,
		&p.PeriodStart, &p.PeriodEnd, &isRenewalInt, &paymentMethodID,
		&p.CreatedAt, &paidAt, &rawPayload,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	p.IsRenewal = isRenewalInt == 1
	p.PromoCode = promoCode.String
	p.DiscountKopecks = int(discountKopecks.Int64)
	p.PaymentMethodID = paymentMethodID.String
	p.RawPayload = rawPayload.String
	if paidAt.Valid {
		v := paidAt.Time
		p.PaidAt = &v
	}
	return &p, nil
}
