import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("every authorised Admin user gets the role-based Add Task flow", async () => {
  const taskPage = await readSource("src/Pages/TaskManagement/TaskManagement.jsx");

  assert.match(taskPage, /\baddDoc\b/);
  assert.match(taskPage, /const canCreateTask = canAccess && Boolean\(adminRoleKey\)/);
  assert.match(taskPage, /if\s*\(\s*!canCreateTask\s*\)/);
  assert.match(taskPage, /\{canCreateTask\s*&&\s*\(/);
  assert.match(taskPage, />\s*<IconPlus\s*\/>\s*Add Task\s*</);
  assert.match(taskPage, /createdByMteamId:\s*["']["']/);
  assert.match(taskPage, /createdByRole:\s*creatorRole/);
  assert.match(taskPage, /createdByPanel:\s*["']admin["']/);
  assert.match(taskPage, /assignedPanel:\s*["']admin["']/);
  assert.doesNotMatch(taskPage, /Only Master Admin can add tasks/);
});

test("Firestore update allows direct create for Marketing or authorised Admin users", async () => {
  const rulesUpdate = await readSource("TASK_MANAGEMENT_RULES_UPDATE.md");

  assert.match(rulesUpdate, /allow create:\s*if validTask\(request\.resource\.data\)/);
  assert.match(rulesUpdate, /marketingTaskAccess\(\)/);
  assert.match(rulesUpdate, /validAdminTaskCreator\(request\.resource\.data\)/);
  assert.match(rulesUpdate, /function validAdminTaskCreator\(data\)/);
  assert.match(rulesUpdate, /adminTab\('taskmanagement'\)/);
  assert.match(rulesUpdate, /adminTaskRoleKey\(\) != ''/);
  assert.match(rulesUpdate, /createdByMteamId == ''/);
  assert.match(rulesUpdate, /createdByUid == request\.auth\.uid/);
  assert.match(rulesUpdate, /createdByName == request\.auth\.token\.name/);
  assert.match(rulesUpdate, /data\.createdByRole == 'Master Admin'/);
  assert.match(rulesUpdate, /data\.createdByRole == 'Developer'/);
  assert.match(rulesUpdate, /data\.createdByRole == 'Template Uploader'/);
  assert.match(rulesUpdate, /data\.createdByRole == 'Designer'/);
  assert.match(rulesUpdate, /createdByPanel == 'admin'/);
});
