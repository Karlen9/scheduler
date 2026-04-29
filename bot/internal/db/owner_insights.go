package db

import (
	"database/sql"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

type OwnerNamedValue struct {
	Name  string `json:"name"`
	Value int    `json:"value"`
}

type OwnerRevenueLeader struct {
	Name        string `json:"name"`
	BotUsername string `json:"botUsername,omitempty"`
	Currency    string `json:"currency"`
	Revenue     int    `json:"revenue"`
}

type OwnerActivityEvent struct {
	ID             string    `json:"id"`
	Type           string    `json:"type"`
	Title          string    `json:"title"`
	Detail         string    `json:"detail,omitempty"`
	EntityID       string    `json:"entityId,omitempty"`
	EntityType     string    `json:"entityType,omitempty"`
	Status         string    `json:"status,omitempty"`
	SpecialistID   string    `json:"specialistId,omitempty"`
	SpecialistName string    `json:"specialistName,omitempty"`
	BotUsername    string    `json:"botUsername,omitempty"`
	OccurredAt     time.Time `json:"occurredAt"`
}

type OwnerBookingFunnel struct {
	Created           int     `json:"created"`
	Pending           int     `json:"pending"`
	Confirmed         int     `json:"confirmed"`
	Completed         int     `json:"completed"`
	Cancelled         int     `json:"cancelled"`
	Rejected          int     `json:"rejected"`
	ReschedulePending int     `json:"reschedulePending"`
	CancelRequested   int     `json:"cancelRequested"`
	CompletionRate    float64 `json:"completionRate"`
	DropoffRate       float64 `json:"dropoffRate"`
}

type OwnerCapacityStats struct {
	WindowStart                    time.Time         `json:"windowStart"`
	WindowEnd                      time.Time         `json:"windowEnd"`
	WorkingMinutes                 int               `json:"workingMinutes"`
	BookedMinutes                  int               `json:"bookedMinutes"`
	BookedSlots                    int               `json:"bookedSlots"`
	UtilizationRate                float64           `json:"utilizationRate"`
	SpecialistsWithoutWorkingHours int               `json:"specialistsWithoutWorkingHours"`
	BusiestWeekdays                []OwnerNamedValue `json:"busiestWeekdays"`
	BusiestHours                   []OwnerNamedValue `json:"busiestHours"`
}

type OwnerCancellationStats struct {
	Cancelled           int               `json:"cancelled"`
	Rejected            int               `json:"rejected"`
	ClientCancelled     int               `json:"clientCancelled"`
	SpecialistCancelled int               `json:"specialistCancelled"`
	CancellationRate    float64           `json:"cancellationRate"`
	BySpecialist        []OwnerNamedValue `json:"bySpecialist"`
	ByService           []OwnerNamedValue `json:"byService"`
}

type OwnerRetentionStats struct {
	TotalClients       int     `json:"totalClients"`
	RepeatClients      int     `json:"repeatClients"`
	OneTimeClients     int     `json:"oneTimeClients"`
	NewClients30d      int     `json:"newClients30d"`
	ActiveClients30d   int     `json:"activeClients30d"`
	ReturningActive30d int     `json:"returningActive30d"`
	ReturningRate      float64 `json:"returningRate"`
}

type OwnerNotificationHealthStats struct {
	RemindersSent                   int `json:"remindersSent"`
	RemindersPending                int `json:"remindersPending"`
	SpecialistBookingMessagesLinked int `json:"specialistBookingMessagesLinked"`
	ClientBookingMessagesLinked     int `json:"clientBookingMessagesLinked"`
	SpecialistOptOutNewBookings     int `json:"specialistOptOutNewBookings"`
	SpecialistOptOutCancellations   int `json:"specialistOptOutCancellations"`
	ClientOptOutStatus              int `json:"clientOptOutStatus"`
	ClientOptOutReminders           int `json:"clientOptOutReminders"`
}

type OwnerSearchClient struct {
	ID               string    `json:"id"`
	SpecialistID     string    `json:"specialistId"`
	SpecialistName   string    `json:"specialistName"`
	Name             string    `json:"name"`
	DisplayName      string    `json:"displayName,omitempty"`
	TelegramUserID   int64     `json:"telegramUserId"`
	TelegramUsername string    `json:"telegramUsername,omitempty"`
	IsGhost          bool      `json:"isGhost"`
	IsBlocked        bool      `json:"isBlocked"`
	CreatedAt        time.Time `json:"createdAt"`
}

type OwnerSearchBooking struct {
	ID             string    `json:"id"`
	SpecialistID   string    `json:"specialistId"`
	SpecialistName string    `json:"specialistName"`
	ClientName     string    `json:"clientName"`
	ServiceName    string    `json:"serviceName,omitempty"`
	Status         string    `json:"status"`
	StartsAt       time.Time `json:"startsAt"`
}

type OwnerSearchResponse struct {
	Specialists []DashboardSpecialistListItem `json:"specialists"`
	Clients     []OwnerSearchClient           `json:"clients"`
	Bookings    []OwnerSearchBooking          `json:"bookings"`
}

type OwnerCalendarEvent struct {
	BookingID      string    `json:"bookingId"`
	SpecialistID   string    `json:"specialistId"`
	SpecialistName string    `json:"specialistName"`
	BotUsername    string    `json:"botUsername,omitempty"`
	ClientName     string    `json:"clientName"`
	ServiceName    string    `json:"serviceName,omitempty"`
	Status         string    `json:"status"`
	StartsAt       time.Time `json:"startsAt"`
	EndsAt         time.Time `json:"endsAt"`
}

type OwnerBookingConflict struct {
	SpecialistID    string    `json:"specialistId"`
	SpecialistName  string    `json:"specialistName"`
	FirstBookingID  string    `json:"firstBookingId"`
	SecondBookingID string    `json:"secondBookingId"`
	FirstClient     string    `json:"firstClient"`
	SecondClient    string    `json:"secondClient"`
	StartsAt        time.Time `json:"startsAt"`
	EndsAt          time.Time `json:"endsAt"`
}

type OwnerWorkingHoursConflict struct {
	SpecialistID   string `json:"specialistId"`
	SpecialistName string `json:"specialistName"`
	DayOfWeek      int    `json:"dayOfWeek"`
	StartTime      string `json:"startTime"`
	EndTime        string `json:"endTime"`
	Reason         string `json:"reason"`
}

type OwnerConflictReport struct {
	OverlappingBookings []OwnerBookingConflict      `json:"overlappingBookings"`
	InvalidWorkingHours []OwnerWorkingHoursConflict `json:"invalidWorkingHours"`
}

type DashboardAuditLogItem struct {
	ID              string    `json:"id"`
	ActorTelegramID int64     `json:"actorTelegramId"`
	Method          string    `json:"method"`
	Path            string    `json:"path"`
	Action          string    `json:"action"`
	SpecialistID    string    `json:"specialistId,omitempty"`
	SpecialistName  string    `json:"specialistName,omitempty"`
	StatusCode      int       `json:"statusCode"`
	CreatedAt       time.Time `json:"createdAt"`
}

func percent(part, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(part) / float64(total) * 100
}

func topNamedValues(counts map[string]int, limit int) []OwnerNamedValue {
	items := make([]OwnerNamedValue, 0, len(counts))
	for name, value := range counts {
		items = append(items, OwnerNamedValue{Name: name, Value: value})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Value == items[j].Value {
			return items[i].Name < items[j].Name
		}
		return items[i].Value > items[j].Value
	})
	if limit > 0 && len(items) > limit {
		return items[:limit]
	}
	return items
}

func parseClockMinutes(value string) (int, bool) {
	parts := strings.Split(value, ":")
	if len(parts) < 2 {
		return 0, false
	}
	hour, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, false
	}
	minute, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, false
	}
	if hour < 0 || hour > 23 || minute < 0 || minute > 59 {
		return 0, false
	}
	return hour*60 + minute, true
}

func GetOwnerActivityFeed(limit int) ([]OwnerActivityEvent, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := DB.Query(Q(`
		SELECT event_type, entity_id, entity_type, title, detail, status, specialist_id, specialist_name, bot_username, occurred_at
		FROM (
			SELECT
				'booking_created' AS event_type,
				b.id AS entity_id,
				'booking' AS entity_type,
				'Booking created' AS title,
				COALESCE(NULLIF(c.display_name, ''), b.client_name) AS detail,
				b.status AS status,
				s.id AS specialist_id,
				s.name AS specialist_name,
				s.bot_username AS bot_username,
				b.created_at AS occurred_at
			FROM bookings b
			JOIN specialists s ON s.id = b.specialist_id
			LEFT JOIN clients c ON c.id = b.client_id
			UNION ALL
			SELECT
				'client_created',
				c.id,
				'client',
				'Client added',
				COALESCE(NULLIF(c.display_name, ''), c.name),
				CASE WHEN COALESCE(c.is_blocked, 0) = 1 THEN 'blocked' ELSE 'active' END,
				s.id,
				s.name,
				s.bot_username,
				c.created_at
			FROM clients c
			JOIN specialists s ON s.id = c.specialist_id
			UNION ALL
			SELECT
				'specialist_created',
				s.id,
				'specialist',
				'Specialist onboarded',
				s.name,
				CASE WHEN s.deleted_at IS NOT NULL THEN 'deleted' WHEN s.is_active = 1 THEN 'active' ELSE 'inactive' END,
				s.id,
				s.name,
				s.bot_username,
				s.created_at
			FROM specialists s
			UNION ALL
			SELECT
				'recurring_created',
				rs.id,
				'recurring',
				'Recurring schedule created',
				rs.client_name,
				rs.status,
				s.id,
				s.name,
				s.bot_username,
				rs.created_at
			FROM recurring_schedules rs
			JOIN specialists s ON s.id = rs.specialist_id
		) activity
		ORDER BY occurred_at DESC
		LIMIT ?
	`), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []OwnerActivityEvent{}
	for rows.Next() {
		var item OwnerActivityEvent
		if err := rows.Scan(&item.Type, &item.EntityID, &item.EntityType, &item.Title, &item.Detail, &item.Status, &item.SpecialistID, &item.SpecialistName, &item.BotUsername, &item.OccurredAt); err != nil {
			return nil, err
		}
		item.ID = item.Type + ":" + item.EntityID
		out = append(out, item)
	}
	return out, rows.Err()
}

func GetOwnerBookingFunnel() (*OwnerBookingFunnel, error) {
	funnel := &OwnerBookingFunnel{}
	if err := DB.QueryRow(Q(`
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'reschedule_pending' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'cancel_requested' THEN 1 ELSE 0 END), 0)
		FROM bookings
	`)).Scan(&funnel.Created, &funnel.Pending, &funnel.Confirmed, &funnel.Completed, &funnel.Cancelled, &funnel.Rejected, &funnel.ReschedulePending, &funnel.CancelRequested); err != nil {
		return nil, err
	}
	funnel.CompletionRate = percent(funnel.Completed, funnel.Created)
	funnel.DropoffRate = percent(funnel.Cancelled+funnel.Rejected, funnel.Created)
	return funnel, nil
}

func GetOwnerCapacityStats(days int) (*OwnerCapacityStats, error) {
	if days <= 0 || days > 31 {
		days = 7
	}
	now := time.Now().UTC()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 0, days)
	stats := &OwnerCapacityStats{WindowStart: start, WindowEnd: end}

	rows, err := DB.Query(Q(`
		SELECT s.id, wh.day_of_week, wh.start_time, wh.end_time
		FROM specialists s
		LEFT JOIN working_hours wh ON wh.specialist_id = s.id
		WHERE s.is_active = 1 AND s.deleted_at IS NULL
		ORDER BY s.id
	`))
	if err != nil {
		return nil, err
	}
	type hoursRow struct {
		specialistID string
		dayOfWeek    int
		startTime    string
		endTime      string
	}
	hours := []hoursRow{}
	seenSpecialists := map[string]bool{}
	withHours := map[string]bool{}
	for rows.Next() {
		var specialistID string
		var day sql.NullInt64
		var startTime, endTime sql.NullString
		if err := rows.Scan(&specialistID, &day, &startTime, &endTime); err != nil {
			rows.Close()
			return nil, err
		}
		seenSpecialists[specialistID] = true
		if day.Valid && startTime.Valid && endTime.Valid {
			withHours[specialistID] = true
			hours = append(hours, hoursRow{
				specialistID: specialistID,
				dayOfWeek:    int(day.Int64),
				startTime:    startTime.String,
				endTime:      endTime.String,
			})
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	for id := range seenSpecialists {
		if !withHours[id] {
			stats.SpecialistsWithoutWorkingHours++
		}
	}

	daysOff := map[string]bool{}
	offRows, err := DB.Query(Q(`SELECT specialist_id, date FROM days_off WHERE date >= ? AND date < ?`), start.Format("2006-01-02"), end.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	for offRows.Next() {
		var specialistID, dateValue string
		if err := offRows.Scan(&specialistID, &dateValue); err != nil {
			offRows.Close()
			return nil, err
		}
		daysOff[specialistID+"|"+dateValue[:10]] = true
	}
	if err := offRows.Err(); err != nil {
		offRows.Close()
		return nil, err
	}
	offRows.Close()

	for day := start; day.Before(end); day = day.AddDate(0, 0, 1) {
		dayKey := day.Format("2006-01-02")
		weekday := int(day.Weekday())
		for _, h := range hours {
			if h.dayOfWeek != weekday || daysOff[h.specialistID+"|"+dayKey] {
				continue
			}
			startMinutes, okStart := parseClockMinutes(h.startTime)
			endMinutes, okEnd := parseClockMinutes(h.endTime)
			if okStart && okEnd && endMinutes > startMinutes {
				stats.WorkingMinutes += endMinutes - startMinutes
			}
		}
	}

	weekdayCounts := map[string]int{}
	hourCounts := map[string]int{}
	bookingRows, err := DB.Query(Q(`
		SELECT starts_at, ends_at
		FROM bookings
		WHERE starts_at >= ? AND starts_at < ?
		  AND status IN ('pending', 'confirmed')
	`), start, end)
	if err != nil {
		return nil, err
	}
	for bookingRows.Next() {
		var startsAt, endsAt time.Time
		if err := bookingRows.Scan(&startsAt, &endsAt); err != nil {
			bookingRows.Close()
			return nil, err
		}
		stats.BookedSlots++
		if endsAt.After(startsAt) {
			stats.BookedMinutes += int(endsAt.Sub(startsAt).Minutes())
		}
		weekdayCounts[startsAt.Weekday().String()]++
		hourCounts[fmt.Sprintf("%02d:00", startsAt.Hour())]++
	}
	if err := bookingRows.Err(); err != nil {
		bookingRows.Close()
		return nil, err
	}
	bookingRows.Close()

	stats.UtilizationRate = percent(stats.BookedMinutes, stats.WorkingMinutes)
	stats.BusiestWeekdays = topNamedValues(weekdayCounts, 7)
	stats.BusiestHours = topNamedValues(hourCounts, 8)
	return stats, nil
}

func GetOwnerCancellationStats() (*OwnerCancellationStats, error) {
	stats := &OwnerCancellationStats{}
	var total int
	if err := DB.QueryRow(Q(`
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN cancelled_by = 'client' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN cancelled_by = 'specialist' THEN 1 ELSE 0 END), 0)
		FROM bookings
	`)).Scan(&total, &stats.Cancelled, &stats.Rejected, &stats.ClientCancelled, &stats.SpecialistCancelled); err != nil {
		return nil, err
	}
	stats.CancellationRate = percent(stats.Cancelled+stats.Rejected, total)

	specialists, err := queryOwnerNamedValues(`
		SELECT s.name, COUNT(*)
		FROM bookings b
		JOIN specialists s ON s.id = b.specialist_id
		WHERE b.status IN ('cancelled', 'rejected')
		GROUP BY s.id, s.name
		ORDER BY COUNT(*) DESC, s.name ASC
		LIMIT ?
	`, 8)
	if err != nil {
		return nil, err
	}
	services, err := queryOwnerNamedValues(`
		SELECT COALESCE(st.name, 'Unknown service'), COUNT(*)
		FROM bookings b
		LEFT JOIN session_types st ON st.id = b.session_type_id
		WHERE b.status IN ('cancelled', 'rejected')
		GROUP BY COALESCE(st.name, 'Unknown service')
		ORDER BY COUNT(*) DESC, COALESCE(st.name, 'Unknown service') ASC
		LIMIT ?
	`, 8)
	if err != nil {
		return nil, err
	}
	stats.BySpecialist = specialists
	stats.ByService = services
	return stats, nil
}

func GetOwnerRetentionStats() (*OwnerRetentionStats, error) {
	stats := &OwnerRetentionStats{}
	if err := DB.QueryRow(Q(`SELECT COUNT(*) FROM clients`)).Scan(&stats.TotalClients); err != nil {
		return nil, err
	}
	if err := DB.QueryRow(Q(`
		SELECT COUNT(*)
		FROM (
			SELECT client_id
			FROM bookings
			GROUP BY client_id
			HAVING COUNT(*) >= 2
		) repeated
	`)).Scan(&stats.RepeatClients); err != nil {
		return nil, err
	}
	if err := DB.QueryRow(Q(`
		SELECT COUNT(*)
		FROM (
			SELECT client_id
			FROM bookings
			GROUP BY client_id
			HAVING COUNT(*) = 1
		) one_time
	`)).Scan(&stats.OneTimeClients); err != nil {
		return nil, err
	}
	since := time.Now().UTC().AddDate(0, 0, -30)
	if err := DB.QueryRow(Q(`SELECT COUNT(*) FROM clients WHERE created_at >= ?`), since).Scan(&stats.NewClients30d); err != nil {
		return nil, err
	}
	if err := DB.QueryRow(Q(`
		SELECT COUNT(DISTINCT client_id)
		FROM bookings
		WHERE starts_at >= ? AND status NOT IN ('cancelled', 'rejected')
	`), since).Scan(&stats.ActiveClients30d); err != nil {
		return nil, err
	}
	if err := DB.QueryRow(Q(`
		SELECT COUNT(*)
		FROM (
			SELECT client_id
			FROM bookings
			GROUP BY client_id
			HAVING COUNT(*) >= 2 AND MAX(starts_at) >= ?
		) returning
	`), since).Scan(&stats.ReturningActive30d); err != nil {
		return nil, err
	}
	stats.ReturningRate = percent(stats.RepeatClients, stats.TotalClients)
	return stats, nil
}

func GetOwnerNotificationHealthStats() (*OwnerNotificationHealthStats, error) {
	stats := &OwnerNotificationHealthStats{}
	now := time.Now().UTC()
	if err := DB.QueryRow(Q(`
		SELECT
			COALESCE(SUM(CASE WHEN reminder_sent = 1 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN reminder_sent = 0 AND status = 'confirmed' AND starts_at > ? THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN telegram_notification_msg_id IS NOT NULL THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN client_notification_msg_id IS NOT NULL THEN 1 ELSE 0 END), 0)
		FROM bookings
	`), now).Scan(&stats.RemindersSent, &stats.RemindersPending, &stats.SpecialistBookingMessagesLinked, &stats.ClientBookingMessagesLinked); err != nil {
		return nil, err
	}
	if err := DB.QueryRow(Q(`SELECT COUNT(*) FROM specialists WHERE COALESCE(notify_new_bookings, 1) = 0`)).Scan(&stats.SpecialistOptOutNewBookings); err != nil {
		return nil, err
	}
	if err := DB.QueryRow(Q(`SELECT COUNT(*) FROM specialists WHERE COALESCE(notify_cancellations, 1) = 0`)).Scan(&stats.SpecialistOptOutCancellations); err != nil {
		return nil, err
	}
	if err := DB.QueryRow(Q(`SELECT COUNT(*) FROM clients WHERE COALESCE(notify_booking_status, 1) = 0`)).Scan(&stats.ClientOptOutStatus); err != nil {
		return nil, err
	}
	if err := DB.QueryRow(Q(`SELECT COUNT(*) FROM clients WHERE COALESCE(notify_reminders, 1) = 0`)).Scan(&stats.ClientOptOutReminders); err != nil {
		return nil, err
	}
	return stats, nil
}

func GetOwnerRevenueBySpecialist(limit int) ([]OwnerRevenueLeader, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := DB.Query(Q(`
		SELECT s.name, s.bot_username, COALESCE(NULLIF(st.currency, ''), 'UNKNOWN') AS currency,
			COALESCE(SUM(CASE
				WHEN st.type = 'batch' AND st.sessions_count > 1 THEN st.price / st.sessions_count
				ELSE st.price
			END), 0) AS revenue
		FROM bookings b
		JOIN specialists s ON s.id = b.specialist_id
		JOIN session_types st ON st.id = b.session_type_id
		WHERE b.status = 'completed' AND st.price > 0
		GROUP BY s.id, s.name, s.bot_username, COALESCE(NULLIF(st.currency, ''), 'UNKNOWN')
		ORDER BY revenue DESC, s.name ASC
		LIMIT ?
	`), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanOwnerRevenueLeaders(rows)
}

func GetOwnerRevenueByService(limit int) ([]OwnerRevenueLeader, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := DB.Query(Q(`
		SELECT st.name, '' AS bot_username, COALESCE(NULLIF(st.currency, ''), 'UNKNOWN') AS currency,
			COALESCE(SUM(CASE
				WHEN st.type = 'batch' AND st.sessions_count > 1 THEN st.price / st.sessions_count
				ELSE st.price
			END), 0) AS revenue
		FROM bookings b
		JOIN session_types st ON st.id = b.session_type_id
		WHERE b.status = 'completed' AND st.price > 0
		GROUP BY st.name, COALESCE(NULLIF(st.currency, ''), 'UNKNOWN')
		ORDER BY revenue DESC, st.name ASC
		LIMIT ?
	`), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanOwnerRevenueLeaders(rows)
}

func scanOwnerRevenueLeaders(rows *sql.Rows) ([]OwnerRevenueLeader, error) {
	items := []OwnerRevenueLeader{}
	for rows.Next() {
		var item OwnerRevenueLeader
		if err := rows.Scan(&item.Name, &item.BotUsername, &item.Currency, &item.Revenue); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func queryOwnerNamedValues(query string, limit int) ([]OwnerNamedValue, error) {
	rows, err := DB.Query(Q(query), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []OwnerNamedValue{}
	for rows.Next() {
		var item OwnerNamedValue
		if err := rows.Scan(&item.Name, &item.Value); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func SearchOwnerDashboard(query string, limit int) (*OwnerSearchResponse, error) {
	query = strings.TrimSpace(query)
	if limit <= 0 || limit > 25 {
		limit = 10
	}
	if query == "" {
		return &OwnerSearchResponse{
			Specialists: []DashboardSpecialistListItem{},
			Clients:     []OwnerSearchClient{},
			Bookings:    []OwnerSearchBooking{},
		}, nil
	}

	specialists, _, err := ListDashboardSpecialists(query, "", limit, 0)
	if err != nil {
		return nil, err
	}
	like := "%" + strings.ToLower(query) + "%"

	clientRows, err := DB.Query(Q(`
		SELECT c.id, c.specialist_id, s.name, c.name, COALESCE(c.display_name, ''), c.telegram_user_id,
			COALESCE(c.telegram_username, ''), COALESCE(c.is_ghost, 0), COALESCE(c.is_blocked, 0), c.created_at
		FROM clients c
		JOIN specialists s ON s.id = c.specialist_id
		WHERE LOWER(c.name) LIKE ? OR LOWER(COALESCE(c.display_name, '')) LIKE ? OR LOWER(COALESCE(c.telegram_username, '')) LIKE ? OR CAST(c.telegram_user_id AS TEXT) LIKE ?
		ORDER BY c.created_at DESC
		LIMIT ?
	`), like, like, like, like, limit)
	if err != nil {
		return nil, err
	}
	clients := []OwnerSearchClient{}
	for clientRows.Next() {
		var item OwnerSearchClient
		var isGhost, isBlocked int
		if err := clientRows.Scan(&item.ID, &item.SpecialistID, &item.SpecialistName, &item.Name, &item.DisplayName, &item.TelegramUserID, &item.TelegramUsername, &isGhost, &isBlocked, &item.CreatedAt); err != nil {
			clientRows.Close()
			return nil, err
		}
		item.IsGhost = isGhost == 1
		item.IsBlocked = isBlocked == 1
		clients = append(clients, item)
	}
	if err := clientRows.Err(); err != nil {
		clientRows.Close()
		return nil, err
	}
	clientRows.Close()

	bookingRows, err := DB.Query(Q(`
		SELECT b.id, b.specialist_id, s.name, b.client_name, COALESCE(st.name, ''), b.status, b.starts_at
		FROM bookings b
		JOIN specialists s ON s.id = b.specialist_id
		LEFT JOIN session_types st ON st.id = b.session_type_id
		WHERE LOWER(b.client_name) LIKE ? OR LOWER(COALESCE(st.name, '')) LIKE ? OR b.id LIKE ?
		ORDER BY b.starts_at DESC
		LIMIT ?
	`), like, like, "%"+query+"%", limit)
	if err != nil {
		return nil, err
	}
	bookings := []OwnerSearchBooking{}
	for bookingRows.Next() {
		var item OwnerSearchBooking
		if err := bookingRows.Scan(&item.ID, &item.SpecialistID, &item.SpecialistName, &item.ClientName, &item.ServiceName, &item.Status, &item.StartsAt); err != nil {
			bookingRows.Close()
			return nil, err
		}
		bookings = append(bookings, item)
	}
	if err := bookingRows.Err(); err != nil {
		bookingRows.Close()
		return nil, err
	}
	bookingRows.Close()

	return &OwnerSearchResponse{Specialists: specialists, Clients: clients, Bookings: bookings}, nil
}

func GetOwnerCalendarEvents(start, end time.Time) ([]OwnerCalendarEvent, error) {
	rows, err := DB.Query(Q(`
		SELECT b.id, b.specialist_id, s.name, s.bot_username, b.client_name, COALESCE(st.name, ''), b.status, b.starts_at, b.ends_at
		FROM bookings b
		JOIN specialists s ON s.id = b.specialist_id
		LEFT JOIN session_types st ON st.id = b.session_type_id
		WHERE b.starts_at >= ? AND b.starts_at < ?
		ORDER BY b.starts_at ASC
	`), start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	events := []OwnerCalendarEvent{}
	for rows.Next() {
		var item OwnerCalendarEvent
		if err := rows.Scan(&item.BookingID, &item.SpecialistID, &item.SpecialistName, &item.BotUsername, &item.ClientName, &item.ServiceName, &item.Status, &item.StartsAt, &item.EndsAt); err != nil {
			return nil, err
		}
		events = append(events, item)
	}
	return events, rows.Err()
}

func GetOwnerConflictReport(limit int) (*OwnerConflictReport, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	report := &OwnerConflictReport{
		OverlappingBookings: []OwnerBookingConflict{},
		InvalidWorkingHours: []OwnerWorkingHoursConflict{},
	}

	rows, err := DB.Query(Q(`
		SELECT b1.specialist_id, s.name, b1.id, b2.id, b1.client_name, b2.client_name, b1.starts_at, b1.ends_at
		FROM bookings b1
		JOIN bookings b2 ON b1.specialist_id = b2.specialist_id
			AND b1.id < b2.id
			AND b1.starts_at < b2.ends_at
			AND b1.ends_at > b2.starts_at
			AND b1.status IN ('pending', 'confirmed')
			AND b2.status IN ('pending', 'confirmed')
		JOIN specialists s ON s.id = b1.specialist_id
		ORDER BY b1.starts_at ASC
		LIMIT ?
	`), limit)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var item OwnerBookingConflict
		if err := rows.Scan(&item.SpecialistID, &item.SpecialistName, &item.FirstBookingID, &item.SecondBookingID, &item.FirstClient, &item.SecondClient, &item.StartsAt, &item.EndsAt); err != nil {
			rows.Close()
			return nil, err
		}
		report.OverlappingBookings = append(report.OverlappingBookings, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	hourRows, err := DB.Query(Q(`
		SELECT wh.specialist_id, s.name, wh.day_of_week, wh.start_time, wh.end_time
		FROM working_hours wh
		JOIN specialists s ON s.id = wh.specialist_id
		ORDER BY s.name, wh.day_of_week, wh.start_time
	`))
	if err != nil {
		return nil, err
	}
	type interval struct {
		specialistID   string
		specialistName string
		dayOfWeek      int
		startTime      string
		endTime        string
		startMinutes   int
		endMinutes     int
	}
	bySpecialistDay := map[string][]interval{}
	for hourRows.Next() {
		var item interval
		if err := hourRows.Scan(&item.specialistID, &item.specialistName, &item.dayOfWeek, &item.startTime, &item.endTime); err != nil {
			hourRows.Close()
			return nil, err
		}
		startMinutes, okStart := parseClockMinutes(item.startTime)
		endMinutes, okEnd := parseClockMinutes(item.endTime)
		item.startMinutes = startMinutes
		item.endMinutes = endMinutes
		if !okStart || !okEnd || endMinutes <= startMinutes {
			report.InvalidWorkingHours = append(report.InvalidWorkingHours, OwnerWorkingHoursConflict{
				SpecialistID: item.specialistID, SpecialistName: item.specialistName, DayOfWeek: item.dayOfWeek,
				StartTime: item.startTime, EndTime: item.endTime, Reason: "invalid interval",
			})
			continue
		}
		key := fmt.Sprintf("%s|%d", item.specialistID, item.dayOfWeek)
		bySpecialistDay[key] = append(bySpecialistDay[key], item)
	}
	if err := hourRows.Err(); err != nil {
		hourRows.Close()
		return nil, err
	}
	hourRows.Close()
	for _, intervals := range bySpecialistDay {
		sort.Slice(intervals, func(i, j int) bool { return intervals[i].startMinutes < intervals[j].startMinutes })
		for i := 1; i < len(intervals); i++ {
			prev := intervals[i-1]
			current := intervals[i]
			if current.startMinutes < prev.endMinutes {
				report.InvalidWorkingHours = append(report.InvalidWorkingHours, OwnerWorkingHoursConflict{
					SpecialistID: current.specialistID, SpecialistName: current.specialistName, DayOfWeek: current.dayOfWeek,
					StartTime: current.startTime, EndTime: current.endTime, Reason: "overlaps another working interval",
				})
			}
		}
	}

	return report, nil
}

func RecordDashboardAuditLog(actorTelegramID int64, method, path, action, specialistID string, statusCode int) error {
	_, err := DB.Exec(Q(`
		INSERT INTO dashboard_audit_log (id, actor_telegram_id, method, path, action, specialist_id, status_code)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`), uuid.New().String(), actorTelegramID, method, path, action, nullableString(specialistID), statusCode)
	return err
}

func ListDashboardAuditLog(limit int) ([]DashboardAuditLogItem, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	rows, err := DB.Query(Q(`
		SELECT a.id, a.actor_telegram_id, a.method, a.path, a.action, COALESCE(a.specialist_id, ''), COALESCE(s.name, ''), a.status_code, a.created_at
		FROM dashboard_audit_log a
		LEFT JOIN specialists s ON s.id = a.specialist_id
		ORDER BY a.created_at DESC
		LIMIT ?
	`), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []DashboardAuditLogItem{}
	for rows.Next() {
		var item DashboardAuditLogItem
		if err := rows.Scan(&item.ID, &item.ActorTelegramID, &item.Method, &item.Path, &item.Action, &item.SpecialistID, &item.SpecialistName, &item.StatusCode, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func nullableString(value string) interface{} {
	if value == "" {
		return nil
	}
	return value
}
