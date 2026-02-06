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
		AllowCredentials: true,
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

		r.Get("/trainer", HandleGetTrainer)
		r.Get("/services", HandleGetServices)
		r.Get("/working-hours", HandleGetWorkingHours)
		r.Get("/availability", HandleGetAvailability)
		r.Get("/days-off", HandleGetPublicDaysOff)
		r.Get("/bookings", HandleGetBookings)
		r.Post("/bookings", HandleCreateBooking)
		r.Delete("/bookings/{id}", HandleCancelBooking)

		// Admin routes (trainer only)
		r.Route("/admin", func(r chi.Router) {
			r.Use(AdminAuthMiddleware)

			// Trainer settings
			r.Get("/settings", HandleGetTrainerSettings)
			r.Put("/settings", HandleUpdateTrainerSettings)

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
			r.Put("/bookings/{id}/status", HandleAdminUpdateBookingStatus)

			// Days off management
			r.Get("/days-off", HandleGetDaysOff)
			r.Post("/days-off", HandleCreateDayOff)
			r.Delete("/days-off/{id}", HandleDeleteDayOff)

			// Profile management
			r.Get("/profile", HandleGetProfile)
			r.Put("/profile", HandleUpdateProfile)
		})
	})

	return r
}
