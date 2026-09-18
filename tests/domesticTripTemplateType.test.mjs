import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(
  resolve(import.meta.dirname, "../src/Pages/Templates/Constant.js"),
  "utf8",
);

test("Admin exposes Domestic Trip directly after Bonanza", () => {
  const bonanzaIndex = source.indexOf('{ name: "Bonanza", value: "Bonanza" }');
  const domesticTripIndex = source.indexOf(
    '{ name: "Domestic Trip", value: "Domestic_Trip" }',
  );
  const achievementsIndex = source.indexOf(
    '{ name: "Achievements", value: "Achievements" }',
  );

  assert.ok(bonanzaIndex >= 0);
  assert.ok(domesticTripIndex > bonanzaIndex);
  assert.ok(achievementsIndex > domesticTripIndex);
});
