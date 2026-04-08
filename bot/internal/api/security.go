package api

import (
	"crypto/subtle"
	"net"
	"net/http"
	"strings"
)

/***************************************************************************************************
* Implements the secure compare logic used by this module.
*
* Parameters:
* - a: A used by the current operation.
* - b: B used by the current operation.
*
* Returns:
* - The computed value for the current operation as bool.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func secureCompare(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

/***************************************************************************************************
* Checks whether internal request.
*
* Parameters:
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - The computed value for the current operation as bool.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func isInternalRequest(r *http.Request) bool {
	host := strings.TrimSpace(r.RemoteAddr)
	if host == "" {
		return false
	}

	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}

	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}

	return ip.IsLoopback() || ip.IsPrivate()
}

/***************************************************************************************************
* Implements the metrics auth middleware logic used by this module.
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
func MetricsAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if LoadTestMode || isInternalRequest(r) {
			next.ServeHTTP(w, r)
			return
		}

		auth := strings.TrimSpace(r.Header.Get("Authorization"))
		if SuperadminSecret != "" && secureCompare(auth, "Bearer "+SuperadminSecret) {
			next.ServeHTTP(w, r)
			return
		}

		if SuperadminSecret == "" {
			http.NotFound(w, r)
			return
		}

		http.Error(w, "Unauthorized", http.StatusUnauthorized)
	})
}

/***************************************************************************************************
* Implements the allowed origins for cors logic used by this module.
*
* Parameters:
* - webAppURL: Web app url used by the current operation.
*
* Returns:
* - The computed value for the current operation as []string.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func allowedOriginsForCORS(webAppURL string) []string {
	origins := []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
	}

	if webAppURL == "" || webAppURL == "https://your-mini-app-url.com" {
		return origins
	}

	if webAppURL == origins[0] || webAppURL == origins[1] {
		return origins
	}

	return append([]string{webAppURL}, origins...)
}
