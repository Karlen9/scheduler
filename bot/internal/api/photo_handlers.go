package api

import (
	"io"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/telegram"
)

const maxPhotoSize = 5 << 20 // 5 MB

// HandleGetPhoto proxies a photo from Telegram's file API.
// GET /api/photo/{fileId}
func HandleGetPhoto(w http.ResponseWriter, r *http.Request) {
	fileID := chi.URLParam(r, "fileId")
	if fileID == "" {
		http.Error(w, "file ID required", http.StatusBadRequest)
		return
	}

	// Determine which trainer's bot to use
	trainerID := r.URL.Query().Get("trainer")
	var botToken string
	if trainerID != "" {
		trainer, err := db.GetTrainerByID(trainerID)
		if err != nil || trainer == nil {
			http.Error(w, "trainer not found", http.StatusNotFound)
			return
		}
		botToken = trainer.BotToken
	} else {
		trainer, err := db.GetFirstTrainer()
		if err != nil || trainer == nil {
			http.Error(w, "no trainer configured", http.StatusInternalServerError)
			return
		}
		botToken = trainer.BotToken
	}

	bot := &telegram.Bot{Token: botToken}
	data, contentType, err := bot.GetFile(fileID)
	if err != nil {
		log.Printf("GetFile error: %v", err)
		http.Error(w, "failed to fetch photo", http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write(data)
}

// HandleUploadPhoto handles photo upload for clients and trainers.
// POST /api/upload/photo (client) or POST /api/admin/upload/photo (trainer)
func HandleUploadPhoto(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "trainer not found", http.StatusNotFound)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxPhotoSize+512) // small buffer for multipart headers
	if err := r.ParseMultipartForm(maxPhotoSize); err != nil {
		http.Error(w, "file too large (max 5MB)", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		http.Error(w, "photo field required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate content type
	ct := header.Header.Get("Content-Type")
	switch ct {
	case "image/jpeg", "image/png", "image/webp":
		// ok
	default:
		http.Error(w, "only JPEG, PNG, WebP allowed", http.StatusBadRequest)
		return
	}

	photoData, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "failed to read photo", http.StatusInternalServerError)
		return
	}

	// Upload to Telegram via the trainer's bot
	bot := &telegram.Bot{Token: trainer.BotToken}
	chatID := trainer.TelegramUserID // send to trainer's chat as temp storage
	if client != nil {
		chatID = client.TelegramUserID
	}

	fileID, msgID, err := bot.SendPhoto(chatID, photoData, header.Filename)
	if err != nil {
		log.Printf("SendPhoto error: %v", err)
		http.Error(w, "failed to upload photo", http.StatusInternalServerError)
		return
	}

	// Delete the temp message
	go bot.DeleteMessage(chatID, msgID)

	// Determine if this is an admin (trainer) or client upload
	isAdmin := client != nil && client.TelegramUserID == trainer.TelegramUserID
	// Check route prefix to distinguish admin vs client
	if isAdmin && len(r.URL.Path) > 10 && r.URL.Path[:10] == "/api/admin" {
		// Update trainer photo
		if err := db.UpdateTrainerPhoto(trainer.ID, fileID); err != nil {
			log.Printf("UpdateTrainerPhoto error: %v", err)
			http.Error(w, "failed to save photo", http.StatusInternalServerError)
			return
		}
	} else if client != nil {
		// Update client photo
		if err := db.UpdateClientPhoto(client.ID, fileID); err != nil {
			log.Printf("UpdateClientPhoto error: %v", err)
			http.Error(w, "failed to save photo", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, map[string]string{"fileId": fileID})
}
