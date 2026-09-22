import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { emptyGraphicsLink } from "../src/Pages/Templates/Constant.js";

const graphicsRowsSource = readFileSync(
  new URL("../src/Pages/Templates/GraphicsLinkRow.jsx", import.meta.url),
  "utf8",
);
const addTemplateSource = readFileSync(
  new URL("../src/Pages/Templates/Forms/AddTemplate.jsx", import.meta.url),
  "utf8",
);
const editTemplateSource = readFileSync(
  new URL("../src/Pages/Templates/Forms/EditTemplate.jsx", import.meta.url),
  "utf8",
);

test("meeting badge image is available only for Meeting and General Meeting graphics rows", () => {
  assert.equal(emptyGraphicsLink().meeting_badge_image, "");
  assert.match(
    graphicsRowsSource,
    /isMeetingType = \(t\) => t === "Meeting" \|\| t === "General_Meeting"/,
  );
  assert.match(
    graphicsRowsSource,
    /canShowMeetingBadgeImage = isMeetingType\(selType\)/,
  );
  assert.match(graphicsRowsSource, /\{canShowMeetingBadgeImage && \(/);
  assert.match(graphicsRowsSource, /Meeting Badge Image/);
  assert.match(graphicsRowsSource, /update\("meeting_badge_image", v\)/);
  assert.match(graphicsRowsSource, /templates\/meeting-badge-image/);
});

test("Add Template and Edit Template both use the shared graphics row field", () => {
  assert.match(addTemplateSource, /<GraphicsLinksField/);
  assert.match(editTemplateSource, /<GraphicsLinksField/);
  assert.match(addTemplateSource, /\.\.\.rest/);
  assert.match(editTemplateSource, /\.\.\.rest/);
});
