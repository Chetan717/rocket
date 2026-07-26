import test from "node:test";
import assert from "node:assert/strict";
import {
  getTaskRole,
  getTaskRoleLabel,
  normalizeTaskRoleKey,
  TASK_ROLE_OPTIONS,
  TASK_STATUSES,
} from "../src/Utils/taskManagement.js";

test("task statuses include the complete workflow", () => {
  assert.deepEqual([...TASK_STATUSES], ["Initiated", "Working", "Pending", "Completed"]);
});

test("all supported admin roles have stable keys and labels", () => {
  assert.deepEqual(
    TASK_ROLE_OPTIONS.map(({ key, label }) => [key, label]),
    [
      ["master_admin", "Master Admin"],
      ["admin", "Admin"],
      ["developer", "Developer"],
      ["template_uploader", "Template Uploader"],
      ["designer", "Designer"],
    ],
  );
});

test("role normalization accepts labels, keys and legacy Developer spelling", () => {
  assert.equal(normalizeTaskRoleKey("Master Admin"), "master_admin");
  assert.equal(normalizeTaskRoleKey("template_uploader"), "template_uploader");
  assert.equal(normalizeTaskRoleKey("Devloper"), "developer");
  assert.equal(getTaskRoleLabel("developer"), "Developer");
  assert.deepEqual(getTaskRole("unknown"), { key: "admin", label: "Admin" });
});
