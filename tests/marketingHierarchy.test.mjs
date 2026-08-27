import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  normalizeEmail,
  validateMarketingMemberInput,
  assertWithinParentPercentage,
  buildHierarchy,
  calculateTeamBonus,
} = require("../functions/marketingHierarchy.js");

test("Marketing member login email and percentages are normalized", () => {
  const member = validateMarketingMemberInput({
    name: " Asha ", loginEmail: " ASHA@Example.COM ", mobile: "+91 98765 43210",
    commissionPercentage: "10", uplineBonusPercentage: "10", referCode: "abc123", active: true,
  });
  assert.equal(normalizeEmail(" Test@Example.COM "), "test@example.com");
  assert.equal(member.loginEmail, "asha@example.com");
  assert.equal(member.mobile, "9876543210");
  assert.equal(member.referCode, "ABC123");
  assert.equal(member.commissionPercentage, 10);
});

test("child percentage can equal but cannot exceed parent percentage", () => {
  assert.doesNotThrow(() => assertWithinParentPercentage(10, 10));
  assert.throws(() => assertWithinParentPercentage(10.01, 10), /cannot exceed/i);
});

test("hierarchy derives levels and rejects cycles", () => {
  const hierarchy = buildHierarchy([
    { id: "root", parentMteamId: "" },
    { id: "child", parentMteamId: "root" },
    { id: "grandchild", parentMteamId: "child" },
  ]);
  assert.deepEqual(hierarchy.get("grandchild"), { level: 2, ancestorIds: ["root", "child"] });
  assert.throws(() => buildHierarchy([{ id: "a", parentMteamId: "b" }, { id: "b", parentMteamId: "a" }]), /cycle/i);
});

test("parent bonus is a percentage of the child commission", () => {
  assert.equal(calculateTeamBonus(10000, 10, 10), 100);
});

test("Admin UI uses trusted callables and notification history supports bulk deletion", async () => {
  const [backend, memberUi, couponUi, notificationUi] = await Promise.all([
    readFile(new URL("../functions/index.js", import.meta.url), "utf8"),
    readFile(new URL("../src/Pages/Mteam/Marketingteam.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/Pages/Mteam/CouponCodeManager.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/Pages/Notifications/Notifications.jsx", import.meta.url), "utf8"),
  ]);
  for (const callable of ["panelListMarketingHierarchy", "panelUpsertMarketingMember", "panelDeleteMarketingMember", "panelUpsertMarketingCoupon", "panelDeleteMarketingCoupon", "panelDeletePushCampaigns"]) {
    assert.match(backend, new RegExp(`exports\\.${callable}\\s*=\\s*onCall`));
  }
  assert.doesNotMatch(memberUi, /addDoc|updateDoc|deleteDoc/);
  assert.doesNotMatch(couponUi, /addDoc|updateDoc|deleteDoc/);
  assert.match(notificationUi, /Delete selected/);
  assert.match(notificationUi, /Clear All/);
});
