import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import { formatLastDownload, toDownloadDate } from "../src/Utils/lastDownload.js";

const projectRoot = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(projectRoot, path), "utf8");

test("Last Download formatting supports Firestore timestamps and missing users", () => {
  const value = { seconds: Date.UTC(2026, 8, 2, 14, 0, 0) / 1000, nanoseconds: 0 };
  assert.equal(toDownloadDate(value)?.toISOString(), "2026-09-02T14:00:00.000Z");
  assert.match(formatLastDownload(value), /02\s+Sep(?:t)?\s+2026/i);
  assert.match(formatLastDownload(value), /07:30\s*pm/i);
  assert.equal(formatLastDownload(null), "Never");
});

test("existing Admin user and lead tables reuse the users field", () => {
  const users = read("src/Pages/UserDashboard/UserDashboard.jsx");
  const leads = read("src/Pages/Leads/Leads.jsx");
  const source = `${users}\n${leads}`;

  assert.match(users, /lastDownloadAt:\s*user\.lastDownloadAt/);
  assert.match(users, /mobileLookupKey/);
  assert.match(users, /Last Download/);
  assert.match(leads, /lastDownloadAt:\s*u\.lastDownloadAt/);
  assert.match(leads, /Last Download/);
  assert.doesNotMatch(source, /collection\(db,\s*["'](?:downloads|downloadActivity|userDownloads)["']/i);
});

test("authenticated download fallback updates only the matching existing user", () => {
  const backend = read("functions/index.js");
  const start = backend.indexOf("exports.recordUserDownload");
  const end = backend.indexOf("exports.registerExpoPushToken", start);
  const callable = backend.slice(start, end);

  assert.match(callable, /region:\s*USER_ACTIVITY_REGION/);
  assert.match(callable, /if \(!request\.auth\)/);
  assert.match(callable, /authenticatedMobile\(request\)/);
  assert.match(callable, /candidate\.data\(\)\.mobileNo/);
  assert.match(callable, /lastDownloadAt:\s*FieldValue\.serverTimestamp\(\)/);
  assert.doesNotMatch(callable, /\.add\(/);
});

test("User Leads has production-safe date-wise last download counts and filters", () => {
  const leads = read("src/Pages/Leads/Leads.jsx");

  assert.match(leads, /filterDownloadFrom/);
  assert.match(leads, /filterDownloadTo/);
  assert.match(leads, /Downloaded in Range/);
  assert.match(leads, /Not Downloaded in Range/);
  assert.match(leads, /Never Downloaded/);
  assert.match(leads, /This Month/);
  assert.match(leads, /toDownloadDate\(lead\.lastDownloadAt\)/);

  // Keep the feature client-side over the already-loaded USERS.lastDownloadAt field.
  assert.doesNotMatch(leads, /collection\(db,\s*["'](?:downloads|downloadActivity|userDownloads)["']/i);
});
