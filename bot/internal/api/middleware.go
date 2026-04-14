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

	"scheduler-bot/internal/changes"
	"scheduler-bot/internal/db"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"

	"github.com/nicksnyder/go-i18n/v2/i18n"
)

/***************************************************************************************************
* localizerFromRequest creates a localizer from the request's lang query parameter. Used in auth
* middlewares that run before I18nMiddleware sets the localizer in context.
*
* Parameters:
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - The computed value for the current operation as *i18n.Localizer.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func localizerFromRequest(r *http.Request) *i18n.Localizer {
	if lang := r.URL.Query().Get("lang"); lang == "en" || lang == "ru" {
		return myI18n.NewLocalizer(lang)
	}
	return myI18n.Default()
}

/***************************************************************************************************
* Defines the context key type used by the api layer.
***************************************************************************************************/
type contextKey string

/***************************************************************************************************
* Groups related constants declared together for this module.
***************************************************************************************************/
const (
	/***************************************************************************************************
	* Defines the client context key value used by the api layer.
	*
	* Usage context:
	* - Reused by the api layer to keep shared values centralized.
	***************************************************************************************************/
	ClientContextKey contextKey = "client"
	/***************************************************************************************************
	* Defines the specialist context key value used by the api layer.
	*
	* Usage context:
	* - Reused by the api layer to keep shared values centralized.
	***************************************************************************************************/
	SpecialistContextKey contextKey = "specialist"
	/***************************************************************************************************
	* Defines the telegram user context key value used by the api layer.
	*
	* Usage context:
	* - Reused by the api layer to keep shared values centralized.
	***************************************************************************************************/
	TelegramUserContextKey contextKey = "telegramUser"
)

/***************************************************************************************************
* LoadTestMode when true bypasses Telegram HMAC validation. Set via LOAD_TEST_MODE env var. Never
* enable in production.
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
var LoadTestMode bool

/***************************************************************************************************
* TelegramUser represents user data from Telegram initData.
***************************************************************************************************/
type TelegramUser struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`
	PhotoURL  string `json:"photo_url"`
}

/***************************************************************************************************
* TelegramAuthMiddleware validates Telegram initData and extracts user info.
*
* Parameters:
* - botToken: Bot token used by the current operation.
*
* Returns:
* - The computed value for the current operation as func(http.Handler) http.Handler.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
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

			/***************************************************************************************************
			* Get specialist by ID or fall back to first specialist.
			***************************************************************************************************/
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

			/***************************************************************************************************
			* Validate initData using the specialist's bot token.
			***************************************************************************************************/
			user, ok := validateInitData(initData, specialist.BotToken)
			if !ok {
				http.Error(w, myI18n.T(localizerFromRequest(r), "Error.TelegramAuth"), http.StatusUnauthorized)
				return
			}

			/***************************************************************************************************
			* Get or create client.
			***************************************************************************************************/
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

			/***************************************************************************************************
			* Auto-set Telegram profile photo if client has no custom photo.
			***************************************************************************************************/
			if client.PhotoURL == "" && user.PhotoURL != "" {
				if err := db.UpdateClientPhoto(client.ID, user.PhotoURL); err == nil {
					client.PhotoURL = user.PhotoURL
				}
			}

			/***************************************************************************************************
			* Auto-set specialist Telegram profile photo if the owner has no custom photo.
			***************************************************************************************************/
			if specialist.PhotoURL == "" && user.PhotoURL != "" && user.ID == specialist.TelegramUserID {
				if err := db.UpdateSpecialistPhoto(specialist.ID, user.PhotoURL); err == nil {
					specialist.PhotoURL = user.PhotoURL
					changes.Publish(specialist.ID, changes.GroupSpecialist)
				}
			}

			ctx := context.WithValue(r.Context(), ClientContextKey, client)
			ctx = context.WithValue(ctx, SpecialistContextKey, specialist)
			ctx = context.WithValue(ctx, TelegramUserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

/***************************************************************************************************
* Validates init data.
*
* Parameters:
* - initData: Init data used by the current operation.
* - botToken: Bot token used by the current operation.
*
* Returns:
* - The computed value for the current operation as (*TelegramUser, bool).
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func validateInitData(initData, botToken string) (*TelegramUser, bool) {
	values, err := url.ParseQuery(initData)
	if err != nil {
		return nil, false
	}

	/***************************************************************************************************
	* Extract hash.
	***************************************************************************************************/
	hash := values.Get("hash")
	if hash == "" {
		return nil, false
	}

	/***************************************************************************************************
	* Build data check string.
	***************************************************************************************************/
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

	/***************************************************************************************************
	* Calculate HMAC.
	***************************************************************************************************/
	secretKey := hmac.New(sha256.New, []byte("WebAppData"))
	secretKey.Write([]byte(botToken))
	secret := secretKey.Sum(nil)

	h := hmac.New(sha256.New, secret)
	h.Write([]byte(dataCheckString))
	calculatedHash := hex.EncodeToString(h.Sum(nil))

	if !secureCompare(calculatedHash, hash) {
		log.Printf("Auth rejected: initData signature mismatch")
		return nil, false
	}

	authDateStr := values.Get("auth_date")
	if authDateStr == "" {
		log.Printf("Auth rejected: missing auth_date")
		return nil, false
	}

	authDate, err := strconv.ParseInt(authDateStr, 10, 64)
	if err != nil {
		log.Printf("Auth rejected: invalid auth_date")
		return nil, false
	}

	age := time.Now().Unix() - authDate
	if age > 3600 {
		log.Printf("Auth rejected: initData expired (age=%ds)", age)
		return nil, false
	}
	if age < -300 {
		log.Printf("Auth rejected: initData auth_date is too far in the future (age=%ds)", age)
		return nil, false
	}

	/***************************************************************************************************
	* Parse user data.
	***************************************************************************************************/
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

/***************************************************************************************************
* GetClientFromContext extracts client from request context.
*
* Parameters:
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - The computed value for the current operation as *models.Client.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func GetClientFromContext(r *http.Request) *models.Client {
	client, _ := r.Context().Value(ClientContextKey).(*models.Client)
	return client
}

/***************************************************************************************************
* GetSpecialistFromContext extracts specialist from request context.
*
* Parameters:
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - The computed value for the current operation as *models.Specialist.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func GetSpecialistFromContext(r *http.Request) *models.Specialist {
	specialist, _ := r.Context().Value(SpecialistContextKey).(*models.Specialist)
	return specialist
}

/***************************************************************************************************
* GetTelegramUserFromContext extracts Telegram initData user from request context.
*
* Parameters:
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - The computed value for the current operation as *TelegramUser.
*
* Side effects:
* - Reads request-scoped context.
*
***************************************************************************************************/
func GetTelegramUserFromContext(r *http.Request) *TelegramUser {
	user, _ := r.Context().Value(TelegramUserContextKey).(*TelegramUser)
	return user
}

/***************************************************************************************************
* AdminAuthMiddleware checks if the user is the specialist (admin).
*
* Parameters:
* - next: Next used by the current operation.
*
* Returns:
* - The computed value for the current operation as http.Handler.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func AdminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		client := GetClientFromContext(r)
		specialist := GetSpecialistFromContext(r)

		if client == nil || specialist == nil {
			httpError(w, r, "Error.Unauthorized", http.StatusUnauthorized)
			return
		}

		/***************************************************************************************************
		* Check if client's telegram ID matches specialist's telegram ID.
		***************************************************************************************************/
		if client.TelegramUserID != specialist.TelegramUserID {
			httpError(w, r, "Error.Forbidden", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

/***************************************************************************************************
* I18nMiddleware determines the user's language from client/specialist profile and stores a
* localizer in context. Must run AFTER auth middleware.
*
* Parameters:
* - next: Next used by the current operation.
*
* Returns:
* - The computed value for the current operation as http.Handler.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
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

/***************************************************************************************************
* SuperadminSecret is set from config at startup. If empty, superadmin endpoints are disabled.
*
* Usage context:
* - Reused by the api layer to keep shared values centralized.
***************************************************************************************************/
var SuperadminSecret string

/***************************************************************************************************
* SuperadminAuthMiddleware checks the Authorization: Bearer <secret> header.
*
* Parameters:
* - next: Next used by the current operation.
*
* Returns:
* - The computed value for the current operation as http.Handler.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func SuperadminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if SuperadminSecret == "" {
			http.NotFound(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if auth == "" || !secureCompare(auth, "Bearer "+SuperadminSecret) {
			log.Printf("Superadmin auth rejected from %s", r.RemoteAddr)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

/***************************************************************************************************
* SecurityHeadersMiddleware adds security response headers.
*
* Parameters:
* - next: Next used by the current operation.
*
* Returns:
* - The computed value for the current operation as http.Handler.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
}
