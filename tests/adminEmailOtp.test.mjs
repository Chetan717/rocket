import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  ADMIN_OTP_RECIPIENT,
  MASKED_ADMIN_OTP_RECIPIENT,
  buildAdminOtpMessage,
} = require("../functions/adminEmailOtp.js");

const readSource = (relativePath) => (
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8")
);

test("Admin OTP email is always addressed to the fixed mailbox", () => {
  const message = buildAdminOtpMessage("sender@gmail.com", "123456");

  assert.equal(ADMIN_OTP_RECIPIENT, "mlmliveapp@gmail.com");
  assert.equal(MASKED_ADMIN_OTP_RECIPIENT, "ml***@gmail.com");
  assert.equal(message.to, ADMIN_OTP_RECIPIENT);
  assert.match(message.from, /sender@gmail\.com/);
  assert.match(message.text, /123456/);
  assert.match(message.html, /123456/);
  assert.match(message.text, /5 minutes/);
});

test("Admin OTP message accepts only a six-digit code", () => {
  assert.throws(() => buildAdminOtpMessage("sender@gmail.com", "1234"), /6-digit/);
  assert.throws(() => buildAdminOtpMessage("sender@gmail.com", "1234567"), /6-digit/);
});

test("backend uses Nodemailer and no longer contains the SMS provider", async () => {
  const [backend, packageJson] = await Promise.all([
    readSource("functions/index.js"),
    readSource("functions/package.json"),
  ]);

  assert.match(backend, /require\(["']nodemailer["']\)/);
  assert.match(backend, /defineSecret\(["']EMAIL_PASS["']\)/);
  assert.match(backend, /defineString\(["']EMAIL_NODEMAILER["']/);
  assert.match(backend, /host:\s*["']smtp\.gmail\.com["']/);
  assert.match(backend, /secrets:\s*\[EMAIL_PASS\]/);
  assert.doesNotMatch(backend, /2factor\.in/i);
  assert.doesNotMatch(backend, /TWOFACTOR_API_KEY/);
  assert.match(packageJson, /["']nodemailer["']/);
});

test("Admin login UI has email OTP only and no mobile OTP input", async () => {
  const login = await readSource("src/Auth/SecureLogin.jsx");

  assert.match(login, /Send Email OTP/);
  assert.match(login, /Verify Email OTP/);
  assert.match(login, /\^\\d\{6\}\$/);
  assert.match(login, /panelStartTwoFactorOtp["']\)\(\{\}\)/);
  assert.doesNotMatch(login, /Owner mobile/);
  assert.doesNotMatch(login, /autoComplete=["']tel["']/);
  assert.doesNotMatch(login, /request\.data\?\.mobile/);
});
