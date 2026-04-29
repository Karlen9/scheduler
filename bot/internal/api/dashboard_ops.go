package api

import (
	"encoding/csv"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/db"
)

type dashboardStatusRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *dashboardStatusRecorder) WriteHeader(statusCode int) {
	r.statusCode = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

func DashboardAuditMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recorder := &dashboardStatusRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(recorder, r)

		if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
			return
		}
		actorID, _ := strconv.ParseInt(r.Header.Get("X-Dashboard-User-ID"), 10, 64)
		action := r.Method + " " + r.URL.Path
		if err := db.RecordDashboardAuditLog(actorID, r.Method, r.URL.Path, action, chi.URLParam(r, "specialistID"), recorder.statusCode); err != nil {
			dashboardInternalErrorLog("dashboard audit log", err)
		}
	})
}

func dashboardInternalErrorLog(message string, err error) {
	if err != nil {
		log.Printf("%s: %v", message, err)
	}
}

type DashboardActivityResponse struct {
	Activity []db.OwnerActivityEvent `json:"activity"`
}

type DashboardAuditLogResponse struct {
	Items []db.DashboardAuditLogItem `json:"items"`
}

type DashboardCalendarResponse struct {
	Events []db.OwnerCalendarEvent `json:"events"`
}

type DashboardAdminsResponse struct {
	AdminIDs []int64 `json:"adminIds"`
	Count    int     `json:"count"`
}

type DashboardSystemResponse struct {
	BackendOK              bool      `json:"backendOk"`
	DatabaseOK             bool      `json:"databaseOk"`
	SuperadminEnabled      bool      `json:"superadminEnabled"`
	TelegramAuthConfigured bool      `json:"telegramAuthConfigured"`
	AdminCount             int       `json:"adminCount"`
	ServerTime             time.Time `json:"serverTime"`
}

func dashboardLimit(r *http.Request, fallback, max int) int {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		return fallback
	}
	if limit > max {
		return max
	}
	return limit
}

func dashboardDateRange(r *http.Request, defaultPastDays, defaultFutureDays int) (time.Time, time.Time, bool) {
	now := time.Now().UTC()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -defaultPastDays)
	end := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, defaultFutureDays)
	if raw := strings.TrimSpace(r.URL.Query().Get("dateFrom")); raw != "" {
		parsed, err := time.Parse("2006-01-02", raw)
		if err != nil {
			return time.Time{}, time.Time{}, false
		}
		start = parsed
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("dateTo")); raw != "" {
		parsed, err := time.Parse("2006-01-02", raw)
		if err != nil {
			return time.Time{}, time.Time{}, false
		}
		end = parsed.AddDate(0, 0, 1)
	}
	if !end.After(start) {
		return time.Time{}, time.Time{}, false
	}
	return start, end, true
}

func HandleDashboardActivity(w http.ResponseWriter, r *http.Request) {
	activity, err := db.GetOwnerActivityFeed(dashboardLimit(r, 50, 100))
	if err != nil {
		dashboardInternalError(w, "dashboard activity", err)
		return
	}
	setNoStore(w)
	writeJSON(w, DashboardActivityResponse{Activity: activity})
}

func HandleDashboardAuditLog(w http.ResponseWriter, r *http.Request) {
	items, err := db.ListDashboardAuditLog(dashboardLimit(r, 100, 200))
	if err != nil {
		dashboardInternalError(w, "dashboard audit log", err)
		return
	}
	setNoStore(w)
	writeJSON(w, DashboardAuditLogResponse{Items: items})
}

func HandleDashboardSearch(w http.ResponseWriter, r *http.Request) {
	result, err := db.SearchOwnerDashboard(r.URL.Query().Get("q"), dashboardLimit(r, 10, 25))
	if err != nil {
		dashboardInternalError(w, "dashboard search", err)
		return
	}
	setNoStore(w)
	writeJSON(w, result)
}

func HandleDashboardCalendar(w http.ResponseWriter, r *http.Request) {
	start, end, ok := dashboardDateRange(r, 0, 31)
	if !ok {
		http.Error(w, "Bad date range", http.StatusBadRequest)
		return
	}
	events, err := db.GetOwnerCalendarEvents(start, end)
	if err != nil {
		dashboardInternalError(w, "dashboard calendar", err)
		return
	}
	setNoStore(w)
	writeJSON(w, DashboardCalendarResponse{Events: events})
}

func HandleDashboardConflicts(w http.ResponseWriter, r *http.Request) {
	report, err := db.GetOwnerConflictReport(dashboardLimit(r, 50, 100))
	if err != nil {
		dashboardInternalError(w, "dashboard conflicts", err)
		return
	}
	setNoStore(w)
	writeJSON(w, report)
}

func HandleDashboardSystem(w http.ResponseWriter, r *http.Request) {
	dbOK := false
	if db.DB != nil && db.DB.Ping() == nil {
		dbOK = true
	}
	setNoStore(w)
	writeJSON(w, DashboardSystemResponse{
		BackendOK:              true,
		DatabaseOK:             dbOK,
		SuperadminEnabled:      SuperadminSecret != "",
		TelegramAuthConfigured: MasterBotToken != "",
		AdminCount:             len(AdminIDs),
		ServerTime:             time.Now().UTC(),
	})
}

func HandleDashboardAdmins(w http.ResponseWriter, r *http.Request) {
	adminIDs := append([]int64{}, AdminIDs...)
	setNoStore(w)
	writeJSON(w, DashboardAdminsResponse{AdminIDs: adminIDs, Count: len(adminIDs)})
}

func HandleDashboardSetSpecialistState(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		http.Error(w, "Specialist not found", http.StatusNotFound)
		return
	}
	var req struct {
		Active bool `json:"active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}
	var err error
	if req.Active {
		err = db.ActivateSpecialist(specialist.ID)
	} else {
		err = db.DeactivateSpecialist(specialist.ID)
	}
	if err != nil {
		dashboardInternalError(w, "dashboard specialist state", err)
		return
	}
	updated, err := db.GetSpecialistByID(specialist.ID)
	if err != nil {
		dashboardInternalError(w, "dashboard specialist state reload", err)
		return
	}
	writeJSON(w, updated)
}

func HandleDashboardExportBookingsCSV(w http.ResponseWriter, r *http.Request) {
	start, end, ok := dashboardDateRange(r, 90, 90)
	if !ok {
		http.Error(w, "Bad date range", http.StatusBadRequest)
		return
	}
	events, err := db.GetOwnerCalendarEvents(start, end)
	if err != nil {
		dashboardInternalError(w, "dashboard export bookings", err)
		return
	}

	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="dashboard-bookings.csv"`)
	writer := csv.NewWriter(w)
	_ = writer.Write([]string{"booking_id", "specialist", "bot_username", "client", "service", "status", "starts_at", "ends_at"})
	for _, event := range events {
		_ = writer.Write([]string{
			event.BookingID,
			event.SpecialistName,
			event.BotUsername,
			event.ClientName,
			event.ServiceName,
			event.Status,
			event.StartsAt.Format(time.RFC3339),
			event.EndsAt.Format(time.RFC3339),
		})
	}
	writer.Flush()
}
