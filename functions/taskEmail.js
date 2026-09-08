/* global module */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function taskRows(task) {
  return [
    ["Task", task.name],
    ["Date", task.taskDate],
    ["Company", task.companyName || "—"],
    ["Assigned To", task.assignedRole || "—"],
    ["Status", task.status || "—"],
    ["Created By", task.createdByName || "—"],
    ["Description", task.description || "—"],
  ];
}

function buildTaskEmailMessage({ sender, recipients, task, eventType }) {
  const to = [...new Set((recipients || []).map(value => String(value || "").trim().toLowerCase()).filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))];
  if (!to.length) return null;
  const completed = eventType === "completed";
  const subject = completed ? `Task Completed: ${task.name || "Task"}` : `New Task Assigned: ${task.name || "Task"}`;
  const heading = completed ? "Task Completed" : "New Task Assigned";
  const rows = taskRows(task);
  return {
    from: `"MLM LIVE Task Management" <${sender}>`,
    to,
    subject,
    text: `${heading}\n\n${rows.map(([label, value]) => `${label}: ${String(value || "—")}`).join("\n")}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px"><h2 style="margin:0 0 18px;color:#5b21b6">${heading}</h2><table style="width:100%;border-collapse:collapse">${rows.map(([label,value]) => `<tr><td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:700;vertical-align:top;width:145px">${escapeHtml(label)}</td><td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:pre-wrap">${escapeHtml(value || "—")}</td></tr>`).join("")}</table></div>`,
  };
}

module.exports = { buildTaskEmailMessage };
