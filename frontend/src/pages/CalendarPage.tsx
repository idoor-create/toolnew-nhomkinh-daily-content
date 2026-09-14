import type { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import viLocale from "@fullcalendar/core/locales/vi";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useCallback, useEffect, useState } from "react";
import { api, HttpError } from "../api";
import { toDatetimeLocal } from "../datetime";
import type { Customer, Post } from "../types";
import { PostModal } from "../components/PostModal";

function statusColor(status: Post["status"]) {
  if (status === "scheduled") {
    return "#0f766e";
  }
  if (status === "published") {
    return "#1d4ed8";
  }
  if (status === "failed") {
    return "#b91c1c";
  }
  if (status === "partial") {
    return "#c2410c";
  }
  return "#64748b";
}

export function CalendarPage() {
  const [accounts, setAccounts] = useState<Customer[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [drafts, setDrafts] = useState<Post[]>([]);
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [initial, setInitial] = useState<Partial<Post> & { scheduledTimeLocal?: string }>({});

  const loadAccounts = useCallback(async () => {
    const data = await api.customers();
    setAccounts(data.customers);
  }, []);

  const loadPosts = useCallback(async () => {
    const scheduled = await api.posts({
      from: range.from,
      to: range.to
    });
    setPosts(scheduled.posts.filter((post) => post.scheduledTime));
    const draftList = await api.posts({ status: "draft" });
    setDrafts(draftList.posts);
  }, [range.from, range.to]);

  useEffect(() => {
    void loadAccounts().catch((err) => {
      setError(err instanceof HttpError ? err.message : "Không tải được kênh.");
    });
  }, [loadAccounts]);

  useEffect(() => {
    if (!range.from) {
      return;
    }
    void loadPosts().catch((err) => {
      setError(err instanceof HttpError ? err.message : "Không tải được bài.");
    });
  }, [loadPosts, range.from]);

  function openCreate(local?: string) {
    setInitial({
      scheduledTimeLocal: local,
      status: local ? "scheduled" : "draft"
    });
    setModalOpen(true);
  }

  async function openEdit(id: number) {
    const data = await api.getPost(id);
    setInitial(data.post);
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Lên lịch bài viết đa kênh</h1>
          <p className="text-sm text-slate-600">Chọn Page/profile đã kết nối, soạn nội dung, rồi đặt lịch đăng.</p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="min-h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-600"
        >
          Tạo lịch đăng
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {accounts.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Chưa có kênh social. Vào trang Kênh để kết nối Fanpage/TikTok profile trước.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={viLocale}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek"
            }}
            height="auto"
            selectable
            select={(info) => {
              openCreate(toDatetimeLocal(info.start.toISOString()));
            }}
            eventClick={(info: EventClickArg) => {
              const id = Number(info.event.id);
              void openEdit(id);
            }}
            datesSet={(info: DatesSetArg) => {
              const from = info.start.toISOString();
              const to = info.end.toISOString();
              setRange((prev) => (prev.from === from && prev.to === to ? prev : { from, to }));
            }}
            events={posts.map((post) => ({
              id: String(post.id),
              title: `${post.customer?.name ?? "Post"} · ${post.title || post.content.slice(0, 24)}`,
              start: post.scheduledTime ?? undefined,
              backgroundColor: statusColor(post.status),
              borderColor: statusColor(post.status)
            }))}
          />
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Nháp</h2>
          {drafts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Không có nháp.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {drafts.map((post) => (
                <li key={post.id}>
                  <button
                    type="button"
                    onClick={() => void openEdit(post.id)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="block font-medium">{post.title || "Không tiêu đề"}</span>
                    <span className="block text-xs text-slate-500">{post.customer?.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <PostModal
        open={modalOpen}
        customers={accounts}
        initial={initial}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          void loadPosts();
        }}
      />
    </div>
  );
}
