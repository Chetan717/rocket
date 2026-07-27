import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("Task Management uses the same permission key across the complete Admin flow", async () => {
  const [
    authFunctions,
    adminManagement,
    sidebar,
    authContext,
    taskPage,
  ] = await Promise.all([
    readSource("functions/index.js"),
    readSource("src/Pages/AdminManagement/AdminManagement.jsx"),
    readSource("src/components/Sidebar.jsx"),
    readSource("src/Auth/AdminAuthContext.jsx"),
    readSource("src/Pages/TaskManagement/TaskManagement.jsx"),
  ]);

  const ownerTabsSource = authFunctions.match(
    /const OWNER_TABS = \[(.*?)\];/s,
  )?.[1];

  assert.ok(ownerTabsSource, "Admin auth allowlist must be present");
  assert.match(ownerTabsSource, /["']taskmanagement["']/);
  assert.match(adminManagement, /id:\s*["']taskmanagement["']/);
  assert.match(sidebar, /id:\s*["']taskmanagement["']/);
  assert.match(authContext, /token\.claims\.tabs/);
  assert.match(taskPage, /includes\(["']taskmanagement["']\)/);
});

test("Admin auth filtering preserves the Task Management permission", async () => {
  const authFunctions = await readSource("functions/index.js");
  const ownerTabsSource = authFunctions.match(
    /const OWNER_TABS = \[(.*?)\];/s,
  )?.[1];
  const ownerTabs = JSON.parse(`[${ownerTabsSource}]`);

  assert.ok(ownerTabs.includes("taskmanagement"));
  assert.equal(
    ownerTabs.filter((tab) => tab === "taskmanagement").length,
    1,
  );
});
