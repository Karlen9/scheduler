package api

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

/***************************************************************************************************
* Groups related module-level variables declared together for this module.
***************************************************************************************************/
var (
	/***************************************************************************************************
	* Defines the http requests total value used by the api layer.
	*
	* Usage context:
	* - Reused by the api layer to keep shared values centralized.
	***************************************************************************************************/
	httpRequestsTotal = promauto.NewCounterVec(
		/***************************************************************************************************
		* Defines the prometheus value used by the api layer.
		*
		* Usage context:
		* - Reused by the api layer to keep shared values centralized.
		***************************************************************************************************/
		prometheus.CounterOpts{
			/***************************************************************************************************
			* Defines the name value used by the api layer.
			*
			* Usage context:
			* - Reused by the api layer to keep shared values centralized.
			***************************************************************************************************/
			Name: "http_requests_total",
			/***************************************************************************************************
			* Defines the help value used by the api layer.
			*
			* Usage context:
			* - Reused by the api layer to keep shared values centralized.
			***************************************************************************************************/
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		},
		[]string{"method", "path"},
	)

	httpRequestsInFlight = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "http_requests_in_flight",
			Help: "Number of HTTP requests currently being processed",
		},
	)
)

/***************************************************************************************************
* PrometheusMiddleware records request metrics.
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
func PrometheusMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/metrics" || r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		httpRequestsInFlight.Inc()
		defer httpRequestsInFlight.Dec()

		start := time.Now()
		wrapped := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(wrapped, r)

		duration := time.Since(start).Seconds()
		path := normalizeRoute(r)

		httpRequestsTotal.WithLabelValues(r.Method, path, strconv.Itoa(wrapped.status)).Inc()
		httpRequestDuration.WithLabelValues(r.Method, path).Observe(duration)
	})
}

/***************************************************************************************************
* Defines the status writer type used by the api layer.
***************************************************************************************************/
type statusWriter struct {
	http.ResponseWriter
	status  int
	written bool
}

/***************************************************************************************************
* Implements the write header logic used by this module.
*
* Parameters:
* - code: Code used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func (w *statusWriter) WriteHeader(code int) {
	if !w.written {
		w.status = code
		w.written = true
	}
	w.ResponseWriter.WriteHeader(code)
}

/***************************************************************************************************
* Implements the write logic used by this module.
*
* Parameters:
* - b: B used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May coordinate request handling, authentication checks, or other API-facing behavior.
***************************************************************************************************/
func (w *statusWriter) Write(b []byte) (int, error) {
	if !w.written {
		w.written = true
	}
	return w.ResponseWriter.Write(b)
}

/***************************************************************************************************
* normalizeRoute extracts the chi route pattern to avoid high-cardinality labels. Falls back to a
* truncated path if no pattern is found.
*
* Parameters:
* - r: HTTP request carrying headers, params, query values, and body data.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Reads request-scoped context, writes HTTP responses, and may call downstream database or notification helpers.
*
***************************************************************************************************/
func normalizeRoute(r *http.Request) string {
	rctx := chi.RouteContext(r.Context())
	if rctx != nil && rctx.RoutePattern() != "" {
		return rctx.RoutePattern()
	}
	/***************************************************************************************************
	* Fallback: collapse path segments that look like IDs.
	***************************************************************************************************/
	parts := strings.Split(r.URL.Path, "/")
	for i, p := range parts {
		if len(p) > 8 && !strings.HasPrefix(p, "api") {
			parts[i] = ":id"
		}
	}
	return strings.Join(parts, "/")
}
