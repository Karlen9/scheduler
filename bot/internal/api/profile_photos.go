package api

import (
	"log"
	"net/http"
	"net/url"
	"strings"

	"scheduler-bot/internal/db"
	"scheduler-bot/internal/models"
	"scheduler-bot/internal/telegram"
)

const telegramProfilePhotoPrefix = "telegram:"

type telegramProfilePhotoLookupFunc func(botToken string, userID int64) (string, error)

var telegramProfilePhotoLookup telegramProfilePhotoLookupFunc = func(botToken string, userID int64) (string, error) {
	bot := &telegram.Bot{Token: botToken}
	return bot.GetUserProfilePhotoFileID(userID)
}

// SetTelegramProfilePhotoLookupForTest swaps the Telegram profile-photo lookup used by tests.
func SetTelegramProfilePhotoLookupForTest(lookup telegramProfilePhotoLookupFunc) func() {
	previous := telegramProfilePhotoLookup
	if lookup == nil {
		telegramProfilePhotoLookup = func(string, int64) (string, error) { return "", nil }
	} else {
		telegramProfilePhotoLookup = lookup
	}
	return func() {
		telegramProfilePhotoLookup = previous
	}
}

func resolveTelegramProfilePhoto(r *http.Request, botToken string, telegramUserID int64) string {
	return resolveTelegramProfilePhotoForCurrent(r, botToken, telegramUserID, "")
}

func resolveTelegramProfilePhotoForCurrent(r *http.Request, botToken string, telegramUserID int64, currentPhotoURL string) string {
	if currentPhotoURL != "" && !isTelegramProfilePhotoValue(currentPhotoURL) {
		return ""
	}
	if strings.HasPrefix(currentPhotoURL, telegramProfilePhotoPrefix) {
		return ""
	}

	if botToken != "" && telegramUserID != 0 {
		fileID, err := telegramProfilePhotoLookup(botToken, telegramUserID)
		if err != nil {
			log.Printf("GetUserProfilePhotos error for user %d: %v", telegramUserID, err)
		} else if fileID != "" {
			return telegramProfilePhotoPrefix + fileID
		}
	}

	user := GetTelegramUserFromContext(r)
	if user != nil && user.ID == telegramUserID && user.PhotoURL != "" && currentPhotoURL != user.PhotoURL {
		return user.PhotoURL
	}
	return ""
}

func isTelegramProfilePhotoValue(photoURL string) bool {
	if strings.HasPrefix(photoURL, telegramProfilePhotoPrefix) {
		return true
	}
	if !strings.HasPrefix(photoURL, "http") {
		return false
	}

	parsed, err := url.Parse(photoURL)
	if err != nil {
		return false
	}
	hostname := parsed.Hostname()
	return hostname == "t.me" ||
		hostname == "telegram.org" ||
		strings.HasSuffix(hostname, ".telegram.org") ||
		strings.HasSuffix(hostname, ".telegram-cdn.org") ||
		strings.HasSuffix(hostname, ".cdn-telegram.org")
}

func ensureClientTelegramProfilePhoto(r *http.Request, client *models.Client, specialist *models.Specialist) {
	if client == nil || specialist == nil {
		return
	}

	photoURL := resolveTelegramProfilePhotoForCurrent(r, specialist.BotToken, client.TelegramUserID, client.PhotoURL)
	if photoURL == "" || photoURL == client.PhotoURL {
		return
	}

	if err := db.UpdateClientPhoto(client.ID, photoURL); err != nil {
		log.Printf("Error updating client Telegram photo: %v", err)
		return
	}
	client.PhotoURL = photoURL
}

func ensureSpecialistTelegramProfilePhoto(r *http.Request, specialist *models.Specialist) {
	if specialist == nil {
		return
	}

	photoURL := resolveTelegramProfilePhotoForCurrent(r, specialist.BotToken, specialist.TelegramUserID, specialist.PhotoURL)
	if photoURL == "" || photoURL == specialist.PhotoURL {
		return
	}

	if err := db.UpdateSpecialistPhoto(specialist.ID, photoURL); err != nil {
		log.Printf("Error updating specialist Telegram photo: %v", err)
		return
	}
	specialist.PhotoURL = photoURL
}
