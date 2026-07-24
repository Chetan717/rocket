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

export function getGraphicsStableKey(link, index) {
  return `${index}:${link?.id ?? index}`;
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
  const checks = qualityDoc?.checks && typeof qualityDoc.checks === "object"
    ? qualityDoc.checks
    : {};

  return links.some((link, index) => {
    const stableKey = getGraphicsStableKey(link, index);
    return Boolean(normalizeQualityFlag(checks[stableKey]?.flag));
  });
}
