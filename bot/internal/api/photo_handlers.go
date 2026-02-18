package api

import (
	"bytes"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	_ "image/png"
	"io"
	"log"
	"math/rand"
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
		httpError(w, r, "Error.PhotoFileIDRequired", http.StatusBadRequest)
		return
	}

	// Determine which specialist's bot to use
	specialistID := r.URL.Query().Get("specialist")
	if specialistID != "" {
		specialist, err := db.GetSpecialistByID(specialistID)
		if err != nil || specialist == nil {
			httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
			return
		}
		bot := &telegram.Bot{Token: specialist.BotToken}
		data, contentType, err := bot.GetFile(fileID)
		if err != nil {
			log.Printf("GetFile error: %v", err)
			httpError(w, r, "Error.PhotoFetchFailed", http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.Write(data)
		return
	}

	// No specialist specified — try all active specialists (file_ids are bot-scoped)
	specialists, err := db.GetAllActiveSpecialists()
	if err != nil || len(specialists) == 0 {
		httpError(w, r, "Error.SpecialistNotConfigured", http.StatusInternalServerError)
		return
	}

	for _, specialist := range specialists {
		bot := &telegram.Bot{Token: specialist.BotToken}
		data, contentType, err := bot.GetFile(fileID)
		if err == nil {
			w.Header().Set("Content-Type", contentType)
			w.Header().Set("Cache-Control", "public, max-age=3600")
			w.Write(data)
			return
		}
	}

	log.Printf("GetFile error: no specialist's bot could resolve file_id %s", fileID[:20])
	httpError(w, r, "Error.PhotoFetchFailed", http.StatusBadGateway)
}

// HandleUploadPhoto handles photo upload for clients.
// POST /api/upload/photo
func HandleUploadPhoto(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	photoData, filename, errMsgID := readUploadedPhoto(r)
	if errMsgID != "" {
		httpError(w, r, errMsgID, http.StatusBadRequest)
		return
	}

	bot := &telegram.Bot{Token: specialist.BotToken}

	// Always send to specialist's chat (used as CDN, not meant for the client to see)
	fileID, _, err := bot.SendPhoto(specialist.TelegramUserID, photoData, filename)
	if err != nil {
		log.Printf("SendPhoto error: %v", err)
		httpError(w, r, "Error.PhotoUploadFailed", http.StatusInternalServerError)
		return
	}

	if client != nil {
		if err := db.UpdateClientPhoto(client.ID, fileID); err != nil {
			log.Printf("UpdateClientPhoto error: %v", err)
			httpError(w, r, "Error.PhotoSaveFailed", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, map[string]string{"fileId": fileID})
}

// HandleAdminUploadPhoto handles photo upload for specialists.
// POST /api/admin/upload/photo
func HandleAdminUploadPhoto(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	photoData, filename, errMsgID := readUploadedPhoto(r)
	if errMsgID != "" {
		httpError(w, r, errMsgID, http.StatusBadRequest)
		return
	}

	bot := &telegram.Bot{Token: specialist.BotToken}

	fileID, _, err := bot.SendPhoto(specialist.TelegramUserID, photoData, filename)
	if err != nil {
		log.Printf("SendPhoto error: %v", err)
		httpError(w, r, "Error.PhotoUploadFailed", http.StatusInternalServerError)
		return
	}

	if err := db.UpdateSpecialistPhoto(specialist.ID, fileID); err != nil {
		log.Printf("UpdateSpecialistPhoto error: %v", err)
		httpError(w, r, "Error.PhotoSaveFailed", http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"fileId": fileID})
}

// readUploadedPhoto reads and validates the uploaded photo from a multipart request.
// On error, it returns an empty slice, empty filename, and an i18n message ID string.
// On success, the third return value is an empty string.
func readUploadedPhoto(r *http.Request) ([]byte, string, string) {
	r.Body = http.MaxBytesReader(nil, r.Body, maxPhotoSize+1<<20) // 6MB total for multipart overhead
	if err := r.ParseMultipartForm(maxPhotoSize); err != nil {
		return nil, "", "Error.PhotoTooLarge"
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		return nil, "", "Error.PhotoFieldRequired"
	}
	defer file.Close()

	photoData, err := io.ReadAll(file)
	if err != nil {
		return nil, "", "Error.PhotoReadFailed"
	}

	// Detect content type from actual file bytes
	ct := http.DetectContentType(photoData)
	if !strings.HasPrefix(ct, "image/") {
		return nil, "", "Error.PhotoOnlyImages"
	}

	// Re-encode as JPEG to ensure unique bytes on every upload.
	// This prevents Telegram from returning a stale cached file_id
	// (which happens when the same image content is re-uploaded after
	// a previous upload's message was deleted, invalidating the file_id).
	reencoded, err := reencodAsJPEG(photoData)
	if err != nil {
		log.Printf("Image re-encode failed, using original: %v", err)
		return photoData, header.Filename, ""
	}

	return reencoded, "photo.jpg", ""
}

// reencodAsJPEG decodes an image and re-encodes it as JPEG with a random
// pixel modification to ensure unique bytes (avoids Telegram file_id caching).
func reencodAsJPEG(data []byte) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	bounds := img.Bounds()
	mutable := image.NewRGBA(bounds)
	draw.Draw(mutable, bounds, img, bounds.Min, draw.Src)

	// Flip LSB of a random pixel to guarantee unique bytes
	x := rand.Intn(bounds.Dx()) + bounds.Min.X
	y := rand.Intn(bounds.Dy()) + bounds.Min.Y
	r, g, b, a := mutable.At(x, y).RGBA()
	mutable.SetRGBA(x, y, color.RGBA{uint8(r>>8) ^ 1, uint8(g >> 8), uint8(b >> 8), uint8(a >> 8)})

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, mutable, &jpeg.Options{Quality: 95}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
