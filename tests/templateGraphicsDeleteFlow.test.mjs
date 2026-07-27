import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editTemplateSource = readFileSync(
  new URL("../src/Pages/Templates/Forms/EditTemplate.jsx", import.meta.url),
  "utf8",
);
const graphicsRowsSource = readFileSync(
  new URL("../src/Pages/Templates/GraphicsLinkRow.jsx", import.meta.url),
  "utf8",
);
const templateHomeSource = readFileSync(
  new URL("../src/Pages/Templates/TemplateHome.jsx", import.meta.url),
  "utf8",
);

test("Edit Template highlights Issue rows by permanent graphics key, not index", () => {
  assert.match(editTemplateSource, /issueKeySet/);
  assert.doesNotMatch(editTemplateSource, /issueIndexSet/);
  assert.doesNotMatch(editTemplateSource, /parseInt\(k\.split/);
  assert.match(
    graphicsRowsSource,
    /issueKeySet\?\.has\(getGraphicsStableKey\(item, idx\)\)/,
  );
});

test("Template save atomically prunes deleted quality checks", () => {
  assert.match(
    editTemplateSource,
    /reconcileQualityChecks\(\s*cleanGraphics,\s*checksToSave/s,
  );
  assert.match(
    editTemplateSource,
    /batch\.set\(doc\(db, COLLECTIONS\.TEMPLATEQUALITY, id\)/,
  );
  assert.match(
    templateHomeSource,
    /const checks = reconcileQualityChecks\(/,
  );
});
