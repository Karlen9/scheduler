package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
)

func isSelfClient(c *models.Client, s *models.Specialist) bool {
	return s != nil && c.IsSelfOf(s.TelegramUserID)
}

type AssignClientBatchRequest struct {
	ServiceID      string `json:"service_id"`
	ServiceIDCamel string `json:"serviceId"`
}

func HandleAdminCreateGhostClient(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		httpError(w, r, "Error.MissingClientName", http.StatusBadRequest)
		return
	}

	client, err := db.CreateGhostClient(specialist.ID, name)
	if err != nil {
		log.Printf("Error creating ghost client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("GHOST CLIENT created: %s for specialist %s", name, specialist.Name)
	changes.Publish(specialist.ID, changes.GroupClients)
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, client)
}

func getAdminOwnedClient(w http.ResponseWriter, r *http.Request, specialistID string) (*models.Client, bool) {
	clientID := chi.URLParam(r, "id")
	if clientID == "" {
		httpError(w, r, "Error.MissingClientID", http.StatusBadRequest)
		return nil, false
	}

	client, err := db.GetClientByID(clientID)
	if err != nil {
		log.Printf("Error getting client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return nil, false
	}
	if client == nil || client.SpecialistID != specialistID {
		httpError(w, r, "Error.ClientNotFound", http.StatusNotFound)
		return nil, false
	}
	return client, true
}

func HandleAdminGetClientBatches(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	client, ok := getAdminOwnedClient(w, r, specialist.ID)
	if !ok {
		return
	}

	batches, err := db.GetClientBatchesByClientID(client.ID, specialist.ID)
	if err != nil {
		log.Printf("Error getting client batches: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if batches == nil {
		batches = []models.ClientBatch{}
	}

	setNoStore(w)
	writeJSON(w, batches)
}

func HandleAdminAssignClientBatch(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}
	if !requirePro(w, r, specialist) {
		return
	}

	client, ok := getAdminOwnedClient(w, r, specialist.ID)
	if !ok {
		return
	}

	var req AssignClientBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	serviceID := req.ServiceID
	if serviceID == "" {
		serviceID = req.ServiceIDCamel
	}
	if serviceID == "" {
		httpError(w, r, "Error.MissingServiceID", http.StatusBadRequest)
		return
	}

	batch, err := db.AssignClientBatch(client.ID, specialist.ID, serviceID)
	if err != nil {
		if errors.Is(err, db.ErrServiceIsNotBatch) {
			httpError(w, r, "Error.InvalidServiceType", http.StatusBadRequest)
			return
		}
		log.Printf("Error assigning client batch: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	changes.Publish(specialist.ID, changes.GroupClientBatches, changes.GroupClients)
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, batch)
}

func HandleAdminDeleteClient(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	clientID := chi.URLParam(r, "id")
	if clientID == "" {
		httpError(w, r, "Error.MissingClientID", http.StatusBadRequest)
		return
	}

	client, err := db.GetClientByID(clientID)
	if err != nil {
		log.Printf("Error getting client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if client == nil || client.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ClientNotFound", http.StatusNotFound)
		return
	}
	if isSelfClient(client, specialist) {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if err := db.DeleteClientCascade(clientID); err != nil {
		log.Printf("Error cascade-deleting client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	log.Printf("CLIENT deleted: %s (%s) by specialist %s", client.Name, clientID[:8], specialist.Name)
	changes.Publish(specialist.ID, changes.GroupClients, changes.GroupBookings, changes.GroupRecurring)
	w.WriteHeader(http.StatusNoContent)
}

func HandleAdminUpdateClient(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	clientID := chi.URLParam(r, "id")
	if clientID == "" {
		httpError(w, r, "Error.MissingClientID", http.StatusBadRequest)
		return
	}

	client, err := db.GetClientByID(clientID)
	if err != nil {
		log.Printf("Error getting client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if client == nil || client.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ClientNotFound", http.StatusNotFound)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.InvalidJSON", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		httpError(w, r, "Error.NameRequired", http.StatusBadRequest)
		return
	}

	if client.IsGhost {
		if err := db.UpdateGhostClientName(clientID, name); err != nil {
			log.Printf("Error updating ghost client name: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
	} else {
		if err := db.UpdateClientDisplayName(clientID, name); err != nil {
			log.Printf("Error updating client display name: %v", err)
			httpError(w, r, "Error.Internal", http.StatusInternalServerError)
			return
		}
	}

	updated, err := db.GetClientByID(clientID)
	if err != nil {
		log.Printf("Error getting updated client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	updated.IsSelf = isSelfClient(updated, specialist)
	changes.Publish(specialist.ID, changes.GroupClients, changes.GroupBookings, changes.GroupRecurring)
	writeJSON(w, updated)
}

func HandleAdminGetClients(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	query := r.URL.Query()
	page, err := parseAdminBookingsPositiveInt(query.Get("page"), 1)
	if err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	limit, err := parseAdminBookingsPositiveInt(query.Get("limit"), defaultAdminClientsLimit)
	if err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}
	if limit > maxAdminClientsLimit {
		limit = maxAdminClientsLimit
	}

	search := strings.TrimSpace(query.Get("search"))
	clients, total, err := db.GetClientsBySpecialistIDPaged(specialist.ID, search, limit, (page-1)*limit)
	if err != nil {
		log.Printf("Error getting clients: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if clients == nil {
		clients = []models.Client{}
	}

	for i := range clients {
		clients[i].IsSelf = isSelfClient(&clients[i], specialist)
	}

	totalPages := 0
	if total > 0 {
		totalPages = (total + limit - 1) / limit
	}

	writeJSON(w, models.ClientListResponse{
		Clients:     clients,
		Total:       total,
		Page:        page,
		Limit:       limit,
		TotalPages:  totalPages,
		SearchQuery: search,
	})
}

func HandleAdminBlockClient(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	clientID := chi.URLParam(r, "id")
	if clientID == "" {
		httpError(w, r, "Error.MissingClientID", http.StatusBadRequest)
		return
	}

	client, err := db.GetClientByID(clientID)
	if err != nil {
		log.Printf("Error getting client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}
	if client == nil || client.SpecialistID != specialist.ID {
		httpError(w, r, "Error.ClientNotFound", http.StatusNotFound)
		return
	}
	if client.IsGhost || isSelfClient(client, specialist) {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	var req struct {
		Blocked        bool `json:"blocked"`
		CancelBookings bool `json:"cancelBookings"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, r, "Error.BadRequest", http.StatusBadRequest)
		return
	}

	if err := db.SetClientBlocked(clientID, req.Blocked); err != nil {
		log.Printf("Error setting client blocked: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	if req.Blocked && req.CancelBookings {
		if n, err := db.CancelAllClientBookings(clientID, specialist.ID); err != nil {
			log.Printf("Error cancelling client bookings: %v", err)
		} else if n > 0 {
			log.Printf("Cancelled %d bookings for blocked client %s", n, clientID[:8])
		}
		if n, err := db.CancelAllClientRecurring(clientID, specialist.ID); err != nil {
			log.Printf("Error cancelling client recurring: %v", err)
		} else if n > 0 {
			log.Printf("Cancelled %d recurring schedules for blocked client %s", n, clientID[:8])
		}
	}

	updated, err := db.GetClientByID(clientID)
	if err != nil {
		log.Printf("Error getting updated client: %v", err)
		httpError(w, r, "Error.Internal", http.StatusInternalServerError)
		return
	}

	updated.IsSelf = isSelfClient(updated, specialist)
	changes.Publish(specialist.ID, changes.GroupClients, changes.GroupBookings, changes.GroupRecurring)
	writeJSON(w, updated)
}
