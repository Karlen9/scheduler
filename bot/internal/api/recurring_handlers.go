package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

// ========== Client Recurring Schedule Endpoints ==========

func HandleGetRecurringSchedules(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	schedules, err := db.GetRecurringSchedulesByClientID(client.ID)
	if err != nil {
		log.Printf("Error getting recurring schedules: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	if schedules == nil {
		schedules = []models.RecurringSchedule{}
	}

	writeJSON(w, schedules)
}

type CreateRecurringScheduleRequest struct {
	DayOfWeek       int    `json:"dayOfWeek"`
	Time            string `json:"time"`
	DurationMinutes int    `json:"durationMinutes"`
}

func HandleCreateRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	trainer := GetTrainerFromContext(r)
	if client == nil || trainer == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	var req CreateRecurringScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if req.DayOfWeek < 0 || req.DayOfWeek > 6 {
		http.Error(w, "Неверный день недели", http.StatusBadRequest)
		return
	}
	if req.Time == "" || req.DurationMinutes <= 0 {
		http.Error(w, "Укажите время и длительность", http.StatusBadRequest)
		return
	}

	schedule, err := db.CreateRecurringSchedule(trainer.ID, client.ID, client.Name, req.DayOfWeek, req.Time, req.DurationMinutes, "client")
	if err != nil {
		log.Printf("Error creating recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 RECURRING CREATE [%s] Client: %s | Day: %d | Time: %s | Duration: %dmin",
		schedule.ID[:8], client.Name, req.DayOfWeek, req.Time, req.DurationMinutes)

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, schedule)
}

func HandleCancelRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	scheduleID := chi.URLParam(r, "id")
	if scheduleID == "" {
		http.Error(w, "Неверный ID", http.StatusBadRequest)
		return
	}

	schedule, err := db.GetRecurringScheduleByID(scheduleID)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if schedule == nil {
		http.Error(w, "Расписание не найдено", http.StatusNotFound)
		return
	}
	if schedule.ClientID != client.ID {
		http.Error(w, "Нет доступа", http.StatusForbidden)
		return
	}

	if err := db.UpdateRecurringScheduleStatus(scheduleID, models.RecurringScheduleStatusCancelled); err != nil {
		log.Printf("Error cancelling recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 RECURRING CANCEL [%s] Client: %s", scheduleID[:8], client.Name)

	w.WriteHeader(http.StatusNoContent)
}

// ========== Admin Recurring Schedule Endpoints ==========

func HandleAdminGetRecurringSchedules(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	schedules, err := db.GetRecurringSchedulesByTrainerID(trainer.ID)
	if err != nil {
		log.Printf("Error getting recurring schedules: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	if schedules == nil {
		schedules = []models.RecurringSchedule{}
	}

	writeJSON(w, schedules)
}

type AdminCreateRecurringScheduleRequest struct {
	ClientID        string `json:"clientId"`
	DayOfWeek       int    `json:"dayOfWeek"`
	Time            string `json:"time"`
	DurationMinutes int    `json:"durationMinutes"`
}

func HandleAdminCreateRecurringSchedule(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	var req AdminCreateRecurringScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if req.ClientID == "" || req.DayOfWeek < 0 || req.DayOfWeek > 6 || req.Time == "" || req.DurationMinutes <= 0 {
		http.Error(w, "Заполните все обязательные поля", http.StatusBadRequest)
		return
	}

	// Verify client belongs to trainer
	client, err := db.GetClientByID(req.ClientID)
	if err != nil {
		log.Printf("Error getting client: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if client == nil || client.TrainerID != trainer.ID {
		http.Error(w, "Клиент не найден", http.StatusNotFound)
		return
	}

	schedule, err := db.CreateRecurringSchedule(trainer.ID, client.ID, client.Name, req.DayOfWeek, req.Time, req.DurationMinutes, "trainer")
	if err != nil {
		log.Printf("Error creating recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 RECURRING CREATE (ADMIN) [%s] Client: %s | Day: %d | Time: %s | Duration: %dmin",
		schedule.ID[:8], client.Name, req.DayOfWeek, req.Time, req.DurationMinutes)

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, schedule)
}

type UpdateRecurringStatusRequest struct {
	Status string `json:"status"`
}

func HandleAdminUpdateRecurringStatus(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "Тренер не найден", http.StatusNotFound)
		return
	}

	scheduleID := chi.URLParam(r, "id")
	if scheduleID == "" {
		http.Error(w, "Неверный ID", http.StatusBadRequest)
		return
	}

	schedule, err := db.GetRecurringScheduleByID(scheduleID)
	if err != nil {
		log.Printf("Error getting recurring schedule: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if schedule == nil || schedule.TrainerID != trainer.ID {
		http.Error(w, "Расписание не найдено", http.StatusNotFound)
		return
	}

	var req UpdateRecurringStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	validStatuses := map[string]bool{
		"active": true, "paused": true, "cancelled": true,
	}
	if !validStatuses[req.Status] {
		http.Error(w, "Неверный статус", http.StatusBadRequest)
		return
	}

	if err := db.UpdateRecurringScheduleStatus(scheduleID, models.RecurringScheduleStatus(req.Status)); err != nil {
		log.Printf("Error updating recurring schedule status: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("🔄 RECURRING STATUS [%s] → %s", scheduleID[:8], req.Status)

	updated, _ := db.GetRecurringScheduleByID(scheduleID)
	writeJSON(w, updated)
}
