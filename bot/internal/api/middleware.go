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
	"time"

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

// LoadTestMode when true bypasses Telegram HMAC validation.
// Set via LOAD_TEST_MODE env var. Never enable in production.
var LoadTestMode bool

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

			if LoadTestMode {
				testUserIDStr := r.Header.Get("X-Test-User-ID")
				if testUserIDStr != "" {
					testUserID, err := strconv.ParseInt(testUserIDStr, 10, 64)
					if err != nil {
						http.Error(w, "invalid X-Test-User-ID", http.StatusBadRequest)
						return
					}

					var specialist *models.Specialist
					var specErr error
					if specialistID != "" {
						specialist, specErr = db.GetSpecialistByID(specialistID)
					} else {
						specialist, specErr = db.GetFirstSpecialist()
					}
					if specErr != nil || specialist == nil {
						http.Error(w, "specialist not found", http.StatusNotFound)
						return
					}

					client, err := db.GetOrCreateClient(testUserID, specialist.ID, "LoadTest User")
					if err != nil {
						http.Error(w, "internal error", http.StatusInternalServerError)
						return
					}

					ctx := context.WithValue(r.Context(), ClientContextKey, client)
					ctx = context.WithValue(ctx, SpecialistContextKey, specialist)
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}
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
				log.Printf("Auth rejected: no initData from %s", r.RemoteAddr)
				http.Error(w, myI18n.T(localizerFromRequest(r), "Error.TelegramAuth"), http.StatusUnauthorized)
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

	// Check auth_date is not too old (1 hour max)
	if authDateStr := values.Get("auth_date"); authDateStr != "" {
		authDate, err := strconv.ParseInt(authDateStr, 10, 64)
		if err == nil {
			age := time.Now().Unix() - authDate
			if age > 3600 {
				log.Printf("Auth rejected: initData expired (age=%ds)", age)
				return nil, false
			}
		}
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

// SuperadminSecret is set from config at startup. If empty, superadmin endpoints are disabled.
var SuperadminSecret string

// SuperadminAuthMiddleware checks the Authorization: Bearer <secret> header.
func SuperadminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if SuperadminSecret == "" {
			http.NotFound(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if auth == "" || auth != "Bearer "+SuperadminSecret {
			log.Printf("Superadmin auth rejected from %s", r.RemoteAddr)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// SecurityHeadersMiddleware adds security response headers.
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}
