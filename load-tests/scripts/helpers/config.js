// Base URL of the backend under test
export const BASE_URL = __ENV.BASE_URL || "http://bot:8080";

// Specialist ID (seeded by setup)
export const SPECIALIST_ID = __ENV.SPECIALIST_ID || "";

// Standard thresholds for pass/fail
export const THRESHOLDS = {
  http_req_duration: ["p(95)<500", "p(99)<1500"],
  http_req_failed: ["rate<0.01"],
};
