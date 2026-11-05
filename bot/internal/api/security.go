package api

import (
	"crypto/subtle"
	"log"
	"net"
	"net/http"
	"net/url"
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

	return ip.IsLoopback()
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
* Placeholder WEB_APP_URL that config.Load() substitutes when the variable is unset.
***************************************************************************************************/
const webAppURLPlaceholder = "https://your-mini-app-url.com"

/***************************************************************************************************
* Normalises a configured origin to scheme://host[:port].
*
* Parameters:
* - raw: Origin or URL as configured (may carry a path or trailing slash).
*
* Returns:
* - The normalised origin and whether the input was a valid http(s) origin without wildcards.
***************************************************************************************************/
func normalizeOrigin(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.Contains(raw, "*") {
		return "", false
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" {
		return "", false
	}
	return strings.ToLower(u.Scheme) + "://" + strings.ToLower(u.Host), true
}

/***************************************************************************************************
* Reports whether an origin points at a loopback host.
***************************************************************************************************/
func isLoopbackOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

/***************************************************************************************************
* Builds the CORS origin allowlist: the normalised WEB_APP_URL plus CORS_ALLOWED_ORIGINS.
* Wildcards and invalid entries are dropped with a warning, and "*" is never returned. The local
* dev origins are added only when WEB_APP_URL is unset, the placeholder, or itself loopback.
*
* Parameters:
* - webAppURL: Configured WEB_APP_URL.
* - configured: Extra origins from CORS_ALLOWED_ORIGINS.
*
* Returns:
* - The deduplicated list of allowed origins as []string.
***************************************************************************************************/
func allowedOriginsForCORS(webAppURL string, configured []string) []string {
	var origins []string
	seen := make(map[string]bool)
	add := func(origin string) {
		if !seen[origin] {
			seen[origin] = true
			origins = append(origins, origin)
		}
	}

	devAllowed := false
	webAppURL = strings.TrimSpace(webAppURL)
	if webAppURL == "" || webAppURL == webAppURLPlaceholder {
		devAllowed = true
	} else if origin, ok := normalizeOrigin(webAppURL); ok {
		add(origin)
		devAllowed = isLoopbackOrigin(origin)
	} else {
		log.Printf("CORS: ignoring invalid WEB_APP_URL %q", webAppURL)
	}

	for _, entry := range configured {
		origin, ok := normalizeOrigin(entry)
		if !ok {
			log.Printf("CORS: ignoring invalid CORS_ALLOWED_ORIGINS entry %q (wildcards and non-http(s) origins are rejected)", entry)
			continue
		}
		add(origin)
	}

	if devAllowed {
		add("http://localhost:3000")
		add("http://127.0.0.1:3000")
	}

	return origins
}
