import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { HttpError } from "../api";
import { useAuth } from "../auth";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Không đăng nhập được.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Đăng nhập</h1>
        <p className="mt-2 text-sm text-slate-600">Dùng tài khoản nhân viên đã seed trên backend.</p>

        <label className="mt-6 block text-sm font-medium text-slate-800" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base"
        />

        <label className="mt-4 block text-sm font-medium text-slate-800" htmlFor="password">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base"
        />

        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 min-h-11 w-full rounded-lg bg-teal-700 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
        >
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
