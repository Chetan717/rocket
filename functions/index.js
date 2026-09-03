/* global require, exports, Buffer */

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { defineSecret, defineString } = require("firebase-functions/params");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { promisify } = require("util");
const {
  ADMIN_OTP_RECIPIENT,
  MASKED_ADMIN_OTP_RECIPIENT,
  buildAdminOtpMessage,
} = require("./adminEmailOtp");
const {
  getRemovedTemplateStoragePaths,
  getUnreferencedTemplateStoragePaths,
} = require("./templateStorageCleanup");
const {
  normalizeEmail,
  normalizeCode,
  validateMarketingMemberInput,
  validateCouponInput,
  assertWithinParentPercentage,
  buildHierarchy,
} = require("./marketingHierarchy");

initializeApp();
const db = getFirestore();
const scrypt = promisify(crypto.scrypt);
const EMAIL_PASS = defineSecret("EMAIL_PASS");
const EXPO_ACCESS_TOKEN = defineSecret("EXPO_ACCESS_TOKEN");
const EMAIL_NODEMAILER = defineString("EMAIL_NODEMAILER", {
  default: "soilbooster717@gmail.com",
});
const REGION = "asia-south1";
const USER_ACTIVITY_REGION = "us-central1";
const TEMPLATE_STORAGE_CLEANUP_REGION = "us-central1";
const SESSION_MS = 10 * 60 * 60 * 1000;
const OTP_MS = 5 * 60 * 1000;
const OWNER_TABS = ["dashboard","companies","templates","templates_operation","templates_quality","Graphics","marketing","removebg","userdashboard","leads","adminmanagement","templatedata","taskmanagement","security","notifications"];
const EXPO_PROJECT_ID = "555505c6-41df-486d-b225-4d9832044425";
const APP_ORIGIN = "https://app.mlmlive.in";
const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";

const hash = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const safeTabs = tabs => Array.isArray(tabs) ? [...new Set(tabs.filter(x => OWNER_TABS.includes(x)))].slice(0, 20) : [];
const cleanText = (value, max = 120) => String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
const mobile10 = value => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
};
const authenticatedMobile = request => {
  const uidMatch = String(request.auth?.uid || "").match(/^mobile_(\d{10})$/);
  const candidates = [
    request.auth?.token?.mobileNo,
    request.auth?.token?.mobile,
    request.auth?.token?.phone_number,
    uidMatch?.[1],
  ];
  for (const candidate of candidates) {
    const mobile = mobile10(candidate);
    if (mobile) return mobile;
  }
  return "";
};
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
const validExpoPushToken = token => /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/.test(token);
const safeAppUrl = value => {
  try {
    const url = new URL(String(value || "/"), `${APP_ORIGIN}/`);
    return url.protocol === "https:" && url.origin === APP_ORIGIN ? url.toString() : "";
  } catch { return ""; }
};

async function requireMasterAdmin(request, message = "Only Master Admin can perform this action.") {
  const session = await requireSession(request);
  if (request.auth?.token?.actorType !== "owner" || request.auth?.token?.role !== "Master Admin") throw new HttpsError("permission-denied", message);
  return session;
}

async function requireMarketingAdmin(request) {
  const session = await requireSession(request);
  const isMaster = request.auth?.token?.actorType === "owner" && request.auth?.token?.role === "Master Admin";
  const hasMarketingTab = Array.isArray(request.auth?.token?.tabs) && request.auth.token.tabs.includes("marketing");
  if (!isMaster && !hasMarketingTab) {
    throw new HttpsError("permission-denied", "Marketing management access is required.");
  }
  return session;
}

async function sendExpoMessages(messages) {
  const accessToken = EXPO_ACCESS_TOKEN.value();
  if (!accessToken) throw new HttpsError("failed-precondition", "Expo push service is not configured.");
  const tickets = [];
  for (let index = 0; index < messages.length; index += 100) {
    const response = await fetch(EXPO_SEND_URL, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` }, body: JSON.stringify(messages.slice(index, index + 100)) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { console.error( "push request failed", { status: response.status, errors: result.errors || [] }); throw new HttpsError("unavailable", "Notification service is temporarily unavailable."); }
    tickets.push(...(Array.isArray(result.data) ? result.data : [result.data]).filter(Boolean));
  }
  return tickets;
}

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
async function ownerForEmailLogin() {
  const snap = await db.collection("adminuser").where("role", "==", "Master Admin").limit(10).get();
  const owners = snap.docs.filter(d => d.data().active === true);
  if (owners.length !== 1) {
    throw new HttpsError("failed-precondition", "Exactly one active Master Admin is required.");
  }
  return owners[0];
}
async function ownerForId(ownerId) {
  const owner = await db.collection("adminuser").doc(String(ownerId || "")).get();
  if (!owner.exists || owner.data().active !== true || owner.data().role !== "Master Admin") {
    throw new HttpsError("permission-denied", "Not authorised.");
  }
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
async function sendEmailOtp(otp) {
  const sender = String(EMAIL_NODEMAILER.value() || "").trim();
  const password = EMAIL_PASS.value();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender) || !password) {
    throw new HttpsError("failed-precondition", "Email OTP service is not configured.");
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: sender, pass: password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    await transporter.sendMail(buildAdminOtpMessage(sender, otp));
  } catch (error) {
    console.error("Admin email OTP delivery failed", { code: error?.code || "unknown" });
    throw new HttpsError("unavailable", "Email OTP could not be sent right now.");
  }
}
async function createEmailChallenge(ownerId) {
  const otp = crypto.randomInt(100000, 1000000).toString();
  const salt = crypto.randomBytes(16).toString("hex");
  const id = crypto.randomBytes(24).toString("hex");
  const ref = db.collection("_panelOtpChallenges").doc(id);
  await ref.set({ panel: "admin", delivery: "email", ownerId, recipientHash: hash(ADMIN_OTP_RECIPIENT), salt, otpHash: hash(`${salt}:${otp}`), attempts: 0, verified: false, used: false, createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + OTP_MS) });
  try {
    await sendEmailOtp(otp);
  } catch (error) {
    await ref.delete().catch(() => null);
    throw error;
  }
  return id;
}
async function verifyChallenge(id, otp) {
  const ref = db.collection("_panelOtpChallenges").doc(id), snap = await ref.get();
  if (!snap.exists) throw new HttpsError("unauthenticated", "OTP session expired.");
  const data = snap.data();
  if (data.panel !== "admin" || data.delivery !== "email" || data.used || data.expiresAt.toMillis() < Date.now()) { await ref.delete(); throw new HttpsError("unauthenticated", "OTP session expired."); }
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
  if (data.panel !== "admin" || data.delivery !== "email" || !data.verified || data.used || data.ticketExpiresAt.toMillis() < Date.now() || data.ticketHash !== hash(ticket)) throw new HttpsError("unauthenticated", "Login session expired.");
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

const millisOf = value => value?.toMillis?.() || null;
const numericPercentage = value => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
};

function validationError(error) {
  if (error instanceof TypeError || error instanceof RangeError) {
    return new HttpsError("invalid-argument", error.message);
  }
  return error;
}

async function writeInBatches(operations) {
  for (let index = 0; index < operations.length; index += 400) {
    const batch = db.batch();
    for (const operation of operations.slice(index, index + 400)) operation(batch);
    await batch.commit();
  }
}

async function revokeMarketingSessions(ownerId, reason) {
  const snapshot = await db.collection("_panelSessions").where("ownerId", "==", ownerId).get();
  const operations = snapshot.docs.map(document => batch => batch.update(document.ref, {
    revoked: true,
    revokedAt: FieldValue.serverTimestamp(),
    revokeReason: cleanText(reason, 120),
    expiresAt: Timestamp.fromMillis(0),
  }));
  if (operations.length) await writeInBatches(operations);
  await Promise.all(snapshot.docs.map(document => getAuth().revokeRefreshTokens(document.id).catch(() => null)));
}

async function hierarchyDocuments() {
  const [membersSnapshot, couponsSnapshot] = await Promise.all([
    db.collection("mteam").get(),
    db.collection("couponcode").get(),
  ]);
  const coupons = couponsSnapshot.docs.map(document => ({ id: document.id, ...document.data() }));
  const couponById = new Map(coupons.map(coupon => [coupon.id, coupon]));
  const members = membersSnapshot.docs.map(document => {
    const data = document.data();
    const coupon = couponById.get(String(data.assign_coupon_id || ""));
    const fallbackPercentage = coupon?.marketing_member_percentage;
    return {
      id: document.id,
      ...data,
      referCode: data.referCode || coupon?.referCode || "",
      commissionPercentage: data.commissionPercentage === undefined
        ? numericPercentage(fallbackPercentage)
        : numericPercentage(data.commissionPercentage),
    };
  });
  return { members, coupons, couponById };
}

async function rebuildMarketingHierarchy() {
  const snapshot = await db.collection("mteam").get();
  const members = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
  let hierarchy;
  try {
    hierarchy = buildHierarchy(members);
  } catch (error) {
    console.error("Marketing hierarchy rebuild rejected", { message: error.message });
    throw new HttpsError("failed-precondition", "Marketing hierarchy contains an invalid cycle.");
  }
  const byId = new Map(members.map(member => [member.id, member]));
  const operations = snapshot.docs.map(document => batch => {
    const info = hierarchy.get(document.id) || { level: 0, ancestorIds: [] };
    const parent = byId.get(String(document.data().parentMteamId || ""));
    batch.set(document.ref, {
      level: info.level,
      ancestorIds: info.ancestorIds,
      parentName: parent?.name || "",
      hierarchyUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  if (operations.length) await writeInBatches(operations);
}

async function parentChain(parentId, childId) {
  const ancestorIds = [];
  const visited = new Set();
  let currentId = String(parentId || "");
  let parentDocument = null;
  while (currentId) {
    if (currentId === childId || visited.has(currentId)) {
      throw new HttpsError("invalid-argument", "A member cannot be assigned below itself or its descendants.");
    }
    if (ancestorIds.length >= 25) throw new HttpsError("failed-precondition", "Marketing hierarchy is too deep.");
    visited.add(currentId);
    const snapshot = await db.collection("mteam").doc(currentId).get();
    if (!snapshot.exists) throw new HttpsError("not-found", "Selected parent Marketing member was not found.");
    if (!parentDocument) parentDocument = snapshot;
    ancestorIds.unshift(snapshot.id);
    currentId = String(snapshot.data().parentMteamId || "");
  }
  return { ancestorIds, parentDocument };
}

async function effectiveMemberPercentage(memberDocument) {
  if (!memberDocument?.exists) return null;
  const data = memberDocument.data();
  if (data.commissionPercentage !== undefined) return numericPercentage(data.commissionPercentage);
  if (!data.assign_coupon_id) return 0;
  const coupon = await db.collection("couponcode").doc(String(data.assign_coupon_id)).get();
  return coupon.exists ? numericPercentage(coupon.data().marketing_member_percentage) : 0;
}

async function ensureUniqueMarketingEmail(loginEmail, memberId) {
  const snapshot = await db.collection("mteam").where("loginEmail", "==", loginEmail).limit(2).get();
  if (snapshot.docs.some(document => document.id !== memberId)) {
    throw new HttpsError("already-exists", "This login email is already assigned to another Marketing member.");
  }
}

async function ensureUniqueCouponField(field, value, couponId, label) {
  if (!value) return;
  const snapshot = await db.collection("couponcode").where(field, "==", value).limit(2).get();
  if (snapshot.docs.some(document => document.id !== couponId)) {
    throw new HttpsError("already-exists", `${label} is already in use.`);
  }
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

// The deployed callable IDs stay unchanged so deploying this version safely
// overwrites the old SMS implementation instead of leaving it active.
exports.panelStartTwoFactorOtp = onCall({ region: REGION, cors: true, secrets: [EMAIL_PASS] }, async request => {
  const owner = await ownerForEmailLogin();
  await rateLimit("admin_email_otp_cooldown", owner.id, 1, 60000);
  await Promise.all([
    rateLimit("admin_email_otp_owner", owner.id, 3, 600000),
    rateLimit("admin_email_otp_ip", ipOf(request), 8, 600000),
  ]);
  return {
    challengeId: await createEmailChallenge(owner.id),
    delivery: "email",
    maskedEmail: MASKED_ADMIN_OTP_RECIPIENT,
  };
});
exports.panelVerifyTwoFactorOtp = onCall({ region: REGION, cors: true }, async request => {
  const id = String(request.data?.challengeId || ""), otp = String(request.data?.otp || "");
  if (!/^[a-f0-9]{48}$/.test(id) || !/^\d{6}$/.test(otp)) throw new HttpsError("invalid-argument", "Enter a valid 6-digit OTP.");
  await rateLimit("admin_verify_ip", ipOf(request), 20, 600000);
  const verified = await verifyChallenge(id, otp), owner = await ownerForId(verified.ownerId);
  return { loginTicket: verified.ticket, actors: await actorsFor(owner) };
});
exports.panelCreateSessionFromTwoFactor = onCall({ region: REGION, cors: true }, async request => {
  const challengeId = String(request.data?.challengeId || ""), ticket = String(request.data?.loginTicket || "");
  const actorId = String(request.data?.actorId || ""), password = String(request.data?.password || "");
  await rateLimit("admin_password_ip", ipOf(request), 20, 600000);
  const { ref: challengeRef, data: verified } = await readTicket(challengeId, ticket);
  const owner = await ownerForId(verified.ownerId), actor = await actorFor(owner, actorId);
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

exports.panelListMarketingHierarchy = onCall({ region: REGION, cors: true }, async request => {
  await requireMarketingAdmin(request);
  const { members, coupons } = await hierarchyDocuments();
  const byId = new Map(members.map(member => [member.id, member]));
  return {
    members: members.map(member => ({
      id: member.id,
      name: cleanText(member.name, 80),
      mobile: String(member.mobile || ""),
      loginEmail: normalizeEmail(member.loginEmail),
      active: member.active === true,
      assign_coupon_id: String(member.assign_coupon_id || ""),
      referCode: String(member.referCode || ""),
      parentMteamId: String(member.parentMteamId || ""),
      parentName: cleanText(byId.get(String(member.parentMteamId || ""))?.name, 80),
      level: Number(member.level || 0),
      ancestorIds: Array.isArray(member.ancestorIds) ? member.ancestorIds.map(String).slice(0, 25) : [],
      commissionPercentage: numericPercentage(member.commissionPercentage),
      uplineBonusPercentage: numericPercentage(member.uplineBonusPercentage === undefined ? 10 : member.uplineBonusPercentage),
      createdAt: millisOf(member.createdAt),
      updatedAt: millisOf(member.updatedAt),
    })),
    coupons: coupons.map(coupon => ({
      id: coupon.id,
      code: String(coupon.code || ""),
      referCode: String(coupon.referCode || ""),
      assigned_user: coupon.assigned_user ? {
        id: String(coupon.assigned_user.id || ""),
        name: cleanText(coupon.assigned_user.name, 80),
        mobile: String(coupon.assigned_user.mobile || ""),
      } : null,
      user_discount: numericPercentage(coupon.user_discount),
      marketing_member_percentage: numericPercentage(coupon.marketing_member_percentage),
      active: coupon.active === true,
      created_at: millisOf(coupon.created_at),
      updated_at: millisOf(coupon.updated_at),
    })),
  };
});

exports.panelUpsertMarketingMember = onCall({ region: REGION, cors: true }, async request => {
  await requireMarketingAdmin(request);
  const requestedId = String(request.data?.memberId || "").trim();
  if (requestedId && !/^[A-Za-z0-9_-]{1,128}$/.test(requestedId)) {
    throw new HttpsError("invalid-argument", "Invalid Marketing member ID.");
  }
  let input;
  try { input = validateMarketingMemberInput(request.data || {}); } catch (error) { throw validationError(error); }

  const memberRef = requestedId ? db.collection("mteam").doc(requestedId) : db.collection("mteam").doc();
  const existing = await memberRef.get();
  if (requestedId && !existing.exists) throw new HttpsError("not-found", "Marketing member was not found.");
  await ensureUniqueMarketingEmail(input.loginEmail, memberRef.id);

  let lineage = { ancestorIds: [], parentDocument: null };
  if (input.parentMteamId) lineage = await parentChain(input.parentMteamId, memberRef.id);
  const parentPercentage = await effectiveMemberPercentage(lineage.parentDocument);
  try { assertWithinParentPercentage(input.commissionPercentage, parentPercentage); } catch (error) { throw validationError(error); }

  const children = await db.collection("mteam").where("parentMteamId", "==", memberRef.id).get();
  const childPercentages = await Promise.all(children.docs.map(effectiveMemberPercentage));
  if (childPercentages.some(percentage => percentage > input.commissionPercentage)) {
    throw new HttpsError("failed-precondition", "This percentage is lower than an existing direct team member. Update the child first.");
  }

  const oldData = existing.exists ? existing.data() : {};
  const oldEmail = normalizeEmail(oldData.loginEmail);
  const newEmailIndexRef = db.collection("_marketingEmailOwners").doc(hash(input.loginEmail));
  const oldEmailIndexRef = oldEmail ? db.collection("_marketingEmailOwners").doc(hash(oldEmail)) : null;
  const assignedCouponRef = oldData.assign_coupon_id
    ? db.collection("couponcode").doc(String(oldData.assign_coupon_id))
    : null;

  await db.runTransaction(async transaction => {
    const [emailOwner, currentMember, parentSnapshot, assignedCoupon] = await Promise.all([
      transaction.get(newEmailIndexRef),
      transaction.get(memberRef),
      input.parentMteamId ? transaction.get(db.collection("mteam").doc(input.parentMteamId)) : Promise.resolve(null),
      assignedCouponRef ? transaction.get(assignedCouponRef) : Promise.resolve(null),
    ]);
    if (requestedId && !currentMember.exists) throw new HttpsError("not-found", "Marketing member was not found.");
    if (emailOwner.exists && emailOwner.data().mteamId !== memberRef.id) {
      throw new HttpsError("already-exists", "This login email is already assigned to another Marketing member.");
    }
    if (parentSnapshot && !parentSnapshot.exists) throw new HttpsError("not-found", "Selected parent Marketing member was not found.");

    const now = FieldValue.serverTimestamp();
    transaction.set(memberRef, {
      ...input,
      parentName: lineage.parentDocument?.data()?.name || "",
      level: lineage.ancestorIds.length,
      ancestorIds: lineage.ancestorIds,
      password: FieldValue.delete(),
      updatedAt: now,
      updatedByUid: request.auth.uid,
      ...(currentMember.exists ? {} : { createdAt: now, createdByUid: request.auth.uid }),
    }, { merge: true });
    transaction.set(newEmailIndexRef, {
      panel: "marketing",
      loginEmail: input.loginEmail,
      mteamId: memberRef.id,
      updatedAt: now,
    });
    if (oldEmailIndexRef && oldEmail !== input.loginEmail) transaction.delete(oldEmailIndexRef);
    if (assignedCoupon?.exists) {
      transaction.update(assignedCoupon.ref, {
        referCode: input.referCode,
        marketing_member_percentage: input.commissionPercentage,
        assigned_user: { id: memberRef.id, name: input.name, mobile: input.mobile },
        updated_at: now,
      });
    }
  });

  await rebuildMarketingHierarchy();
  const sensitiveChanged = existing.exists && (
    oldEmail !== input.loginEmail ||
    oldData.active !== input.active ||
    String(oldData.parentMteamId || "") !== input.parentMteamId
  );
  if (sensitiveChanged) await revokeMarketingSessions(memberRef.id, "Marketing account settings changed by Admin");
  await db.collection("_panelAudit").add({
    panel: "admin",
    action: existing.exists ? "marketing_member_updated" : "marketing_member_created",
    targetId: memberRef.id,
    actorUid: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true, memberId: memberRef.id };
});

exports.panelDeleteMarketingMember = onCall({ region: REGION, cors: true }, async request => {
  await requireMasterAdmin(request, "Only Master Admin can delete a Marketing member.");
  const memberId = String(request.data?.memberId || "").trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(memberId)) throw new HttpsError("invalid-argument", "Invalid Marketing member ID.");
  const memberRef = db.collection("mteam").doc(memberId);
  const member = await memberRef.get();
  if (!member.exists) throw new HttpsError("not-found", "Marketing member was not found.");
  const children = await db.collection("mteam").where("parentMteamId", "==", memberId).limit(1).get();
  if (!children.empty) throw new HttpsError("failed-precondition", "Move or remove this member's direct team before deleting the member.");

  let coupon = null;
  if (member.data().assign_coupon_id) coupon = await db.collection("couponcode").doc(String(member.data().assign_coupon_id)).get();
  if (coupon?.exists && coupon.data().code) {
    const sales = await db.collection("subscription")
      .where("couponApplied", "==", coupon.data().code)
      .where("payment", "==", "Success")
      .limit(1).get();
    if (!sales.empty) throw new HttpsError("failed-precondition", "This member has sales history. Deactivate the member instead so reports stay accurate.");
  }

  await revokeMarketingSessions(memberId, "Marketing account deleted by Master Admin");
  const team = Array.isArray(member.data().team) ? member.data().team : [];
  const credentialRefs = [memberId, ...team.map(user => user?.id).filter(Boolean)]
    .map(actorId => db.collection("_panelCredentials").doc(hash(`marketing:${memberId}:${actorId}`)));
  const email = normalizeEmail(member.data().loginEmail);
  const operations = [
    batch => batch.delete(memberRef),
    ...credentialRefs.map(ref => batch => batch.delete(ref)),
    ...(email ? [batch => batch.delete(db.collection("_marketingEmailOwners").doc(hash(email)))] : []),
    ...(coupon?.exists ? [batch => batch.update(coupon.ref, { assigned_user: null, updated_at: FieldValue.serverTimestamp() })] : []),
  ];
  await writeInBatches(operations);
  await db.collection("_panelAudit").add({ panel: "admin", action: "marketing_member_deleted", targetId: memberId, actorUid: request.auth.uid, createdAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

exports.panelUpsertMarketingCoupon = onCall({ region: REGION, cors: true }, async request => {
  await requireMarketingAdmin(request);
  const requestedId = String(request.data?.couponId || "").trim();
  if (requestedId && !/^[A-Za-z0-9_-]{1,128}$/.test(requestedId)) throw new HttpsError("invalid-argument", "Invalid coupon ID.");
  let input;
  try { input = validateCouponInput(request.data || {}); } catch (error) { throw validationError(error); }
  const couponRef = requestedId ? db.collection("couponcode").doc(requestedId) : db.collection("couponcode").doc();
  const [existing, member] = await Promise.all([
    couponRef.get(),
    db.collection("mteam").doc(input.assignedMteamId).get(),
  ]);
  if (requestedId && !existing.exists) throw new HttpsError("not-found", "Coupon was not found.");
  if (!member.exists) throw new HttpsError("not-found", "Assigned Marketing member was not found.");
  if (member.data().assign_coupon_id && member.data().assign_coupon_id !== couponRef.id) {
    throw new HttpsError("failed-precondition", "This member already has another coupon assigned.");
  }
  await Promise.all([
    ensureUniqueCouponField("code", input.code, couponRef.id, "Coupon code"),
    ensureUniqueCouponField("referCode", input.referCode, couponRef.id, "Refer code"),
  ]);

  let parent = null;
  if (member.data().parentMteamId) parent = await db.collection("mteam").doc(String(member.data().parentMteamId)).get();
  const parentPercentage = await effectiveMemberPercentage(parent);
  try { assertWithinParentPercentage(input.marketingPercentage, parentPercentage); } catch (error) { throw validationError(error); }
  const children = await db.collection("mteam").where("parentMteamId", "==", member.id).get();
  const childPercentages = await Promise.all(children.docs.map(effectiveMemberPercentage));
  if (childPercentages.some(percentage => percentage > input.marketingPercentage)) {
    throw new HttpsError("failed-precondition", "This percentage is lower than an existing direct team member. Update the child first.");
  }

  const oldMemberId = existing.exists ? String(existing.data().assigned_user?.id || "") : "";
  const oldMemberRef = oldMemberId && oldMemberId !== member.id ? db.collection("mteam").doc(oldMemberId) : null;
  const codeIndexRef = db.collection("_marketingCouponCodes").doc(hash(input.code));
  const referIndexRef = input.referCode ? db.collection("_marketingReferCodes").doc(hash(input.referCode)) : null;
  const oldCode = existing.exists ? normalizeCode(existing.data().code) : "";
  const oldReferCode = existing.exists ? normalizeCode(existing.data().referCode) : "";
  await db.runTransaction(async transaction => {
    const [currentCoupon, currentMember, oldMember, codeOwner, referOwner] = await Promise.all([
      transaction.get(couponRef),
      transaction.get(member.ref),
      oldMemberRef ? transaction.get(oldMemberRef) : Promise.resolve(null),
      transaction.get(codeIndexRef),
      referIndexRef ? transaction.get(referIndexRef) : Promise.resolve(null),
    ]);
    if (requestedId && !currentCoupon.exists) throw new HttpsError("not-found", "Coupon was not found.");
    if (!currentMember.exists) throw new HttpsError("not-found", "Assigned Marketing member was not found.");
    if (currentMember.data().assign_coupon_id && currentMember.data().assign_coupon_id !== couponRef.id) {
      throw new HttpsError("failed-precondition", "This member already has another coupon assigned.");
    }
    if (codeOwner.exists && codeOwner.data().couponId !== couponRef.id) throw new HttpsError("already-exists", "Coupon code is already in use.");
    if (referOwner?.exists && referOwner.data().couponId !== couponRef.id) throw new HttpsError("already-exists", "Refer code is already in use.");
    const now = FieldValue.serverTimestamp();
    if (oldMember?.exists && oldMember.data().assign_coupon_id === couponRef.id) {
      transaction.update(oldMember.ref, { assign_coupon_id: "", referCode: "", updatedAt: now });
    }
    transaction.set(couponRef, {
      code: input.code,
      referCode: input.referCode,
      assigned_user: { id: member.id, name: cleanText(member.data().name, 80), mobile: String(member.data().mobile || "") },
      user_discount: input.userDiscount,
      marketing_member_percentage: input.marketingPercentage,
      active: input.active,
      updated_at: now,
      updatedByUid: request.auth.uid,
      ...(currentCoupon.exists ? {} : { created_at: now, createdByUid: request.auth.uid }),
    }, { merge: true });
    transaction.update(member.ref, {
      assign_coupon_id: couponRef.id,
      referCode: input.referCode,
      commissionPercentage: input.marketingPercentage,
      password: FieldValue.delete(),
      updatedAt: now,
    });
    transaction.set(codeIndexRef, { code: input.code, couponId: couponRef.id, updatedAt: now });
    if (referIndexRef) transaction.set(referIndexRef, { referCode: input.referCode, couponId: couponRef.id, updatedAt: now });
    if (oldCode && oldCode !== input.code) transaction.delete(db.collection("_marketingCouponCodes").doc(hash(oldCode)));
    if (oldReferCode && oldReferCode !== input.referCode) transaction.delete(db.collection("_marketingReferCodes").doc(hash(oldReferCode)));
  });
  await db.collection("_panelAudit").add({ panel: "admin", action: existing.exists ? "marketing_coupon_updated" : "marketing_coupon_created", targetId: couponRef.id, actorUid: request.auth.uid, createdAt: FieldValue.serverTimestamp() });
  return { ok: true, couponId: couponRef.id };
});

exports.panelDeleteMarketingCoupon = onCall({ region: REGION, cors: true }, async request => {
  await requireMasterAdmin(request, "Only Master Admin can delete a Marketing coupon.");
  const couponId = String(request.data?.couponId || "").trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(couponId)) throw new HttpsError("invalid-argument", "Invalid coupon ID.");
  const couponRef = db.collection("couponcode").doc(couponId);
  const coupon = await couponRef.get();
  if (!coupon.exists) throw new HttpsError("not-found", "Coupon was not found.");
  if (coupon.data().code) {
    const sales = await db.collection("subscription")
      .where("couponApplied", "==", coupon.data().code)
      .where("payment", "==", "Success")
      .limit(1).get();
    if (!sales.empty) throw new HttpsError("failed-precondition", "This coupon has sales history. Deactivate it instead so reports stay accurate.");
  }
  await db.runTransaction(async transaction => {
    const current = await transaction.get(couponRef);
    if (!current.exists) throw new HttpsError("not-found", "Coupon was not found.");
    const currentMemberId = String(current.data().assigned_user?.id || "");
    if (currentMemberId) {
      const memberRef = db.collection("mteam").doc(currentMemberId);
      const member = await transaction.get(memberRef);
      if (member.exists && member.data().assign_coupon_id === couponId) {
        transaction.update(memberRef, { assign_coupon_id: "", referCode: "", updatedAt: FieldValue.serverTimestamp() });
      }
    }
    const code = normalizeCode(current.data().code), referCode = normalizeCode(current.data().referCode);
    if (code) transaction.delete(db.collection("_marketingCouponCodes").doc(hash(code)));
    if (referCode) transaction.delete(db.collection("_marketingReferCodes").doc(hash(referCode)));
    transaction.delete(couponRef);
  });
  await db.collection("_panelAudit").add({ panel: "admin", action: "marketing_coupon_deleted", targetId: couponId, actorUid: request.auth.uid, createdAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

exports.recordUserDownload = onCall(
  { region: USER_ACTIVITY_REGION, cors: true },
  async request => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Please login again.");
    }

    const mobile = authenticatedMobile(request);
    if (!mobile) {
      throw new HttpsError(
        "failed-precondition",
        "Verified mobile identity is missing.",
      );
    }

    const requestedId = String(
      request.data?.userDocumentId || "",
    ).trim();
    let userDocument = null;

    if (/^[A-Za-z0-9_-]{1,128}$/.test(requestedId)) {
      const candidate = await db.collection("users").doc(requestedId).get();
      if (
        candidate.exists &&
        mobile10(
          candidate.data().mobileNo ||
            candidate.data().mobile ||
            candidate.data().phone,
        ) === mobile
      ) {
        userDocument = candidate;
      }
    }

    if (!userDocument) {
      const mobileValues = [
        mobile,
        Number(mobile),
        `91${mobile}`,
        `+91${mobile}`,
      ];
      const byMobileNo = await db
        .collection("users")
        .where("mobileNo", "in", mobileValues)
        .limit(5)
        .get();
      userDocument =
        byMobileNo.docs.find(
          document =>
            mobile10(document.data().mobileNo) === mobile,
        ) || null;
    }

    if (!userDocument) {
      throw new HttpsError("not-found", "User account was not found.");
    }

    await userDocument.ref.update({
      lastDownloadAt: FieldValue.serverTimestamp(),
    });
    return { ok: true };
  },
);

exports.registerExpoPushToken = onRequest({ region: REGION, cors: true }, async (request, response) => {
  response.set("Cache-Control", "no-store");
  if (request.method !== "POST") { response.status(405).json({ ok: false }); return; }
  const token = cleanText(request.body?.token, 255), platform = cleanText(request.body?.platform, 20), projectId = cleanText(request.body?.projectId, 80);
  if (!validExpoPushToken(token) || !["android", "ios"].includes(platform) || projectId !== EXPO_PROJECT_ID) { response.status(422).json({ ok: false, error: "Invalid registration" }); return; }
  try {
    await rateLimit("push_register_ip", ipOf({ rawRequest: request }), 80, 10 * 60 * 1000);
    const ref = db.collection("_expoPushDevices").doc(hash(`expo:${token}`)), existing = await ref.get();
    await ref.set({ token, platform, projectId, active: true, lastSeenAt: FieldValue.serverTimestamp(), ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true });
    response.status(200).json({ ok: true });
  } catch (error) { const limited = error?.code === "resource-exhausted"; response.status(limited ? 429 : 500).json({ ok: false, error: limited ? "Try later" : "Server error" }); }
});

exports.panelPushOverview = onCall({ region: REGION, cors: true }, async request => {
  await requireMasterAdmin(request);
  const [devices, campaigns] = await Promise.all([db.collection("_expoPushDevices").where("active", "==", true).count().get(), db.collection("_pushCampaigns").orderBy("createdAt", "desc").limit(20).get()]);
  return { deviceCount: devices.data().count, campaigns: campaigns.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toMillis?.() || null })) };
});

exports.panelDeletePushCampaigns = onCall({ region: REGION, cors: true }, async request => {
  await requireMasterAdmin(request, "Only Master Admin can delete notification history.");
  const clearAll = request.data?.clearAll === true;
  const ids = [...new Set((Array.isArray(request.data?.campaignIds) ? request.data.campaignIds : [])
    .map(value => String(value || "").trim())
    .filter(value => /^[A-Za-z0-9_-]{1,128}$/.test(value)))]
    .slice(0, 100);
  if (!clearAll && ids.length === 0) throw new HttpsError("invalid-argument", "Select at least one notification.");
  const documents = clearAll
    ? (await db.collection("_pushCampaigns").get()).docs
    : (await Promise.all(ids.map(id => db.collection("_pushCampaigns").doc(id).get()))).filter(document => document.exists);
  if (documents.length) await writeInBatches(documents.map(document => batch => batch.delete(document.ref)));
  await db.collection("_panelAudit").add({
    panel: "admin",
    action: clearAll ? "push_history_cleared" : "push_history_deleted",
    deletedCount: documents.length,
    actorUid: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true, deletedCount: documents.length };
});

exports.panelSendPushNotification = onCall({ region: REGION, cors: true, secrets: [EXPO_ACCESS_TOKEN] }, async request => {
  const { data: session } = await requireMasterAdmin(request);
  await rateLimit("admin_push_send", request.auth.uid, 20, 60 * 60 * 1000);
  const title = cleanText(request.data?.title, 100), body = cleanText(request.data?.body, 1000), url = safeAppUrl(request.data?.url);
  if (!title || !body || !url) throw new HttpsError("invalid-argument", "Enter a valid title, message and MLM LIVE page URL.");
  const snapshot = await db.collection("_expoPushDevices").where("active", "==", true).limit(10000).get();
  if (snapshot.empty) throw new HttpsError("failed-precondition", "No app devices are registered yet.");
  const messages = snapshot.docs.filter(doc => validExpoPushToken(doc.data().token)).map(doc => ({ to: doc.data().token, title, body, data: { url }, priority: "high", sound: "default", channelId: "default" }));
  const tickets = await sendExpoMessages(messages), accepted = tickets.filter(ticket => ticket.status === "ok").length, rejected = tickets.length - accepted;
  await db.collection("_pushCampaigns").add({ title, body, url, targeted: messages.length, accepted, rejected, createdAt: FieldValue.serverTimestamp(), createdByUid: request.auth.uid, createdByName: request.auth.token.name || session.actorName || "Master Admin" });
  return { targeted: messages.length, accepted, rejected };
});
