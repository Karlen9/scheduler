package db

import (
	"time"
)

// OwnerPlatformStats holds platform-wide specialist metrics shown in the master bot's owner panel.
type OwnerPlatformStats struct {
	TotalSpecialists    int `json:"totalSpecialists"`
	ActiveSpecialists   int `json:"activeSpecialists"`  // is_active = 1
	DeletedSpecialists  int `json:"deletedSpecialists"` // deleted_at IS NOT NULL
	NewSpecialists7d    int `json:"newSpecialists7d"`
	NewSpecialists30d   int `json:"newSpecialists30d"`
	RecentlyActive7d    int `json:"recentlyActive7d"` // at least one booking touched in last 7d
	RecentlyActive30d   int `json:"recentlyActive30d"`
	ConfiguredWithPhoto int `json:"configuredWithPhoto"` // has non-empty photo_url
	WithCustomBio       int `json:"withCustomBio"`
	WithReferralCode    int `json:"withReferralCode"`
}

// OwnerBookingStats aggregates every specialist's bookings into a single platform view.
type OwnerBookingStats struct {
	Total            int     `json:"total"`
	Last7d           int     `json:"last7d"`
	Last30d          int     `json:"last30d"`
	StatusPending    int     `json:"statusPending"`
	StatusConfirmed  int     `json:"statusConfirmed"`
	StatusCompleted  int     `json:"statusCompleted"`
	StatusCancelled  int     `json:"statusCancelled"`
	StatusRejected   int     `json:"statusRejected"`
	StatusReschedule int     `json:"statusReschedule"` // reschedule_pending / cancel_requested
	CancellationRate float64 `json:"cancellationRate"`
	Reschedules      int     `json:"reschedules"` // bookings with replaces_booking_id set
	AvgPerSpecialist float64 `json:"avgPerSpecialist"`
}

// OwnerClientStats aggregates every client across the platform.
type OwnerClientStats struct {
	Total       int     `json:"total"`
	Ghosts      int     `json:"ghosts"`
	Real        int     `json:"real"`
	Blocked     int     `json:"blocked"`
	New7d       int     `json:"new7d"`
	New30d      int     `json:"new30d"`
	AvgPerSpec  float64 `json:"avgPerSpec"`
	ViaReferral int     `json:"viaReferral"`
}

// OwnerRecurringStats aggregates recurring schedules platform-wide.
type OwnerRecurringStats struct {
	Total     int `json:"total"`
	Active    int `json:"active"`
	Pending   int `json:"pending"`
	Cancelled int `json:"cancelled"`
	Declined  int `json:"declined"`
}

// OwnerReferralStats summarises the referral program.
type OwnerReferralStats struct {
	ReferredClients     int                `json:"referredClients"`
	SpecialistsWithCode int                `json:"specialistsWithCode"`
	TopReferrers        []OwnerTopReferrer `json:"topReferrers"`
}

// OwnerTopReferrer is one row of the top-referrers leaderboard.
type OwnerTopReferrer struct {
	SpecialistName string `json:"specialistName"`
	BotUsername    string `json:"botUsername"`
	ReferredCount  int    `json:"referredCount"`
}

// OwnerTopSpecialist is one row of the generic "top N" lists.
type OwnerTopSpecialist struct {
	Name        string `json:"name"`
	BotUsername string `json:"botUsername"`
	Value       int    `json:"value"`
}

// OwnerDurationStat is one row of the duration popularity breakdown.
type OwnerDurationStat struct {
	DurationMinutes int `json:"durationMinutes"`
	Count           int `json:"count"`
}

// GetOwnerPlatformStats returns specialist-level platform metrics.
func GetOwnerPlatformStats() (*OwnerPlatformStats, error) {
	stats := &OwnerPlatformStats{}
	now := time.Now().UTC()
	sevenDays := now.AddDate(0, 0, -7)
	thirtyDays := now.AddDate(0, 0, -30)

	if err := DB.QueryRow(Q(`
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN COALESCE(photo_url, '') <> '' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN COALESCE(bio, '') <> '' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN COALESCE(referral_code, '') <> '' THEN 1 ELSE 0 END), 0)
		FROM specialists
	`), sevenDays, thirtyDays).Scan(
		&stats.TotalSpecialists,
		&stats.ActiveSpecialists,
		&stats.DeletedSpecialists,
		&stats.NewSpecialists7d,
		&stats.NewSpecialists30d,
		&stats.ConfiguredWithPhoto,
		&stats.WithCustomBio,
		&stats.WithReferralCode,
	); err != nil {
		return nil, err
	}

	if err := DB.QueryRow(Q(`
		SELECT COUNT(DISTINCT specialist_id) FROM bookings WHERE created_at >= ?
	`), sevenDays).Scan(&stats.RecentlyActive7d); err != nil {
		return nil, err
	}
	if err := DB.QueryRow(Q(`
		SELECT COUNT(DISTINCT specialist_id) FROM bookings WHERE created_at >= ?
	`), thirtyDays).Scan(&stats.RecentlyActive30d); err != nil {
		return nil, err
	}
	return stats, nil
}

// GetOwnerBookingStats aggregates booking counts platform-wide.
func GetOwnerBookingStats() (*OwnerBookingStats, error) {
	stats := &OwnerBookingStats{}
	now := time.Now().UTC()
	sevenDays := now.AddDate(0, 0, -7)
	thirtyDays := now.AddDate(0, 0, -30)

	if err := DB.QueryRow(Q(`
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status IN ('reschedule_pending','cancel_requested') THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN replaces_booking_id IS NOT NULL AND replaces_booking_id <> '' THEN 1 ELSE 0 END), 0)
		FROM bookings
	`), sevenDays, thirtyDays).Scan(
		&stats.Total,
		&stats.Last7d,
		&stats.Last30d,
		&stats.StatusPending,
		&stats.StatusConfirmed,
		&stats.StatusCompleted,
		&stats.StatusCancelled,
		&stats.StatusRejected,
		&stats.StatusReschedule,
		&stats.Reschedules,
	); err != nil {
		return nil, err
	}

	if stats.Total > 0 {
		stats.CancellationRate = float64(stats.StatusCancelled) / float64(stats.Total) * 100
	}

	var specialistCount int
	_ = DB.QueryRow(Q(`SELECT COUNT(*) FROM specialists WHERE is_active = 1`)).Scan(&specialistCount)
	if specialistCount > 0 {
		stats.AvgPerSpecialist = float64(stats.Total) / float64(specialistCount)
	}
	return stats, nil
}

// GetOwnerClientStats aggregates client counts platform-wide.
func GetOwnerClientStats() (*OwnerClientStats, error) {
	stats := &OwnerClientStats{}
	now := time.Now().UTC()
	sevenDays := now.AddDate(0, 0, -7)
	thirtyDays := now.AddDate(0, 0, -30)

	if err := DB.QueryRow(Q(`
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN is_ghost = 1 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN is_blocked = 1 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN COALESCE(referred_via_code, '') <> '' THEN 1 ELSE 0 END), 0)
		FROM clients
	`), sevenDays, thirtyDays).Scan(
		&stats.Total,
		&stats.Ghosts,
		&stats.Blocked,
		&stats.New7d,
		&stats.New30d,
		&stats.ViaReferral,
	); err != nil {
		return nil, err
	}
	stats.Real = stats.Total - stats.Ghosts

	var specialistCount int
	_ = DB.QueryRow(Q(`SELECT COUNT(*) FROM specialists WHERE is_active = 1`)).Scan(&specialistCount)
	if specialistCount > 0 {
		stats.AvgPerSpec = float64(stats.Total) / float64(specialistCount)
	}
	return stats, nil
}

// GetOwnerRecurringStats aggregates recurring-schedule counts platform-wide.
func GetOwnerRecurringStats() (*OwnerRecurringStats, error) {
	stats := &OwnerRecurringStats{}
	err := DB.QueryRow(Q(`
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END), 0)
		FROM recurring_schedules
	`)).Scan(&stats.Total, &stats.Active, &stats.Pending, &stats.Cancelled, &stats.Declined)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

// GetOwnerReferralStats returns the referral overview plus top 5 referrers.
func GetOwnerReferralStats() (*OwnerReferralStats, error) {
	stats := &OwnerReferralStats{TopReferrers: []OwnerTopReferrer{}}
	if err := DB.QueryRow(Q(`
		SELECT
			COALESCE(SUM(CASE WHEN COALESCE(referred_via_code, '') <> '' THEN 1 ELSE 0 END), 0)
		FROM clients
	`)).Scan(&stats.ReferredClients); err != nil {
		return nil, err
	}
	if err := DB.QueryRow(Q(`
		SELECT COALESCE(SUM(CASE WHEN COALESCE(referral_code, '') <> '' THEN 1 ELSE 0 END), 0)
		FROM specialists
	`)).Scan(&stats.SpecialistsWithCode); err != nil {
		return nil, err
	}

	rows, err := DB.Query(Q(`
		SELECT s.name, s.bot_username, COUNT(c.id) AS cnt
		FROM specialists s
		JOIN clients c ON c.referred_via_code = s.referral_code
		WHERE COALESCE(s.referral_code, '') <> ''
		GROUP BY s.id, s.name, s.bot_username
		ORDER BY cnt DESC, s.name
		LIMIT 5
	`))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var item OwnerTopReferrer
		if err := rows.Scan(&item.SpecialistName, &item.BotUsername, &item.ReferredCount); err != nil {
			return nil, err
		}
		stats.TopReferrers = append(stats.TopReferrers, item)
	}
	return stats, rows.Err()
}

// GetOwnerTopSpecialistsByBookings returns the top N specialists ranked by total booking count.
func GetOwnerTopSpecialistsByBookings(limit int) ([]OwnerTopSpecialist, error) {
	return queryOwnerTopSpecialists(`
		SELECT s.name, s.bot_username, COUNT(b.id) AS cnt
		FROM specialists s
		LEFT JOIN bookings b ON b.specialist_id = s.id
		GROUP BY s.id, s.name, s.bot_username
		ORDER BY cnt DESC, s.name
		LIMIT ?
	`, limit)
}

// GetOwnerTopSpecialistsByClients returns the top N specialists ranked by total client count.
func GetOwnerTopSpecialistsByClients(limit int) ([]OwnerTopSpecialist, error) {
	return queryOwnerTopSpecialists(`
		SELECT s.name, s.bot_username, COUNT(c.id) AS cnt
		FROM specialists s
		LEFT JOIN clients c ON c.specialist_id = s.id
		GROUP BY s.id, s.name, s.bot_username
		ORDER BY cnt DESC, s.name
		LIMIT ?
	`, limit)
}

// GetOwnerDurationBreakdown returns booking counts grouped by duration_minutes (completed only).
func GetOwnerDurationBreakdown() ([]OwnerDurationStat, error) {
	rows, err := DB.Query(Q(`
		SELECT duration_minutes, COUNT(*) AS cnt
		FROM bookings
		WHERE status = 'completed'
		GROUP BY duration_minutes
		ORDER BY cnt DESC, duration_minutes
	`))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OwnerDurationStat
	for rows.Next() {
		var item OwnerDurationStat
		if err := rows.Scan(&item.DurationMinutes, &item.Count); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func queryOwnerTopSpecialists(query string, limit int) ([]OwnerTopSpecialist, error) {
	rows, err := DB.Query(Q(query), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []OwnerTopSpecialist{}
	for rows.Next() {
		var item OwnerTopSpecialist
		if err := rows.Scan(&item.Name, &item.BotUsername, &item.Value); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}
