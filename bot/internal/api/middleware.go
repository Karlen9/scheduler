package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"

	"github.com/nicksnyder/go-i18n/v2/i18n"
)

// localizerFromRequest creates a localizer from the request's lang query parameter.
// Used in auth middlewares that run before I18nMiddleware sets the localizer in context.
func localizerFromRequest(r *http.Request) *i18n.Localizer {
	if lang := r.URL.Query().Get("lang"); lang == "en" || lang == "ru" {
		return myI18n.NewLocalizer(lang)
	}
	return myI18n.Default()
}

type contextKey string

const (
	ClientContextKey     contextKey = "client"
	SpecialistContextKey contextKey = "specialist"
)

// TelegramUser represents user data from Telegram initData
type TelegramUser struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`
	PhotoURL  string `json:"photo_url"`
}

// TelegramAuthMiddleware validates Telegram initData and extracts user info
func TelegramAuthMiddleware(botToken string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			initData := r.Header.Get("X-Telegram-Init-Data")
			specialistID := r.Header.Get("X-Specialist-ID")
			if specialistID == "" {
				specialistID = r.Header.Get("X-Trainer-ID") // legacy cached Telegram headers
			}
			if specialistID == "" {
				specialistID = r.URL.Query().Get("specialist")
			}
			if specialistID == "" {
				specialistID = r.URL.Query().Get("trainer") // legacy cached Telegram URLs
			}

			// Get specialist by ID or fall back to first specialist
			var specialist *models.Specialist
			var err error
			if specialistID != "" {
				specialist, err = db.GetSpecialistByID(specialistID)
			} else {
				specialist, err = db.GetFirstSpecialist()
			}
			if err != nil {
				log.Printf("Error getting specialist: %v", err)
				http.Error(w, myI18n.T(localizerFromRequest(r), "Error.Internal"), http.StatusInternalServerError)
				return
			}
			if specialist == nil {
				http.Error(w, myI18n.T(localizerFromRequest(r), "Error.SpecialistNotFound"), http.StatusNotFound)
				return
			}

			if initData == "" {
				// For development, allow requests without auth
				log.Println("Warning: No Telegram initData provided")
				ctx := context.WithValue(r.Context(), SpecialistContextKey, specialist)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// Validate initData using the specialist's bot token
			user, ok := validateInitData(initData, specialist.BotToken)
			if !ok {
				http.Error(w, myI18n.T(localizerFromRequest(r), "Error.TelegramAuth"), http.StatusUnauthorized)
				return
			}

			// Get or create client
			name := user.FirstName
			if user.LastName != "" {
				name += " " + user.LastName
			}
			client, err := db.GetOrCreateClient(user.ID, specialist.ID, name)
			if err != nil {
				log.Printf("Error getting/creating client: %v", err)
				http.Error(w, myI18n.T(localizerFromRequest(r), "Error.Internal"), http.StatusInternalServerError)
				return
			}

			// Auto-set Telegram profile photo if client has no custom photo
			if client.PhotoURL == "" && user.PhotoURL != "" {
				if err := db.UpdateClientPhoto(client.ID, user.PhotoURL); err == nil {
					client.PhotoURL = user.PhotoURL
				}
			}

			ctx := context.WithValue(r.Context(), ClientContextKey, client)
			ctx = context.WithValue(ctx, SpecialistContextKey, specialist)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func validateInitData(initData, botToken string) (*TelegramUser, bool) {
	values, err := url.ParseQuery(initData)
	if err != nil {
		return nil, false
	}

	// Extract hash
	hash := values.Get("hash")
	if hash == "" {
		return nil, false
	}

	// Build data check string
	values.Del("hash")
	var keys []string
	for k := range values {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var dataCheckParts []string
	for _, k := range keys {
		dataCheckParts = append(dataCheckParts, k+"="+values.Get(k))
	}
	dataCheckString := strings.Join(dataCheckParts, "\n")

	// Calculate HMAC
	secretKey := hmac.New(sha256.New, []byte("WebAppData"))
	secretKey.Write([]byte(botToken))
	secret := secretKey.Sum(nil)

	h := hmac.New(sha256.New, secret)
	h.Write([]byte(dataCheckString))
	calculatedHash := hex.EncodeToString(h.Sum(nil))

	if calculatedHash != hash {
		log.Printf("Hash mismatch: expected %s, got %s", calculatedHash, hash)
		return nil, false
	}

	// Parse user data
	userJSON := values.Get("user")
	if userJSON == "" {
		return nil, false
	}

	var user TelegramUser
	if err := json.Unmarshal([]byte(userJSON), &user); err != nil {
		return nil, false
	}

	return &user, true
}

// GetClientFromContext extracts client from request context
func GetClientFromContext(r *http.Request) *models.Client {
	client, _ := r.Context().Value(ClientContextKey).(*models.Client)
	return client
}

// GetSpecialistFromContext extracts specialist from request context
func GetSpecialistFromContext(r *http.Request) *models.Specialist {
	specialist, _ := r.Context().Value(SpecialistContextKey).(*models.Specialist)
	return specialist
}

// AdminAuthMiddleware checks if the user is the specialist (admin)
func AdminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		client := GetClientFromContext(r)
		specialist := GetSpecialistFromContext(r)

		if client == nil || specialist == nil {
			httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
			return
		}

		// Check if client's telegram ID matches specialist's telegram ID
		if client.TelegramUserID != specialist.TelegramUserID {
			httpError(w, r, "Error.Forbidden", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// DevAuthMiddleware is a simple middleware for development that creates a mock client
func DevAuthMiddleware(defaultSpecialistID int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if we already have auth from Telegram middleware
			if GetClientFromContext(r) != nil {
				next.ServeHTTP(w, r)
				return
			}

			// Get specialist from context (set by TelegramAuthMiddleware)
			specialist := GetSpecialistFromContext(r)
			if specialist == nil {
				// Fall back to first specialist
				var err error
				specialist, err = db.GetFirstSpecialist()
				if err != nil || specialist == nil {
					log.Printf("Error getting specialist: %v", err)
					http.Error(w, myI18n.T(localizerFromRequest(r), "Error.SpecialistNotConfigured"), http.StatusInternalServerError)
					return
				}
			}

			// For dev, use a mock user ID from query or header
			userIDStr := r.Header.Get("X-Dev-User-ID")
			if userIDStr == "" {
				userIDStr = r.URL.Query().Get("dev_user_id")
			}

			// Default to specialist's ID for dev (allows admin access)
			var userID int64 = specialist.TelegramUserID
			if userIDStr != "" {
				if parsed, err := strconv.ParseInt(userIDStr, 10, 64); err == nil {
					userID = parsed
				}
			}

			client, err := db.GetOrCreateClient(userID, specialist.ID, "Dev User")
			if err != nil {
				log.Printf("Error creating dev client: %v", err)
				http.Error(w, myI18n.T(localizerFromRequest(r), "Error.Internal"), http.StatusInternalServerError)
				return
			}

			ctx := context.WithValue(r.Context(), ClientContextKey, client)
			ctx = context.WithValue(ctx, SpecialistContextKey, specialist)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// I18nMiddleware determines the user's language from client/specialist profile
// and stores a localizer in context. Must run AFTER auth middleware.
func I18nMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lang := "ru"
		if client := GetClientFromContext(r); client != nil && client.Language != "" {
			lang = client.Language
		} else if specialist := GetSpecialistFromContext(r); specialist != nil && specialist.Language != "" {
			lang = specialist.Language
		}
		loc := myI18n.NewLocalizer(lang)
		ctx := myI18n.WithLocalizer(r.Context(), loc)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
