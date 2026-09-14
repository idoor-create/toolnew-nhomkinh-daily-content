import type { ApiError, ContentDraft, ContentReference, Customer, CustomerInput, Post, User } from "./types";

const TOKEN_KEY = "scheduler.token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:3000";

export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json()) as T | ApiError;

  if (!response.ok) {
    const err = data as ApiError;
    throw new HttpError(response.status, err.error?.code || "ERROR", err.error?.message || "Request failed");
  }

  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  me: () => request<{ user: User }>("/api/auth/me"),
  customers: () => request<{ customers: Customer[] }>("/api/channels"),
  createCustomer: (body: CustomerInput) =>
    request<{ customer: Customer }>("/api/channels", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  updateCustomer: (id: number, body: CustomerInput) =>
    request<{ customer: Customer }>(`/api/channels/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),
  deleteCustomer: (id: number) => request<void>(`/api/channels/${id}`, { method: "DELETE" }),
  facebookConnectUrl: (customerId: number) =>
    request<{ authUrl: string }>(`/api/integrations/customers/${customerId}/facebook/start`),
  facebookPages: (customerId: number) =>
    request<{ pages: Customer["facebookPages"] }>(`/api/integrations/customers/${customerId}/facebook/pages`),
  tiktokConnectUrl: (customerId: number) =>
    request<{ authUrl: string }>(`/api/integrations/customers/${customerId}/tiktok/start`),
  posts: (query: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        params.set(key, value);
      }
    }
    const suffix = params.toString() ? `?${params}` : "";
    return request<{ posts: Post[] }>(`/api/posts${suffix}`);
  },
  getPost: (id: number) => request<{ post: Post }>(`/api/posts/${id}`),
  createPost: (body: unknown) =>
    request<{ post: Post }>("/api/posts", { method: "POST", body: JSON.stringify(body) }),
  updatePost: (id: number, body: unknown) =>
    request<{ post: Post }>(`/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePost: (id: number) => request<void>(`/api/posts/${id}`, { method: "DELETE" }),
  contentReferences: (customerId: number) =>
    request<{ references: ContentReference[] }>(`/api/content/references?customerId=${customerId}`),
  createContentReference: (body: unknown) =>
    request<{ reference: ContentReference }>("/api/content/references", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  contentDrafts: (customerId: number) =>
    request<{ drafts: ContentDraft[]; columns: string[] }>(`/api/content/drafts?customerId=${customerId}`),
  generateContentDraft: (body: unknown) =>
    request<{ draft: ContentDraft }>("/api/content/generate", {
      method: "POST",
      body: JSON.stringify(body)
    })
};
