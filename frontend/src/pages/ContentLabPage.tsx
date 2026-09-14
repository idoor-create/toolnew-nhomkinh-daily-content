import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Copy, ExternalLink, Image, Sparkles } from "lucide-react";
import { api, HttpError } from "../api";
import type { ContentDraft, ContentReference, ContentSheetRow, Customer } from "../types";

type ReferenceForm = {
  platform: ContentReference["platform"];
  sourceUrl: string;
  sourceTitle: string;
  sourceImageUrl: string;
  originalImageUrl: string;
  views: string;
  reactions: string;
  comments: string;
  notes: string;
};

const emptyReference: ReferenceForm = {
  platform: "facebook", sourceUrl: "", sourceTitle: "", sourceImageUrl: "", originalImageUrl: "", views: "", reactions: "", comments: "", notes: ""
};

const contentSheetColumns: Array<keyof ContentSheetRow> = [
  "thoi_gian",
  "tu_khoa_chinh",
  "tu_khoa_phu",
  "y_dinh_tim_kiem",
  "title_seo",
  "meta_description",
  "h1",
  "slug",
  "dan_y",
  "noi_dung_seo",
  "caption_tiktok",
  "caption_facebook",
  "kich_ban_video",
  "hashtag",
  "link_nguon",
  "image",
  "noi_dau_khach"
];

function toOptionalNumber(value: string) {
  return value.trim() ? Number(value) : null;
}

function isTemporaryImageUrl(value: string) {
  return /(?:scontent|fbcdn|_nc_|[?&](?:oe|oh|expires?|sig|token|X-Amz-[^=]+)=)/i.test(value);
}

function isSpecificSourceUrl(value: string) {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const lowerPath = url.pathname.toLowerCase();
    const hasSpecificQuery = ["story_fbid", "fbid", "v", "photo_id"].some((key) => url.searchParams.has(key));
    const hasPfbid = segments.some((segment) => /^pfbid/i.test(segment));
    const specificSectionIndex = segments.findIndex((segment) => /^(?:posts?|videos?|reel|photos?|permalink)$/i.test(segment));
    const hasSpecificSection = specificSectionIndex >= 0 && segments.length > specificSectionIndex + 1;
    const hasWatchPath = /\/watch\b/i.test(lowerPath) && url.searchParams.has("v");
    const hasPostMarker = hasSpecificQuery || hasPfbid || hasSpecificSection || hasWatchPath;

    if (hasPostMarker) return true;
    if (segments.length === 0) return false;
    if (segments.length === 1 && !/\d|[-_]/.test(segments[0])) return false;
    return segments.join("/").length >= 12;
  } catch {
    return false;
  }
}

function formatSheetRow(draft: ContentDraft) {
  return contentSheetColumns
    .map((column) => draft.sheetRow[column].replace(/\t/g, " ").replace(/\r?\n/g, " | "))
    .join("\t");
}

export function ContentLabPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [references, setReferences] = useState<ContentReference[]>([]);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [referenceForm, setReferenceForm] = useState<ReferenceForm>(emptyReference);
  const [primaryKeyword, setPrimaryKeyword] = useState("");
  const [secondaryKeywords, setSecondaryKeywords] = useState("");
  const [searchIntent, setSearchIntent] = useState("tìm hiểu vấn đề");
  const [businessContext, setBusinessContext] = useState("");
  const [originalImageUrl, setOriginalImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedCustomer = useMemo(() => customers.find((customer) => String(customer.id) === customerId), [customerId, customers]);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    const numericId = Number(id);
    const [referenceData, draftData] = await Promise.all([api.contentReferences(numericId), api.contentDrafts(numericId)]);
    setReferences(referenceData.references);
    setDrafts(draftData.drafts);
    setSelectedIds((current) => current.filter((referenceId) => referenceData.references.some((item) => item.id === referenceId)));
  }, []);

  useEffect(() => {
    void api.customers().then(({ customers: items }) => {
      setCustomers(items);
      setCustomerId((current) => current || String(items[0]?.id || ""));
    }).catch((err) => setError(err instanceof HttpError ? err.message : "Không tải được hồ sơ."));
  }, []);

  useEffect(() => {
    void load(customerId).catch((err) => setError(err instanceof HttpError ? err.message : "Không tải được Content Lab."));
  }, [customerId, load]);

  async function addReference(event: FormEvent) {
    event.preventDefault();
    if (!customerId) return;
    if (!isSpecificSourceUrl(referenceForm.sourceUrl)) {
      setError("Link bài nguồn cần là post/video/bài viết cụ thể, không dùng homepage hoặc fanpage chung chung.");
      return;
    }
    if ([referenceForm.sourceImageUrl, referenceForm.originalImageUrl].some((url) => url && isTemporaryImageUrl(url))) {
      setError("Ảnh nguồn đang là link tạm như scontent/fbcdn/_nc_. Hãy upload ảnh thật lên Google Drive hoặc server ổn định rồi dán link public.");
      return;
    }
    setPending(true); setError(null);
    try {
      const { reference } = await api.createContentReference({
        customerId: Number(customerId),
        ...referenceForm,
        sourceImageUrl: referenceForm.sourceImageUrl || null,
        originalImageUrl: referenceForm.originalImageUrl || null,
        views: toOptionalNumber(referenceForm.views),
        reactions: toOptionalNumber(referenceForm.reactions),
        comments: toOptionalNumber(referenceForm.comments),
        notes: referenceForm.notes || null
      });
      setReferences((current) => [reference, ...current]);
      setSelectedIds((current) => [...current, reference.id]);
      setReferenceForm(emptyReference);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Không lưu được bài nguồn.");
    } finally { setPending(false); }
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!customerId || selectedIds.length === 0) return;
    if (originalImageUrl && isTemporaryImageUrl(originalImageUrl)) {
      setError("Ảnh ưu tiên đang là link tạm. Hãy dùng link Google Drive/server ổn định để Google Sheet hiển thị lâu dài.");
      return;
    }
    setPending(true); setError(null);
    try {
      const { draft } = await api.generateContentDraft({
        customerId: Number(customerId), referenceIds: selectedIds, primaryKeyword, secondaryKeywords, searchIntent, businessContext,
        originalImageUrl: originalImageUrl || null
      });
      setDrafts((current) => [draft, ...current]);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Không tạo được nháp AI.");
    } finally { setPending(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">Content Lab</h1>
        <p className="text-sm text-slate-600">Lưu bài nguồn, dùng ảnh công trình thật và tạo nháp chuẩn Google Sheet.</p>
      </div>
      <label className="block text-sm font-medium">Hồ sơ
        <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-1 block min-h-11 min-w-56 rounded-lg border border-slate-300 bg-white px-3">
          <option value="">Chọn hồ sơ</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
      </label>
    </div>

    {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
    {!selectedCustomer ? <p className="text-sm text-slate-600">Tạo hoặc chọn một hồ sơ kênh để bắt đầu.</p> : <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="space-y-5">
        <form onSubmit={addReference} className="border-b border-slate-200 pb-5">
          <h2 className="text-sm font-semibold">Bài nguồn có tín hiệu tốt</h2>
          <p className="mt-1 text-sm text-slate-600">Ghi số liệu thật bạn quan sát được. Link nguồn phải là bài cụ thể; ảnh nên là Drive/server ổn định.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input required value={referenceForm.sourceTitle} onChange={(e) => setReferenceForm({ ...referenceForm, sourceTitle: e.target.value })} placeholder="Tên/chủ đề bài nguồn" className="min-h-11 rounded-lg border border-slate-300 px-3 sm:col-span-2" />
            <input required type="url" value={referenceForm.sourceUrl} onChange={(e) => setReferenceForm({ ...referenceForm, sourceUrl: e.target.value })} placeholder="Link bài/post/video nguồn cụ thể" className="min-h-11 rounded-lg border border-slate-300 px-3 sm:col-span-2" />
            <select value={referenceForm.platform} onChange={(e) => setReferenceForm({ ...referenceForm, platform: e.target.value as ContentReference["platform"] })} className="min-h-11 rounded-lg border border-slate-300 px-3"><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="instagram">Instagram</option><option value="other">Khác</option></select>
            <input type="url" value={referenceForm.sourceImageUrl} onChange={(e) => setReferenceForm({ ...referenceForm, sourceImageUrl: e.target.value })} placeholder="Ảnh nguồn ổn định URL" className="min-h-11 rounded-lg border border-slate-300 px-3" />
            <input type="url" value={referenceForm.originalImageUrl} onChange={(e) => setReferenceForm({ ...referenceForm, originalImageUrl: e.target.value })} placeholder="Ảnh gốc/công trình Drive URL" className="min-h-11 rounded-lg border border-slate-300 px-3 sm:col-span-2" />
            <input inputMode="numeric" value={referenceForm.views} onChange={(e) => setReferenceForm({ ...referenceForm, views: e.target.value })} placeholder="Lượt xem" className="min-h-11 rounded-lg border border-slate-300 px-3" />
            <input inputMode="numeric" value={referenceForm.reactions} onChange={(e) => setReferenceForm({ ...referenceForm, reactions: e.target.value })} placeholder="Tương tác" className="min-h-11 rounded-lg border border-slate-300 px-3" />
            <textarea value={referenceForm.notes} onChange={(e) => setReferenceForm({ ...referenceForm, notes: e.target.value })} placeholder="Hook, góc nội dung, nhận xét" rows={3} className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-2" />
          </div>
          <button disabled={pending} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-teal-700 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-60"><ExternalLink className="size-4" />Lưu bài nguồn</button>
        </form>

        <div>
          <h2 className="text-sm font-semibold">Nguồn đã lưu</h2>
          <div className="mt-3 space-y-2">
            {references.length === 0 ? <p className="text-sm text-slate-500">Chưa có bài nguồn.</p> : references.map((reference) => <label key={reference.id} className="flex gap-3 rounded-lg border border-slate-200 p-3 text-sm">
              <input type="checkbox" checked={selectedIds.includes(reference.id)} onChange={() => setSelectedIds((current) => current.includes(reference.id) ? current.filter((id) => id !== reference.id) : [...current, reference.id])} />
              <span className="min-w-0"><span className="block font-medium text-slate-900">{reference.sourceTitle}</span><span className="block truncate text-xs text-slate-500">{reference.platform} · {reference.views ?? 0} views · {reference.sourceImageUrl ? "có ảnh nguồn" : "chưa có ảnh nguồn"}</span></span>
            </label>)}
          </div>
        </div>
      </section>

      <section>
        <form onSubmit={generate} className="border-b border-slate-200 pb-5">
          <h2 className="text-sm font-semibold">Tạo nháp AI theo Google Sheet</h2>
          <p className="mt-1 text-sm text-slate-600">Bản nháp bám 17 cột Sheet, xoay vòng khu vực miền Nam/miền Tây và tránh trùng nỗi đau gần nhất.</p>
          <div className="mt-4 grid gap-3">
            <input required value={primaryKeyword} onChange={(e) => setPrimaryKeyword(e.target.value)} placeholder="Từ khóa chính: dịch vụ + địa phương" className="min-h-11 rounded-lg border border-slate-300 px-3" />
            <input value={secondaryKeywords} onChange={(e) => setSecondaryKeywords(e.target.value)} placeholder="3-5 từ khóa phụ liên quan nỗi đau" className="min-h-11 rounded-lg border border-slate-300 px-3" />
            <select required value={searchIntent} onChange={(e) => setSearchIntent(e.target.value)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3">
              <option value="tìm hiểu vấn đề">tìm hiểu vấn đề</option>
              <option value="so sánh giá">so sánh giá</option>
              <option value="tìm thợ sửa gấp">tìm thợ sửa gấp</option>
            </select>
            <textarea required rows={4} value={businessContext} onChange={(e) => setBusinessContext(e.target.value)} placeholder="Bối cảnh doanh nghiệp, khu vực phục vụ, điểm mạnh có thể xác minh" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input type="url" value={originalImageUrl} onChange={(e) => setOriginalImageUrl(e.target.value)} placeholder="Ảnh gốc ưu tiên Drive/server URL" className="min-h-11 rounded-lg border border-slate-300 px-3" />
          </div>
          <button disabled={pending || selectedIds.length === 0} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"><Sparkles className="size-4" />{pending ? "Đang tạo…" : `Tạo nháp từ ${selectedIds.length} nguồn`}</button>
        </form>

        <div className="mt-5">
          <h2 className="text-sm font-semibold">Nháp theo format Sheet</h2>
          <div className="mt-3 space-y-3">
            {drafts.length === 0 ? <p className="text-sm text-slate-500">Nháp AI sẽ xuất hiện tại đây.</p> : drafts.map((draft) => <article key={draft.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{draft.sheetRow.title_seo}</p><p className="mt-1 text-xs text-slate-500">{draft.sheetRow.tu_khoa_chinh}</p></div><div className="flex items-center gap-2"><button type="button" title="Sao chép 1 dòng để dán vào Google Sheet" onClick={() => void navigator.clipboard.writeText(formatSheetRow(draft))} className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><Copy className="size-4" /></button><Image className="size-4 shrink-0 text-slate-500" /></div></div>
              {draft.sheetRow.image ? <img src={draft.sheetRow.image} alt={draft.sheetRow.title_seo} className="mt-3 aspect-video w-full rounded-lg border border-slate-200 object-cover" loading="lazy" /> : null}
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{draft.sheetRow.caption_facebook}</p>
              <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2"><div><dt className="font-semibold">Ảnh</dt><dd className="break-all">{draft.sheetRow.image || "—"}</dd></div><div><dt className="font-semibold">Nỗi đau khách</dt><dd>{draft.sheetRow.noi_dau_khach || "—"}</dd></div></dl>
              <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-teal-800">Xem toàn bộ format Google Sheet</summary><div className="mt-2 overflow-x-auto"><table className="min-w-full border-collapse text-left text-xs"><tbody>{contentSheetColumns.map((column) => <tr key={column} className="border-t border-slate-100 align-top"><th className="w-40 px-2 py-2 font-medium text-slate-600">{column}</th><td className="whitespace-pre-wrap break-words px-2 py-2 text-slate-800">{draft.sheetRow[column] || "—"}</td></tr>)}</tbody></table></div></details>
            </article>)}
          </div>
        </div>
      </section>
    </div>}
  </div>;
}
