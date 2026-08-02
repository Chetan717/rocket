/* global require, exports, Buffer */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { defineSecret } = require("firebase-functions/params");
const crypto = require("crypto");
const { promisify } = require("util");
const {
  getRemovedTemplateStoragePaths,
  getUnreferencedTemplateStoragePaths,
} = require("./templateStorageCleanup");

initializeApp();
const db = getFirestore();
const scrypt = promisify(crypto.scrypt);
const TWOFACTOR_API_KEY = defineSecret("TWOFACTOR_API_KEY");
const REGION = "asia-south1";
const TEMPLATE_STORAGE_CLEANUP_REGION = "us-central1";
const SESSION_MS = 10 * 60 * 60 * 1000;
const OTP_MS = 5 * 60 * 1000;
const OWNER_TABS = ["dashboard","companies","templates","templates_operation","templates_quality","Graphics","marketing","removebg","userdashboard","leads","adminmanagement","templatedata","taskmanagement","security"];

const mobile10 = value => String(value || "").replace(/\D/g, "").slice(-10);
const hash = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const safeTabs = tabs => Array.isArray(tabs) ? [...new Set(tabs.filter(x => OWNER_TABS.includes(x)))].slice(0, 20) : [];
const cleanText = (value, max = 120) => String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
const ipOf = request => String(request.rawRequest?.headers?.["x-forwarded-for"] || request.rawRequest?.ip || "Unavailable").split(",")[0].trim();
const locationOf = request => {
  const h = request.rawRequest?.headers || {};
  return [h["x-appengine-city"], h["x-appengine-region"], h["x-appengine-country"]]
    .filter(Boolean).map(x => cleanText(x, 60)).join(", ") || "Location unavailable";
};
const deviceOf = request => ({
  label: cleanText(request.data?.device?.label || "Unknown device", 100),
  browser: cleanText(request.data?.device?.browser || "Unknown browser", 60),
  os: cleanText(request.data?.device?.os || "Unknown OS", 60),
  language: cleanText(request.data?.device?.language || "", 20),
  timezone: cleanText(request.data?.device?.timezone || "", 60),
  userAgent: cleanText(request.rawRequest?.headers?.["user-agent"] || "", 300),
});

function strongPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 12 &&
    /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}
function passwordError() {
  return new HttpsError("invalid-argument", "Password must be 8–12 characters with uppercase, lowercase, number and special character.");
}
async function rateLimit(bucket, key, max, windowMs) {
  const ref = db.collection("_panelLoginLimits").doc(hash(`${bucket}:${key}`));
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref), now = Date.now(), data = snap.exists ? snap.data() : {};
    const same = now - Number(data.windowStart || 0) < windowMs;
    const count = same ? Number(data.count || 0) : 0;
    if (count >= max) throw new HttpsError("resource-exhausted", "Too many attempts. Try again later.");
    tx.set(ref, { bucket, count: count + 1, windowStart: same ? data.windowStart : now, expiresAt: Timestamp.fromMillis(now + windowMs) });
  });
}
async function ownerFor(mobile) {
  const snap = await db.collection("adminuser").where("mobile", "==", mobile).limit(10).get();
  const owner = snap.docs.find(d => d.data().active === true && d.data().role === "Master Admin");
  if (!owner) throw new HttpsError("permission-denied", "Not authorised.");
  return owner;
}
async function actorsFor(owner) {
  const subs = await db.collection("adminuser").where("ownerAdminId", "==", owner.id).where("active", "==", true).get();
  const actors = [
    { id: owner.id, name: owner.data().name || "Master Admin", role: "Master Admin", actorType: "owner" },
    ...subs.docs.filter(d => d.id !== owner.id).map(d => ({ id: d.id, name: d.data().name || "Admin", role: d.data().role || "Admin", actorType: "subuser" })),
  ];
  const creds = await Promise.all(actors.map(a => db.collection("_panelCredentials").doc(hash(`admin:${owner.id}:${a.id}`)).get()));
  return actors.map((a, i) => ({ ...a, passwordConfigured: creds[i].exists }));
}
async function actorFor(owner, actorId) {
  if (actorId === owner.id) return { id: owner.id, ...owner.data(), actorType: "owner" };
  const snap = await db.collection("adminuser").doc(actorId).get();
  if (!snap.exists || snap.data().active !== true || snap.data().ownerAdminId !== owner.id) throw new HttpsError("permission-denied", "Actor not authorised.");
  return { id: snap.id, ...snap.data(), actorType: "subuser" };
}
async function sendOtp(mobile, otp) {
  const key = TWOFACTOR_API_KEY.value();
  if (!key) throw new HttpsError("failed-precondition", "OTP service is not configured.");
  try {
    const response = await fetch(`https://2factor.in/API/V1/${encodeURIComponent(key)}/SMS/+91${mobile}/${otp}/OTP`, { signal: AbortSignal.timeout(10000) });
    const body = await response.json();
    if (!response.ok || body?.Status !== "Success") throw new Error("send failed");
  } catch { throw new HttpsError("unavailable", "OTP could not be sent right now."); }
}
async function createChallenge(mobile, ownerId) {
  const otp = crypto.randomInt(1000, 10000).toString();
  const salt = crypto.randomBytes(16).toString("hex");
  const id = crypto.randomBytes(24).toString("hex");
  await sendOtp(mobile, otp);
  await db.collection("_panelOtpChallenges").doc(id).set({ panel: "admin", mobile, ownerId, salt, otpHash: hash(`${salt}:${otp}`), attempts: 0, verified: false, used: false, createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + OTP_MS) });
  return id;
}
async function verifyChallenge(id, otp) {
  const ref = db.collection("_panelOtpChallenges").doc(id), snap = await ref.get();
  if (!snap.exists) throw new HttpsError("unauthenticated", "OTP session expired.");
  const data = snap.data();
  if (data.panel !== "admin" || data.used || data.expiresAt.toMillis() < Date.now()) { await ref.delete(); throw new HttpsError("unauthenticated", "OTP session expired."); }
  if (Number(data.attempts || 0) >= 5) { await ref.delete(); throw new HttpsError("resource-exhausted", "Too many incorrect attempts."); }
  if (hash(`${data.salt}:${otp}`) !== data.otpHash) { await ref.update({ attempts: FieldValue.increment(1) }); throw new HttpsError("unauthenticated", "Incorrect OTP."); }
  const ticket = crypto.randomBytes(32).toString("hex");
  await ref.update({ verified: true, ticketHash: hash(ticket), ticketExpiresAt: Timestamp.fromMillis(Date.now() + OTP_MS), otpHash: FieldValue.delete(), salt: FieldValue.delete() });
  return { ...data, ticket };
}
async function readTicket(id, ticket) {
  const ref = db.collection("_panelOtpChallenges").doc(id), snap = await ref.get();
  if (!snap.exists) throw new HttpsError("unauthenticated", "Login session expired.");
  const data = snap.data();
  if (data.panel !== "admin" || !data.verified || data.used || data.ticketExpiresAt.toMillis() < Date.now() || data.ticketHash !== hash(ticket)) throw new HttpsError("unauthenticated", "Login session expired.");
  return { ref, data };
}
async function passwordHash(password, salt) { return (await scrypt(password, salt, 64)).toString("hex"); }
async function verifyOrCreatePassword(ownerId, actorId, password, allowCreate) {
  if (!strongPassword(password)) throw passwordError();
  const ref = db.collection("_panelCredentials").doc(hash(`admin:${ownerId}:${actorId}`)), snap = await ref.get();
  if (!snap.exists) {
    if (!allowCreate) throw new HttpsError("failed-precondition", "Set password using OTP login first.");
    const salt = crypto.randomBytes(24).toString("hex");
    await ref.create({ panel: "admin", ownerId, actorId, salt, passwordHash: await passwordHash(password, salt), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    return;
  }
  const data = snap.data(), actual = await passwordHash(password, data.salt);
  const a = Buffer.from(actual, "hex"), b = Buffer.from(String(data.passwordHash || ""), "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpsError("unauthenticated", "Incorrect password.");
}
function sessionPublic(doc) {
  const d = doc.data();
  return { id: doc.id, actorId: d.actorId, actorName: d.actorName, actorType: d.actorType, ip: d.ip, location: d.location, device: d.device, createdAt: d.createdAt?.toMillis?.() || null, lastSeenAt: d.lastSeenAt?.toMillis?.() || null, expiresAt: d.expiresAt?.toMillis?.() || null, revoked: d.revoked === true };
}
async function requireSession(request) {
  if (request.auth?.token?.panel !== "admin") throw new HttpsError("unauthenticated", "Sign in required.");
  const ref = db.collection("_panelSessions").doc(request.auth.uid), snap = await ref.get();
  if (!snap.exists || snap.data().panel !== "admin" || snap.data().revoked === true || snap.data().expiresAt.toMillis() <= Date.now()) throw new HttpsError("unauthenticated", "Session expired.");
  return { ref, data: snap.data() };
}

async function deleteTemplateStoragePaths(bucket, paths) {
  const failures = [];
  const batchSize = 20;

  for (let index = 0; index < paths.length; index += batchSize) {
    const batch = paths.slice(index, index + batchSize);
    const results = await Promise.allSettled(
      batch.map((path) => bucket.file(path).delete({ ignoreNotFound: true })),
    );

    results.forEach((result, resultIndex) => {
      if (result.status === "rejected") {
        failures.push({
          path: batch[resultIndex],
          reason: result.reason,
        });
      }
    });
  }

  if (failures.length) {
    console.error("Template Storage cleanup failed", {
      failedObjects: failures.map(({ path }) => path),
    });
    throw failures[0].reason;
  }
}

/**
 * Storage cleanup is server-owned so it works for every authorised Admin role
 * and every UI/code path that updates or deletes an mlmtemplate document.
 */
exports.cleanupTemplateStorageOnWrite = onDocumentWritten(
  {
    document: "mlmtemplate/{templateId}",
    region: TEMPLATE_STORAGE_CLEANUP_REGION,
    retry: true,
  },
  async (event) => {
    const beforeSnapshot = event.data?.before;
    const afterSnapshot = event.data?.after;

    // Creates cannot make an existing Storage object orphaned.
    if (!beforeSnapshot?.exists) return;

    const beforeData = beforeSnapshot.data() || {};
    const afterData = afterSnapshot?.exists ? (afterSnapshot.data() || {}) : {};
    const bucket = getStorage().bucket();
    const removedPaths = getRemovedTemplateStoragePaths(
      beforeData,
      afterData,
      bucket.name,
    );

    let deletedCount = 0;
    let sharedCount = 0;

    if (removedPaths.length) {
      // A Storage URL can be intentionally reused. Scan the current template
      // documents and delete only objects that have no remaining reference.
      const currentTemplatesSnapshot = await db.collection("mlmtemplate").get();
      const currentTemplates = currentTemplatesSnapshot.docs.map((document) => (
        document.data()
      ));
      const unreferencedPaths = getUnreferencedTemplateStoragePaths(
        removedPaths,
        currentTemplates,
        bucket.name,
      );

      await deleteTemplateStoragePaths(bucket, unreferencedPaths);
      deletedCount = unreferencedPaths.length;
      sharedCount = removedPaths.length - deletedCount;
    }

    // The per-template quality document must not remain after full deletion.
    if (!afterSnapshot?.exists) {
      await db.collection("templatequality").doc(event.params.templateId).delete();
    }

    console.info("Template Storage cleanup complete", {
      templateId: event.params.templateId,
      removedReferences: removedPaths.length,
      deletedObjects: deletedCount,
      retainedSharedObjects: sharedCount,
      templateDeleted: !afterSnapshot?.exists,
    });
  },
);

exports.panelStartTwoFactorOtp = onCall({ region: REGION, cors: true, secrets: [TWOFACTOR_API_KEY] }, async request => {
  const mobile = mobile10(request.data?.mobile);
  if (!/^\d{10}$/.test(mobile)) throw new HttpsError("invalid-argument", "Invalid mobile number.");
  await Promise.all([rateLimit("admin_otp_mobile", mobile, 3, 600000), rateLimit("admin_otp_ip", ipOf(request), 8, 600000)]);
  const owner = await ownerFor(mobile);
  return { challengeId: await createChallenge(mobile, owner.id) };
});
exports.panelVerifyTwoFactorOtp = onCall({ region: REGION, cors: true }, async request => {
  const id = String(request.data?.challengeId || ""), otp = String(request.data?.otp || "");
  if (!/^[a-f0-9]{48}$/.test(id) || !/^\d{4}$/.test(otp)) throw new HttpsError("invalid-argument", "Enter a valid OTP.");
  await rateLimit("admin_verify_ip", ipOf(request), 20, 600000);
  const verified = await verifyChallenge(id, otp), owner = await ownerFor(verified.mobile);
  return { loginTicket: verified.ticket, actors: await actorsFor(owner) };
});
exports.panelCreateSessionFromTwoFactor = onCall({ region: REGION, cors: true }, async request => {
  const challengeId = String(request.data?.challengeId || ""), ticket = String(request.data?.loginTicket || "");
  const actorId = String(request.data?.actorId || ""), password = String(request.data?.password || "");
  await rateLimit("admin_password_ip", ipOf(request), 20, 600000);
  const { ref: challengeRef, data: verified } = await readTicket(challengeId, ticket);
  const owner = await ownerFor(verified.mobile), actor = await actorFor(owner, actorId);
  await verifyOrCreatePassword(owner.id, actor.id, password, true);
  await challengeRef.update({ used: true, ticketHash: FieldValue.delete() });
  const tabs = actor.actorType === "owner" ? OWNER_TABS : safeTabs(actor.assigntab);
  const claims = { panel: "admin", actorType: actor.actorType, adminId: actor.id, ownerAdminId: owner.id, name: cleanText(actor.name || "Admin", 80), role: actor.role || "Admin", tabs };
  const uid = `panel_${hash(`admin:${owner.id}:${actor.id}:${crypto.randomBytes(24).toString("hex")}`).slice(0, 48)}`;
  const prior = await db.collection("_panelSessions").where("ownerId", "==", owner.id).get();
  const previous = prior.docs.map(sessionPublic).filter(s => s.actorId === actor.id).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0))[0] || null;
  const now = Timestamp.now(), expiresAt = Timestamp.fromMillis(Date.now() + SESSION_MS);
  await db.collection("_panelSessions").doc(uid).set({ panel: "admin", ownerId: owner.id, actorId: actor.id, actorName: claims.name, actorType: actor.actorType, ip: ipOf(request), location: locationOf(request), device: deviceOf(request), createdAt: now, lastSeenAt: now, expiresAt, revoked: false });
  return { token: await getAuth().createCustomToken(uid, claims), expiresAt: expiresAt.toMillis(), loginAlert: previous };
});
exports.panelSessionStatus = onCall({ region: REGION, cors: true }, async request => {
  const { ref, data } = await requireSession(request);
  await ref.update({ lastSeenAt: FieldValue.serverTimestamp() });
  return { valid: true, expiresAt: data.expiresAt.toMillis() };
});
exports.panelUnlockSession = onCall({ region: REGION, cors: true }, async request => {
  const { ref, data } = await requireSession(request);
  await rateLimit("admin_unlock", `${request.auth.uid}:${ipOf(request)}`, 10, 900000);
  await verifyOrCreatePassword(data.ownerId, data.actorId, String(request.data?.password || ""), false);
  await ref.update({ lastSeenAt: FieldValue.serverTimestamp(), lastUnlockAt: FieldValue.serverTimestamp() });
  return { ok: true };
});
exports.panelListSessions = onCall({ region: REGION, cors: true }, async request => {
  const { data } = await requireSession(request);
  const snap = await db.collection("_panelSessions").where("ownerId", "==", data.ownerId).get();
  const all = request.auth.token.actorType === "owner";
  return { currentSessionId: request.auth.uid, sessions: snap.docs.map(sessionPublic).filter(s => all || s.actorId === data.actorId).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 100) };
});
exports.panelRevokeSession = onCall({ region: REGION, cors: true }, async request => {
  const { data } = await requireSession(request), id = String(request.data?.sessionId || "");
  const target = await db.collection("_panelSessions").doc(id).get();
  if (!target.exists || target.data().ownerId !== data.ownerId || (request.auth.token.actorType !== "owner" && target.data().actorId !== data.actorId)) throw new HttpsError("permission-denied", "Not authorised.");
  await target.ref.update({ revoked: true, revokedAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(0) });
  try { await getAuth().revokeRefreshTokens(id); } catch { /* session denial is immediate */ }
  return { ok: true, current: id === request.auth.uid };
});
exports.panelLogout = onCall({ region: REGION, cors: true }, async request => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Not signed in.");
  await db.collection("_panelSessions").doc(request.auth.uid).delete();
  try { await getAuth().revokeRefreshTokens(request.auth.uid); } catch { /* deleted session denies access */ }
  return { ok: true };
});
exports.purgeLegacyPanelSecrets = onCall({ region: REGION, cors: true }, async request => {
  await requireSession(request);
  if (request.auth.token.actorType !== "owner" || request.auth.token.role !== "Master Admin") throw new HttpsError("permission-denied", "Not authorised.");
  const admins = await db.collection("adminuser").get(); let batch = db.batch(), count = 0;
  for (const doc of admins.docs) {
    const updates = {};
    if (doc.data().pin !== undefined) updates.pin = FieldValue.delete();
    if (doc.data().password !== undefined) updates.password = FieldValue.delete();
    if (Object.keys(updates).length) { batch.update(doc.ref, updates); count++; }
  }
  if (count) await batch.commit();
  return { purged: count };
});
