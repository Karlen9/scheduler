package api

import (
	"bytes"
	crand "crypto/rand"
	"encoding/binary"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	"scheduler-bot/internal/telegram"
)

/***************************************************************************************************
* Defines the max photo size value used by the api layer.
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
const maxPhotoSize = 5 << 20 // 5 MB
/***************************************************************************************************
* Defines the max photo pixels value used by the api layer.
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
const maxPhotoPixels = 25_000_000

/***************************************************************************************************
* HandleGetPhoto proxies a photo from Telegram's file API. GET /api/photo/{fileId}. notification
* helpers.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleGetPhoto(w http.ResponseWriter, r *http.Request) {
	fileID := chi.URLParam(r, "fileId")
	if fileID == "" {
		httpError(w, r, "Error.PhotoFileIDRequired", http.StatusBadRequest)
		return
	}

	/***************************************************************************************************
	* File IDs are unguessable Telegram tokens, and image tags cannot reliably attach auth headers.
	* Prefer the specialist from the URL when present; otherwise try all active specialists because
	* Telegram file IDs are bot-scoped.
	***************************************************************************************************/
	specialistID := requestSpecialistID(r)
	if specialistID != "" {
		specialist, err := db.GetSpecialistByID(specialistID)
		if err != nil || specialist == nil {
			httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
			return
		}
		if !specialist.IsActive || specialist.DeletedAt != nil {
			httpError(w, r, "Error.BotDeleted", http.StatusGone)
			return
		}
		if proxyTelegramFile(w, specialist.BotToken, fileID) {
			return
		}
		httpError(w, r, "Error.PhotoFetchFailed", http.StatusBadGateway)
		return
	}

	specialists, err := db.GetAllActiveSpecialists()
	if err != nil || len(specialists) == 0 {
		httpError(w, r, "Error.SpecialistNotConfigured", http.StatusInternalServerError)
		return
	}

	for _, specialist := range specialists {
		if proxyTelegramFile(w, specialist.BotToken, fileID) {
			return
		}
	}

	log.Printf("GetFile error: no specialist bot could resolve file_id %s", truncateForLog(fileID, 20))
	httpError(w, r, "Error.PhotoFetchFailed", http.StatusBadGateway)
}

func proxyTelegramFile(w http.ResponseWriter, botToken string, fileID string) bool {
	bot := &telegram.Bot{Token: botToken}
	data, contentType, err := bot.GetFile(fileID)
	if err != nil {
		log.Printf("GetFile error: %v", err)
		return false
	}
	w.Header().Set("Content-Type", contentType)
	setPublicCache(w, 3600, true)
	w.Write(data)
	return true
}

/***************************************************************************************************
* HandleUploadPhoto handles photo upload for clients. POST /api/upload/photo. notification
* helpers.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleUploadPhoto(w http.ResponseWriter, r *http.Request) {
	client := GetClientFromContext(r)
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	photoData, filename, errMsgID := readUploadedPhoto(w, r)
	if errMsgID != "" {
		httpError(w, r, errMsgID, http.StatusBadRequest)
		return
	}

	bot := &telegram.Bot{Token: specialist.BotToken}

	/***************************************************************************************************
	* Always send to specialist's chat (used as CDN, not meant for the client to see).
	***************************************************************************************************/
	fileID, messageID, err := bot.SendPhoto(specialist.TelegramUserID, photoData, filename)
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
		changes.Publish(
			client.SpecialistID,
			changes.GroupClientProfile,
			changes.GroupClients,
			changes.GroupBookings,
			changes.GroupRecurring,
		)
	}

	deleteUploadedPhotoMessage(bot, specialist.TelegramUserID, messageID)

	writeJSON(w, map[string]string{"fileId": fileID})
}

/***************************************************************************************************
* HandleAdminUploadPhoto handles photo upload for specialists. POST /api/admin/upload/photo.
*
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func HandleAdminUploadPhoto(w http.ResponseWriter, r *http.Request) {
	specialist := GetSpecialistFromContext(r)
	if specialist == nil {
		httpError(w, r, "Error.SpecialistNotFound", http.StatusNotFound)
		return
	}

	photoData, filename, errMsgID := readUploadedPhoto(w, r)
	if errMsgID != "" {
		httpError(w, r, errMsgID, http.StatusBadRequest)
		return
	}

	bot := &telegram.Bot{Token: specialist.BotToken}

	fileID, messageID, err := bot.SendPhoto(specialist.TelegramUserID, photoData, filename)
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

	deleteUploadedPhotoMessage(bot, specialist.TelegramUserID, messageID)

	changes.Publish(specialist.ID, changes.GroupSpecialist)
	writeJSON(w, map[string]string{"fileId": fileID})
}

/***************************************************************************************************
* deleteUploadedPhotoMessage removes the temporary Telegram chat message used to obtain a file_id.
* The fileID stays valid after deletion because Telegram retains the underlying file, and the
* LSB-flip re-encoding in readUploadedPhoto guarantees each upload yields a fresh fileID so we
* never resurrect a stale one from a previously deleted message. Best-effort: cleanup failures
* are logged but do not fail the upload (the fileID is already safely stored in the database).
***************************************************************************************************/
func deleteUploadedPhotoMessage(bot *telegram.Bot, chatID int64, messageID int) {
	if messageID == 0 {
		return
	}
	if err := bot.DeleteMessage(chatID, messageID); err != nil {
		log.Printf("Delete uploaded photo message error: %v", err)
	}
}

/***************************************************************************************************
* readUploadedPhoto reads and validates the uploaded photo from a multipart request. On error, it
* returns an empty slice, empty filename, and an i18n message ID string. On success, the third
* return value is an empty string.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - The computed value for the current operation as ([]byte, string, string).
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func readUploadedPhoto(w http.ResponseWriter, r *http.Request) ([]byte, string, string) {
	r.Body = http.MaxBytesReader(w, r.Body, maxPhotoSize+1<<20) // 6MB total for multipart overhead
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

	/***************************************************************************************************
	* Detect content type from actual file bytes.
	***************************************************************************************************/
	ct := http.DetectContentType(photoData)
	if !strings.HasPrefix(ct, "image/") {
		return nil, "", "Error.PhotoOnlyImages"
	}

	/***************************************************************************************************
	* Re-encode as JPEG to ensure unique bytes on every upload. This prevents Telegram from returning
	* a stale cached file_id from an older deleted storage message.
	***************************************************************************************************/
	reencoded, err := reencodAsJPEG(photoData)
	if err != nil {
		log.Printf("Image re-encode failed, using original: %v", err)
		return photoData, header.Filename, ""
	}

	return reencoded, "photo.jpg", ""
}

/***************************************************************************************************
* reencodAsJPEG decodes an image and re-encodes it as JPEG with a random pixel modification to
* ensure unique bytes (avoids Telegram file_id caching).
*
* Parameters:
* - data: Input data consumed by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func reencodAsJPEG(data []byte) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	bounds := img.Bounds()
	if bounds.Dx() <= 0 || bounds.Dy() <= 0 || bounds.Dx()*bounds.Dy() > maxPhotoPixels {
		return nil, fmt.Errorf("image dimensions exceed limit")
	}

	mutable := image.NewRGBA(bounds)
	draw.Draw(mutable, bounds, img, bounds.Min, draw.Src)

	/***************************************************************************************************
	* Flip LSB of a random pixel to guarantee unique bytes.
	***************************************************************************************************/
	x := randomIndex(bounds.Dx()) + bounds.Min.X
	y := randomIndex(bounds.Dy()) + bounds.Min.Y
	r, g, b, a := mutable.At(x, y).RGBA()
	mutable.SetRGBA(x, y, color.RGBA{uint8(r>>8) ^ 1, uint8(g >> 8), uint8(b >> 8), uint8(a >> 8)})

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, mutable, &jpeg.Options{Quality: 95}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

/***************************************************************************************************
* Implements the random index logic used by this module.
*
* Parameters:
* - max: Max used by the current operation.
*
* Returns:
* - The computed value for the current operation as int.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func randomIndex(max int) int {
	if max <= 1 {
		return 0
	}

	var raw [8]byte
	if _, err := crand.Read(raw[:]); err != nil {
		return 0
	}

	return int(binary.BigEndian.Uint64(raw[:]) % uint64(max))
}

/***************************************************************************************************
* Implements the truncate for log logic used by this module.
*
* Parameters:
* - value: Input data consumed by the current operation.
* - max: Max used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func truncateForLog(value string, max int) string {
	if len(value) <= max {
		return value
	}
	return value[:max]
}
