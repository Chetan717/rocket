/* global module */

const TEMPLATE_STORAGE_PREFIX = "templates/";

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function normalizeBucketName(value) {
  const raw = String(value || "").trim().replace(/^gs:\/\//i, "");
  return raw.split("/")[0];
}

function normalizeTemplatePath(value) {
  const path = String(value || "").trim().replace(/^\/+/, "");
  const segments = path.split("/");

  if (
    !path.startsWith(TEMPLATE_STORAGE_PREFIX)
    || segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return "";
  }

  return path;
}

/**
 * Resolve a Firebase/Google Cloud Storage URL to one owned templates/... path.
 * External URLs, other buckets and non-template paths are deliberately ignored.
 */
function getTemplateStoragePath(value, expectedBucket) {
  if (typeof value !== "string" || !value.trim()) return "";

  const wantedBucket = normalizeBucketName(expectedBucket);
  if (!wantedBucket) return "";

  const raw = value.trim();
  let bucketName = "";
  let objectPath = "";

  if (/^gs:\/\//i.test(raw)) {
    const withoutScheme = raw.slice(5);
    const slashIndex = withoutScheme.indexOf("/");
    if (slashIndex < 1) return "";
    bucketName = decode(withoutScheme.slice(0, slashIndex));
    objectPath = decode(withoutScheme.slice(slashIndex + 1));
  } else {
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      return "";
    }

    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    if (hostname === "firebasestorage.googleapis.com") {
      const match = pathname.match(/^\/v\d+\/b\/([^/]+)\/o\/(.+)$/);
      if (!match) return "";
      bucketName = decode(match[1]);
      objectPath = decode(match[2]);
    } else if (hostname === "storage.googleapis.com") {
      const apiMatch = pathname.match(
        /^\/(?:download\/)?storage\/v\d+\/b\/([^/]+)\/o\/(.+)$/,
      );
      if (apiMatch) {
        bucketName = decode(apiMatch[1]);
        objectPath = decode(apiMatch[2]);
      } else {
        const directMatch = pathname.match(/^\/([^/]+)\/(.+)$/);
        if (!directMatch) return "";
        bucketName = decode(directMatch[1]);
        objectPath = decode(directMatch[2]);
      }
    } else if (hostname.endsWith(".storage.googleapis.com")) {
      bucketName = hostname.slice(0, -".storage.googleapis.com".length);
      objectPath = decode(pathname.replace(/^\/+/, ""));
    } else {
      return "";
    }
  }

  if (normalizeBucketName(bucketName) !== wantedBucket) return "";
  return normalizeTemplatePath(objectPath);
}

/**
 * Recursively find every owned Firebase Storage object referenced anywhere in
 * a template document. This also automatically covers future template fields.
 */
function collectTemplateStoragePaths(value, expectedBucket) {
  const paths = new Set();
  const visited = new Set();

  function visit(current) {
    if (typeof current === "string") {
      const path = getTemplateStoragePath(current, expectedBucket);
      if (path) paths.add(path);
      return;
    }

    if (!current || typeof current !== "object" || visited.has(current)) return;
    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }

    Object.values(current).forEach(visit);
  }

  visit(value);
  return paths;
}

function getRemovedTemplateStoragePaths(beforeData, afterData, expectedBucket) {
  const beforePaths = collectTemplateStoragePaths(beforeData, expectedBucket);
  const afterPaths = collectTemplateStoragePaths(afterData, expectedBucket);

  return [...beforePaths].filter((path) => !afterPaths.has(path));
}

function getUnreferencedTemplateStoragePaths(
  candidatePaths,
  currentTemplates,
  expectedBucket,
) {
  const referencedPaths = new Set();

  for (const template of currentTemplates || []) {
    collectTemplateStoragePaths(template, expectedBucket).forEach((path) => {
      referencedPaths.add(path);
    });
  }

  return [...new Set(candidatePaths || [])].filter(
    (path) => !referencedPaths.has(path),
  );
}

module.exports = {
  TEMPLATE_STORAGE_PREFIX,
  collectTemplateStoragePaths,
  getRemovedTemplateStoragePaths,
  getTemplateStoragePath,
  getUnreferencedTemplateStoragePaths,
};
