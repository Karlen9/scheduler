package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

// NotifyWaitlistOfferFunc is a callback to notify client about a waitlist offer
var NotifyWaitlistOfferFunc func(entry *models.WaitlistEntry) error

// NotifyWaitlistExpiredFunc is a callback to notify client about expired offer
var NotifyWaitlistExpiredFunc func(entry *models.WaitlistEntry) error

// JoinWaitlistRequest is the request body for joining a waitlist
type JoinWaitlistRequest struct {
	Duration int    `json:"duration"`
	Date     string `json:"date"`
	Time     string `json:"time"`
}

func HandleJoinWaitlist(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	trainer := GetTrainerFromContext(r)
	if client == nil || trainer == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	var req JoinWaitlistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	if req.Date == "" || req.Time == "" || req.Duration <= 0 {
		http.Error(w, "Укажите дату, время и длительность", http.StatusBadRequest)
		return
	}

	// Parse date and time
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		http.Error(w, "Неверный формат даты", http.StatusBadRequest)
		return
	}

	timeParts := parseTime(req.Time)
	startsAt := time.Date(date.Year(), date.Month(), date.Day(), timeParts[0], timeParts[1], 0, 0, time.UTC)
	endsAt := startsAt.Add(time.Duration(req.Duration) * time.Minute)

	// Check slot is in the future
	if startsAt.Before(time.Now().UTC()) {
		http.Error(w, "Нельзя встать в очередь на прошедшее время", http.StatusBadRequest)
		return
	}

	// Check that the slot is actually booked (has conflict)
	hasConflict, err := db.HasConflictingBooking(trainer.ID, startsAt, endsAt, "")
	if err != nil {
		log.Printf("Error checking conflicts: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if !hasConflict {
		http.Error(w, "Это время свободно — можно записаться напрямую", http.StatusBadRequest)
		return
	}

	// Check client doesn't already have waitlist entry for this slot
	hasWaitlist, err := db.ClientHasWaitlistForSlot(client.ID, trainer.ID, startsAt, endsAt)
	if err != nil {
		log.Printf("Error checking waitlist: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if hasWaitlist {
		http.Error(w, "Вы уже в очереди на это время", http.StatusConflict)
		return
	}

	entry, err := db.CreateWaitlistEntry(trainer.ID, client.ID, startsAt, endsAt, client.Name, req.Duration)
	if err != nil {
		log.Printf("Error creating waitlist entry: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	// Calculate position
	position, err := db.GetWaitlistPosition(entry)
	if err == nil {
		entry.Position = position
	}

	log.Printf("📋 WAITLIST JOIN [%s] Client: %s | Duration: %dmin | Time: %s %s",
		entry.ID[:8], client.Name, req.Duration, req.Date, req.Time)

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, entry)
}

func HandleGetMyWaitlist(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	entries, err := db.GetWaitlistByClientID(client.ID)
	if err != nil {
		log.Printf("Error getting waitlist: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	if entries == nil {
		entries = []models.WaitlistEntry{}
	}

	// Calculate positions
	for i := range entries {
		position, err := db.GetWaitlistPosition(&entries[i])
		if err == nil {
			entries[i].Position = position
		}
	}

	writeJSON(w, entries)
}

func HandleLeaveWaitlist(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	entryID := chi.URLParam(r, "id")
	if entryID == "" {
		http.Error(w, "Неверный ID", http.StatusBadRequest)
		return
	}

	entry, err := db.GetWaitlistByID(entryID)
	if err != nil {
		log.Printf("Error getting waitlist entry: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if entry == nil {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}

	if entry.ClientID != client.ID {
		http.Error(w, "Нет доступа", http.StatusForbidden)
		return
	}

	if entry.Status != models.WaitlistStatusWaiting && entry.Status != models.WaitlistStatusOffered {
		http.Error(w, "Нельзя отменить эту запись", http.StatusBadRequest)
		return
	}

	if err := db.UpdateWaitlistStatus(entryID, models.WaitlistStatusCancelled); err != nil {
		log.Printf("Error cancelling waitlist entry: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("📋 WAITLIST LEAVE [%s] Client: %s", entryID[:8], client.Name)

	w.WriteHeader(http.StatusNoContent)
}

func HandleAcceptWaitlistOffer(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	trainer := GetTrainerFromContext(r)
	if client == nil || trainer == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	entryID := chi.URLParam(r, "id")
	if entryID == "" {
		http.Error(w, "Неверный ID", http.StatusBadRequest)
		return
	}

	entry, err := db.GetWaitlistByID(entryID)
	if err != nil {
		log.Printf("Error getting waitlist entry: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if entry == nil {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}

	if entry.ClientID != client.ID {
		http.Error(w, "Нет доступа", http.StatusForbidden)
		return
	}

	if entry.Status != models.WaitlistStatusOffered {
		http.Error(w, "Предложение больше не актуально", http.StatusBadRequest)
		return
	}

	// Check if slot is in the past
	if entry.StartsAt.Before(time.Now().UTC()) {
		db.UpdateWaitlistStatus(entryID, models.WaitlistStatusExpired)
		http.Error(w, "Это время уже прошло", http.StatusBadRequest)
		return
	}

	// Race guard: check if slot is still free
	hasConflict, err := db.HasConflictingBooking(entry.TrainerID, entry.StartsAt, entry.EndsAt, "")
	if err != nil {
		log.Printf("Error checking conflicts: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if hasConflict {
		db.UpdateWaitlistStatus(entryID, models.WaitlistStatusExpired)
		http.Error(w, "Это время уже занято", http.StatusConflict)
		return
	}

	// Check client doesn't already have a booking on this day
	hasBooking, err := db.ClientHasBookingOnDate(client.ID, entry.StartsAt)
	if err != nil {
		log.Printf("Error checking client bookings: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if hasBooking {
		db.UpdateWaitlistStatus(entryID, models.WaitlistStatusDeclined)
		http.Error(w, "У вас уже есть запись на этот день", http.StatusConflict)
		return
	}

	// Find a session type to use for the booking FK
	services, err := db.GetSessionTypesByTrainerID(entry.TrainerID)
	if err != nil || len(services) == 0 {
		log.Printf("Error getting services: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	sessionTypeID := services[0].ID
	for _, s := range services {
		if s.DurationMinutes == entry.DurationMinutes {
			sessionTypeID = s.ID
			break
		}
	}

	// Create booking
	booking, err := db.CreateBooking(entry.TrainerID, entry.ClientID, sessionTypeID,
		entry.StartsAt, entry.EndsAt, entry.ClientName, "", entry.DurationMinutes)
	if err != nil {
		log.Printf("Error creating booking from waitlist: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	// Update waitlist status to booked
	db.UpdateWaitlistStatus(entryID, models.WaitlistStatusBooked)

	// Cancel remaining waitlist entries for this client on this slot
	db.CancelWaitlistEntriesForSlot(client.ID, entry.TrainerID, entry.StartsAt, entry.EndsAt)

	log.Printf("📋 WAITLIST ACCEPTED [%s] Client: %s → Booking [%s]",
		entryID[:8], entry.ClientName, booking.ID[:8])

	// Notify trainer about new booking
	if NotifyBookingFunc != nil {
		if err := NotifyBookingFunc(booking); err != nil {
			log.Printf("Error notifying trainer: %v", err)
		}
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, booking)
}

func HandleDeclineWaitlistOffer(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	if client == nil {
		http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
		return
	}

	entryID := chi.URLParam(r, "id")
	if entryID == "" {
		http.Error(w, "Неверный ID", http.StatusBadRequest)
		return
	}

	entry, err := db.GetWaitlistByID(entryID)
	if err != nil {
		log.Printf("Error getting waitlist entry: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}
	if entry == nil {
		http.Error(w, "Запись не найдена", http.StatusNotFound)
		return
	}

	if entry.ClientID != client.ID {
		http.Error(w, "Нет доступа", http.StatusForbidden)
		return
	}

	if entry.Status != models.WaitlistStatusOffered {
		http.Error(w, "Предложение больше не актуально", http.StatusBadRequest)
		return
	}

	if err := db.UpdateWaitlistStatus(entryID, models.WaitlistStatusDeclined); err != nil {
		log.Printf("Error declining waitlist entry: %v", err)
		http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	log.Printf("📋 WAITLIST DECLINED [%s] Client: %s", entryID[:8], client.Name)

	// Offer to next person in queue
	go ProcessNextWaitlistEntry(entry.TrainerID, entry.StartsAt, entry.EndsAt)

	w.WriteHeader(http.StatusNoContent)
}

// ProcessWaitlistForCancelledBooking is called after a booking is cancelled.
// Finds the first "waiting" entry for the freed slot and offers it.
func ProcessWaitlistForCancelledBooking(trainerID string, startsAt, endsAt time.Time) {
	// Don't process past slots
	if startsAt.Before(time.Now().UTC()) {
		return
	}

	entries, err := db.GetWaitlistForSlot(trainerID, startsAt, endsAt)
	if err != nil || len(entries) == 0 {
		return
	}

	// Offer to first in queue
	entry := entries[0]
	if err := db.OfferWaitlistEntry(entry.ID); err != nil {
		log.Printf("Error offering waitlist entry: %v", err)
		return
	}

	log.Printf("📋 WAITLIST OFFER [%s] Client: %s | Time: %s",
		entry.ID[:8], entry.ClientName, entry.StartsAt.Format("2006-01-02 15:04"))

	// Notify client via Telegram
	if NotifyWaitlistOfferFunc != nil {
		if err := NotifyWaitlistOfferFunc(&entry); err != nil {
			log.Printf("Error notifying waitlist offer: %v", err)
		}
	}
}

// ProcessNextWaitlistEntry is called when someone declines an offer.
func ProcessNextWaitlistEntry(trainerID string, startsAt, endsAt time.Time) {
	// Check if slot is still free
	hasConflict, _ := db.HasConflictingBooking(trainerID, startsAt, endsAt, "")
	if hasConflict {
		return
	}
	ProcessWaitlistForCancelledBooking(trainerID, startsAt, endsAt)
}
