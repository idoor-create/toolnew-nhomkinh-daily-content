import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./auth";

export function RequireAuth() {
  const { user, ready } = useAuth();

  if (!ready) {
    return <p className="p-6 text-sm text-slate-600">Đang tải…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
