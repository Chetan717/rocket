import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildTaskEmailMessage } = require("../functions/taskEmail.js");

test("task assigned email contains task details and deduplicates recipients", () => {
  const message = buildTaskEmailMessage({
    sender: "sender@example.com",
    recipients: ["designer@example.com", "designer@example.com"],
    eventType: "assigned",
    task: { name: "Banner QA", taskDate: "2026-09-08", description: "Check graphics", companyName: "ABC", assignedRole: "Designer", status: "Initiated", createdByName: "Master" },
  });
  assert.deepEqual(message.to, ["designer@example.com"]);
  assert.match(message.subject, /New Task Assigned/);
  assert.match(message.text, /Banner QA/);
  assert.match(message.text, /Check graphics/);
});

test("completed task email is clearly marked completed", () => {
  const message = buildTaskEmailMessage({ sender: "sender@example.com", recipients: ["master@example.com"], eventType: "completed", task: { name: "Final QA", status: "Completed" } });
  assert.match(message.subject, /Task Completed/);
  assert.match(message.text, /Status: Completed/);
});

test("quality check exposes one-click all graphics OK control", () => {
  const source = fs.readFileSync(new URL("../src/Pages/Templates/QualityCheck.jsx", import.meta.url), "utf8");
  assert.match(source, /handleSelectAllOk/);
  assert.match(source, /One Click: All Graphics OK/);
  assert.match(source, /flag: "ok"/);
});

test("delete approval uses backend request, review and final delete callables", () => {
  const backend = fs.readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
  assert.match(backend, /panelCreateDeleteRequest/);
  assert.match(backend, /panelReviewDeleteRequest/);
  assert.match(backend, /panelFinalizeApprovedDelete/);
  assert.match(backend, /requireMasterAdmin\(request\)/);
  const page = fs.readFileSync(new URL("../src/Pages/DeleteRequests.jsx", import.meta.url), "utf8");
  assert.match(page, /Approve & Open/);
  assert.match(page, /Cancel Request/);
});
