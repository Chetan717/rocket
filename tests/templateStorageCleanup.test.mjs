import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  collectTemplateStoragePaths,
  getRemovedTemplateStoragePaths,
  getTemplateStoragePath,
  getUnreferencedTemplateStoragePaths,
} = require("../functions/templateStorageCleanup.js");

const BUCKET = "mlmbooster-a4887.appspot.com";
const downloadUrl = (path, bucket = BUCKET) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=test`;

test("template cleanup deploys in us-central1 without moving auth functions", async () => {
  const source = await readFile(
    new URL("../functions/index.js", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const TEMPLATE_STORAGE_CLEANUP_REGION = "us-central1";/,
  );
  assert.match(
    source,
    /exports\.cleanupTemplateStorageOnWrite = onDocumentWritten\([\s\S]*?region: TEMPLATE_STORAGE_CLEANUP_REGION,/,
  );
  assert.match(source, /const REGION = "asia-south1";/);
  assert.match(
    source,
    /exports\.panelStartTwoFactorOtp = onCall\(\{ region: REGION,/,
  );
});

test("only owned templates paths from the configured bucket are accepted", () => {
  assert.equal(
    getTemplateStoragePath(downloadUrl("templates/graphics/background.webp"), BUCKET),
    "templates/graphics/background.webp",
  );
  assert.equal(
    getTemplateStoragePath(`gs://${BUCKET}/templates/badges/badge.webp`, BUCKET),
    "templates/badges/badge.webp",
  );
  assert.equal(
    getTemplateStoragePath(downloadUrl("companies/logos/logo.webp"), BUCKET),
    "",
  );
  assert.equal(
    getTemplateStoragePath(downloadUrl("templates/graphics/file.webp", "other.appspot.com"), BUCKET),
    "",
  );
  assert.equal(getTemplateStoragePath("https://example.com/image.webp", BUCKET), "");
});

test("all template image and video fields are collected recursively and deduplicated", () => {
  const sharedUrl = downloadUrl("templates/suggestion/shared.webp");
  const paths = collectTemplateStoragePaths({
    Showcase_url: downloadUrl("templates/showcase/main.webp"),
    ShowCaseForm: downloadUrl("templates/showcase-form/form.webp"),
    GraphicsLink: [{
      url: sharedUrl,
      suggestionImage: sharedUrl,
      backgroundVideoUrl: downloadUrl("templates/graphics-videos/background.mp4"),
      nameImageUrl: downloadUrl("templates/name-images/name.webp"),
      rankNameImageUrl: downloadUrl("templates/rank-name-images/rank.webp"),
      bannerId: downloadUrl("templates/badges/badge.webp"),
    }],
  }, BUCKET);

  assert.deepEqual([...paths].sort(), [
    "templates/badges/badge.webp",
    "templates/graphics-videos/background.mp4",
    "templates/name-images/name.webp",
    "templates/rank-name-images/rank.webp",
    "templates/showcase-form/form.webp",
    "templates/showcase/main.webp",
    "templates/suggestion/shared.webp",
  ]);
});

test("row delete, field clear and replacement return only removed Storage objects", () => {
  const kept = downloadUrl("templates/graphics/kept.webp");
  const removed = downloadUrl("templates/graphics/removed.webp");
  const replacement = downloadUrl("templates/graphics/replacement.webp");

  assert.deepEqual(
    getRemovedTemplateStoragePaths(
      { GraphicsLink: [{ url: kept }, { url: removed }] },
      { GraphicsLink: [{ url: kept }, { url: replacement }] },
      BUCKET,
    ),
    ["templates/graphics/removed.webp"],
  );
});

test("a removed object is retained while another template still references it", () => {
  const sharedPath = "templates/graphics/shared.webp";
  const uniquePath = "templates/graphics/unique.webp";

  assert.deepEqual(
    getUnreferencedTemplateStoragePaths(
      [sharedPath, uniquePath],
      [{ GraphicsLink: [{ url: downloadUrl(sharedPath) }] }],
      BUCKET,
    ),
    [uniquePath],
  );
});
