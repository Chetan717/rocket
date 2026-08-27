import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const functionsSource = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const sidebarSource = await readFile(new URL("../src/components/Sidebar.jsx", import.meta.url), "utf8");

test("push registration and Master Admin send functions are exported", () => {
  assert.match(functionsSource, /exports\.registerExpoPushToken\s*=\s*onRequest/);
  assert.match(functionsSource, /exports\.panelSendPushNotification\s*=\s*onCall/);
  assert.match(functionsSource, /exports\.panelDeletePushCampaigns\s*=\s*onCall/);
  assert.match(functionsSource, /requireMasterAdmin\(request\)/);
  assert.match(functionsSource, /messages\.slice\(index, index \+ 100\)/);
});

test("notification navigation is visible only to the owner UI", () => {
  assert.match(appSource, /path="\/notifications"/);
  assert.match(sidebarSource, /id: "notifications"[\s\S]*ownerOnly: true/);
  assert.match(sidebarSource, /if \(item\.ownerOnly\) return false/);
});
