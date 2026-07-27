import assert from "node:assert/strict";
import test from "node:test";

import {
  getTemplateQualityCounts,
  getGraphicsStableKey,
  reconcileQualityChecks,
} from "../src/Pages/Templates/qualityUtils.js";

test("counts OK and Issue flags for current graphics links", () => {
  const template = {
    GraphicsLink: [{ id: "first" }, { id: "second" }, { id: "third" }],
  };
  const qualityDoc = {
    checks: {
      [getGraphicsStableKey(template.GraphicsLink[0], 0)]: { flag: "ok" },
      [getGraphicsStableKey(template.GraphicsLink[1], 1)]: { flag: "issue" },
    },
  };

  assert.deepEqual(getTemplateQualityCounts(template, qualityDoc), {
    graphics: 3,
    ok: 1,
    issues: 1,
    unselected: 1,
  });
});

test("keeps legacy Checked and Working flags visible in the status column", () => {
  const template = {
    GraphicsLink: [{ id: "legacy-ok" }, { id: "legacy-issue" }],
  };
  const qualityDoc = {
    checks: {
      [getGraphicsStableKey(template.GraphicsLink[0], 0)]: { flag: "Checked" },
      [getGraphicsStableKey(template.GraphicsLink[1], 1)]: { flag: "Working" },
    },
  };

  assert.deepEqual(getTemplateQualityCounts(template, qualityDoc), {
    graphics: 2,
    ok: 1,
    issues: 1,
    unselected: 0,
  });
});

test("does not count stale quality flags from removed graphics links", () => {
  const template = {
    GraphicsLink: [{ id: "current" }],
  };
  const qualityDoc = {
    checks: {
      [getGraphicsStableKey(template.GraphicsLink[0], 0)]: { flag: "ok" },
      "9:removed": { flag: "issue" },
    },
  };

  assert.deepEqual(getTemplateQualityCounts(template, qualityDoc), {
    graphics: 1,
    ok: 1,
    issues: 0,
    unselected: 0,
  });
});

test("permanent graphics key does not change when its list number changes", () => {
  const link = { id: 35, qualityId: "quality-link-35" };

  assert.equal(
    getGraphicsStableKey(link, 34),
    getGraphicsStableKey(link, 33),
  );
});

test("deleting an issue link does not move its red Issue flag to the next link", () => {
  const originalLinks = [
    { id: 33, qualityId: "quality-33" },
    { id: 34, qualityId: "quality-34" },
    { id: 35, qualityId: "quality-35" },
  ];
  const legacyChecks = {
    "0:33": { flag: "ok", note: "" },
    "1:34": { flag: "issue", note: "Graphics Problem" },
    "2:35": { flag: "ok", note: "" },
  };
  const migratedChecks = reconcileQualityChecks(originalLinks, legacyChecks);
  const afterDelete = [originalLinks[0], originalLinks[2]];
  const reconciledAfterDelete = reconcileQualityChecks(
    afterDelete,
    migratedChecks,
  );

  assert.deepEqual(
    getTemplateQualityCounts(
      { GraphicsLink: afterDelete },
      { checks: reconciledAfterDelete },
    ),
    {
      graphics: 2,
      ok: 2,
      issues: 0,
      unselected: 0,
    },
  );
  assert.equal(
    Object.hasOwn(
      reconciledAfterDelete,
      getGraphicsStableKey(originalLinks[1], 1),
    ),
    false,
  );
});

test("deleting a link before an Issue keeps the Issue on the same graphics id", () => {
  const originalLinks = [
    { id: 33 },
    { id: 34 },
    { id: 35 },
  ];
  const legacyChecks = {
    "1:34": { flag: "issue", note: "Keep this on graphics 34" },
  };
  const afterDelete = [originalLinks[1], originalLinks[2]];
  const reconciled = reconcileQualityChecks(afterDelete, legacyChecks);

  assert.equal(
    reconciled[getGraphicsStableKey(originalLinks[1], 0)]?.flag,
    "issue",
  );
  assert.equal(
    reconciled[getGraphicsStableKey(originalLinks[2], 1)],
    undefined,
  );
});

test("reconcile removes deleted checks and writes only permanent current keys", () => {
  const currentLinks = [
    { id: 35, qualityId: "permanent-35" },
  ];
  const checks = {
    "33:34": { flag: "issue", note: "deleted" },
    "34:35": { flag: "ok", note: "current" },
  };

  assert.deepEqual(reconcileQualityChecks(currentLinks, checks), {
    [getGraphicsStableKey(currentLinks[0], 0)]: {
      flag: "ok",
      note: "current",
    },
  });
});
