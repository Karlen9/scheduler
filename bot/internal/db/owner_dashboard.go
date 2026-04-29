package db

import (
	"database/sql"
	"strings"
	"time"
)

type DashboardSpecialistListItem struct {
	ID             string     `json:"id"`
	TelegramUserID int64      `json:"telegramUserId"`
	Name           string     `json:"name"`
	BotUsername    string     `json:"botUsername"`
	Timezone       string     `json:"timezone"`
	TelegramHandle string     `json:"telegramHandle,omitempty"`
	PhotoURL       string     `json:"photoUrl,omitempty"`
	IsActive       bool       `json:"isActive"`
	CreatedAt      time.Time  `json:"createdAt"`
	DeletedAt      *time.Time `json:"deletedAt,omitempty"`
	FirstPaymentAt *time.Time `json:"firstPaymentAt,omitempty"`
	BookingCount   int        `json:"bookingCount"`
	ClientCount    int        `json:"clientCount"`
}

type OwnerMonthlyTrendPoint struct {
	Month          string `json:"month"`
	Bookings       int    `json:"bookings"`
	Completed      int    `json:"completed"`
	Cancelled      int    `json:"cancelled"`
	NewClients     int    `json:"newClients"`
	NewSpecialists int    `json:"newSpecialists"`
}

type OwnerRevenueByCurrency struct {
	Currency string `json:"currency"`
	Revenue  int    `json:"revenue"`
}

func dashboardSpecialistsWhere(search, status string) (string, []interface{}) {
	clauses := []string{"1 = 1"}
	args := []interface{}{}

	if trimmed := strings.TrimSpace(search); trimmed != "" {
		like := "%" + strings.ToLower(trimmed) + "%"
		clauses = append(clauses, `(LOWER(name) LIKE ? OR LOWER(bot_username) LIKE ? OR LOWER(COALESCE(telegram_handle, '')) LIKE ? OR CAST(telegram_user_id AS TEXT) LIKE ?)`)
		args = append(args, like, like, like, like)
	}

	switch status {
	case "active":
		clauses = append(clauses, "is_active = 1 AND deleted_at IS NULL")
	case "inactive":
		clauses = append(clauses, "is_active = 0 AND deleted_at IS NULL")
	case "deleted":
		clauses = append(clauses, "deleted_at IS NOT NULL")
	}

	return strings.Join(clauses, " AND "), args
}

func ListDashboardSpecialists(search, status string, limit, offset int) ([]DashboardSpecialistListItem, int, error) {
	whereClause, args := dashboardSpecialistsWhere(search, status)

	var total int
	if err := DB.QueryRow(Q(`SELECT COUNT(*) FROM specialists WHERE `+whereClause), args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	queryArgs := append([]interface{}{}, args...)
	queryArgs = append(queryArgs, limit, offset)
	rows, err := DB.Query(Q(`
		SELECT
			id,
			telegram_user_id,
			name,
			bot_username,
			timezone,
			COALESCE(telegram_handle, ''),
			COALESCE(photo_url, ''),
			is_active,
			created_at,
			deleted_at,
			first_payment_at,
			(SELECT COUNT(*) FROM bookings WHERE bookings.specialist_id = specialists.id),
			(SELECT COUNT(*) FROM clients WHERE clients.specialist_id = specialists.id)
		FROM specialists
		WHERE `+whereClause+`
		ORDER BY created_at DESC, name ASC
		LIMIT ? OFFSET ?
	`), queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := []DashboardSpecialistListItem{}
	for rows.Next() {
		var item DashboardSpecialistListItem
		var isActive int
		var deletedAt, firstPaymentAt sql.NullTime
		if err := rows.Scan(
			&item.ID,
			&item.TelegramUserID,
			&item.Name,
			&item.BotUsername,
			&item.Timezone,
			&item.TelegramHandle,
			&item.PhotoURL,
			&isActive,
			&item.CreatedAt,
			&deletedAt,
			&firstPaymentAt,
			&item.BookingCount,
			&item.ClientCount,
		); err != nil {
			return nil, 0, err
		}
		item.IsActive = isActive == 1
		if deletedAt.Valid {
			t := deletedAt.Time
			item.DeletedAt = &t
		}
		if firstPaymentAt.Valid {
			t := firstPaymentAt.Time
			item.FirstPaymentAt = &t
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func GetOwnerMonthlyTrends(count int) ([]OwnerMonthlyTrendPoint, error) {
	if count <= 0 {
		count = 6
	}
	now := time.Now().UTC()
	months := buildMonthRanges(now, time.UTC, count)
	result := make([]OwnerMonthlyTrendPoint, 0, len(months))

	for _, month := range months {
		point := OwnerMonthlyTrendPoint{Month: month.Key}
		if err := DB.QueryRow(Q(`
			SELECT
				COUNT(*),
				COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
				COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0)
			FROM bookings
			WHERE created_at >= ? AND created_at < ?
		`), month.Start.UTC(), month.End.UTC()).Scan(&point.Bookings, &point.Completed, &point.Cancelled); err != nil {
			return nil, err
		}
		if err := DB.QueryRow(Q(`
			SELECT COUNT(*)
			FROM clients
			WHERE created_at >= ? AND created_at < ?
		`), month.Start.UTC(), month.End.UTC()).Scan(&point.NewClients); err != nil {
			return nil, err
		}
		if err := DB.QueryRow(Q(`
			SELECT COUNT(*)
			FROM specialists
			WHERE created_at >= ? AND created_at < ?
		`), month.Start.UTC(), month.End.UTC()).Scan(&point.NewSpecialists); err != nil {
			return nil, err
		}
		result = append(result, point)
	}

	return result, nil
}

func GetOwnerRevenueByCurrency() ([]OwnerRevenueByCurrency, error) {
	rows, err := DB.Query(Q(`
		SELECT
			COALESCE(NULLIF(st.currency, ''), 'UNKNOWN') AS currency,
			COALESCE(SUM(CASE
				WHEN st.type = 'batch' AND st.sessions_count > 1 THEN st.price / st.sessions_count
				ELSE st.price
			END), 0) AS revenue
		FROM bookings b
		JOIN session_types st ON st.id = b.session_type_id
		WHERE b.status = 'completed' AND st.price > 0
		GROUP BY COALESCE(NULLIF(st.currency, ''), 'UNKNOWN')
		ORDER BY revenue DESC, currency ASC
	`))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []OwnerRevenueByCurrency{}
	for rows.Next() {
		var item OwnerRevenueByCurrency
		if err := rows.Scan(&item.Currency, &item.Revenue); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
