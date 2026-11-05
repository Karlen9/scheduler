package main

import (
	"crypto/subtle"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"scheduler-bot/internal/telegram"
)

/***************************************************************************************************
* updateHandler is the part of a bot handler the webhook dispatcher needs. Both
* *telegram.Handler and *telegram.MasterHandler satisfy it.
***************************************************************************************************/
type updateHandler interface {
	HandleUpdate(telegram.Update)
}

var (
	_ updateHandler = (*telegram.Handler)(nil)
	_ updateHandler = (*telegram.MasterHandler)(nil)
)

/***************************************************************************************************
* Name of the header Telegram echoes the registered secret_token in.
***************************************************************************************************/
const webhookSecretHeader = "X-Telegram-Bot-Api-Secret-Token"

/***************************************************************************************************
* Telegram limits secret_token to 256 characters. Longer header values can never be legitimate, so
* they are rejected before any lookup.
***************************************************************************************************/
const maxWebhookSecretLen = 256

/***************************************************************************************************
* secretsEqual compares two secrets in constant time. Empty values never match.
***************************************************************************************************/
func secretsEqual(a, b string) bool {
	if a == "" || b == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

/***************************************************************************************************
* newWebhookHandler dispatches Telegram webhooks before the chi API router.
*
* Routes (the secret lives only in the X-Telegram-Bot-Api-Secret-Token header):
* - POST /tg/webhook                specialist bots; the header selects the bot.
* - POST /tg/{secret}/webhook       legacy URL kept for already-registered webhooks; header must
*                                   equal the path segment.
* - POST /master/webhook            master bot; header must equal masterSecret.
* - POST /master/{secret}/webhook   legacy master URL; path segment and header must equal masterSecret.
* Anything else under /tg/ (or /master/ when master is set) is 404, other methods are 405.
* Everything outside those prefixes falls through to next. No log line contains a secret or a
* path that carries one.
*
* Parameters:
* - resolveSpecialist: Maps a webhook secret to its handler; must return a nil interface when unknown.
* - masterSecret: Webhook secret of the master bot.
* - master: Master bot handler, or a nil interface when the master bot is not configured.
* - next: Handler for every non-webhook request.
*
* Returns:
* - The dispatching http.Handler.
***************************************************************************************************/
func newWebhookHandler(resolveSpecialist func(secret string) updateHandler, masterSecret string, master updateHandler, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		if strings.HasPrefix(path, "/tg/") {
			serveSpecialistWebhook(w, r, resolveSpecialist)
			return
		}

		if master != nil && strings.HasPrefix(path, "/master/") {
			serveMasterWebhook(w, r, masterSecret, master)
			return
		}

		next.ServeHTTP(w, r)
	})
}

/***************************************************************************************************
* webhookPathSecret parses /<prefix>/webhook and /<prefix>/{secret}/webhook.
*
* Parameters:
* - path: Request path starting with the given prefix.
* - prefix: "tg" or "master".
*
* Returns:
* - The legacy path secret (empty for the new form), whether the path is legacy, and whether the
*   path is a valid webhook path at all.
***************************************************************************************************/
func webhookPathSecret(path, prefix string) (secret string, legacy bool, ok bool) {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	switch {
	case len(parts) == 2 && parts[0] == prefix && parts[1] == "webhook":
		return "", false, true
	case len(parts) == 3 && parts[0] == prefix && parts[2] == "webhook":
		return parts[1], true, true
	}
	return "", false, false
}

/***************************************************************************************************
* decodeUpdate reads the (size-limited) request body into a Telegram update.
***************************************************************************************************/
func decodeUpdate(w http.ResponseWriter, r *http.Request) (telegram.Update, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	defer r.Body.Close()

	var update telegram.Update
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		log.Printf("Webhook rejected: invalid json: %v", err)
		http.Error(w, "invalid json", http.StatusBadRequest)
		return update, false
	}
	return update, true
}

/***************************************************************************************************
* Serves specialist-bot webhooks (/tg/...).
***************************************************************************************************/
func serveSpecialistWebhook(w http.ResponseWriter, r *http.Request, resolve func(secret string) updateHandler) {
	pathSecret, legacy, ok := webhookPathSecret(r.URL.Path, "tg")
	if !ok {
		log.Printf("Webhook rejected: unknown path under /tg/")
		http.NotFound(w, r)
		return
	}

	if r.Method != http.MethodPost {
		log.Printf("Webhook rejected: method %s", r.Method)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	secret := r.Header.Get(webhookSecretHeader)
	if secret == "" {
		log.Printf("Webhook rejected: missing secret header")
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if len(secret) > maxWebhookSecretLen {
		log.Printf("Webhook rejected: secret header too long")
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if legacy {
		if !secretsEqual(secret, pathSecret) {
			log.Printf("Webhook rejected: secret mismatch (legacy path)")
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		log.Printf("legacy webhook path used")
	}

	h := resolve(secret)
	if h == nil {
		// Retired or unknown bot: answer 200 so Telegram stops retrying, without revealing which
		// secrets exist.
		log.Printf("Webhook ignored: no handler for secret (returning 200 to stop retries)")
		w.WriteHeader(http.StatusOK)
		return
	}

	update, ok := decodeUpdate(w, r)
	if !ok {
		return
	}

	log.Printf("Webhook update received (message=%v, callback=%v)", update.Message != nil, update.CallbackQuery != nil)
	w.WriteHeader(http.StatusOK)
	go h.HandleUpdate(update)
}

/***************************************************************************************************
* Serves master-bot webhooks (/master/...).
***************************************************************************************************/
func serveMasterWebhook(w http.ResponseWriter, r *http.Request, masterSecret string, master updateHandler) {
	pathSecret, legacy, ok := webhookPathSecret(r.URL.Path, "master")
	if !ok {
		http.NotFound(w, r)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if !secretsEqual(r.Header.Get(webhookSecretHeader), masterSecret) {
		log.Printf("Master webhook rejected: header mismatch")
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if legacy {
		if !secretsEqual(pathSecret, masterSecret) {
			log.Printf("Master webhook rejected: secret mismatch (legacy path)")
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		log.Printf("legacy webhook path used")
	}

	update, ok := decodeUpdate(w, r)
	if !ok {
		return
	}

	log.Printf("Master webhook update (message=%v, callback=%v)", update.Message != nil, update.CallbackQuery != nil)
	w.WriteHeader(http.StatusOK)
	go master.HandleUpdate(update)
}
