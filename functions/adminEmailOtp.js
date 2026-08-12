/* global module */

const ADMIN_OTP_RECIPIENT = "mlmliveapp@gmail.com";
const MASKED_ADMIN_OTP_RECIPIENT = "ml***@gmail.com";

function buildAdminOtpMessage(sender, otp) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(sender || ""))) {
    throw new TypeError("A valid sender email is required.");
  }
  if (!/^\d{6}$/.test(String(otp || ""))) {
    throw new TypeError("A 6-digit OTP is required.");
  }

  return {
    from: `"MLM LIVE Security" <${sender}>`,
    to: ADMIN_OTP_RECIPIENT,
    subject: "MLM LIVE Admin login OTP",
    text: `Your MLM LIVE Admin login OTP is ${otp}. It expires in 5 minutes. Do not share this OTP.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px"><h2 style="margin:0 0 12px;color:#5b21b6">MLM LIVE Admin Login</h2><p>Use this one-time password to continue:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${otp}</p><p style="color:#4b5563">This OTP expires in 5 minutes. Do not share it with anyone.</p></div>`,
  };
}

module.exports = {
  ADMIN_OTP_RECIPIENT,
  MASKED_ADMIN_OTP_RECIPIENT,
  buildAdminOtpMessage,
};
