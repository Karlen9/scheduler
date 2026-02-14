package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func NewRouter() http.Handler {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)

	// CORS for mini-app
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Telegram-Init-Data", "X-Dev-User-ID", "X-Trainer-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	})

	// Super admin (list all trainers) - protect in production!
	r.Get("/superadmin/trainers", HandleListAllTrainers)

	// API routes with auth
	r.Route("/api", func(r chi.Router) {
		r.Use(TelegramAuthMiddleware("")) // botToken not used, we look it up per trainer
		r.Use(DevAuthMiddleware(0))       // Fallback for dev

		// Photo proxy (works without auth — middleware passes through unauthenticated requests)
		r.Get("/photo/{fileId}", HandleGetPhoto)

		r.Get("/trainer", HandleGetTrainer)
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

		// Admin routes (trainer only)
		r.Route("/admin", func(r chi.Router) {
			r.Use(AdminAuthMiddleware)

			// Trainer settings
			r.Get("/settings", HandleGetTrainerSettings)
			r.Put("/settings", HandleUpdateTrainerSettings)

			// Durations
			r.Get("/durations", HandleAdminGetDurations)

			// Session types management
			r.Get("/services", HandleAdminGetServices)
			r.Post("/services", HandleCreateService)
			r.Put("/services/{type}", HandleUpdateService)
			r.Delete("/services/{type}", HandleDeleteService)

			// Working hours management
			r.Get("/working-hours", HandleAdminGetWorkingHours)
			r.Put("/working-hours", HandleUpdateWorkingHours)
			r.Put("/working-hours/{day}", HandleSetWorkingHoursForDay)
			r.Delete("/working-hours/{day}", HandleDeleteWorkingHoursForDay)

			// Bookings management
			r.Get("/bookings", HandleAdminGetBookings)
			r.Post("/bookings", HandleAdminCreateBooking)
			r.Put("/bookings/{id}/status", HandleAdminUpdateBookingStatus)

			// Days off management
			r.Get("/days-off", HandleGetDaysOff)
			r.Post("/days-off", HandleCreateDayOff)
			r.Delete("/days-off/{id}", HandleDeleteDayOff)

			// Clients
			r.Get("/clients", HandleAdminGetClients)

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

			// Photo upload (trainer)
			r.Post("/upload/photo", HandleAdminUploadPhoto)

			// Notification preferences
			r.Get("/notifications", HandleAdminGetNotificationPrefs)
			r.Put("/notifications", HandleAdminUpdateNotificationPrefs)
		})
	})

	return r
}
