import { useCallback, useState } from "react";
import { getAdminSession } from "./adminSession";

export function getCurrentAdmin() { return getAdminSession(); }
export function isMasterAdmin(admin = getCurrentAdmin()) { return admin?.role === "Master Admin"; }

// Firestore Rules remain the real delete boundary. This helper provides a
// matching UI boundary and never asks for/stores a legacy PIN.
export function useAdminDeleteGuard() {
  const [blockedMessage, setBlockedMessage] = useState("");
  const requestDelete = useCallback((action, onCancel) => {
    if (!isMasterAdmin()) {
      setBlockedMessage("Only the Master Admin can delete this item.");
      window.setTimeout(() => setBlockedMessage(""), 4000);
      onCancel?.(); return;
    }
    Promise.resolve(action()).catch(() => {
      setBlockedMessage("Action could not be completed.");
      window.setTimeout(() => setBlockedMessage(""), 4000);
    });
  }, []);
  const BlockedToast = blockedMessage ? <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-medium shadow-lg">{blockedMessage}</div> : null;
  return { requestDelete, DeleteAuthModal: null, BlockedToast, blockedMessage };
}
