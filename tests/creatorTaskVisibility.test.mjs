import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("non-Master Admin sees role-assigned tasks and tasks they created", async () => {
  const taskPage = await readSource("src/Pages/TaskManagement/TaskManagement.jsx");

  assert.match(taskPage, /where\(["']assignedRoleKey["'],\s*["']==["'],\s*adminRoleKey\)/);
  assert.match(taskPage, /where\(["']createdByUid["'],\s*["']==["'],\s*admin\.uid\)/);
  assert.match(taskPage, /const mergedTasks = new Map\(\)/);
  assert.match(taskPage, /mergedTasks\.set\(item\.id,\s*item\)/);
  assert.match(taskPage, /tasks created by you/);
});

test("Firestore read access includes the authenticated Admin task creator", async () => {
  const rulesUpdate = await readSource("TASK_MANAGEMENT_RULES_UPDATE.md");

  const accessHelper = rulesUpdate.match(
    /function adminTaskAccess\(data\) \{([\s\S]*?)\n\}/,
  )?.[1];

  assert.ok(accessHelper, "adminTaskAccess helper must be present");
  assert.match(accessHelper, /adminTab\('taskmanagement'\)/);
  assert.match(accessHelper, /data\.assignedRoleKey == adminTaskRoleKey\(\)/);
  assert.match(accessHelper, /data\.createdByUid == request\.auth\.uid/);
});
