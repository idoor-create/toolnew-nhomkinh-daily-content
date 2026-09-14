import { useEffect, useState, type FormEvent } from "react";
import { api, HttpError } from "../api";
import type { Customer } from "../types";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    const data = await api.customers();
    setCustomers(data.customers);
  }

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof HttpError ? err.message : "Không tải được danh sách.");
    });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const body = {
      name,
      contactName: contactName || null
    };

    try {
      if (editingId) {
        await api.updateCustomer(editingId, body);
        setEditingId(null);
      } else {
        await api.createCustomer(body);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Không lưu được.");
    } finally {
      setPending(false);
    }
  }

  function resetForm() {
    setName("");
    setContactName("");
  }

  async function onDelete(id: number) {
    setError(null);
    try {
      await api.deleteCustomer(id);
      await load();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Không xóa được.");
    }
  }

  async function onConnectFacebook(customerId: number) {
    setError(null);
    try {
      const data = await api.facebookConnectUrl(customerId);
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Chưa tạo được link kết nối Facebook.");
    }
  }

  async function onConnectTiktok(customerId: number) {
    setError(null);
    try {
      const data = await api.tiktokConnectUrl(customerId);
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Chưa tạo được link kết nối TikTok.");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Kênh social</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tool không tạo Fanpage mới. Nó kết nối các Fanpage/TikTok profile có sẵn rồi dùng chúng để lên lịch bài viết đa kênh.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-800" htmlFor="customer-name">
            Hồ sơ quản lý
            <input
              id="customer-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Brand ABC hoặc Shop thời trang"
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
            />
          </label>
          <label className="block text-sm font-medium text-slate-800" htmlFor="contact-name">
            Người phụ trách
            <input
              id="contact-name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Tên người liên hệ"
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="min-h-11 py-3 text-sm font-medium text-slate-800">Facebook Page</p>
            <p className="text-xs text-slate-500">
              Tạo hồ sơ quản lý trước, rồi bấm Kết nối Facebook để login OAuth và lấy các Fanpage có sẵn.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="min-h-11 py-3 text-sm font-medium text-slate-800">TikTok Profile</p>
            <p className="text-xs text-slate-500">
              Tạo hồ sơ quản lý trước, rồi bấm Kết nối TikTok để login OAuth và cấp quyền đăng video.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
          >
            {editingId ? "Cập nhật hồ sơ" : "Tạo hồ sơ quản lý"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="min-h-11 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100"
              onClick={() => {
                setEditingId(null);
                resetForm();
              }}
            >
              Hủy
            </button>
          ) : null}
        </div>
      </form>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {customers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8">
          <p className="text-sm font-medium text-slate-800">Chưa có kênh social.</p>
          <p className="mt-1 text-sm text-slate-500">Tạo một hồ sơ quản lý, sau đó kết nối Fanpage hoặc TikTok profile có sẵn.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {customers.map((customer) => (
            <li key={customer.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{customer.name}</p>
                {customer.contactName ? <p className="text-xs text-slate-500">Phụ trách: {customer.contactName}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs ${customer.facebookPages.length ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                    Facebook: {customer.facebookPages.length ? `${customer.facebookPages.length} Fanpage` : "chưa kết nối"}
                  </span>
                  <span className={`rounded-full px-2 py-1 text-xs ${customer.tiktokConnected && customer.tiktokProfileName ? "bg-fuchsia-50 text-fuchsia-700" : "bg-slate-100 text-slate-500"}`}>
                    TikTok: {customer.tiktokConnected && customer.tiktokProfileName ? customer.tiktokProfileName : "chưa cấu hình"}
                  </span>
                </div>
                {customer.facebookReconnectRequired ? (
                  <p className="text-xs text-amber-700">Cần kết nối lại Facebook (Phase 2)</p>
                ) : null}
                {customer.tiktokReconnectRequired ? (
                  <p className="text-xs text-amber-700">Cần kết nối lại TikTok.</p>
                ) : null}
                {customer.facebookPages.length ? (
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {customer.facebookPages.map((page) => (
                      <li key={page.pageId}>Page: {page.pageName}</li>
                    ))}
                  </ul>
                ) : null}
                {customer.tiktokConnected && customer.tiktokProfileName ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    {customer.tiktokAvatarUrl ? (
                      <img
                        src={customer.tiktokAvatarUrl}
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : null}
                    <span>Profile TikTok: {customer.tiktokProfileName}</span>
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-100"
                  onClick={() => {
                    setEditingId(customer.id);
                    setName(customer.name);
                    setContactName(customer.contactName ?? "");
                  }}
                >
                  Sửa
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg px-3 text-sm text-blue-700 hover:bg-blue-50"
                  onClick={() => void onConnectFacebook(customer.id)}
                >
                  {customer.facebookConnected ? "Đồng bộ lại Facebook" : "Kết nối Facebook"}
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg px-3 text-sm text-fuchsia-700 hover:bg-fuchsia-50"
                  onClick={() => void onConnectTiktok(customer.id)}
                >
                  {customer.tiktokConnected ? "Đồng bộ lại TikTok" : "Kết nối TikTok"}
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg px-3 text-sm text-red-700 hover:bg-red-50"
                  onClick={() => void onDelete(customer.id)}
                >
                  Xóa
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
