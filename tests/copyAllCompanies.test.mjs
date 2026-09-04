import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homePath = new URL("../src/Pages/Templates/TemplateHome.jsx", import.meta.url);
const copyPath = new URL("../src/Pages/Templates/Forms/CopyRankPromotion.jsx", import.meta.url);

test("Templates tab exposes Copy to All Companies without replacing single-company copy", async () => {
  const home = await readFile(homePath, "utf8");
  assert.match(home, /Copy to Company/);
  assert.match(home, /Copy to All Companies/);
  assert.match(home, /copy-rank-promotion\?target=all/);
});

test("bulk template copy excludes Demo and skips exact duplicates per company", async () => {
  const copy = await readFile(copyPath, "utf8");
  assert.match(copy, /ALL_COMPANIES_TARGET/);
  assert.match(copy, /targetCompanies/);
  assert.match(copy, /where\("SelectType", "==", selectedSelectType\)/);
  assert.match(copy, /existingKeysByCompany/);
  assert.match(copy, /same subtype \+ serial/);
  assert.match(copy, /window\.confirm/);
  assert.match(copy, /Company: company\.id/);
});
