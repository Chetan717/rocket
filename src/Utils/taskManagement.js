export const TASK_STATUSES = Object.freeze([
  "Initiated",
  "Working",
  "Pending",
  "Completed",
]);

export const TASK_ROLE_OPTIONS = Object.freeze([
  { key: "master_admin", label: "Master Admin" },
  { key: "admin", label: "Admin" },
  { key: "developer", label: "Developer" },
  { key: "template_uploader", label: "Template Uploader" },
  { key: "designer", label: "Designer" },
]);

export function normalizeTaskRoleKey(value) {
  const compact = String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");

  if (compact === "masteradmin") return "master_admin";
  if (compact === "admin") return "admin";
  if (compact === "developer" || compact === "devloper") return "developer";
  if (compact === "templateuploader") return "template_uploader";
  if (compact === "designer") return "designer";
  return "";
}

export function getTaskRoleLabel(value, fallback = "Unassigned") {
  const key = normalizeTaskRoleKey(value);
  return TASK_ROLE_OPTIONS.find((role) => role.key === key)?.label || fallback;
}

export function getTaskRole(roleLike, fallbackKey = "admin") {
  const key = normalizeTaskRoleKey(roleLike) || fallbackKey;
  return {
    key,
    label: getTaskRoleLabel(key, "Admin"),
  };
}
