package api

import (
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

/***************************************************************************************************
* GlobalRateLimitMiddleware limits total requests per second across all clients.
*
* Parameters:
* - rps: Rps used by the current operation.
* - burst: Burst used by the current operation.
*
* Returns:
* - The computed value for the current operation as func(http.Handler) http.Handler.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func GlobalRateLimitMiddleware(rps float64, burst int) func(http.Handler) http.Handler {
	limiter := rate.NewLimiter(rate.Limit(rps), burst)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !limiter.Allow() {
				log.Printf("Rate limit (global): rejected request from %s", r.RemoteAddr)
				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

/***************************************************************************************************
* clientIP returns the best-effort real client address for rate limiting.
*
* The TCP peer is trusted as the client unless it is a loopback or private address, i.e. a local
* reverse proxy (Caddy on the docker network). Only then is X-Forwarded-For consulted, walked from
* right to left: every proxy appends the address it saw, so the rightmost entries are written by
* our own infrastructure while the leftmost ones are attacker-controlled. The first entry that is
* neither loopback nor private is the client. X-Real-IP is ignored.
*
* Parameters:
* - r: HTTP request carrying the peer address and forwarding headers.
*
* Returns:
* - The client IP as a string, or the peer host when nothing trustworthy can be derived.
***************************************************************************************************/
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}

	peer := net.ParseIP(host)
	if peer == nil || !(peer.IsLoopback() || peer.IsPrivate()) {
		return host
	}

	forwarded := strings.Join(r.Header.Values("X-Forwarded-For"), ",")
	if strings.TrimSpace(forwarded) == "" {
		return host
	}

	entries := strings.Split(forwarded, ",")
	for i := len(entries) - 1; i >= 0; i-- {
		ip := net.ParseIP(strings.TrimSpace(entries[i]))
		if ip == nil {
			return host
		}
		if ip.IsLoopback() || ip.IsPrivate() {
			continue
		}
		return ip.String()
	}
	return host
}

/***************************************************************************************************
* keyedLimiter keeps one token bucket per key and evicts idle buckets every 5 minutes.
***************************************************************************************************/
type keyedLimiter struct {
	mu       sync.Mutex
	limiters map[string]*rateLimiterEntry
	rps      float64
	burst    int
}

/***************************************************************************************************
* Creates a keyed limiter and starts its background cleanup loop.
*
* Parameters:
* - rps: Sustained requests per second allowed per key.
* - burst: Bucket size per key.
*
* Returns:
* - The new limiter as *keyedLimiter.
***************************************************************************************************/
func newKeyedLimiter(rps float64, burst int) *keyedLimiter {
	k := &keyedLimiter{
		limiters: make(map[string]*rateLimiterEntry),
		rps:      rps,
		burst:    burst,
	}

	/***************************************************************************************************
	* Background cleanup every 5 minutes.
	***************************************************************************************************/
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			k.mu.Lock()
			now := time.Now()
			for key, entry := range k.limiters {
				if now.Sub(entry.lastSeen) > 10*time.Minute {
					delete(k.limiters, key)
				}
			}
			k.mu.Unlock()
		}
	}()

	return k
}

/***************************************************************************************************
* Consumes one token for key.
*
* Parameters:
* - key: Namespaced limiter key (see ipRateKey and clientRateKey).
*
* Returns:
* - True when the request may proceed.
***************************************************************************************************/
func (k *keyedLimiter) allow(key string) bool {
	k.mu.Lock()
	entry, exists := k.limiters[key]
	if !exists {
		entry = &rateLimiterEntry{limiter: rate.NewLimiter(rate.Limit(k.rps), k.burst)}
		k.limiters[key] = entry
	}
	entry.lastSeen = time.Now()
	k.mu.Unlock()

	return entry.limiter.Allow()
}

/***************************************************************************************************
* Namespaced limiter keys so a Telegram user ID can never collide with an IP string.
***************************************************************************************************/
func ipRateKey(ip string) string { return "ip:" + ip }

func userRateKey(telegramUserID int64) string { return "tg:" + strconv.FormatInt(telegramUserID, 10) }

/***************************************************************************************************
* PerIPRateLimitMiddleware limits requests per second per client IP (see clientIP).
*
* Parameters:
* - rps: Rps used by the current operation.
* - burst: Burst used by the current operation.
*
* Returns:
* - The computed value for the current operation as func(http.Handler) http.Handler.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func PerIPRateLimitMiddleware(rps float64, burst int) func(http.Handler) http.Handler {
	limiter := newKeyedLimiter(rps, burst)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := clientIP(r)
			if !limiter.allow(ipRateKey(ip)) {
				log.Printf("Rate limit (per-IP): rejected request from %s", ip)
				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

/***************************************************************************************************
* PerClientRateLimitMiddleware limits requests per second per authenticated Telegram user. It must
* run after the auth middleware: it keys on the Telegram user from initData, then on the client
* record's Telegram ID, and only falls back to the client IP when neither is in the context.
*
* Parameters:
* - rps: Sustained requests per second allowed per user.
* - burst: Bucket size per user.
*
* Returns:
* - The computed value for the current operation as func(http.Handler) http.Handler.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func PerClientRateLimitMiddleware(rps float64, burst int) func(http.Handler) http.Handler {
	limiter := newKeyedLimiter(rps, burst)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var key string
			if user := GetTelegramUserFromContext(r); user != nil {
				key = userRateKey(user.ID)
			} else if client := GetClientFromContext(r); client != nil {
				key = userRateKey(client.TelegramUserID)
			} else {
				key = ipRateKey(clientIP(r))
			}

			if !limiter.allow(key) {
				log.Printf("Rate limit (per-client): rejected %s %s for %s", r.Method, r.URL.Path, key)
				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

/***************************************************************************************************
* Defines the rate limiter entry type used by the api layer.
***************************************************************************************************/
type rateLimiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}
