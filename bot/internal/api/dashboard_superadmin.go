package api

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

type DashboardOverviewResponse struct {
	Platform                 *db.OwnerPlatformStats           `json:"platform"`
	Bookings                 *db.OwnerBookingStats            `json:"bookings"`
	Clients                  *db.OwnerClientStats             `json:"clients"`
	Recurring                *db.OwnerRecurringStats          `json:"recurring"`
	Referrals                *db.OwnerReferralStats           `json:"referrals"`
	BookingFunnel            *db.OwnerBookingFunnel           `json:"bookingFunnel"`
	Capacity                 *db.OwnerCapacityStats           `json:"capacity"`
	Cancellations            *db.OwnerCancellationStats       `json:"cancellations"`
	Retention                *db.OwnerRetentionStats          `json:"retention"`
	NotificationHealth       *db.OwnerNotificationHealthStats `json:"notificationHealth"`
	TopSpecialistsByBookings []db.OwnerTopSpecialist          `json:"topSpecialistsByBookings"`
	TopSpecialistsByClients  []db.OwnerTopSpecialist          `json:"topSpecialistsByClients"`
	DurationBreakdown        []db.OwnerDurationStat           `json:"durationBreakdown"`
	MonthlyTrends            []db.OwnerMonthlyTrendPoint      `json:"monthlyTrends"`
	RevenueByCurrency        []db.OwnerRevenueByCurrency      `json:"revenueByCurrency"`
	RevenueBySpecialist      []db.OwnerRevenueLeader          `json:"revenueBySpecialist"`
	RevenueByService         []db.OwnerRevenueLeader          `json:"revenueByService"`
	Activity                 []db.OwnerActivityEvent          `json:"activity"`
}

type DashboardSpecialistsResponse struct {
	Specialists []db.DashboardSpecialistListItem `json:"specialists"`
	Total       int                              `json:"total"`
	Page        int                              `json:"page"`
	Limit       int                              `json:"limit"`
	TotalPages  int                              `json:"totalPages"`
	SearchQuery string                           `json:"searchQuery,omitempty"`
	Status      string                           `json:"status,omitempty"`
}

type DashboardSpecialistSnapshot struct {
	Profile       SpecialistResponse             `json:"profile"`
	Stats         *models.AdminStats             `json:"stats"`
	Services      []models.SessionType           `json:"services"`
	Bookings      models.BookingListResponse     `json:"bookings"`
	Clients       models.ClientListResponse      `json:"clients"`
	Recurring     []models.RecurringSchedule     `json:"recurring"`
	Schedule      AdminScheduleContextResponse   `json:"schedule"`
	Notifications AdminNotificationPrefsResponse `json:"notifications"`
	Referrals     ReferralsResponse              `json:"referrals"`
	Durations     []int                          `json:"durations"`
}

func dashboardInternalError(w http.ResponseWriter, message string, err error) {
	log.Printf("%s: %v", message, err)
	http.Error(w, "Internal server error", http.StatusInternalServerError)
}

func HandleDashboardOverview(w http.ResponseWriter, r *http.Request) {
	platform, err := db.GetOwnerPlatformStats()
	if err != nil {
		dashboardInternalError(w, "dashboard overview platform", err)
		return
	}
	bookings, err := db.GetOwnerBookingStats()
	if err != nil {
		dashboardInternalError(w, "dashboard overview bookings", err)
		return
	}
	clients, err := db.GetOwnerClientStats()
	if err != nil {
		dashboardInternalError(w, "dashboard overview clients", err)
		return
	}
	recurring, err := db.GetOwnerRecurringStats()
	if err != nil {
		dashboardInternalError(w, "dashboard overview recurring", err)
		return
	}
	referrals, err := db.GetOwnerReferralStats()
	if err != nil {
		dashboardInternalError(w, "dashboard overview referrals", err)
		return
	}
	funnel, err := db.GetOwnerBookingFunnel()
	if err != nil {
		dashboardInternalError(w, "dashboard overview funnel", err)
		return
	}
	capacity, err := db.GetOwnerCapacityStats(7)
	if err != nil {
		dashboardInternalError(w, "dashboard overview capacity", err)
		return
	}
	cancellations, err := db.GetOwnerCancellationStats()
	if err != nil {
		dashboardInternalError(w, "dashboard overview cancellations", err)
		return
	}
	retention, err := db.GetOwnerRetentionStats()
	if err != nil {
		dashboardInternalError(w, "dashboard overview retention", err)
		return
	}
	notificationHealth, err := db.GetOwnerNotificationHealthStats()
	if err != nil {
		dashboardInternalError(w, "dashboard overview notifications", err)
		return
	}
	topByBookings, err := db.GetOwnerTopSpecialistsByBookings(10)
	if err != nil {
		dashboardInternalError(w, "dashboard overview top bookings", err)
		return
	}
	topByClients, err := db.GetOwnerTopSpecialistsByClients(10)
	if err != nil {
		dashboardInternalError(w, "dashboard overview top clients", err)
		return
	}
	durations, err := db.GetOwnerDurationBreakdown()
	if err != nil {
		dashboardInternalError(w, "dashboard overview durations", err)
		return
	}
	monthly, err := db.GetOwnerMonthlyTrends(6)
	if err != nil {
		dashboardInternalError(w, "dashboard overview monthly trends", err)
		return
	}
	revenueByCurrency, err := db.GetOwnerRevenueByCurrency()
	if err != nil {
		dashboardInternalError(w, "dashboard overview revenue", err)
		return
	}
	revenueBySpecialist, err := db.GetOwnerRevenueBySpecialist(10)
	if err != nil {
		dashboardInternalError(w, "dashboard overview revenue by specialist", err)
		return
	}
	revenueByService, err := db.GetOwnerRevenueByService(10)
	if err != nil {
		dashboardInternalError(w, "dashboard overview revenue by service", err)
		return
	}
	activity, err := db.GetOwnerActivityFeed(12)
	if err != nil {
		dashboardInternalError(w, "dashboard overview activity", err)
		return
	}

	setNoStore(w)
	writeJSON(w, DashboardOverviewResponse{
		Platform:                 platform,
		Bookings:                 bookings,
		Clients:                  clients,
		Recurring:                recurring,
		Referrals:                referrals,
		BookingFunnel:            funnel,
		Capacity:                 capacity,
		Cancellations:            cancellations,
		Retention:                retention,
		NotificationHealth:       notificationHealth,
		TopSpecialistsByBookings: topByBookings,
		TopSpecialistsByClients:  topByClients,
		DurationBreakdown:        durations,
		MonthlyTrends:            monthly,
		RevenueByCurrency:        revenueByCurrency,
		RevenueBySpecialist:      revenueBySpecialist,
		RevenueByService:         revenueByService,
		Activity:                 activity,
	})
}

func HandleDashboardListSpecialists(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	page, err := parseAdminBookingsPositiveInt(query.Get("page"), 1)
	if err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}
	limit, err := parseAdminBookingsPositiveInt(query.Get("limit"), 25)
	if err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}
	if limit > 100 {
		limit = 100
	}
	search := strings.TrimSpace(query.Get("search"))
	status := strings.TrimSpace(query.Get("status"))

	specialists, total, err := db.ListDashboardSpecialists(search, status, limit, (page-1)*limit)
	if err != nil {
		dashboardInternalError(w, "dashboard specialists list", err)
		return
	}

	totalPages := 0
	if total > 0 {
		totalPages = (total + limit - 1) / limit
	}

	setNoStore(w)
	writeJSON(w, DashboardSpecialistsResponse{
		Specialists: specialists,
		Total:       total,
		Page:        page,
		Limit:       limit,
		TotalPages:  totalPages,
		SearchQuery: search,
		Status:      status,
	})
}

func DashboardSpecialistContextMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		specialistID := chi.URLParam(r, "specialistID")
		if specialistID == "" {
			http.Error(w, "Missing specialist ID", http.StatusBadRequest)
			return
		}

		specialist, err := db.GetSpecialistByID(specialistID)
		if err != nil {
			dashboardInternalError(w, "dashboard specialist load", err)
			return
		}
		if specialist == nil {
			http.Error(w, "Specialist not found", http.StatusNotFound)
			return
		}
		isStatePatch := r.Method == http.MethodPatch && strings.HasSuffix(r.URL.Path, "/state")
		if isStatePatch && specialist.DeletedAt != nil {
			http.Error(w, "Specialist is deleted", http.StatusConflict)
			return
		}
		if r.Method != http.MethodGet && !isStatePatch && (!specialist.IsActive || specialist.DeletedAt != nil) {
			http.Error(w, "Specialist is inactive", http.StatusConflict)
			return
		}

		ctx := context.WithValue(r.Context(), SpecialistContextKey, specialist)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func HandleDashboardSpecialistSnapshot(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		http.Error(w, "Specialist not found", http.StatusNotFound)
		return
	}

	stats, err := db.GetAdminStats(specialist.ID, specialist.Timezone)
	if err != nil {
		dashboardInternalError(w, "dashboard specialist stats", err)
		return
	}
	services, err := db.GetAllSessionTypesBySpecialistID(specialist.ID)
	if err != nil {
		dashboardInternalError(w, "dashboard specialist services", err)
		return
	}
	if services == nil {
		services = []models.SessionType{}
	}
	bookings, bookingTotal, err := db.GetBookingsBySpecialistIDFiltered(specialist.ID, db.BookingListFilters{
		Sort:   "created_desc",
		Limit:  25,
		Offset: 0,
	})
	if err != nil {
		dashboardInternalError(w, "dashboard specialist bookings", err)
		return
	}
	if bookings == nil {
		bookings = []models.Booking{}
	}
	clients, clientTotal, err := db.GetClientsBySpecialistIDPaged(specialist.ID, "", 25, 0)
	if err != nil {
		dashboardInternalError(w, "dashboard specialist clients", err)
		return
	}
	if clients == nil {
		clients = []models.Client{}
	}
	recurring, err := db.GetRecurringSchedulesBySpecialistID(specialist.ID)
	if err != nil {
		dashboardInternalError(w, "dashboard specialist recurring", err)
		return
	}
	if recurring == nil {
		recurring = []models.RecurringSchedule{}
	}
	schedule, err := loadAdminScheduleContext(specialist.ID)
	if err != nil {
		dashboardInternalError(w, "dashboard specialist schedule", err)
		return
	}
	referrals, err := buildReferralsResponse(specialist)
	if err != nil {
		dashboardInternalError(w, "dashboard specialist referrals", err)
		return
	}

	dashEnt := specialist.Entitlement(time.Now())
	setNoStore(w)
	writeJSON(w, DashboardSpecialistSnapshot{
		Profile: SpecialistResponse{
			ID:                 specialist.ID,
			Name:               specialist.Name,
			Timezone:           specialist.Timezone,
			CancelCutoffHrs:    specialist.CancelCutoffHrs,
			BotUsername:        specialist.BotUsername,
			TelegramHandle:     specialist.TelegramHandle,
			Phone:              specialist.Phone,
			Specialization:     specialist.Specialization,
			Bio:                specialist.Bio,
			PhotoURL:           specialist.PhotoURL,
			LocationLatitude:   specialist.LocationLatitude,
			LocationLongitude:  specialist.LocationLongitude,
			Language:           specialist.Language,
			Wallpaper:          specialist.Wallpaper,
			IsPro:              dashEnt.IsPro,
			SubscriptionStatus: specialist.SubscriptionStatus,
			TrialEndsAt:        specialist.TrialEndsAt,
			CurrentPeriodEndAt: specialist.CurrentPeriodEndAt,
			AutoRenew:          specialist.AutoRenew,
		},
		Stats:    stats,
		Services: services,
		Bookings: models.BookingListResponse{
			Bookings:   bookings,
			Total:      bookingTotal,
			Page:       1,
			Limit:      25,
			TotalPages: (bookingTotal + 24) / 25,
		},
		Clients: models.ClientListResponse{
			Clients:    clients,
			Total:      clientTotal,
			Page:       1,
			Limit:      25,
			TotalPages: (clientTotal + 24) / 25,
		},
		Recurring: recurring,
		Schedule:  schedule,
		Notifications: AdminNotificationPrefsResponse{
			NotifyNewBookings:   specialist.NotifyNewBookings,
			NotifyCancellations: specialist.NotifyCancellations,
		},
		Referrals: referrals,
		Durations: getDurationsFromServices(specialist.ID),
	})
}
