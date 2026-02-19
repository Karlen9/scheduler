import http from "k6/http";
import { check, sleep, group } from "k6";
import { BASE_URL, SPECIALIST_ID, THRESHOLDS } from "./helpers/config.js";
import { authHeaders } from "./helpers/auth.js";

export const options = {
  stages: [
    { duration: "1m", target: 50 }, // ramp up
    { duration: "1m", target: 200 }, // ramp to peak
    { duration: "5m", target: 200 }, // sustained peak
    { duration: "1m", target: 0 }, // ramp down
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
    const avail = http.get(`${BASE_URL}/api/availability?date=${futureDate}&duration=60`, {
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
    const created = createRes.status === 201 || createRes.status === 200;
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
        { headers },
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
