package db

import (
	"database/sql"
	"strings"
	"time"

	"github.com/google/uuid"

	"scheduler-bot/internal/models"
)

// GetPromoCodeByCode looks up a promo code case-insensitively (codes are stored upper-cased).
// Returns nil, nil when not found.
func GetPromoCodeByCode(code string) (*models.PromoCode, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" {
		return nil, nil
	}
	row := DB.QueryRow(Q(`
		SELECT id, code, discount_type, discount_value, duration_days,
		       max_redemptions, redemptions_count,
		       valid_from, valid_until,
		       applies_to_plan, referral_specialist_id, is_active, created_at
		FROM promo_codes
		WHERE code = ?
	`), code)
	return scanPromoCode(row)
}

// GetPromoCodeByID looks up a promo code by its primary key.
// Returns nil, nil when not found.
func GetPromoCodeByID(id string) (*models.PromoCode, error) {
	row := DB.QueryRow(Q(`
		SELECT id, code, discount_type, discount_value, duration_days,
		       max_redemptions, redemptions_count,
		       valid_from, valid_until,
		       applies_to_plan, referral_specialist_id, is_active, created_at
		FROM promo_codes
		WHERE id = ?
	`), id)
	return scanPromoCode(row)
}

// CreatePromoCode inserts a new promo_codes row. p.ID may be empty — a UUID is generated.
// The code is upper-cased before insert.
func CreatePromoCode(p models.PromoCode) error {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	p.Code = strings.ToUpper(strings.TrimSpace(p.Code))
	if p.CreatedAt.IsZero() {
		p.CreatedAt = time.Now().UTC()
	}
	isActive := 1
	if !p.IsActive {
		isActive = 0
	}
	_, err := DB.Exec(Q(`
		INSERT INTO promo_codes
			(id, code, discount_type, discount_value, duration_days,
			 max_redemptions, redemptions_count,
			 valid_from, valid_until,
			 applies_to_plan, referral_specialist_id, is_active, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`),
		p.ID, p.Code, p.DiscountType, p.DiscountValue, p.DurationDays,
		p.MaxRedemptions, p.RedemptionsCount,
		p.ValidFrom, p.ValidUntil,
		p.AppliesToPlan, p.ReferralSpecialistID, isActive, p.CreatedAt,
	)
	return err
}

// ListPromoCodes returns all promo codes ordered by creation time descending.
func ListPromoCodes() ([]models.PromoCode, error) {
	rows, err := DB.Query(`
		SELECT id, code, discount_type, discount_value, duration_days,
		       max_redemptions, redemptions_count,
		       valid_from, valid_until,
		       applies_to_plan, referral_specialist_id, is_active, created_at
		FROM promo_codes
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.PromoCode
	for rows.Next() {
		p, err := scanPromoCode(rows)
		if err != nil {
			return nil, err
		}
		if p != nil {
			out = append(out, *p)
		}
	}
	return out, rows.Err()
}

// DeactivatePromoCode sets is_active=0 for the given promo code id.
func DeactivatePromoCode(id string) error {
	_, err := DB.Exec(Q(`UPDATE promo_codes SET is_active = 0 WHERE id = ?`), id)
	return err
}

// HasSpecialistRedeemed returns true if the given specialist has already used this promo code.
func HasSpecialistRedeemed(promoCodeID, specialistID string) (bool, error) {
	var count int
	err := DB.QueryRow(Q(`
		SELECT COUNT(1) FROM promo_redemptions
		WHERE promo_code_id = ? AND specialist_id = ?
	`), promoCodeID, specialistID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// RecordPromoRedemption inserts a redemption row and atomically increments the count on the
// promo code, capped at max_redemptions. If the cap would be exceeded (or is already met),
// models.ErrPromoExhausted is returned and no row is inserted.
//
// Ordering: INSERT first, then increment counter. This ensures redemptions_count never drifts
// above the number of promo_redemptions rows — a duplicate INSERT (UNIQUE constraint violation)
// returns nil without touching the counter, and a counter-exhausted UPDATE rolls back the insert.
func RecordPromoRedemption(r models.PromoRedemption) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	if r.CreatedAt.IsZero() {
		r.CreatedAt = time.Now().UTC()
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck

	// Step 1: insert the redemption row.
	// If the UNIQUE(promo_code_id, specialist_id) index rejects it, the specialist already
	// redeemed this code — treat as a no-op (already redeemed) and return nil.
	_, err = tx.Exec(Q(`
		INSERT INTO promo_redemptions
			(id, promo_code_id, specialist_id, payment_id, discount_kopecks, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`), r.ID, r.PromoCodeID, r.SpecialistID, r.PaymentID, r.DiscountKopecks, r.CreatedAt)
	if err != nil {
		// Unique constraint violation → already redeemed; not an error for the caller.
		if isUniqueConstraintError(err) {
			return nil
		}
		return err
	}

	// Step 2: increment the counter, respecting the cap.
	res, err := tx.Exec(Q(`
		UPDATE promo_codes
		SET redemptions_count = redemptions_count + 1
		WHERE id = ? AND (max_redemptions IS NULL OR redemptions_count < max_redemptions)
	`), r.PromoCodeID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		// Cap already met — roll back the insert so the slot is not consumed.
		return models.ErrPromoExhausted
	}

	return tx.Commit()
}

// MarkFirstPaymentIfUnset sets first_payment_at on the specialist row only when it is
// currently NULL. Returns wasFirst=true when the row was updated (i.e., this is the first
// payment), false when first_payment_at was already set.
func MarkFirstPaymentIfUnset(specialistID string, t time.Time) (wasFirst bool, err error) {
	res, err := DB.Exec(Q(`
		UPDATE specialists
		SET first_payment_at = ?
		WHERE id = ? AND first_payment_at IS NULL
	`), t, specialistID)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return n == 1, nil
}

// GrantBonusSubscriptionDays extends a specialist's active subscription by the given number of
// days. It sets subscription_status='active', extends current_period_end_at from
// max(now, current_period_end_at), and seeds subscription_started_at via COALESCE.
func GrantBonusSubscriptionDays(specialistID string, days int) error {
	now := time.Now().UTC()
	// We need to compute the new period end in Go because SQLite's datetime arithmetic
	// differs from Postgres's interval syntax.
	// First fetch the current period end to compute the extension base correctly.
	var periodEndNull sql.NullTime
	err := DB.QueryRow(Q(`
		SELECT current_period_end_at FROM specialists WHERE id = ?
	`), specialistID).Scan(&periodEndNull)
	if err != nil {
		return err
	}

	base := now
	if periodEndNull.Valid && periodEndNull.Time.After(now) {
		base = periodEndNull.Time
	}
	newPeriodEnd := base.Add(time.Duration(days) * 24 * time.Hour)

	_, err = DB.Exec(Q(`
		UPDATE specialists
		SET subscription_status = 'active',
		    current_period_end_at = ?,
		    subscription_started_at = COALESCE(subscription_started_at, ?)
		WHERE id = ?
	`), newPeriodEnd, now, specialistID)
	return err
}

func scanPromoCode(row interface{ Scan(...any) error }) (*models.PromoCode, error) {
	var p models.PromoCode
	var maxRedemptions sql.NullInt64
	var validFrom, validUntil sql.NullTime
	var appliesToPlan, referralSpecialistID sql.NullString
	var isActiveInt int

	err := row.Scan(
		&p.ID, &p.Code, &p.DiscountType, &p.DiscountValue, &p.DurationDays,
		&maxRedemptions, &p.RedemptionsCount,
		&validFrom, &validUntil,
		&appliesToPlan, &referralSpecialistID, &isActiveInt, &p.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if maxRedemptions.Valid {
		v := int(maxRedemptions.Int64)
		p.MaxRedemptions = &v
	}
	if validFrom.Valid {
		v := validFrom.Time
		p.ValidFrom = &v
	}
	if validUntil.Valid {
		v := validUntil.Time
		p.ValidUntil = &v
	}
	p.AppliesToPlan = appliesToPlan.String
	p.ReferralSpecialistID = referralSpecialistID.String
	p.IsActive = isActiveInt == 1

	return &p, nil
}
