package db

import (
	"database/sql"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* Defines the month range type used by the database layer.
***************************************************************************************************/
type monthRange struct {
	Key   string
	Start time.Time
	End   time.Time
}

/***************************************************************************************************
* Returns client analytics stats.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - clientID: Identifier used to target the current record.
* - timezone: Timezone used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetClientStats(specialistID, clientID, timezone string) (*models.ClientStats, error) {
	loc := loadLocation(timezone)
	now := time.Now().In(loc)
	months := buildMonthRanges(now, loc, 6)

	stats := &models.ClientStats{
		DurationBreakdown: []models.DurationCount{},
		MonthlyTrend:      make([]models.MonthlyCount, 0, len(months)),
	}

	var totalDurationMinutes int
	var averageDuration sql.NullFloat64
	var decisionCount int

	err := DB.QueryRow(Q(`
		SELECT
			COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'completed' THEN duration_minutes ELSE 0 END), 0),
			AVG(CASE WHEN status = 'completed' THEN duration_minutes END),
			COALESCE(SUM(CASE WHEN status IN ('completed', 'cancelled', 'rejected') THEN 1 ELSE 0 END), 0)
		FROM bookings
		WHERE specialist_id = ? AND client_id = ?
	`), specialistID, clientID).Scan(
		&stats.TotalSessions,
		&totalDurationMinutes,
		&averageDuration,
		&decisionCount,
	)
	if err != nil {
		return nil, err
	}

	stats.TotalHours = roundToSingleDecimal(float64(totalDurationMinutes) / 60)
	if decisionCount > 0 {
		stats.CompletionRate = roundToSingleDecimal(float64(stats.TotalSessions) / float64(decisionCount) * 100)
	}
	if averageDuration.Valid {
		stats.AverageDuration = int(math.Round(averageDuration.Float64))
	}

	monthlyCounts, err := scanMonthlyIntSeries(DB.QueryRow(Q(buildMonthlySeriesQuery(
		"COUNT",
		"starts_at",
		"specialist_id = ? AND client_id = ? AND status = 'completed'",
		len(months),
	)), buildMonthlySeriesArgs([]interface{}{specialistID, clientID}, months)...), len(months))
	if err != nil {
		return nil, err
	}

	for index, count := range monthlyCounts {
		stats.MonthlyTrend = append(stats.MonthlyTrend, models.MonthlyCount{
			Month: months[index].Key,
			Count: count,
		})
	}
	if len(monthlyCounts) >= 2 {
		stats.SessionsLastMonth = monthlyCounts[len(monthlyCounts)-2]
	}
	if len(monthlyCounts) >= 1 {
		stats.SessionsThisMonth = monthlyCounts[len(monthlyCounts)-1]
	}

	durationRows, err := DB.Query(Q(`
		SELECT duration_minutes, COUNT(*)
		FROM bookings
		WHERE specialist_id = ? AND client_id = ? AND status = 'completed'
		GROUP BY duration_minutes
		ORDER BY duration_minutes
	`), specialistID, clientID)
	if err != nil {
		return nil, err
	}
	defer durationRows.Close()

	for durationRows.Next() {
		var item models.DurationCount
		if err := durationRows.Scan(&item.Duration, &item.Count); err != nil {
			return nil, err
		}
		stats.DurationBreakdown = append(stats.DurationBreakdown, item)
	}
	if err := durationRows.Err(); err != nil {
		return nil, err
	}

	completedStarts, err := loadBookingTimes(`
		SELECT starts_at
		FROM bookings
		WHERE specialist_id = ? AND client_id = ? AND status = 'completed'
		ORDER BY starts_at
	`, specialistID, clientID)
	if err != nil {
		return nil, err
	}

	currentStreak, longestStreak, mostCommonDay, mostCommonTimeSlot := analyzeBookingPatterns(completedStarts, loc, now)
	stats.CurrentStreak = currentStreak
	stats.LongestStreak = longestStreak
	stats.MostCommonDay = mostCommonDay
	stats.MostCommonTimeSlot = mostCommonTimeSlot

	return stats, nil
}

/***************************************************************************************************
* Returns admin analytics stats.
*
* Parameters:
* - specialistID: Identifier used to target the current record.
* - timezone: Timezone used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func GetAdminStats(specialistID, timezone string) (*models.AdminStats, error) {
	loc := loadLocation(timezone)
	now := time.Now().In(loc)
	months := buildMonthRanges(now, loc, 6)
	currentMonthStart := startOfMonth(now)
	lastMonthStart := currentMonthStart.AddDate(0, -1, 0)
	nextMonthStart := currentMonthStart.AddDate(0, 1, 0)
	lastThirtyDaysStart := now.AddDate(0, 0, -30)
	fourWeeksStart := now.AddDate(0, 0, -28)

	stats := &models.AdminStats{
		TopClients:       []models.TopClientStat{},
		RevenueByMonth:   make([]models.RevenueByMonth, 0, len(months)),
		RevenueByService: []models.RevenueByService{},
	}

	var completedCount int
	var decisionCount int
	var cancelledCount int
	err := DB.QueryRow(Q(`
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status IN ('completed', 'cancelled', 'rejected') THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0)
		FROM bookings
		WHERE specialist_id = ?
	`), specialistID).Scan(&stats.TotalBookings, &completedCount, &decisionCount, &cancelledCount)
	if err != nil {
		return nil, err
	}
	if decisionCount > 0 {
		stats.CompletionRate = roundToSingleDecimal(float64(completedCount) / float64(decisionCount) * 100)
	}
	if stats.TotalBookings > 0 {
		stats.CancellationRate = roundToSingleDecimal(float64(cancelledCount) / float64(stats.TotalBookings) * 100)
	}

	err = DB.QueryRow(Q(`
		SELECT COUNT(DISTINCT client_id)
		FROM bookings
		WHERE specialist_id = ? AND status = 'completed' AND starts_at >= ? AND starts_at < ?
	`), specialistID, lastThirtyDaysStart.UTC(), now.UTC()).Scan(&stats.ActiveClients)
	if err != nil {
		return nil, err
	}

	bookingCounts, err := scanMonthlyIntSeries(DB.QueryRow(Q(buildMonthlySeriesQuery(
		"COUNT",
		"created_at",
		"specialist_id = ?",
		2,
	)), buildMonthlySeriesArgs([]interface{}{specialistID}, []monthRange{
		{Key: lastMonthStart.Format("2006-01"), Start: lastMonthStart, End: currentMonthStart},
		{Key: currentMonthStart.Format("2006-01"), Start: currentMonthStart, End: nextMonthStart},
	})...), 2)
	if err != nil {
		return nil, err
	}
	stats.BookingsLastMonth = bookingCounts[0]
	stats.BookingsThisMonth = bookingCounts[1]

	err = DB.QueryRow(Q(`
		SELECT COUNT(*)
		FROM clients
		WHERE specialist_id = ?
	`), specialistID).Scan(&stats.TotalClients)
	if err != nil {
		return nil, err
	}

	err = DB.QueryRow(Q(`
		SELECT COUNT(*)
		FROM (
			SELECT client_id, MIN(created_at) AS first_booking_at
			FROM bookings
			WHERE specialist_id = ?
			GROUP BY client_id
		) first_bookings
		WHERE first_booking_at >= ? AND first_booking_at < ?
	`), specialistID, currentMonthStart.UTC(), nextMonthStart.UTC()).Scan(&stats.NewClientsThisMonth)
	if err != nil {
		return nil, err
	}

	var returningClients int
	err = DB.QueryRow(Q(`
		SELECT COUNT(*)
		FROM (
			SELECT client_id
			FROM bookings
			WHERE specialist_id = ? AND status = 'completed'
			GROUP BY client_id
			HAVING COUNT(*) >= 2
		) returning_clients
	`), specialistID).Scan(&returningClients)
	if err != nil {
		return nil, err
	}
	if stats.TotalClients > 0 {
		stats.ReturningRate = roundToSingleDecimal(float64(returningClients) / float64(stats.TotalClients) * 100)
	}

	topClientRows, err := DB.Query(Q(`
		SELECT
			COALESCE(NULLIF(c.display_name, ''), c.name) AS client_name,
			COUNT(*) AS session_count,
			COALESCE(c.photo_url, '') AS photo_url
		FROM bookings b
		JOIN clients c ON c.id = b.client_id
		WHERE b.specialist_id = ? AND b.status = 'completed'
		GROUP BY b.client_id, COALESCE(NULLIF(c.display_name, ''), c.name), COALESCE(c.photo_url, '')
		ORDER BY session_count DESC, client_name
		LIMIT 5
	`), specialistID)
	if err != nil {
		return nil, err
	}
	defer topClientRows.Close()

	for topClientRows.Next() {
		var item models.TopClientStat
		if err := topClientRows.Scan(&item.Name, &item.Count, &item.PhotoURL); err != nil {
			return nil, err
		}
		stats.TopClients = append(stats.TopClients, item)
	}
	if err := topClientRows.Err(); err != nil {
		return nil, err
	}

	var lastFourWeekBookings int
	err = DB.QueryRow(Q(`
		SELECT COUNT(*)
		FROM bookings
		WHERE specialist_id = ? AND status NOT IN ('cancelled', 'rejected') AND starts_at >= ? AND starts_at < ?
	`), specialistID, fourWeeksStart.UTC(), now.UTC()).Scan(&lastFourWeekBookings)
	if err != nil {
		return nil, err
	}
	stats.AvgBookingsPerWeek = roundToSingleDecimal(float64(lastFourWeekBookings) / 4)

	scheduleStarts, err := loadBookingTimes(`
		SELECT starts_at
		FROM bookings
		WHERE specialist_id = ? AND status NOT IN ('cancelled', 'rejected')
		ORDER BY starts_at
	`, specialistID)
	if err != nil {
		return nil, err
	}

	_, _, busiestDay, busiestTimeSlot := analyzeBookingPatterns(scheduleStarts, loc, now)
	stats.BusiestDay = busiestDay
	stats.BusiestTimeSlot = busiestTimeSlot

	revenueCounts, err := scanMonthlyIntSeries(DB.QueryRow(Q(buildMonthlySeriesQuery(
		"REVENUE",
		"b.starts_at",
		"b.specialist_id = ? AND b.status = 'completed'",
		len(months),
	)), buildMonthlySeriesArgs([]interface{}{specialistID}, months)...), len(months))
	if err != nil {
		return nil, err
	}

	if len(revenueCounts) >= 2 {
		stats.RevenueLastMonth = revenueCounts[len(revenueCounts)-2]
	}
	if len(revenueCounts) >= 1 {
		stats.RevenueThisMonth = revenueCounts[len(revenueCounts)-1]
	}
	for index, revenue := range revenueCounts {
		stats.RevenueByMonth = append(stats.RevenueByMonth, models.RevenueByMonth{
			Month:   months[index].Key,
			Revenue: revenue,
		})
	}

	err = DB.QueryRow(Q(`
		SELECT COALESCE(currency, '')
		FROM session_types
		WHERE specialist_id = ? AND is_active = 1
		ORDER BY name
		LIMIT 1
	`), specialistID).Scan(&stats.RevenueCurrency)
	if err == sql.ErrNoRows {
		stats.RevenueCurrency = ""
	} else if err != nil {
		return nil, err
	}

	revenueServiceRows, err := DB.Query(Q(`
		SELECT st.name, COALESCE(SUM(CASE
			WHEN st.type = 'batch' AND st.sessions_count > 1 THEN st.price / st.sessions_count
			ELSE st.price
		END), 0) AS revenue
		FROM bookings b
		JOIN session_types st ON st.id = b.session_type_id
		WHERE b.specialist_id = ? AND b.status = 'completed' AND st.price > 0
		GROUP BY st.id, st.name
		ORDER BY revenue DESC, st.name
	`), specialistID)
	if err != nil {
		return nil, err
	}
	defer revenueServiceRows.Close()

	for revenueServiceRows.Next() {
		var item models.RevenueByService
		if err := revenueServiceRows.Scan(&item.Name, &item.Revenue); err != nil {
			return nil, err
		}
		stats.RevenueByService = append(stats.RevenueByService, item)
	}
	if err := revenueServiceRows.Err(); err != nil {
		return nil, err
	}

	return stats, nil
}

/***************************************************************************************************
* Returns the monthly series query for the requested aggregation mode.
*
* Parameters:
* - aggregation: Aggregation used by the current operation.
* - timeColumn: Time column used by the current operation.
* - whereClause: Where clause used by the current operation.
* - monthCount: Month count used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func buildMonthlySeriesQuery(aggregation, timeColumn, whereClause string, monthCount int) string {
	valueExpr := "1"
	aggregateFn := "SUM"
	fromClause := "FROM bookings"
	if aggregation == "REVENUE" {
		valueExpr = "COALESCE(CASE WHEN st.type = 'batch' AND st.sessions_count > 1 THEN st.price / st.sessions_count ELSE st.price END, 0)"
		fromClause = "FROM bookings b JOIN session_types st ON st.id = b.session_type_id"
	}

	parts := make([]string, 0, monthCount)
	for index := 0; index < monthCount; index++ {
		parts = append(parts, fmt.Sprintf(
			"COALESCE(%s(CASE WHEN %s >= ? AND %s < ? THEN %s ELSE 0 END), 0)",
			aggregateFn,
			timeColumn,
			timeColumn,
			valueExpr,
		))
	}

	return fmt.Sprintf("SELECT %s %s WHERE %s", strings.Join(parts, ", "), fromClause, whereClause)
}

/***************************************************************************************************
* Returns the monthly series args.
*
* Parameters:
* - baseArgs: Base args used by the current operation.
* - months: Month ranges used by the current operation.
*
* Returns:
* - The computed value for the current operation as []interface{}.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func buildMonthlySeriesArgs(baseArgs []interface{}, months []monthRange) []interface{} {
	args := make([]interface{}, 0, len(months)*2+len(baseArgs))
	for _, month := range months {
		args = append(args, month.Start.UTC(), month.End.UTC())
	}
	args = append(args, baseArgs...)
	return args
}

/***************************************************************************************************
* Scans monthly integer series.
*
* Parameters:
* - row: Row used by the current operation.
* - count: Count used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func scanMonthlyIntSeries(row *sql.Row, count int) ([]int, error) {
	values := make([]int, count)
	dest := make([]interface{}, count)
	for index := range values {
		dest[index] = &values[index]
	}
	if err := row.Scan(dest...); err != nil {
		return nil, err
	}
	return values, nil
}

/***************************************************************************************************
* Loads booking times.
*
* Parameters:
* - query: Query used by the current operation.
* - args: Args used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func loadBookingTimes(query string, args ...interface{}) ([]time.Time, error) {
	rows, err := DB.Query(Q(query), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var times []time.Time
	for rows.Next() {
		var startsAt time.Time
		if err := rows.Scan(&startsAt); err != nil {
			return nil, err
		}
		times = append(times, startsAt)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return times, nil
}

/***************************************************************************************************
* Analyzes booking patterns.
*
* Parameters:
* - starts: Starts used by the current operation.
* - loc: Location used by the current operation.
* - now: Current time used by the current operation.
*
* Returns:
* - The computed values for the current operation as pattern metrics.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func analyzeBookingPatterns(starts []time.Time, loc *time.Location, now time.Time) (int, int, *int, *string) {
	if len(starts) == 0 {
		return 0, 0, nil, nil
	}

	dayCounts := map[int]int{}
	slotCounts := map[string]int{}
	weeks := map[string]time.Time{}

	for _, startsAt := range starts {
		localTime := startsAt.In(loc)
		dayCounts[int(localTime.Weekday())]++
		if slot := classifyTimeSlot(localTime); slot != "" {
			slotCounts[slot]++
		}
		weekStart := startOfWeek(localTime)
		weeks[weekStart.Format("2006-01-02")] = weekStart
	}

	var mostCommonDay *int
	bestDayCount := -1
	for day := 0; day <= 6; day++ {
		if dayCounts[day] > bestDayCount {
			dayCopy := day
			bestDayCount = dayCounts[day]
			mostCommonDay = &dayCopy
		}
	}
	if bestDayCount <= 0 {
		mostCommonDay = nil
	}

	slotOrder := []string{"morning", "afternoon", "evening"}
	var bestSlot *string
	bestSlotCount := 0
	for _, slot := range slotOrder {
		if slotCounts[slot] > bestSlotCount {
			slotCopy := slot
			bestSlot = &slotCopy
			bestSlotCount = slotCounts[slot]
		}
	}

	weekList := make([]time.Time, 0, len(weeks))
	for _, weekStart := range weeks {
		weekList = append(weekList, weekStart)
	}
	sort.Slice(weekList, func(i, j int) bool {
		return weekList[i].Before(weekList[j])
	})

	currentStreak := 0
	for cursor := startOfWeek(now); ; cursor = cursor.AddDate(0, 0, -7) {
		if _, exists := weeks[cursor.Format("2006-01-02")]; !exists {
			break
		}
		currentStreak++
	}

	longestStreak := 0
	streak := 0
	for index, weekStart := range weekList {
		if index == 0 {
			streak = 1
		} else if weekList[index-1].AddDate(0, 0, 7).Format("2006-01-02") == weekStart.Format("2006-01-02") {
			streak++
		} else {
			streak = 1
		}
		if streak > longestStreak {
			longestStreak = streak
		}
	}

	return currentStreak, longestStreak, mostCommonDay, bestSlot
}

/***************************************************************************************************
* Returns the start of the month.
*
* Parameters:
* - t: Time used by the current operation.
*
* Returns:
* - The computed value for the current operation as time.Time.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func startOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
}

/***************************************************************************************************
* Returns the start of the week using Sunday as the first day.
*
* Parameters:
* - t: Time used by the current operation.
*
* Returns:
* - The computed value for the current operation as time.Time.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func startOfWeek(t time.Time) time.Time {
	normalized := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	return normalized.AddDate(0, 0, -int(normalized.Weekday()))
}

/***************************************************************************************************
* Builds month ranges.
*
* Parameters:
* - now: Current time used by the current operation.
* - loc: Location used by the current operation.
* - count: Count used by the current operation.
*
* Returns:
* - The computed value for the current operation as []monthRange.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func buildMonthRanges(now time.Time, loc *time.Location, count int) []monthRange {
	currentMonthStart := startOfMonth(now.In(loc))
	firstMonthStart := currentMonthStart.AddDate(0, -(count - 1), 0)
	months := make([]monthRange, 0, count)
	for index := 0; index < count; index++ {
		monthStart := firstMonthStart.AddDate(0, index, 0)
		months = append(months, monthRange{
			Key:   monthStart.Format("2006-01"),
			Start: monthStart,
			End:   monthStart.AddDate(0, 1, 0),
		})
	}
	return months
}

/***************************************************************************************************
* Loads the requested location or falls back to UTC.
*
* Parameters:
* - timezone: Timezone used by the current operation.
*
* Returns:
* - The computed value for the current operation as *time.Location.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func loadLocation(timezone string) *time.Location {
	if timezone == "" {
		return time.UTC
	}
	location, err := time.LoadLocation(timezone)
	if err != nil {
		return time.UTC
	}
	return location
}

/***************************************************************************************************
* Classifies the provided time into a reporting slot.
*
* Parameters:
* - t: Time used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func classifyTimeSlot(t time.Time) string {
	hour := t.Hour()
	switch {
	case hour >= 6 && hour <= 11:
		return "morning"
	case hour >= 12 && hour <= 16:
		return "afternoon"
	case hour >= 17 && hour <= 23:
		return "evening"
	default:
		return ""
	}
}

/***************************************************************************************************
* Rounds the given value to one decimal place.
*
* Parameters:
* - value: Value used by the current operation.
*
* Returns:
* - The computed value for the current operation as float64.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func roundToSingleDecimal(value float64) float64 {
	return math.Round(value*10) / 10
}
