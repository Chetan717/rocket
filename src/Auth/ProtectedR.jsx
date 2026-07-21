import { Navigate } from "react-router";
import { useAdminAuth } from "./AdminAuthContext";

export default function ProtectedRoute({ children }) {
  const { loading, session, unlocked } = useAdminAuth();
  if (loading) return <div className="min-h-screen grid place-items-center">Checking session…</div>;
  return session && unlocked ? children : <Navigate to="/login" replace />;
}
