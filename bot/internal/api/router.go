package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// WebAppURL is set from config. Used to restrict CORS origins.
var WebAppURL string

func NewRouter() http.Handler {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(PrometheusMiddleware)
	r.Use(SecurityHeadersMiddleware)

	// Rate limiting
	r.Use(GlobalRateLimitMiddleware(100, 200))
	r.Use(PerIPRateLimitMiddleware(20, 40))

	// CORS for mini-app
	allowedOrigins := []string{"*"}
	if WebAppURL != "" && WebAppURL != "https://your-mini-app-url.com" {
		allowedOrigins = []string{WebAppURL, "http://localhost:3000"}
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Telegram-Init-Data", "X-Specialist-ID", "X-Trainer-ID", "X-Test-User-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Health check (no auth)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	})

	// Prometheus metrics (no auth)
	r.Handle("/metrics", promhttp.Handler())

	// Super admin (bearer token auth)
	r.Route("/superadmin", func(r chi.Router) {
		r.Use(SuperadminAuthMiddleware)
		r.Get("/specialists", HandleListAllSpecialists)
	})

	// Photo proxy (no auth — fileIds are unguessable Telegram tokens)
	r.Get("/api/photo/{fileId}", HandleGetPhoto)

	// API routes with Telegram auth
	r.Route("/api", func(r chi.Router) {
		r.Use(TelegramAuthMiddleware(""))
		r.Use(I18nMiddleware)

		r.Get("/specialist", HandleGetSpecialist)
		r.Get("/services", HandleGetServices)
		r.Get("/working-hours", HandleGetWorkingHours)
		r.Get("/availability", HandleGetAvailability)
		r.Get("/days-off", HandleGetPublicDaysOff)
		r.Get("/durations", HandleGetDurations)
		r.Get("/bookings", HandleGetBookings)
		r.Post("/bookings", HandleCreateBooking)
		r.Delete("/bookings/{id}", HandleCancelBooking)
		r.Put("/bookings/{id}/confirm", HandleClientConfirmBooking)
		r.Put("/bookings/{id}/decline", HandleClientDeclineBooking)

		// Photo upload (client)
		r.Post("/upload/photo", HandleUploadPhoto)

		// Client profile
		r.Get("/profile", HandleGetClientProfile)
		r.Put("/profile", HandleUpdateClientProfile)
		r.Put("/profile/notifications", HandleUpdateClientNotificationPrefs)

		// Client recurring schedules
		r.Get("/recurring", HandleGetRecurringSchedules)
		r.Post("/recurring", HandleCreateRecurringSchedule)
		r.Post("/recurring/preview", HandlePreviewRecurringSchedule)
		r.Get("/recurring/{id}", HandleGetRecurringScheduleDetail)
		r.Delete("/recurring/{id}", HandleCancelRecurringSchedule)

		// Client recurring individual booking management
		r.Put("/recurring/{scheduleId}/bookings/{bookingId}/cancel-request", HandleClientCancelRequest)
		r.Post("/recurring/{scheduleId}/bookings/{bookingId}/move", HandleClientMoveRequest)

		// Admin routes (specialist only)
		r.Route("/admin", func(r chi.Router) {
			r.Use(AdminAuthMiddleware)

			// Specialist settings
			r.Get("/settings", HandleGetSpecialistSettings)
			r.Put("/settings", HandleUpdateSpecialistSettings)

			// Durations
			r.Get("/durations", HandleAdminGetDurations)

			// Session types management
			r.Get("/services", HandleAdminGetServices)
			r.Post("/services", HandleCreateService)
			r.Put("/services/{id}", HandleUpdateService)
			r.Delete("/services/{id}", HandleDeleteService)

			// Working hours management
			r.Get("/working-hours", HandleAdminGetWorkingHours)
			r.Put("/working-hours", HandleUpdateWorkingHours)
			r.Put("/working-hours/{day}", HandleSetWorkingHoursForDay)
			r.Delete("/working-hours/{day}", HandleDeleteWorkingHoursForDay)

			// Bookings management
			r.Get("/bookings", HandleAdminGetBookings)
			r.Post("/bookings", HandleAdminCreateBooking)
			r.Put("/bookings/{id}/status", HandleAdminUpdateBookingStatus)
			r.Put("/bookings/{id}/reschedule", HandleAdminRescheduleBooking)

			// Days off management
			r.Get("/days-off", HandleGetDaysOff)
			r.Post("/days-off", HandleCreateDayOff)
			r.Delete("/days-off/{id}", HandleDeleteDayOff)

			// Clients
			r.Get("/clients", HandleAdminGetClients)
			r.Post("/clients", HandleAdminCreateGhostClient)
			r.Put("/clients/{id}", HandleAdminUpdateClient)
			r.Delete("/clients/{id}", HandleAdminDeleteClient)

			// Profile management
			r.Get("/profile", HandleGetProfile)
			r.Put("/profile", HandleUpdateProfile)

			// Recurring schedules (admin)
			r.Get("/recurring", HandleAdminGetRecurringSchedules)
			r.Post("/recurring", HandleAdminCreateRecurringSchedule)
			r.Post("/recurring/preview", HandleAdminPreviewRecurringSchedule)
			r.Get("/recurring/{id}", HandleAdminGetRecurringScheduleDetail)
			r.Put("/recurring/{id}/approve", HandleAdminApproveRecurringSchedule)
			r.Put("/recurring/{id}/decline", HandleAdminDeclineRecurringSchedule)
			r.Delete("/recurring/{id}", HandleAdminCancelRecurringSchedule)

			// Admin recurring individual booking management
			r.Put("/recurring/{scheduleId}/bookings/{bookingId}/cancel-request", HandleAdminBookingCancelRequest)
			r.Post("/recurring/{scheduleId}/bookings/{bookingId}/move", HandleAdminBookingMoveRequest)
			r.Put("/recurring/{scheduleId}/bookings/{bookingId}/approve-move", HandleAdminApproveMoveBooking)
			r.Put("/recurring/{scheduleId}/bookings/{bookingId}/decline-move", HandleAdminDeclineMoveBooking)

			// Photo upload (specialist)
			r.Post("/upload/photo", HandleAdminUploadPhoto)

			// Notification preferences
			r.Get("/notifications", HandleAdminGetNotificationPrefs)
			r.Put("/notifications", HandleAdminUpdateNotificationPrefs)
		})
	})

	return r
}
