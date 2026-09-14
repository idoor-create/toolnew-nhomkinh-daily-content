import { CalendarDays, Lightbulb, LogOut, RadioTower } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
    isActive ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-100"
  }`;

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-svh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Lịch đăng bài</p>
            <p className="text-xs text-slate-500">Quản lý Page, profile và lịch đăng đa kênh</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Chính">
            <NavLink to="/" className={linkClass} end>
              <CalendarDays className="size-4" aria-hidden />
              Lịch
            </NavLink>
            <NavLink to="/channels" className={linkClass}>
              <RadioTower className="size-4" aria-hidden />
              Kênh
            </NavLink>
            <NavLink to="/content-lab" className={linkClass}>
              <Lightbulb className="size-4" aria-hidden />
              Content Lab
            </NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{user?.name}</span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="size-4" aria-hidden />
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
