# k6 + Prometheus Stress Testing Design

**Date**: 2026-02-20
**Goal**: Validate production readiness for ~1000 concurrent users
**Stack**: k6 load testing + Prometheus metrics + Grafana dashboards, all in Docker Compose

## 1. Go Backend Instrumentation

Add Prometheus metrics middleware to the chi router using `prometheus/client_golang`.

New file `bot/internal/api/metrics.go`:
- `http_requests_total` counter (labels: method, path, status)
- `http_request_duration_seconds` histogram (labels: method, path)
- `http_requests_in_flight` gauge

Expose `GET /metrics` endpoint outside auth middleware for Prometheus scraping.

Middleware inserted into chi chain after `RealIP`, before auth. Route labels normalized (e.g., `/api/bookings/{id}` -> `/api/bookings/:id`) to avoid high cardinality.

## 2. k6 Test Scripts

New directory `load-tests/` at project root:

| Script | VUs | Duration | Purpose |
|--------|-----|----------|---------|
| `scripts/smoke.js` | 5 | 30s | Quick sanity check: `/health`, `GET /api/specialist`, `GET /api/availability` |
| `scripts/load.js` | ramp to 200 | ~8min | Sustained load: full booking flow (browse -> create -> confirm -> cancel) |
| `scripts/stress.js` | ramp to 1000 | ~12min | Find breaking points, same flow as load test |

Helper modules:
- `scripts/helpers/auth.js` — Generate valid `X-Telegram-Init-Data` HMAC for test users
- `scripts/helpers/config.js` — Base URL, thresholds, common options

Pass/fail thresholds:
- p95 response time < 500ms
- p99 response time < 1500ms
- Error rate < 1%
- Request rate > 100 rps sustained

## 3. Docker Compose Stack

Separate file `docker-compose.loadtest.yml`:

| Service | Image | Purpose |
|---------|-------|---------|
| `bot` | Build from `./bot` | Backend under test (PostgreSQL mode) |
| `db` | postgres:16-alpine | Database |
| `prometheus` | prom/prometheus | Scrapes bot `/metrics` + receives k6 remote write |
| `grafana` | grafana/grafana | Auto-provisioned dashboards |
| `k6` | grafana/k6 | Runs load test scripts |

- Prometheus: scrape `bot:8080/metrics` every 5s, receive k6 remote write on 9090
- Grafana on port 3001 (avoids conflict with mini-app dev server on 3000)
- k6 pushes via `K6_PROMETHEUS_RW_SERVER_URL`
- Shared Docker network, k6 hits `http://bot:8080` directly

## 4. Grafana Dashboards (auto-provisioned)

**Dashboard 1 — Backend Metrics**: Request rate by endpoint, latency percentiles (p50/p95/p99), error rate, in-flight requests.

**Dashboard 2 — k6 Load Test**: Virtual users over time, request duration trends, iterations/sec, failed checks.

Dashboards provisioned via JSON files mounted into Grafana.

## 5. Test Data & Auth

Add `LOAD_TEST_MODE` env var that, when set to `true`:
- Skips Telegram HMAC validation
- Accepts `X-Test-User-ID` header as client identifier
- Only enabled in the load test compose file (never in production)

k6 setup function pre-seeds: a specialist with working hours + available durations.

## 6. Run Commands

```bash
# Start infrastructure
docker compose -f docker-compose.loadtest.yml up -d bot db prometheus grafana

# Run tests
docker compose -f docker-compose.loadtest.yml run k6 run /scripts/smoke.js
docker compose -f docker-compose.loadtest.yml run k6 run /scripts/load.js
docker compose -f docker-compose.loadtest.yml run k6 run /scripts/stress.js

# Open Grafana
open http://localhost:3001

# Tear down
docker compose -f docker-compose.loadtest.yml down -v
```

## File Structure

```
scheduler/
  load-tests/
    scripts/
      smoke.js
      load.js
      stress.js
      helpers/
        auth.js
        config.js
    prometheus/
      prometheus.yml
    grafana/
      provisioning/
        datasources/
          prometheus.yml
        dashboards/
          dashboard.yml
      dashboards/
        backend-metrics.json
        k6-results.json
  docker-compose.loadtest.yml
  bot/
    internal/api/
      metrics.go          (new)
```
