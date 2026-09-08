import { useCallback, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../Firebase";
import { getAdminSession } from "./adminSession";

export function getCurrentAdmin() { return getAdminSession(); }
export function isMasterAdmin(admin = getCurrentAdmin()) { return admin?.role === "Master Admin"; }

// Firestore Rules remain the direct-delete boundary. For Template/Company
// records, sub-users can create a Master Admin approval request instead.
export function useAdminDeleteGuard() {
  const [blockedMessage, setBlockedMessage] = useState("");
  const showMessage = useCallback((message) => {
    setBlockedMessage(message);
    window.setTimeout(() => setBlockedMessage(""), 4500);
  }, []);

  const requestDelete = useCallback(async (action, onCancel, requestContext = null) => {
    if (isMasterAdmin()) {
      try { await Promise.resolve(action()); }
      catch (_) { showMessage("Action could not be completed."); }
      return;
    }

    if (requestContext?.resourceType && requestContext?.resourceId) {
      try {
        await httpsCallable(functions, "panelCreateDeleteRequest")({
          resourceType: requestContext.resourceType,
          resourceId: requestContext.resourceId,
          resourceLabel: requestContext.resourceLabel || "",
          returnUrl: requestContext.returnUrl || "",
        });
        showMessage("Delete request Master Admin ko bhej diya gaya hai.");
      } catch (error) {
        console.error(error);
        showMessage(error?.message || "Delete request send nahi ho saka.");
      }
      onCancel?.();
      return;
    }

    showMessage("Only the Master Admin can delete this item.");
    onCancel?.();
  }, [showMessage]);

  const BlockedToast = blockedMessage ? <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium shadow-lg">{blockedMessage}</div> : null;
  return { requestDelete, DeleteAuthModal: null, BlockedToast, blockedMessage };
}
