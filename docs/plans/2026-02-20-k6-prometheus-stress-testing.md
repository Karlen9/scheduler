# k6 + Prometheus Stress Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up k6 load testing with Prometheus metrics and Grafana dashboards to validate the Go backend handles ~1000 concurrent users.

**Architecture:** Prometheus middleware in the Go backend exposes `/metrics`. k6 generates load and pushes its own metrics via Prometheus remote write. Grafana auto-provisions dashboards for both server-side and client-side metrics. A `LOAD_TEST_MODE` env var bypasses Telegram HMAC auth for test traffic.

**Tech Stack:** prometheus/client_golang, k6 (grafana/k6 Docker image), Prometheus, Grafana, Docker Compose

---

### Task 1: Add Prometheus dependency to Go backend

**Files:**
- Modify: `bot/go.mod`

**Step 1: Add the prometheus client library**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go get github.com/prometheus/client_golang`

Expected: go.mod updated with `github.com/prometheus/client_golang` in require block

**Step 2: Verify it compiles**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`

Expected: no errors

**Step 3: Commit**

```bash
cd /Users/user/Documents/karlen/scheduler/bot
git add go.mod go.sum
git commit -m "chore: add prometheus client_golang dependency"
```

---

### Task 2: Create Prometheus metrics middleware

**Files:**
- Create: `bot/internal/api/metrics.go`

**Step 1: Create the metrics middleware file**

```go
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

var (
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
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

// PrometheusMiddleware records request metrics.
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

type statusWriter struct {
	http.ResponseWriter
	status int
	written bool
}

func (w *statusWriter) WriteHeader(code int) {
	if !w.written {
		w.status = code
		w.written = true
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	if !w.written {
		w.written = true
	}
	return w.ResponseWriter.Write(b)
}

// normalizeRoute extracts the chi route pattern to avoid high-cardinality labels.
// Falls back to a truncated path if no pattern is found.
func normalizeRoute(r *http.Request) string {
	rctx := chi.RouteContext(r.Context())
	if rctx != nil && rctx.RoutePattern() != "" {
		return rctx.RoutePattern()
	}
	// Fallback: collapse path segments that look like IDs
	parts := strings.Split(r.URL.Path, "/")
	for i, p := range parts {
		if len(p) > 8 && !strings.HasPrefix(p, "api") {
			parts[i] = ":id"
		}
	}
	return strings.Join(parts, "/")
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`

Expected: no errors

**Step 3: Commit**

```bash
git add bot/internal/api/metrics.go
git commit -m "feat: add Prometheus metrics middleware for HTTP requests"
```

---

### Task 3: Wire metrics middleware and /metrics endpoint into the router

**Files:**
- Modify: `bot/internal/api/router.go:14-21` (add middleware + endpoint)

**Step 1: Add the promhttp import and middleware to router.go**

In the imports, add:
```go
"github.com/prometheus/client_golang/prometheus/promhttp"
```

In `NewRouter()`, after `r.Use(middleware.RealIP)` (line 20) and before `r.Use(SecurityHeadersMiddleware)` (line 21), insert:
```go
r.Use(PrometheusMiddleware)
```

After the health check endpoint (after line 44), add the metrics endpoint:
```go
// Prometheus metrics (no auth)
r.Handle("/metrics", promhttp.Handler())
```

**Step 2: Verify it compiles**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`

Expected: no errors

**Step 3: Run existing tests**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go test ./...`

Expected: all tests pass

**Step 4: Commit**

```bash
git add bot/internal/api/router.go
git commit -m "feat: wire Prometheus middleware and /metrics endpoint into router"
```

---

### Task 4: Add LOAD_TEST_MODE auth bypass

**Files:**
- Modify: `bot/internal/api/middleware.go:50-120` (TelegramAuthMiddleware)

**Step 1: Add load test mode bypass to TelegramAuthMiddleware**

At the top of `middleware.go`, add a package-level variable:
```go
// LoadTestMode when true bypasses Telegram HMAC validation.
// Set via LOAD_TEST_MODE env var. Never enable in production.
var LoadTestMode bool
```

In `TelegramAuthMiddleware`, right after retrieving `initData` and `specialistID` (after line 63, where specialistID fallbacks are done), before the specialist lookup, add a load-test bypass block:

```go
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
```

Add `"strconv"` to the imports if not already present (it's already there at line 12).

**Step 2: Set the variable in main.go**

In `bot/main.go`, after `api.WebAppURL = cfg.WebAppURL` (line 402), add:
```go
api.LoadTestMode = os.Getenv("LOAD_TEST_MODE") == "true"
if api.LoadTestMode {
	log.Println("WARNING: LOAD_TEST_MODE enabled — Telegram auth bypassed for X-Test-User-ID requests")
}
```

**Step 3: Verify it compiles**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go build ./...`

Expected: no errors

**Step 4: Run existing tests**

Run: `cd /Users/user/Documents/karlen/scheduler/bot && go test ./...`

Expected: all tests pass (LoadTestMode defaults to false, no behavior change)

**Step 5: Commit**

```bash
git add bot/internal/api/middleware.go bot/main.go
git commit -m "feat: add LOAD_TEST_MODE auth bypass for load testing"
```

---

### Task 5: Create k6 helper modules

**Files:**
- Create: `load-tests/scripts/helpers/config.js`
- Create: `load-tests/scripts/helpers/auth.js`

**Step 1: Create config.js**

```javascript
// Base URL of the backend under test
export const BASE_URL = __ENV.BASE_URL || "http://bot:8080";

// Specialist ID (seeded by setup)
export const SPECIALIST_ID = __ENV.SPECIALIST_ID || "";

// Standard thresholds for pass/fail
export const THRESHOLDS = {
  http_req_duration: ["p(95)<500", "p(99)<1500"],
  http_req_failed: ["rate<0.01"],
};
```

**Step 2: Create auth.js**

```javascript
// In LOAD_TEST_MODE, auth is simplified to just an X-Test-User-ID header.
// Each VU gets a unique user ID based on VU number + iteration.
export function authHeaders(vuId, specialistId) {
  return {
    "Content-Type": "application/json",
    "X-Test-User-ID": String(100000 + vuId),
    "X-Specialist-ID": specialistId,
  };
}
```

**Step 3: Commit**

```bash
git add load-tests/scripts/helpers/config.js load-tests/scripts/helpers/auth.js
git commit -m "feat: add k6 helper modules for config and auth"
```

---

### Task 6: Create k6 smoke test

**Files:**
- Create: `load-tests/scripts/smoke.js`

**Step 1: Create smoke.js**

```javascript
import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, SPECIALIST_ID, THRESHOLDS } from "./helpers/config.js";
import { authHeaders } from "./helpers/auth.js";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: THRESHOLDS,
};

// Setup: seed a specialist with working hours via direct API or verify one exists
export function setup() {
  // Health check must work without auth
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    "health check returns 200": (r) => r.status === 200,
    "health check returns OK": (r) => r.body === "OK",
  });

  // Try to get specialist (relies on pre-seeded data from DB init)
  const headers = authHeaders(1, SPECIALIST_ID);
  const specRes = http.get(`${BASE_URL}/api/specialist`, { headers });
  check(specRes, {
    "specialist endpoint returns 200": (r) => r.status === 200,
  });

  if (specRes.status === 200) {
    const specialist = specRes.json();
    return { specialistId: specialist.id };
  }

  return { specialistId: SPECIALIST_ID };
}

export default function (data) {
  const headers = authHeaders(__VU, data.specialistId);

  // GET /health (no auth)
  const health = http.get(`${BASE_URL}/health`);
  check(health, { "health 200": (r) => r.status === 200 });

  // GET /api/specialist
  const spec = http.get(`${BASE_URL}/api/specialist`, { headers });
  check(spec, { "specialist 200": (r) => r.status === 200 });

  // GET /api/durations
  const dur = http.get(`${BASE_URL}/api/durations`, { headers });
  check(dur, { "durations 200": (r) => r.status === 200 });

  // GET /api/working-hours
  const wh = http.get(`${BASE_URL}/api/working-hours`, { headers });
  check(wh, { "working-hours 200": (r) => r.status === 200 });

  // GET /api/availability (today + 7 days)
  const today = new Date().toISOString().split("T")[0];
  const avail = http.get(`${BASE_URL}/api/availability?date=${today}`, {
    headers,
  });
  check(avail, { "availability 200": (r) => r.status === 200 });

  sleep(1);
}
```

**Step 2: Commit**

```bash
git add load-tests/scripts/smoke.js
git commit -m "feat: add k6 smoke test script"
```

---

### Task 7: Create k6 load test (full booking flow)

**Files:**
- Create: `load-tests/scripts/load.js`

**Step 1: Create load.js**

```javascript
import http from "k6/http";
import { check, sleep, group } from "k6";
import { BASE_URL, SPECIALIST_ID, THRESHOLDS } from "./helpers/config.js";
import { authHeaders } from "./helpers/auth.js";

export const options = {
  stages: [
    { duration: "1m", target: 50 },   // ramp up
    { duration: "1m", target: 200 },   // ramp to peak
    { duration: "5m", target: 200 },   // sustained peak
    { duration: "1m", target: 0 },     // ramp down
  ],
  thresholds: THRESHOLDS,
};

export function setup() {
  const headers = authHeaders(1, SPECIALIST_ID);
  const specRes = http.get(`${BASE_URL}/api/specialist`, { headers });
  if (specRes.status === 200) {
    return { specialistId: specRes.json().id };
  }
  return { specialistId: SPECIALIST_ID };
}

export default function (data) {
  const headers = authHeaders(__VU, data.specialistId);

  group("browse", () => {
    const spec = http.get(`${BASE_URL}/api/specialist`, { headers });
    check(spec, { "specialist 200": (r) => r.status === 200 });

    const dur = http.get(`${BASE_URL}/api/durations`, { headers });
    check(dur, { "durations 200": (r) => r.status === 200 });

    const wh = http.get(`${BASE_URL}/api/working-hours`, { headers });
    check(wh, { "working-hours 200": (r) => r.status === 200 });

    // Check availability for a date 7 days from now
    const futureDate = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0];
    const avail = http.get(`${BASE_URL}/api/availability?date=${futureDate}`, {
      headers,
    });
    check(avail, { "availability 200": (r) => r.status === 200 });
  });

  sleep(0.5);

  group("book", () => {
    // Create a booking 14 days from now at 10:00
    const bookDate = new Date(Date.now() + 14 * 86400000)
      .toISOString()
      .split("T")[0];

    const payload = JSON.stringify({
      date: bookDate,
      time: "10:00",
      duration: 60,
    });

    const createRes = http.post(`${BASE_URL}/api/bookings`, payload, {
      headers,
    });

    // May get 409 conflict if slot taken — that's expected under load
    const created =
      createRes.status === 201 || createRes.status === 200;
    const conflict = createRes.status === 409;
    check(createRes, {
      "booking created or conflict": () => created || conflict,
    });

    if (created && createRes.json() && createRes.json().id) {
      const bookingId = createRes.json().id;

      sleep(0.2);

      // Cancel the booking (cleanup)
      const cancelRes = http.del(
        `${BASE_URL}/api/bookings/${bookingId}`,
        null,
        { headers }
      );
      check(cancelRes, {
        "booking cancelled": (r) => r.status === 200 || r.status === 204,
      });
    }
  });

  sleep(1);

  group("list-bookings", () => {
    const bookings = http.get(`${BASE_URL}/api/bookings`, { headers });
    check(bookings, { "bookings 200": (r) => r.status === 200 });
  });

  sleep(0.5);
}
```

**Step 2: Commit**

```bash
git add load-tests/scripts/load.js
git commit -m "feat: add k6 load test with full booking flow"
```

---

### Task 8: Create k6 stress test

**Files:**
- Create: `load-tests/scripts/stress.js`

**Step 1: Create stress.js**

```javascript
import http from "k6/http";
import { check, sleep, group } from "k6";
import { BASE_URL, SPECIALIST_ID } from "./helpers/config.js";
import { authHeaders } from "./helpers/auth.js";

export const options = {
  stages: [
    { duration: "2m", target: 200 },   // ramp up
    { duration: "2m", target: 500 },   // push higher
    { duration: "3m", target: 1000 },  // peak stress
    { duration: "3m", target: 1000 },  // sustained peak
    { duration: "2m", target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000", "p(99)<3000"],
    http_req_failed: ["rate<0.05"],
  },
};

export function setup() {
  const headers = authHeaders(1, SPECIALIST_ID);
  const specRes = http.get(`${BASE_URL}/api/specialist`, { headers });
  if (specRes.status === 200) {
    return { specialistId: specRes.json().id };
  }
  return { specialistId: SPECIALIST_ID };
}

export default function (data) {
  const headers = authHeaders(__VU, data.specialistId);

  group("browse", () => {
    http.get(`${BASE_URL}/api/specialist`, { headers });
    http.get(`${BASE_URL}/api/durations`, { headers });
    http.get(`${BASE_URL}/api/working-hours`, { headers });

    const futureDate = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0];
    http.get(`${BASE_URL}/api/availability?date=${futureDate}`, { headers });
  });

  sleep(0.3);

  group("book-and-cancel", () => {
    // Each VU books on a different day to reduce conflicts
    const dayOffset = 7 + (__VU % 60);
    const bookDate = new Date(Date.now() + dayOffset * 86400000)
      .toISOString()
      .split("T")[0];

    // Vary the time by VU to reduce slot conflicts
    const hour = 9 + (__VU % 8);
    const timeStr = `${String(hour).padStart(2, "0")}:00`;

    const payload = JSON.stringify({
      date: bookDate,
      time: timeStr,
      duration: 60,
    });

    const res = http.post(`${BASE_URL}/api/bookings`, payload, { headers });

    if ((res.status === 200 || res.status === 201) && res.json() && res.json().id) {
      sleep(0.1);
      http.del(`${BASE_URL}/api/bookings/${res.json().id}`, null, { headers });
    }
  });

  sleep(0.5);

  group("list", () => {
    http.get(`${BASE_URL}/api/bookings`, { headers });
    http.get(`${BASE_URL}/api/profile`, { headers });
  });

  sleep(0.3);
}
```

**Step 2: Commit**

```bash
git add load-tests/scripts/stress.js
git commit -m "feat: add k6 stress test targeting 1000 VUs"
```

---

### Task 9: Create Prometheus config

**Files:**
- Create: `load-tests/prometheus/prometheus.yml`

**Step 1: Create prometheus.yml**

```yaml
global:
  scrape_interval: 5s
  evaluation_interval: 5s

scrape_configs:
  - job_name: "bot"
    static_configs:
      - targets: ["bot:8080"]
    metrics_path: /metrics

# Enable remote write receiver for k6
# (Prometheus must be started with --web.enable-remote-write-receiver)
```

**Step 2: Commit**

```bash
git add load-tests/prometheus/prometheus.yml
git commit -m "feat: add Prometheus scrape config for bot metrics"
```

---

### Task 10: Create Grafana provisioning configs

**Files:**
- Create: `load-tests/grafana/provisioning/datasources/prometheus.yml`
- Create: `load-tests/grafana/provisioning/dashboards/dashboard.yml`

**Step 1: Create datasource provisioning**

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

**Step 2: Create dashboard provisioning config**

```yaml
apiVersion: 1

providers:
  - name: "default"
    orgId: 1
    folder: ""
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
```

**Step 3: Commit**

```bash
git add load-tests/grafana/provisioning/
git commit -m "feat: add Grafana datasource and dashboard provisioning"
```

---

### Task 11: Create Grafana dashboard JSON files

**Files:**
- Create: `load-tests/grafana/dashboards/backend-metrics.json`
- Create: `load-tests/grafana/dashboards/k6-results.json`

**Step 1: Create backend-metrics.json**

A Grafana dashboard JSON with 4 panels:
1. **Request Rate** — `rate(http_requests_total[1m])` grouped by path
2. **Latency Percentiles** — `histogram_quantile(0.50|0.95|0.99, rate(http_request_duration_seconds_bucket[1m]))`
3. **Error Rate** — `rate(http_requests_total{status=~"5.."}[1m]) / rate(http_requests_total[1m])`
4. **In-Flight Requests** — `http_requests_in_flight`

Create a standard Grafana dashboard JSON with these panels using timeseries visualization type, Prometheus datasource, auto-refresh 5s.

**Step 2: Create k6-results.json**

A Grafana dashboard JSON with 4 panels:
1. **Virtual Users** — `k6_vus` gauge
2. **Request Duration** — `k6_http_req_duration` histogram percentiles
3. **Iterations/sec** — `rate(k6_iterations_total[1m])`
4. **HTTP Failures** — `k6_http_req_failed` rate

Create a standard Grafana dashboard JSON with these panels.

**Step 3: Commit**

```bash
git add load-tests/grafana/dashboards/
git commit -m "feat: add Grafana dashboards for backend metrics and k6 results"
```

---

### Task 12: Create docker-compose.loadtest.yml

**Files:**
- Create: `docker-compose.loadtest.yml`

**Step 1: Create the compose file**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: scheduler_loadtest
      POSTGRES_USER: scheduler
      POSTGRES_PASSWORD: loadtest
    ports:
      - "127.0.0.1:5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U scheduler -d scheduler_loadtest"]
      interval: 2s
      timeout: 5s
      retries: 10

  bot:
    build:
      context: ./bot
      args:
        VERSION: loadtest
    ports:
      - "127.0.0.1:8082:8080"
    environment:
      - DATABASE_URL=postgres://scheduler:loadtest@db:5432/scheduler_loadtest?sslmode=disable
      - PORT=8080
      - PUBLIC_BASE_URL=http://localhost:8082
      - WEB_APP_URL=http://localhost:3000
      - LOAD_TEST_MODE=true
      - MASTER_BOT_TOKEN=fake:loadtest
    depends_on:
      db:
        condition: service_healthy

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "127.0.0.1:9090:9090"
    volumes:
      - ./load-tests/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--web.enable-remote-write-receiver"
      - "--storage.tsdb.retention.time=1h"
    depends_on:
      - bot

  grafana:
    image: grafana/grafana:latest
    ports:
      - "127.0.0.1:3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=loadtest
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
    volumes:
      - ./load-tests/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./load-tests/grafana/dashboards:/var/lib/grafana/dashboards:ro
    depends_on:
      - prometheus

  k6:
    image: grafana/k6:latest
    environment:
      - BASE_URL=http://bot:8080
      - K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write
      - K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM=true
    volumes:
      - ./load-tests/scripts:/scripts:ro
    depends_on:
      - bot
      - prometheus
    profiles:
      - test
    entrypoint: ["k6", "run", "-o", "experimental-prometheus-rw"]
```

Note: The `k6` service uses `profiles: [test]` so it doesn't start with `docker compose up`. It's invoked explicitly via `docker compose run k6 /scripts/smoke.js`.

**Step 2: Verify compose file is valid**

Run: `docker compose -f docker-compose.loadtest.yml config --quiet`

Expected: no errors

**Step 3: Commit**

```bash
git add docker-compose.loadtest.yml
git commit -m "feat: add docker-compose.loadtest.yml for k6 + Prometheus + Grafana stack"
```

---

### Task 13: Seed test data for load tests

The `LOAD_TEST_MODE` bot needs a specialist with working hours to test against. The bot's `seedLegacyData` function in `main.go` already seeds a specialist when `TELEGRAM_BOT_TOKEN` and `SPECIALIST_TELEGRAM_ID` are set. However, for load testing we need a simpler approach.

**Files:**
- Create: `load-tests/scripts/seed.js`

**Step 1: Create seed.js — a k6 script that seeds test data via admin API**

```javascript
import http from "k6/http";
import { check } from "k6";
import { BASE_URL } from "./helpers/config.js";

// This script seeds a specialist with working hours.
// Run once before other tests.
// The specialist is created by the bot on startup (via legacy env vars or master bot).
// This script just verifies data exists and sets up working hours if needed.
export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  // Use VU 1 as admin (specialist)
  const adminHeaders = {
    "Content-Type": "application/json",
    "X-Test-User-ID": "1",
  };

  // Check specialist exists
  const specRes = http.get(`${BASE_URL}/api/specialist`, {
    headers: adminHeaders,
  });
  check(specRes, {
    "specialist exists": (r) => r.status === 200,
  });

  if (specRes.status !== 200) {
    console.error("No specialist found. Ensure bot has seeded data on startup.");
    return;
  }

  const specialist = specRes.json();
  console.log(`Specialist: ${specialist.name} (ID: ${specialist.id})`);

  // Print specialist ID for use in other tests
  console.log(`\nUse SPECIALIST_ID=${specialist.id} for other test scripts`);
}
```

**Step 2: Commit**

```bash
git add load-tests/scripts/seed.js
git commit -m "feat: add k6 seed script to verify test data"
```

---

### Task 14: End-to-end verification

**Step 1: Build and start the stack**

Run:
```bash
docker compose -f docker-compose.loadtest.yml up -d --build db bot prometheus grafana
```

Expected: all 4 services start, bot connects to PostgreSQL, Prometheus scrapes `/metrics`

**Step 2: Verify metrics endpoint**

Run:
```bash
curl -s http://localhost:8082/metrics | head -20
```

Expected: Prometheus text format output with `http_requests_total`, `http_request_duration_seconds`, etc.

**Step 3: Run smoke test**

Run:
```bash
docker compose -f docker-compose.loadtest.yml run k6 /scripts/smoke.js
```

Expected: k6 output showing all checks passing, thresholds met

**Step 4: Verify Grafana dashboards**

Open `http://localhost:3001` in browser. Log in with admin/loadtest. Check both dashboards show data from the smoke test.

**Step 5: Run load test**

Run:
```bash
docker compose -f docker-compose.loadtest.yml run k6 /scripts/load.js
```

Expected: k6 completes, watch Grafana for latency/error trends during the run

**Step 6: Tear down**

Run:
```bash
docker compose -f docker-compose.loadtest.yml down -v
```

**Step 7: Final commit**

If any fixes were needed during verification, commit them. Then:

```bash
git add -A
git commit -m "feat: complete k6 + Prometheus stress testing setup"
```
