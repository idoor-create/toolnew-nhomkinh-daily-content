import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, HttpError } from "../api";
import { parseMediaUrls, toDatetimeLocal, toIsoUtc } from "../datetime";
import type { Customer, Platform, Post } from "../types";

type Props = {
  open: boolean;
  customers: Customer[];
  initial: Partial<Post> & { scheduledTimeLocal?: string };
  onClose: () => void;
  onSaved: () => void;
};

function configuredPlatforms(customer: Customer | undefined): Platform[] {
  const items: Platform[] = [];

  if (customer?.facebookConnected && customer.facebookPages.length > 0) {
    items.push("facebook");
  }

  if (customer?.tiktokConnected && customer.tiktokProfileName) {
    items.push("tiktok");
  }

  return items;
}

export function PostModal({ open, customers, initial, onClose, onSaved }: Props) {
  const editingId = initial.id;
  const [customerId, setCustomerId] = useState(String(initial.customerId ?? customers[0]?.id ?? ""));
  const [title, setTitle] = useState(initial.title ?? "");
  const [content, setContent] = useState(initial.content ?? "");
  const [hashtags, setHashtags] = useState(initial.hashtags ?? "");
  const [platforms, setPlatforms] = useState<Platform[]>(
    (initial.platforms as Platform[] | undefined) ?? configuredPlatforms(customers[0])
  );
  const [facebookPageIds, setFacebookPageIds] = useState<string[]>(initial.facebookPageIds ?? []);
  const [mediaText, setMediaText] = useState((initial.mediaUrls ?? []).join("\n"));
  const [schedule, setSchedule] = useState(Boolean(initial.status === "scheduled" || initial.scheduledTime));
  const [scheduledLocal, setScheduledLocal] = useState(
    initial.scheduledTimeLocal || toDatetimeLocal(initial.scheduledTime)
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setCustomerId(String(initial.customerId ?? customers[0]?.id ?? ""));
    setTitle(initial.title ?? "");
    setContent(initial.content ?? "");
    setHashtags(initial.hashtags ?? "");
    const defaultCustomer = customers.find((customer) => customer.id === (initial.customerId ?? customers[0]?.id));
    setPlatforms(Array.isArray(initial.platforms) ? (initial.platforms as Platform[]) : configuredPlatforms(defaultCustomer));
    setFacebookPageIds(
      Array.isArray(initial.facebookPageIds)
        ? initial.facebookPageIds
        : defaultCustomer?.facebookPages.length === 1
          ? [defaultCustomer.facebookPages[0].pageId]
          : []
    );
    setMediaText(Array.isArray(initial.mediaUrls) ? initial.mediaUrls.join("\n") : "");
    setSchedule(Boolean(initial.status === "scheduled" || initial.scheduledTime));
    setScheduledLocal(initial.scheduledTimeLocal || toDatetimeLocal(initial.scheduledTime));
    setFieldError(null);
  }, [open, initial, customers]);

  const mediaUrls = useMemo(() => parseMediaUrls(mediaText), [mediaText]);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => String(customer.id) === customerId),
    [customerId, customers]
  );

  if (!open) {
    return null;
  }

  function togglePlatform(platform: Platform) {
    if (!isPlatformConfigured(platform)) {
      setFieldError(`${platform === "facebook" ? "Facebook" : "TikTok"} chưa được kết nối cho hồ sơ này.`);
      return;
    }

    setPlatforms((current) =>
      current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]
    );
  }

  function isPlatformConfigured(platform: Platform) {
    if (!selectedCustomer) {
      return false;
    }

    if (platform === "facebook") {
      return selectedCustomer.facebookConnected && selectedCustomer.facebookPages.length > 0;
    }

    return selectedCustomer.tiktokConnected && Boolean(selectedCustomer.tiktokProfileName);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldError(null);

    if (!customerId) {
      setFieldError("Chọn hồ sơ/kênh.");
      return;
    }
    if (!content.trim()) {
      setFieldError("Nội dung bắt buộc.");
      return;
    }
    if (platforms.length === 0) {
      setFieldError("Chọn ít nhất một kênh.");
      return;
    }
    if (platforms.includes("facebook") && !isPlatformConfigured("facebook")) {
      setFieldError("Hồ sơ này chưa kết nối Fanpage Facebook.");
      return;
    }
    if (platforms.includes("facebook") && facebookPageIds.length === 0) {
      setFieldError("Chọn ít nhất một Fanpage Facebook.");
      return;
    }
    if (platforms.includes("tiktok") && !isPlatformConfigured("tiktok")) {
      setFieldError("Hồ sơ này chưa cấu hình TikTok profile.");
      return;
    }
    if (platforms.includes("tiktok") && mediaUrls.length === 0) {
      setFieldError("TikTok cần ít nhất một URL media (nên là video).");
      return;
    }
    if (schedule && !scheduledLocal) {
      setFieldError("Bài lên lịch cần ngày giờ đăng.");
      return;
    }

    const body = {
      customerId: Number(customerId),
      title: title.trim() || null,
      content: content.trim(),
      platforms,
      facebookPageIds: platforms.includes("facebook") ? facebookPageIds : [],
      mediaUrls,
      hashtags: hashtags.trim() || null,
      status: schedule ? "scheduled" : "draft",
      scheduledTime: scheduledLocal ? toIsoUtc(scheduledLocal) : null
    };

    setPending(true);
    try {
      if (editingId) {
        await api.updatePost(editingId, body);
      } else {
        await api.createPost(body);
      }
      onSaved();
      onClose();
    } catch (err) {
      setFieldError(err instanceof HttpError ? err.message : "Không lưu được bài.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!editingId) {
      return;
    }
    setPending(true);
    try {
      await api.deletePost(editingId);
      onSaved();
      onClose();
    } catch (err) {
      setFieldError(err instanceof HttpError ? err.message : "Không xóa được bài.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-labelledby="post-modal-title"
        className="max-h-[95svh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="post-modal-title" className="text-lg font-semibold">
            {editingId ? "Sửa lịch đăng" : "Tạo lịch đăng"}
          </h2>
          <button type="button" className="min-h-11 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100" onClick={onClose}>
            Đóng
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium" htmlFor="customer">
                Hồ sơ/kênh
              </label>
              {customers.length === 0 ? (
                <p className="mt-2 text-sm text-amber-800">
                  Chưa có kênh social.{" "}
                  <Link to="/channels" className="font-semibold text-teal-800 underline" onClick={onClose}>
                    Kết nối kênh trước
                  </Link>
                  .
                </p>
              ) : (
                <select
                  id="customer"
                  value={customerId}
                  onChange={(e) => {
                    const nextCustomerId = e.target.value;
                    const nextCustomer = customers.find((customer) => String(customer.id) === nextCustomerId);
                    setCustomerId(nextCustomerId);
                    setPlatforms(configuredPlatforms(nextCustomer));
                    setFacebookPageIds(nextCustomer?.facebookPages.length === 1 ? [nextCustomer.facebookPages[0].pageId] : []);
                    setFieldError(null);
                  }}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
                >
                  <option value="" disabled>
                    Chọn hồ sơ quản lý
                  </option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              )}
              {selectedCustomer ? (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className={isPlatformConfigured("facebook") ? "text-blue-700" : "text-slate-500"}>
                    Facebook: {isPlatformConfigured("facebook") ? `${selectedCustomer.facebookPages.length} Fanpage` : "chưa kết nối"}
                  </span>
                  <span className={isPlatformConfigured("tiktok") ? "text-fuchsia-700" : "text-slate-500"}>
                    TikTok: {isPlatformConfigured("tiktok") ? selectedCustomer.tiktokProfileName : "chưa cấu hình"}
                  </span>
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium" htmlFor="title">
                Tiêu đề (tuỳ chọn)
              </label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium" htmlFor="content">
                Nội dung
              </label>
              <textarea
                id="content"
                required
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
              <p className="mt-1 text-xs text-slate-500">{content.length} ký tự</p>
            </div>

            <div>
              <label className="block text-sm font-medium" htmlFor="hashtags">
                Hashtag
              </label>
              <input
                id="hashtags"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#sale #agency"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Kênh đăng</legend>
              <div className="mt-2 flex gap-4">
                {(["facebook", "tiktok"] as const).map((platform) => (
                  <label
                    key={platform}
                    className={`inline-flex min-h-11 items-center gap-2 text-sm ${
                      isPlatformConfigured(platform) ? "" : "text-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={platforms.includes(platform)}
                      disabled={!isPlatformConfigured(platform)}
                      onChange={() => togglePlatform(platform)}
                    />
                    {platform === "facebook" ? "Facebook" : "TikTok"}
                  </label>
                ))}
              </div>
            </fieldset>

            {platforms.includes("facebook") && selectedCustomer ? (
              <fieldset className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <legend className="px-1 text-sm font-medium text-blue-900">Fanpage Facebook</legend>
                <div className="mt-2 space-y-2">
                  {selectedCustomer.facebookPages.map((page) => (
                    <label key={page.pageId} className="flex min-h-10 items-center gap-2 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={facebookPageIds.includes(page.pageId)}
                        onChange={() => {
                          setFacebookPageIds((current) =>
                            current.includes(page.pageId)
                              ? current.filter((item) => item !== page.pageId)
                              : [...current, page.pageId]
                          );
                        }}
                      />
                      {page.pageName}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <div>
              <label className="block text-sm font-medium" htmlFor="media">
                URL media (mỗi dòng một URL)
              </label>
              <textarea
                id="media"
                rows={3}
                value={mediaText}
                onChange={(e) => setMediaText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Phase 1 chưa upload file. TikTok cần URL video.</p>
            </div>

            <label className="inline-flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />
              Lên lịch đăng
            </label>

            <div>
              <label className="block text-sm font-medium" htmlFor="when">
                Ngày giờ đăng (giờ máy bạn, lưu UTC)
              </label>
              <input
                id="when"
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3"
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium">Preview</p>
            {platforms.includes("facebook") ? (
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-blue-700">Facebook</p>
                {selectedCustomer?.facebookPages.length ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Fanpage:{" "}
                    {selectedCustomer.facebookPages
                      .filter((page) => facebookPageIds.includes(page.pageId))
                      .map((page) => page.pageName)
                      .join(", ") || "chưa chọn"}
                  </p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{content || "—"}</p>
                {hashtags ? <p className="mt-2 text-sm text-blue-800">{hashtags}</p> : null}
              </article>
            ) : null}
            {platforms.includes("tiktok") ? (
              <article className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-white">
                <p className="text-xs font-semibold text-fuchsia-300">TikTok</p>
                <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm">{content || "—"}</p>
                {hashtags ? <p className="mt-2 text-sm text-fuchsia-200">{hashtags}</p> : null}
                <p className="mt-3 text-xs text-slate-400">
                  {mediaUrls.length ? `${mediaUrls.length} media URL` : "Chưa có video URL"}
                </p>
              </article>
            ) : null}

            {fieldError ? (
              <p className="text-sm text-red-600" role="alert">
                {fieldError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={pending || customers.length === 0}
                className="min-h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
              >
                {pending ? "Đang lưu…" : "Lưu"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void onDelete()}
                  className="min-h-11 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Xóa
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
