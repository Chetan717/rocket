import assert from "node:assert/strict";
import test from "node:test";

import {
  getTemplateQualityCounts,
  getGraphicsStableKey,
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
