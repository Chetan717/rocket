import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onIdTokenChanged, signOut } from "firebase/auth";
import { auth, functions } from "../../Firebase";
import { httpsCallable } from "firebase/functions";
import { clearAdminSession, setAdminSession } from "../Utils/adminSession";

const AuthContext = createContext(null);
export function AdminAuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => onIdTokenChanged(auth, async (user) => {
    if (!user) { clearAdminSession(); setSession(null); setUnlocked(false); setLoading(false); return; }
    try {
    const token = await user.getIdTokenResult();
    if (token.claims.panel !== "admin") throw new Error("wrong panel");
    await httpsCallable(functions, "panelSessionStatus")({});
    const next = {
      uid: user.uid, id: token.claims.adminId, ownerAdminId: token.claims.ownerAdminId,
      name: token.claims.name || "Admin", role: token.claims.role,
      assigntab: Array.isArray(token.claims.tabs) ? token.claims.tabs : [],
      actorType: token.claims.actorType,
    };
    setAdminSession(next); setSession(next); setLoading(false);
    } catch (_) { clearAdminSession(); setSession(null); setUnlocked(false); await signOut(auth).catch(()=>null); setLoading(false); }
  }), []);
  const value = useMemo(() => ({ loading, session, unlocked, markUnlocked:()=>setUnlocked(true), unlock:async password=>{await httpsCallable(functions,"panelUnlockSession")({password});setUnlocked(true);}, logout: async () => {
    await httpsCallable(functions, "panelLogout")({}).catch(() => null);
    clearAdminSession(); await signOut(auth); setSession(null); setUnlocked(false);
  }}), [loading, session, unlocked]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAdminAuth() { return useContext(AuthContext); }
