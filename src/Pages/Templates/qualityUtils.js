export const QUALITY_FLAG_KEYS = ["ok", "issue"];

/**
 * Keep legacy quality data readable after moving to the two-flag workflow.
 * Old "checked" entries represented a successful review, while "working"
 * entries represented an unresolved problem.
 */
export function normalizeQualityFlag(value) {
  const flag = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (flag === "ok" || flag === "checked") return "ok";
  if (flag === "issue" || flag === "working") return "issue";
  return "";
}

export function normalizeQualityChecks(checks) {
  if (!checks || typeof checks !== "object") return {};

  return Object.entries(checks).reduce((result, [key, value]) => {
    if (!value || typeof value !== "object") return result;
    const flag = normalizeQualityFlag(value.flag);
    const note = typeof value.note === "string" ? value.note : "";
    if (!flag && !note.trim()) return result;
    result[key] = {
      ...(flag ? { flag } : {}),
      note,
    };
    return result;
  }, {});
}

function hasValue(value) {
  return value !== undefined
    && value !== null
    && String(value).trim() !== "";
}

function getIdStableKey(link) {
  if (!hasValue(link?.id)) return "";
  return `graphic-id:${encodeURIComponent(String(link.id))}`;
}

function getLegacyGraphicsKey(link, index) {
  return `${index}:${link?.id ?? index}`;
}

function isLegacyKeyForId(key, id) {
  if (!hasValue(id) || typeof key !== "string") return false;
  const separator = key.indexOf(":");
  if (separator <= 0) return false;
  const legacyIndex = key.slice(0, separator);
  return /^\d+$/.test(legacyIndex)
    && key.slice(separator + 1) === String(id);
}

/**
 * Permanent quality identity for one graphics link.
 *
 * New and edited links carry qualityId, so deleting/reordering another row
 * cannot move their OK/Issue status. Existing templates fall back to their
 * saved graphics id until they are edited and receive a qualityId.
 */
export function getGraphicsStableKey(link, index) {
  if (hasValue(link?.qualityId)) {
    return `graphic:${encodeURIComponent(String(link.qualityId))}`;
  }
  return getIdStableKey(link) || `graphic-index:${index}`;
}

function getQualityCheckCandidates(checks, link, index) {
  const currentKey = getGraphicsStableKey(link, index);
  const idKey = getIdStableKey(link);
  const exactLegacyKey = getLegacyGraphicsKey(link, index);
  const indexOnlyLegacyKey = `${index}:${index}`;
  const candidates = [currentKey];

  if (idKey && idKey !== currentKey) candidates.push(idKey);
  if (!candidates.includes(exactLegacyKey)) candidates.push(exactLegacyKey);
  if (!candidates.includes(indexOnlyLegacyKey)) {
    candidates.push(indexOnlyLegacyKey);
  }

  // Recover old index:id checks after an earlier row deletion/reorder.
  // The graphics id, unlike the old index, still identifies the same link.
  Object.keys(checks).forEach((key) => {
    if (isLegacyKeyForId(key, link?.id) && !candidates.includes(key)) {
      candidates.push(key);
    }
  });

  return candidates;
}

export function getQualityCheckForLink(checks, link, index) {
  const normalized = normalizeQualityChecks(checks);
  const key = getQualityCheckCandidates(normalized, link, index)
    .find((candidate) => Object.prototype.hasOwnProperty.call(normalized, candidate));
  return key ? normalized[key] : undefined;
}

/**
 * Keep only checks for links that still exist and rewrite them to permanent
 * keys. This doubles as a backward-compatible migration for old index:id data.
 */
export function reconcileQualityChecks(links, checks) {
  const currentLinks = Array.isArray(links) ? links : [];
  const normalized = normalizeQualityChecks(checks);
  const reconciled = {};
  const usedSourceKeys = new Set();

  currentLinks.forEach((link, index) => {
    const sourceKey = getQualityCheckCandidates(normalized, link, index)
      .find((candidate) => (
        !usedSourceKeys.has(candidate)
        && Object.prototype.hasOwnProperty.call(normalized, candidate)
      ));
    if (!sourceKey) return;

    reconciled[getGraphicsStableKey(link, index)] = normalized[sourceKey];
    usedSourceKeys.add(sourceKey);
  });

  return reconciled;
}

export function getSubtypeQualityKey(template) {
  const mainType = String(template?.MainType || "").trim();
  const company = mainType.toUpperCase() === "MLM"
    ? String(template?.Company || "").trim()
    : "";
  const selectType = String(template?.SelectType || "").trim();
  const subtype = String(template?.Subtype || "").trim();
  return JSON.stringify([mainType, company, selectType, subtype]);
}

export function getSubtypeQualityDocId(templateOrKey) {
  const key = typeof templateOrKey === "string"
    ? templateOrKey
    : getSubtypeQualityKey(templateOrKey);
  return `subtype__${encodeURIComponent(key)}`;
}

export function isSubtypeQualityDoc(value) {
  return value?.recordType === "subtype"
    || String(value?.id || "").startsWith("subtype__");
}

export function hasSelectedCurrentFlag(template, qualityDoc) {
  const links = Array.isArray(template?.GraphicsLink) ? template.GraphicsLink : [];
  const rawChecks = qualityDoc?.checks && typeof qualityDoc.checks === "object"
    ? qualityDoc.checks
    : {};
  const checks = reconcileQualityChecks(links, rawChecks);

  return links.some((link, index) => {
    const stableKey = getGraphicsStableKey(link, index);
    return Boolean(normalizeQualityFlag(checks[stableKey]?.flag));
  });
}

/**
 * Count only flags that belong to the template's current graphics links.
 * This keeps the main Template list consistent with Quality Check and avoids
 * showing stale flags from links that have already been removed.
 */
export function getTemplateQualityCounts(template, qualityDoc) {
  const links = Array.isArray(template?.GraphicsLink) ? template.GraphicsLink : [];
  const rawChecks = qualityDoc?.checks && typeof qualityDoc.checks === "object"
    ? qualityDoc.checks
    : {};
  const checks = reconcileQualityChecks(links, rawChecks);
  const counts = {
    graphics: links.length,
    ok: 0,
    issues: 0,
    unselected: 0,
  };

  links.forEach((link, index) => {
    const stableKey = getGraphicsStableKey(link, index);
    const flag = normalizeQualityFlag(checks[stableKey]?.flag);
    if (flag === "ok") counts.ok += 1;
    else if (flag === "issue") counts.issues += 1;
    else counts.unselected += 1;
  });

  return counts;
}
