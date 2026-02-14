package api

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

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

// HandleUploadPhoto handles photo upload for clients.
// POST /api/upload/photo
func HandleUploadPhoto(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "trainer not found", http.StatusNotFound)
		return
	}

	photoData, filename, err := readUploadedPhoto(r)
	if err != nil {
		log.Printf("Upload read error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	bot := &telegram.Bot{Token: trainer.BotToken}
	chatID := trainer.TelegramUserID
	if client != nil {
		chatID = client.TelegramUserID
	}

	fileID, _, err := bot.SendPhoto(chatID, photoData, filename)
	if err != nil {
		log.Printf("SendPhoto error: %v", err)
		http.Error(w, "failed to upload photo", http.StatusInternalServerError)
		return
	}

	if client != nil {
		if err := db.UpdateClientPhoto(client.ID, fileID); err != nil {
			log.Printf("UpdateClientPhoto error: %v", err)
			http.Error(w, "failed to save photo", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, map[string]string{"fileId": fileID})
}

// HandleAdminUploadPhoto handles photo upload for trainers.
// POST /api/admin/upload/photo
func HandleAdminUploadPhoto(w http.ResponseWriter, r *http.Request) {
	trainer := GetTrainerFromContext(r)
	if trainer == nil {
		http.Error(w, "trainer not found", http.StatusNotFound)
		return
	}

	photoData, filename, err := readUploadedPhoto(r)
	if err != nil {
		log.Printf("Upload read error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	bot := &telegram.Bot{Token: trainer.BotToken}

	fileID, _, err := bot.SendPhoto(trainer.TelegramUserID, photoData, filename)
	if err != nil {
		log.Printf("SendPhoto error: %v", err)
		http.Error(w, "failed to upload photo", http.StatusInternalServerError)
		return
	}

	if err := db.UpdateTrainerPhoto(trainer.ID, fileID); err != nil {
		log.Printf("UpdateTrainerPhoto error: %v", err)
		http.Error(w, "failed to save photo", http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"fileId": fileID})
}

// readUploadedPhoto reads and validates the uploaded photo from a multipart request.
func readUploadedPhoto(r *http.Request) ([]byte, string, error) {
	r.Body = http.MaxBytesReader(nil, r.Body, maxPhotoSize+1<<20) // 6MB total for multipart overhead
	if err := r.ParseMultipartForm(maxPhotoSize); err != nil {
		return nil, "", fmt.Errorf("file too large (max 5MB)")
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		return nil, "", fmt.Errorf("photo field required")
	}
	defer file.Close()

	photoData, err := io.ReadAll(file)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read photo")
	}

	// Detect content type from actual file bytes
	ct := http.DetectContentType(photoData)
	if !strings.HasPrefix(ct, "image/") {
		return nil, "", fmt.Errorf("only image files allowed")
	}

	return photoData, header.Filename, nil
}
