"use strict";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIX_CHARACTER_CODE = /^[A-Z0-9]{6}$/;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function asPercentage(value, fieldName = "Percentage") {
  const percentage = Number(value);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new TypeError(`${fieldName} must be between 0 and 100.`);
  }
  return Math.round(percentage * 100) / 100;
}

function validateMarketingMemberInput(input = {}) {
  const name = String(input.name || "").replace(/[<>]/g, "").trim().slice(0, 80);
  const loginEmail = normalizeEmail(input.loginEmail);
  const mobile = normalizeMobile(input.mobile);
  const parentMteamId = String(input.parentMteamId || "").trim().slice(0, 128);
  const referCode = normalizeCode(input.referCode);
  const commissionPercentage = asPercentage(input.commissionPercentage, "Commission percentage");
  const uplineBonusPercentage = asPercentage(
    input.uplineBonusPercentage === "" || input.uplineBonusPercentage === undefined
      ? 10
      : input.uplineBonusPercentage,
    "Upline bonus percentage",
  );

  if (!name) throw new TypeError("Member name is required.");
  if (!EMAIL_PATTERN.test(loginEmail) || loginEmail.length > 254) {
    throw new TypeError("Enter a valid login email.");
  }
  if (!/^\d{10}$/.test(mobile)) throw new TypeError("Enter a valid 10-digit mobile number.");
  if (input.referCode && !SIX_CHARACTER_CODE.test(referCode)) {
    throw new TypeError("Refer code must contain exactly 6 letters or numbers.");
  }

  return {
    name,
    loginEmail,
    mobile,
    parentMteamId,
    referCode,
    commissionPercentage,
    uplineBonusPercentage,
    active: input.active !== false,
  };
}

function validateCouponInput(input = {}) {
  const code = normalizeCode(input.code);
  const referCode = normalizeCode(input.referCode);
  const assignedMteamId = String(input.assignedMteamId || "").trim().slice(0, 128);
  const userDiscount = asPercentage(input.userDiscount, "User discount");
  const marketingPercentage = asPercentage(input.marketingPercentage, "Marketing percentage");

  if (!SIX_CHARACTER_CODE.test(code)) {
    throw new TypeError("Coupon code must contain exactly 6 letters or numbers.");
  }
  if (input.referCode && !SIX_CHARACTER_CODE.test(referCode)) {
    throw new TypeError("Refer code must contain exactly 6 letters or numbers.");
  }
  if (!assignedMteamId) throw new TypeError("Select a Marketing member.");

  return {
    code,
    referCode,
    assignedMteamId,
    userDiscount,
    marketingPercentage,
    active: input.active !== false,
  };
}

function assertWithinParentPercentage(childPercentage, parentPercentage) {
  if (parentPercentage !== null && parentPercentage !== undefined && childPercentage > parentPercentage) {
    throw new RangeError(`Child commission cannot exceed the parent's ${parentPercentage}% commission.`);
  }
}

function buildHierarchy(members = []) {
  const byId = new Map(members.map(member => [member.id, member]));
  const resolved = new Map();

  function visit(id, path = []) {
    if (resolved.has(id)) return resolved.get(id);
    if (path.includes(id)) throw new RangeError("Marketing hierarchy contains a cycle.");
    const member = byId.get(id);
    if (!member) return { level: 0, ancestorIds: [] };
    const parentId = String(member.parentMteamId || "");
    if (!parentId || !byId.has(parentId)) {
      const root = { level: 0, ancestorIds: [] };
      resolved.set(id, root);
      return root;
    }
    const parent = visit(parentId, [...path, id]);
    const result = {
      level: parent.level + 1,
      ancestorIds: [...parent.ancestorIds, parentId],
    };
    resolved.set(id, result);
    return result;
  }

  for (const member of members) visit(member.id);
  return resolved;
}

function calculateTeamBonus(revenue, memberPercentage, uplineBonusPercentage) {
  const baseCommission = Number(revenue || 0) * (Number(memberPercentage || 0) / 100);
  return Math.round(baseCommission * (Number(uplineBonusPercentage || 0) / 100) * 100) / 100;
}

module.exports = {
  EMAIL_PATTERN,
  SIX_CHARACTER_CODE,
  normalizeEmail,
  normalizeMobile,
  normalizeCode,
  asPercentage,
  validateMarketingMemberInput,
  validateCouponInput,
  assertWithinParentPercentage,
  buildHierarchy,
  calculateTeamBonus,
};
