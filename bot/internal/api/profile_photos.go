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

/***************************************************************************************************
* lookupTelegramProfilePhoto resolves the Telegram profile photo for a user. Profile photos come
* exclusively from Telegram: a current value that is not a Telegram photo (a legacy custom upload)
* is treated as replaceable, never as something to keep.
*
* Returns:
* - The photo value to persist ("" when Telegram has no photo or nothing needs to change).
* - definitive: false when the lookup failed (network/API error), so callers must not clear an
*   existing value on the strength of an empty result.
***************************************************************************************************/
func lookupTelegramProfilePhoto(r *http.Request, botToken string, telegramUserID int64, currentPhotoURL string) (string, bool) {
	if strings.HasPrefix(currentPhotoURL, telegramProfilePhotoPrefix) {
		return "", true
	}

	/***************************************************************************************************
	* Prefer the HTTP CDN URL from validated initData when present — it loads directly from
	* t.me in the browser, bypassing the token-protected /api/photo proxy. fileIDs returned by
	* getUserProfilePhotos are not always downloadable via getFile (a known Telegram API quirk),
	* so the bot-API path is kept only as a fallback for inline-keyboard launches whose initData
	* does not carry photo_url. We verify the bot-API fileID is downloadable before returning it
	* so callers do not persist a value the proxy would later fail to serve.
	***************************************************************************************************/
	user := GetTelegramUserFromContext(r)
	if user != nil && user.ID == telegramUserID && user.PhotoURL != "" && currentPhotoURL != user.PhotoURL {
		return user.PhotoURL, true
	}

	definitive := true
	if botToken != "" && telegramUserID != 0 {
		fileID, err := telegramProfilePhotoLookup(botToken, telegramUserID)
		if err != nil {
			log.Printf("GetUserProfilePhotos error for user %d: %v", telegramUserID, err)
			definitive = false
		} else if fileID != "" {
			if telegramProfilePhotoFileVerifier(botToken, fileID) {
				return telegramProfilePhotoPrefix + fileID, true
			}
			definitive = false
		}
	}

	return "", definitive
}

/***************************************************************************************************
* telegramProfilePhotoFileVerifier returns true when the bot can actually download the file_id via
* getFile. Indirected through a package-level variable so tests can stub it without spinning up a
* real Telegram API. Production implementation issues a single getFile round-trip and discards the
* bytes — a few hundred ms once per restore is acceptable to avoid persisting an unloadable
* reference.
***************************************************************************************************/
var telegramProfilePhotoFileVerifier = func(botToken, fileID string) bool {
	bot := &telegram.Bot{Token: botToken}
	if _, _, err := bot.GetFile(fileID); err != nil {
		log.Printf("Telegram profile photo file verification failed for %s: %v", truncateForLog(fileID, 20), err)
		return false
	}
	return true
}

/***************************************************************************************************
* SetTelegramProfilePhotoFileVerifierForTest replaces the bot-API fileID verifier used by
* lookupTelegramProfilePhoto. Returns a function that restores the previous value.
***************************************************************************************************/
func SetTelegramProfilePhotoFileVerifierForTest(verifier func(botToken, fileID string) bool) func() {
	previous := telegramProfilePhotoFileVerifier
	if verifier == nil {
		telegramProfilePhotoFileVerifier = func(string, string) bool { return true }
	} else {
		telegramProfilePhotoFileVerifier = verifier
	}
	return func() {
		telegramProfilePhotoFileVerifier = previous
	}
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

	photoURL, definitive := lookupTelegramProfilePhoto(r, specialist.BotToken, client.TelegramUserID, client.PhotoURL)
	if photoURL == "" {
		/***************************************************************************************************
		* Telegram has no photo: drop any legacy non-Telegram value so the avatar falls back to initials.
		***************************************************************************************************/
		if definitive && client.PhotoURL != "" && !isTelegramProfilePhotoValue(client.PhotoURL) {
			if err := db.UpdateClientPhoto(client.ID, ""); err != nil {
				log.Printf("Error clearing client custom photo: %v", err)
				return
			}
			client.PhotoURL = ""
		}
		return
	}
	if photoURL == client.PhotoURL {
		return
	}

	if err := db.UpdateClientPhoto(client.ID, photoURL); err != nil {
		log.Printf("Error updating client Telegram photo: %v", err)
		return
	}
	client.PhotoURL = photoURL
}

/***************************************************************************************************
* ensureSpecialistTelegramProfilePhoto keeps the specialist's photo in sync with Telegram. The
* Telegram photo always wins: legacy custom uploads are replaced and the old photo_removed flag is
* ignored (and reset by UpdateSpecialistPhoto).
***************************************************************************************************/
func ensureSpecialistTelegramProfilePhoto(r *http.Request, specialist *models.Specialist) {
	if specialist == nil {
		return
	}

	photoURL, definitive := lookupTelegramProfilePhoto(r, specialist.BotToken, specialist.TelegramUserID, specialist.PhotoURL)
	if photoURL == "" {
		if definitive && specialist.PhotoURL != "" && !isTelegramProfilePhotoValue(specialist.PhotoURL) {
			if err := db.UpdateSpecialistPhoto(specialist.ID, ""); err != nil {
				log.Printf("Error clearing specialist custom photo: %v", err)
				return
			}
			specialist.PhotoURL = ""
		}
		return
	}
	if photoURL == specialist.PhotoURL {
		return
	}

	if err := db.UpdateSpecialistPhoto(specialist.ID, photoURL); err != nil {
		log.Printf("Error updating specialist Telegram photo: %v", err)
		return
	}
	specialist.PhotoURL = photoURL
}
