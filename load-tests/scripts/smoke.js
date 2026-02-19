import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, SPECIALIST_ID, THRESHOLDS } from "./helpers/config.js";
import { authHeaders } from "./helpers/auth.js";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: THRESHOLDS,
};

// Setup: verify specialist exists
export function setup() {
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    "health check returns 200": (r) => r.status === 200,
    "health check returns OK": (r) => r.body === "OK",
  });

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

  // GET /api/availability (today)
  const today = new Date().toISOString().split("T")[0];
  const avail = http.get(`${BASE_URL}/api/availability?date=${today}`, {
    headers,
  });
  check(avail, { "availability 200": (r) => r.status === 200 });

  sleep(1);
}
