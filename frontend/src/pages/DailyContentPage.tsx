import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, ExternalLink, Plus, RefreshCw, Save, Trash2, XCircle } from "lucide-react";
import { api, HttpError } from "../api";
import type { DailyContentStatus, SourceSeed } from "../types";

type FormState = {
  enabled: boolean;
  rowCount: number;
  businessContext: string;
  sourceSeeds: SourceSeed[];
};

const emptySeed: SourceSeed = {
  platform: "website",
  sourceUrl: "",
  sourceTitle: "",
  imageUrl: "",
  notes: ""
};

const statusClass = {
  running: "bg-amber-50 text-amber-700 ring-amber-200",
  succeeded: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-red-50 text-red-700 ring-red-200"
};

const statusLabel = {
  running: "Đang chạy",
  succeeded: "Thành công",
  failed: "Lỗi"
};

function toForm(status: DailyContentStatus): FormState {
  const sourceSeeds = status.settings.sourceSeeds || [];
  return {
    enabled: status.settings.enabled,
    rowCount: status.settings.rowCount,
    businessContext: status.settings.businessContext,
    sourceSeeds: sourceSeeds.length ? sourceSeeds : [{ ...emptySeed }]
  };
}

function formatDate(value: string | null) {
  if (!value) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh"
  }).format(new Date(value));
}

export function DailyContentPage() {
  const [status, setStatus] = useState<DailyContentStatus | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const dirty = useMemo(() => {
    if (!status || !form) return false;
    return (
      status.settings.enabled !== form.enabled ||
      status.settings.rowCount !== form.rowCount ||
      status.settings.businessContext !== form.businessContext ||
      JSON.stringify(status.settings.sourceSeeds || []) !== JSON.stringify(form.sourceSeeds)
    );
  }, [form, status]);

  function updateSeed(index: number, patch: Partial<SourceSeed>) {
    setForm((current) => current ? {
      ...current,
      sourceSeeds: current.sourceSeeds.map((seed, seedIndex) => seedIndex === index ? { ...seed, ...patch } : seed)
    } : current);
  }

  function addSeed() {
    setForm((current) => current ? { ...current, sourceSeeds: [...current.sourceSeeds, { ...emptySeed }] } : current);
  }

  function removeSeed(index: number) {
    setForm((current) => current ? {
      ...current,
      sourceSeeds: current.sourceSeeds.filter((_seed, seedIndex) => seedIndex !== index)
    } : current);
  }

  async function load() {
    setLoading(true);
    setError(null);
    setRunMessage(null);
    try {
      const nextStatus = await api.dailyContentStatus();
      setStatus(nextStatus);
      setForm(toForm(nextStatus));
      setSaved(false);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Không tải được cấu hình daily content.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { settings } = await api.updateDailyContentSettings({
        enabled: form.enabled,
        rowCount: form.rowCount,
        businessContext: form.businessContext.trim(),
        sourceSeeds: form.sourceSeeds.map((seed) => ({
          platform: seed.platform,
          sourceUrl: seed.sourceUrl.trim(),
          sourceTitle: seed.sourceTitle.trim(),
          imageUrl: seed.imageUrl.trim(),
          notes: seed.notes.trim()
        }))
      });
      setStatus((current) => current ? { ...current, settings } : current);
      setForm({
        enabled: settings.enabled,
        rowCount: settings.rowCount,
        businessContext: settings.businessContext,
        sourceSeeds: settings.sourceSeeds?.length ? settings.sourceSeeds : [{ ...emptySeed }]
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Không lưu được cấu hình.");
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    setError(null);
    setSaved(false);
    setRunMessage(null);
    try {
      const result = await api.runDailyContentNow();
      setRunMessage(result.message || `Đã kích hoạt ${result.triggered || 0} dòng. Sheet sẽ có bài mới sau khoảng 1-2 phút.`);
      window.setTimeout(() => {
        void load();
      }, 4000);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Không chạy được cập nhật Sheet ngay.");
    } finally {
      setRunning(false);
    }
  }

  if (loading && !status) {
    return <p className="text-sm text-slate-600">Đang tải cấu hình daily content...</p>;
  }

  if (!form || !status) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error || "Không tải được cấu hình daily content."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Daily AI Content</h1>
          <p className="mt-1 text-sm text-slate-600">Cấu hình nội dung tự động ghi vào Google Sheet mỗi ngày.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={status.sheetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="size-4" aria-hidden />
            Mở Sheet
          </a>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className="size-4" aria-hidden />
            Tải lại
          </button>
        </div>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Đã lưu cấu hình.</p> : null}
      {runMessage ? <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">{runMessage}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={save} className="space-y-5 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Cấu hình tự động</h2>
              <p className="mt-1 text-sm text-slate-600">Cron chạy lúc {status.schedule}, mỗi dòng được ghi thêm vào tab {status.sheetName}.</p>
            </div>
            <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => current ? { ...current, enabled: event.target.checked } : current)}
                className="size-5 rounded border-slate-300 text-teal-700"
              />
              Bật tự động
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Số dòng ghi mỗi ngày
            <input
              type="number"
              min={1}
              max={10}
              value={form.rowCount}
              onChange={(event) => setForm((current) => current ? { ...current, rowCount: Number(event.target.value) } : current)}
              className="mt-1 block min-h-11 w-32 rounded-lg border border-slate-300 px-3"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Bối cảnh doanh nghiệp cho AI
            <textarea
              required
              minLength={20}
              maxLength={8000}
              rows={10}
              value={form.businessContext}
              onChange={(event) => setForm((current) => current ? { ...current, businessContext: event.target.value } : current)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6"
            />
          </label>

          <section className="space-y-3 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Nguồn AI lấy về</h2>
                <p className="mt-1 text-sm text-slate-600">Danh sách này thay thế nguồn cũ. AI dùng `link_nguon` và `image` ở đây để tạo nội dung ghi vào Sheet.</p>
              </div>
              <button
                type="button"
                onClick={addSeed}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Plus className="size-4" aria-hidden />
                Thêm nguồn
              </button>
            </div>

            <div className="space-y-3">
              {form.sourceSeeds.map((seed, index) => (
                <fieldset key={index} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <legend className="text-sm font-semibold text-slate-900">Nguồn {index + 1}</legend>
                    <button
                      type="button"
                      onClick={() => removeSeed(index)}
                      disabled={form.sourceSeeds.length === 1}
                      title="Xóa nguồn"
                      className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Nền tảng
                      <select
                        value={seed.platform}
                        onChange={(event) => updateSeed(index, { platform: event.target.value as SourceSeed["platform"] })}
                        className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
                      >
                        <option value="website">Website</option>
                        <option value="facebook">Facebook</option>
                        <option value="tiktok">TikTok</option>
                        <option value="other">Khác</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Tiêu đề nguồn
                      <input
                        required
                        value={seed.sourceTitle}
                        onChange={(event) => updateSeed(index, { sourceTitle: event.target.value })}
                        className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                      link_nguon
                      <input
                        required
                        type="url"
                        value={seed.sourceUrl}
                        onChange={(event) => updateSeed(index, { sourceUrl: event.target.value })}
                        className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                      image
                      <input
                        required
                        type="url"
                        value={seed.imageUrl}
                        onChange={(event) => updateSeed(index, { imageUrl: event.target.value })}
                        className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                      Ghi chú để AI tạo dàn ý, nội dung, caption, hashtag
                      <textarea
                        required
                        rows={3}
                        value={seed.notes}
                        onChange={(event) => updateSeed(index, { notes: event.target.value })}
                        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6"
                      />
                    </label>
                  </div>
                </fieldset>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving || !dirty}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
            >
              <Save className="size-4" aria-hidden />
              {saving ? "Đang lưu..." : "Lưu cấu hình"}
            </button>
            <button
              type="button"
              onClick={() => void runNow()}
              disabled={running || dirty}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-teal-700 px-4 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-60"
            >
              <RefreshCw className="size-4" aria-hidden />
              {running ? "Đang cập nhật..." : "Cập nhật Sheet ngay"}
            </button>
            <span className="text-sm text-slate-500">
              Cập nhật gần nhất: {formatDate(status.settings.updatedAt)}
            </span>
          </div>
        </form>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Kết nối</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600">AI</dt>
                <dd className="flex items-center gap-1 font-medium text-slate-900">
                  {status.connections.ai ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-red-600" />}
                  {status.connections.ai ? "Sẵn sàng" : "Thiếu key"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600">Google Sheet</dt>
                <dd className="flex items-center gap-1 font-medium text-slate-900">
                  {status.connections.google ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-red-600" />}
                  {status.connections.google ? "Sẵn sàng" : "Thiếu quyền"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600">Cron secret</dt>
                <dd className="flex items-center gap-1 font-medium text-slate-900">
                  {status.connections.cron ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-red-600" />}
                  {status.connections.cron ? "Đã bảo vệ" : "Chưa cấu hình"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Lịch sử gần đây</h2>
            <div className="mt-3 space-y-2">
              {status.runs.length === 0 ? <p className="text-sm text-slate-500">Chưa có lần chạy nào.</p> : status.runs.map((run) => (
                <div key={run.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-900">{run.day} · dòng {run.rowIndex + 1}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusClass[run.status]}`}>
                      {statusLabel[run.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(run.updatedAt)}{run.message ? ` · ${run.message}` : ""}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
