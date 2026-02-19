// In LOAD_TEST_MODE, auth is simplified to just an X-Test-User-ID header.
// Each VU gets a unique user ID based on VU number + iteration.
export function authHeaders(vuId, specialistId) {
  return {
    "Content-Type": "application/json",
    "X-Test-User-ID": String(100000 + vuId),
    "X-Specialist-ID": specialistId,
  };
}
