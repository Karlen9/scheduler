import http from "k6/http";
import { check, sleep, group } from "k6";
import { BASE_URL, SPECIALIST_ID } from "./helpers/config.js";
import { authHeaders } from "./helpers/auth.js";

export const options = {
  stages: [
    { duration: "2m", target: 200 }, // ramp up
    { duration: "2m", target: 500 }, // push higher
    { duration: "3m", target: 1000 }, // peak stress
    { duration: "3m", target: 1000 }, // sustained peak
    { duration: "2m", target: 0 }, // ramp down
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

    if (
      (res.status === 200 || res.status === 201) &&
      res.json() &&
      res.json().id
    ) {
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
