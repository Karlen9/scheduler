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
	"scheduler-bot/internal/models"
)

type contextKey string

const (
	ClientContextKey  contextKey = "client"
	TrainerContextKey contextKey = "trainer"
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
			trainerID := r.Header.Get("X-Trainer-ID")
			if trainerID == "" {
				trainerID = r.URL.Query().Get("trainer")
			}

			// Get trainer by ID or fall back to first trainer
			var trainer *models.Trainer
			var err error
			if trainerID != "" {
				trainer, err = db.GetTrainerByID(trainerID)
			} else {
				trainer, err = db.GetFirstTrainer()
			}
			if err != nil {
				log.Printf("Error getting trainer: %v", err)
				http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
				return
			}
			if trainer == nil {
				http.Error(w, "Тренер не найден", http.StatusNotFound)
				return
			}

			if initData == "" {
				// For development, allow requests without auth
				log.Println("Warning: No Telegram initData provided")
				ctx := context.WithValue(r.Context(), TrainerContextKey, trainer)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// Validate initData using the trainer's bot token
			user, ok := validateInitData(initData, trainer.BotToken)
			if !ok {
				http.Error(w, "Ошибка авторизации Telegram", http.StatusUnauthorized)
				return
			}

			// Get or create client
			name := user.FirstName
			if user.LastName != "" {
				name += " " + user.LastName
			}
			client, err := db.GetOrCreateClient(user.ID, trainer.ID, name)
			if err != nil {
				log.Printf("Error getting/creating client: %v", err)
				http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
				return
			}

			// Auto-set Telegram profile photo if client has no custom photo
			if client.PhotoURL == "" && user.PhotoURL != "" {
				if err := db.UpdateClientPhoto(client.ID, user.PhotoURL); err == nil {
					client.PhotoURL = user.PhotoURL
				}
			}

			ctx := context.WithValue(r.Context(), ClientContextKey, client)
			ctx = context.WithValue(ctx, TrainerContextKey, trainer)
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

// GetTrainerFromContext extracts trainer from request context
func GetTrainerFromContext(r *http.Request) *models.Trainer {
	trainer, _ := r.Context().Value(TrainerContextKey).(*models.Trainer)
	return trainer
}

// AdminAuthMiddleware checks if the user is the trainer (admin)
func AdminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		client := GetClientFromContext(r)
		trainer := GetTrainerFromContext(r)

		if client == nil || trainer == nil {
			http.Error(w, "Необходима авторизация", http.StatusUnauthorized)
			return
		}

		// Check if client's telegram ID matches trainer's telegram ID
		if client.TelegramUserID != trainer.TelegramUserID {
			http.Error(w, "Нет доступа", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// DevAuthMiddleware is a simple middleware for development that creates a mock client
func DevAuthMiddleware(defaultTrainerID int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check if we already have auth from Telegram middleware
			if GetClientFromContext(r) != nil {
				next.ServeHTTP(w, r)
				return
			}

			// Get trainer from context (set by TelegramAuthMiddleware)
			trainer := GetTrainerFromContext(r)
			if trainer == nil {
				// Fall back to first trainer
				var err error
				trainer, err = db.GetFirstTrainer()
				if err != nil || trainer == nil {
					log.Printf("Error getting trainer: %v", err)
					http.Error(w, "Тренер не настроен", http.StatusInternalServerError)
					return
				}
			}

			// For dev, use a mock user ID from query or header
			userIDStr := r.Header.Get("X-Dev-User-ID")
			if userIDStr == "" {
				userIDStr = r.URL.Query().Get("dev_user_id")
			}

			// Default to trainer's ID for dev (allows admin access)
			var userID int64 = trainer.TelegramUserID
			if userIDStr != "" {
				if parsed, err := strconv.ParseInt(userIDStr, 10, 64); err == nil {
					userID = parsed
				}
			}

			client, err := db.GetOrCreateClient(userID, trainer.ID, "Dev User")
			if err != nil {
				log.Printf("Error creating dev client: %v", err)
				http.Error(w, "Внутренняя ошибка сервера", http.StatusInternalServerError)
				return
			}

			ctx := context.WithValue(r.Context(), ClientContextKey, client)
			ctx = context.WithValue(ctx, TrainerContextKey, trainer)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
