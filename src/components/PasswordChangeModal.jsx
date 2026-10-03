import { useState } from "react";

const strongPassword = (password) =>
  password.length >= 8 &&
  password.length <= 12 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

export default function PasswordChangeModal({
  title,
  subtitle,
  saving,
  error,
  onSave,
  onClose,
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");

  const submit = async (event) => {
    event.preventDefault();

    if (!strongPassword(password)) {
      setLocalError(
        "Password must be 8–12 characters with uppercase, lowercase, number and special character.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Both passwords must be the same.");
      return;
    }

    setLocalError("");
    await onSave(password);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              New Password
            </span>

            <div className="flex overflow-hidden rounded-xl border border-gray-200 focus-within:border-violet-500 dark:border-gray-700">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setLocalError("");
                }}
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                placeholder="8–12 strong password"
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="border-l border-gray-200 px-3 text-xs font-bold text-violet-600 dark:border-gray-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Confirm Password
            </span>

            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setLocalError("");
              }}
              className="w-full rounded-xl border border-gray-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-gray-700"
              placeholder="Re-enter new password"
            />
          </label>
        </div>

        <p className="mt-3 text-[11px] leading-5 text-gray-400">
          Current password is securely hashed and cannot be displayed. Saving
          here replaces it with the new password.
        </p>

        {(localError || error) && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30">
            {localError || error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:border-gray-700"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Password"}
          </button>
        </div>
      </form>
    </div>
  );
}
