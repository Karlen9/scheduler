package api

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
)

/***************************************************************************************************
* Implements the add vary headers logic used by this module.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - headers: Headers used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func addVaryHeaders(w http.ResponseWriter, headers ...string) {
	existing := strings.TrimSpace(w.Header().Get("Vary"))
	seen := make(map[string]struct{}, len(headers)+1)

	if existing != "" {
		for _, header := range strings.Split(existing, ",") {
			name := strings.TrimSpace(header)
			if name != "" {
				seen[name] = struct{}{}
			}
		}
	}

	for _, header := range headers {
		if header != "" {
			seen[header] = struct{}{}
		}
	}

	if len(seen) == 0 {
		return
	}

	names := make([]string, 0, len(seen))
	for header := range seen {
		names = append(names, header)
	}
	sort.Strings(names)
	w.Header().Set("Vary", strings.Join(names, ", "))
}

/***************************************************************************************************
* Sets private cache.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - maxAgeSeconds: Max age seconds used by the current operation.
* - staleWhileRevalidateSeconds: Date value used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func setPrivateCache(w http.ResponseWriter, maxAgeSeconds int, staleWhileRevalidateSeconds int) {
	addVaryHeaders(w, "Accept-Language", "X-Specialist-ID", "X-Telegram-Init-Data", "X-Trainer-ID")
	value := fmt.Sprintf("private, max-age=%d", maxAgeSeconds)
	if staleWhileRevalidateSeconds > 0 {
		value += fmt.Sprintf(", stale-while-revalidate=%d", staleWhileRevalidateSeconds)
	}
	w.Header().Set("Cache-Control", value)
}

/***************************************************************************************************
* Sets no store.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func setNoStore(w http.ResponseWriter) {
	addVaryHeaders(w, "Accept-Language", "X-Specialist-ID", "X-Telegram-Init-Data", "X-Trainer-ID")
	w.Header().Set("Cache-Control", "private, no-store")
}

/***************************************************************************************************
* Sets public cache.
*
* Parameters:
* - w: HTTP response writer used to send the reply.
* - maxAgeSeconds: Max age seconds used by the current operation.
* - immutable: Immutable used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func setPublicCache(w http.ResponseWriter, maxAgeSeconds int, immutable bool) {
	value := fmt.Sprintf("public, max-age=%d", maxAgeSeconds)
	if immutable {
		value += ", immutable"
	}
	w.Header().Set("Cache-Control", value)
}
