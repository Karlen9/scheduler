import http from "k6/http";
import { check } from "k6";
import { BASE_URL } from "./helpers/config.js";

// This script verifies a specialist exists and prints its ID.
// Run once before other tests.
// The specialist is created by the bot on startup (via legacy env vars or master bot).
export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  const adminHeaders = {
    "Content-Type": "application/json",
    "X-Test-User-ID": "1",
  };

  const specRes = http.get(`${BASE_URL}/api/specialist`, {
    headers: adminHeaders,
  });
  check(specRes, {
    "specialist exists": (r) => r.status === 200,
  });

  if (specRes.status !== 200) {
    console.error(
      "No specialist found. Ensure bot has seeded data on startup.",
    );
    return;
  }

  const specialist = specRes.json();
  console.log(`Specialist: ${specialist.name} (ID: ${specialist.id})`);
  console.log(`\nUse SPECIALIST_ID=${specialist.id} for other test scripts`);
}
