package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

/***************************************************************************************************
* WebAppURL is set from config. Used to restrict CORS origins.
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
var WebAppURL string

/***************************************************************************************************
* Creates router.
*
* Parameters:
* - None.
*
* Returns:
* - The computed value for the current operation as http.Handler.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func NewRouter() http.Handler {
	r := chi.NewRouter()

	/***************************************************************************************************
	* Middleware.
	***************************************************************************************************/
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(PrometheusMiddleware)
	r.Use(SecurityHeadersMiddleware)

	/***************************************************************************************************
	* Rate limiting (disabled in load test mode).
	***************************************************************************************************/
	if !LoadTestMode {
		r.Use(GlobalRateLimitMiddleware(100, 200))
		r.Use(PerIPRateLimitMiddleware(20, 40))
	}

	/***************************************************************************************************
	* CORS for mini-app.
	***************************************************************************************************/
	allowedOrigins := allowedOriginsForCORS(WebAppURL)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Telegram-Init-Data", "X-Specialist-ID", "X-Trainer-ID", "X-Test-User-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	/***************************************************************************************************
	* Health check (no auth).
	***************************************************************************************************/
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Write([]byte("OK"))
	})

	/***************************************************************************************************
	* Prometheus metrics (restricted to internal callers or superadmin).
	***************************************************************************************************/
	r.With(MetricsAuthMiddleware).Handle("/metrics", promhttp.Handler())

	/***************************************************************************************************
	* Dashboard Telegram login (Telegram Login Widget auth + ADMIN_IDS allowlist).
	***************************************************************************************************/
	r.Post("/dashboard/auth/telegram", HandleDashboardTelegramAuth)

	/***************************************************************************************************
	* Super admin (bearer token auth).
	***************************************************************************************************/
	r.Route("/superadmin", func(r chi.Router) {
		r.Use(SuperadminAuthMiddleware)
		r.Get("/specialists", HandleListAllSpecialists)

		r.Route("/dashboard", func(r chi.Router) {
			r.Use(DashboardAuditMiddleware)
			r.Get("/overview", HandleDashboardOverview)
			r.Get("/activity", HandleDashboardActivity)
			r.Get("/audit-log", HandleDashboardAuditLog)
			r.Get("/search", HandleDashboardSearch)
			r.Get("/calendar", HandleDashboardCalendar)
			r.Get("/conflicts", HandleDashboardConflicts)
			r.Get("/system", HandleDashboardSystem)
			r.Get("/admins", HandleDashboardAdmins)
			r.Get("/export/bookings.csv", HandleDashboardExportBookingsCSV)
			r.Get("/specialists", HandleDashboardListSpecialists)

			r.Route("/specialists/{specialistID}", func(r chi.Router) {
				r.Use(DashboardSpecialistContextMiddleware)

				r.Get("/snapshot", HandleDashboardSpecialistSnapshot)
				r.Patch("/state", HandleDashboardSetSpecialistState)
				r.Get("/durations", HandleAdminGetDurations)

				r.Get("/services", HandleAdminGetServices)
				r.Post("/services", HandleCreateService)
				r.Put("/services/{id}", HandleUpdateService)
				r.Delete("/services/{id}", HandleDeleteService)

				r.Get("/working-hours", HandleAdminGetWorkingHours)
				r.Get("/schedule-context", HandleAdminGetScheduleContext)
				r.Put("/working-hours", HandleUpdateWorkingHours)

				r.Get("/bookings", HandleAdminGetBookings)
				r.Get("/stats", HandleGetAdminStats)
				r.Post("/bookings", HandleAdminCreateBooking)
				r.Put("/bookings/{id}/status", HandleAdminUpdateBookingStatus)
				r.Put("/bookings/{id}/reschedule", HandleAdminRescheduleBooking)

				r.Get("/days-off", HandleGetDaysOff)
				r.Post("/days-off/batch", HandleBatchCreateDayOff)
				r.Delete("/days-off/{id}", HandleDeleteDayOff)

				r.Get("/clients", HandleAdminGetClients)
				r.Post("/clients", HandleAdminCreateGhostClient)
				r.Put("/clients/{id}", HandleAdminUpdateClient)
				r.Delete("/clients/{id}", HandleAdminDeleteClient)
				r.Put("/clients/{id}/block", HandleAdminBlockClient)
				r.Get("/clients/{id}/batches", HandleAdminGetClientBatches)
				r.Post("/clients/{id}/batches", HandleAdminAssignClientBatch)

				r.Get("/profile", HandleGetProfile)
				r.Put("/profile", HandleUpdateProfile)

				r.Get("/recurring", HandleAdminGetRecurringSchedules)
				r.Post("/recurring", HandleAdminCreateRecurringSchedule)
				r.Post("/recurring/preview", HandleAdminPreviewRecurringSchedule)
				r.Get("/recurring/{id}", HandleAdminGetRecurringScheduleDetail)
				r.Put("/recurring/{id}/approve", HandleAdminApproveRecurringSchedule)
				r.Put("/recurring/{id}/decline", HandleAdminDeclineRecurringSchedule)
				r.Delete("/recurring/{id}", HandleAdminCancelRecurringSchedule)
				r.Put("/recurring/{scheduleId}/bookings/{bookingId}/cancel-request", HandleAdminBookingCancelRequest)
				r.Post("/recurring/{scheduleId}/bookings/{bookingId}/move", HandleAdminBookingMoveRequest)
				r.Put("/recurring/{scheduleId}/bookings/{bookingId}/approve-move", HandleAdminApproveMoveBooking)
				r.Put("/recurring/{scheduleId}/bookings/{bookingId}/decline-move", HandleAdminDeclineMoveBooking)

				r.Post("/upload/photo", HandleAdminUploadPhoto)

				r.Get("/notifications", HandleAdminGetNotificationPrefs)
				r.Put("/notifications", HandleAdminUpdateNotificationPrefs)

				r.Get("/referrals", HandleAdminGetReferrals)
			})
		})
	})

	/***************************************************************************************************
	* Photo proxy (no auth — fileIds are unguessable Telegram tokens).
	***************************************************************************************************/
	r.Get("/api/photo/{fileId}", HandleGetPhoto)

	/***************************************************************************************************
	* API routes with Telegram auth.
	***************************************************************************************************/
	r.Route("/api", func(r chi.Router) {
		r.Use(TelegramAuthMiddleware(""))
		r.Use(I18nMiddleware)

		r.Get("/specialist", HandleGetSpecialist)
		r.Get("/services", HandleGetServices)
		r.Get("/working-hours", HandleGetWorkingHours)
		r.Get("/schedule-context", HandleGetScheduleContext)
		r.Get("/availability", HandleGetAvailability)
		r.Get("/days-off", HandleGetPublicDaysOff)
		r.Get("/durations", HandleGetDurations)
		r.Get("/bookings", HandleGetBookings)
		r.Get("/stats", HandleGetClientStats)
		r.Get("/batches", HandleGetClientBatches)
		r.Get("/changes", HandleGetChangeVersions)
		r.Post("/bookings", HandleCreateBooking)
		r.Delete("/bookings/{id}", HandleCancelBooking)
		r.Put("/bookings/{id}/reschedule", HandleClientRescheduleBooking)
		r.Put("/bookings/{id}/confirm", HandleClientConfirmBooking)
		r.Put("/bookings/{id}/decline", HandleClientDeclineBooking)
		r.Put("/bookings/{id}/approve-reschedule", HandleClientApproveReschedule)
		r.Put("/bookings/{id}/decline-reschedule", HandleClientDeclineReschedule)

		/***************************************************************************************************
		* Photo upload (client).
		***************************************************************************************************/
		r.Post("/upload/photo", HandleUploadPhoto)

		/***************************************************************************************************
		* Client profile.
		***************************************************************************************************/
		r.Get("/profile", HandleGetClientProfile)
		r.Put("/profile", HandleUpdateClientProfile)
		r.Put("/profile/notifications", HandleUpdateClientNotificationPrefs)
		r.Post("/profile/restore-telegram-photo", HandleRestoreClientTelegramPhoto)

		/***************************************************************************************************
		* Client recurring schedules.
		***************************************************************************************************/
		r.Get("/recurring", HandleGetRecurringSchedules)
		r.Post("/recurring", HandleCreateRecurringSchedule)
		r.Post("/recurring/preview", HandlePreviewRecurringSchedule)
		r.Get("/recurring/{id}", HandleGetRecurringScheduleDetail)
		r.Delete("/recurring/{id}", HandleCancelRecurringSchedule)

		/***************************************************************************************************
		* Client recurring individual booking management.
		***************************************************************************************************/
		r.Put("/recurring/{scheduleId}/bookings/{bookingId}/cancel-request", HandleClientCancelRequest)
		r.Post("/recurring/{scheduleId}/bookings/{bookingId}/move", HandleClientMoveRequest)

		/***************************************************************************************************
		* Admin routes (specialist only).
		***************************************************************************************************/
		r.Route("/admin", func(r chi.Router) {
			r.Use(AdminAuthMiddleware)

			/***************************************************************************************************
			* Durations.
			***************************************************************************************************/
			r.Get("/durations", HandleAdminGetDurations)

			/***************************************************************************************************
			* Session types management.
			***************************************************************************************************/
			r.Get("/services", HandleAdminGetServices)
			r.Post("/services", HandleCreateService)
			r.Put("/services/{id}", HandleUpdateService)
			r.Delete("/services/{id}", HandleDeleteService)

			/***************************************************************************************************
			* Working hours management.
			***************************************************************************************************/
			r.Get("/working-hours", HandleAdminGetWorkingHours)
			r.Get("/schedule-context", HandleAdminGetScheduleContext)
			r.Put("/working-hours", HandleUpdateWorkingHours)

			/***************************************************************************************************
			* Bookings management.
			***************************************************************************************************/
			r.Get("/bookings", HandleAdminGetBookings)
			r.Get("/stats", HandleGetAdminStats)
			r.Post("/bookings", HandleAdminCreateBooking)
			r.Put("/bookings/{id}/status", HandleAdminUpdateBookingStatus)
			r.Put("/bookings/{id}/reschedule", HandleAdminRescheduleBooking)

			/***************************************************************************************************
			* Days off management.
			***************************************************************************************************/
			r.Get("/days-off", HandleGetDaysOff)
			r.Post("/days-off/batch", HandleBatchCreateDayOff)
			r.Delete("/days-off/{id}", HandleDeleteDayOff)

			/***************************************************************************************************
			* Clients.
			***************************************************************************************************/
			r.Get("/clients", HandleAdminGetClients)
			r.Post("/clients", HandleAdminCreateGhostClient)
			r.Put("/clients/{id}", HandleAdminUpdateClient)
			r.Delete("/clients/{id}", HandleAdminDeleteClient)
			r.Put("/clients/{id}/block", HandleAdminBlockClient)
			r.Get("/clients/{id}/batches", HandleAdminGetClientBatches)
			r.Post("/clients/{id}/batches", HandleAdminAssignClientBatch)

			/***************************************************************************************************
			* Profile management.
			***************************************************************************************************/
			r.Get("/profile", HandleGetProfile)
			r.Put("/profile", HandleUpdateProfile)
			r.Post("/profile/restore-telegram-photo", HandleRestoreSpecialistTelegramPhoto)

			/***************************************************************************************************
			* Recurring schedules (admin).
			***************************************************************************************************/
			r.Get("/recurring", HandleAdminGetRecurringSchedules)
			r.Post("/recurring", HandleAdminCreateRecurringSchedule)
			r.Post("/recurring/preview", HandleAdminPreviewRecurringSchedule)
			r.Get("/recurring/{id}", HandleAdminGetRecurringScheduleDetail)
			r.Put("/recurring/{id}/approve", HandleAdminApproveRecurringSchedule)
			r.Put("/recurring/{id}/decline", HandleAdminDeclineRecurringSchedule)
			r.Delete("/recurring/{id}", HandleAdminCancelRecurringSchedule)

			/***************************************************************************************************
			* Admin recurring individual booking management.
			***************************************************************************************************/
			r.Put("/recurring/{scheduleId}/bookings/{bookingId}/cancel-request", HandleAdminBookingCancelRequest)
			r.Post("/recurring/{scheduleId}/bookings/{bookingId}/move", HandleAdminBookingMoveRequest)
			r.Put("/recurring/{scheduleId}/bookings/{bookingId}/approve-move", HandleAdminApproveMoveBooking)
			r.Put("/recurring/{scheduleId}/bookings/{bookingId}/decline-move", HandleAdminDeclineMoveBooking)

			/***************************************************************************************************
			* Photo upload (specialist).
			***************************************************************************************************/
			r.Post("/upload/photo", HandleAdminUploadPhoto)

			/***************************************************************************************************
			* Notification preferences.
			***************************************************************************************************/
			r.Get("/notifications", HandleAdminGetNotificationPrefs)
			r.Put("/notifications", HandleAdminUpdateNotificationPrefs)

			/***************************************************************************************************
			* Referrals.
			***************************************************************************************************/
			r.Get("/referrals", HandleAdminGetReferrals)

			/***************************************************************************************************
			* Soft-delete the entire bot (requires an exact confirmation phrase in the body).
			***************************************************************************************************/
			r.Delete("/specialist", HandleAdminDeleteBot)
		})
	})

	r.Route("/api/preview", func(r chi.Router) {
		r.Use(PreviewAuthMiddleware)
		r.Use(I18nMiddleware)

		r.Get("/specialist", HandleGetSpecialist)
		r.Get("/services", HandleGetServices)
		r.Get("/working-hours", HandleGetWorkingHours)
		r.Get("/schedule-context", HandleGetScheduleContext)
		r.Get("/availability", HandleGetAvailability)
		r.Get("/days-off", HandleGetPublicDaysOff)
		r.Get("/durations", HandleGetDurations)
		r.Get("/changes", HandleGetChangeVersions)
		r.Get("/bookings", HandleGetPreviewBookings)
		r.Get("/stats", HandleGetPreviewClientStats)
		r.Get("/batches", HandleGetPreviewClientBatches)
		r.Get("/profile", HandleGetPreviewClientProfile)
		r.Get("/recurring", HandleGetPreviewRecurringSchedules)
	})

	return r
}
