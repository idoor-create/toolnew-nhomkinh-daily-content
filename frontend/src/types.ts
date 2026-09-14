export type User = {
  id: number;
  email: string;
  name: string;
};

export type Customer = {
  id: number;
  name: string;
  contactName: string | null;
  facebookPageId: string | null;
  facebookPageName: string | null;
  tiktokOpenId: string | null;
  tiktokProfileName: string | null;
  tiktokAvatarUrl: string | null;
  facebookConnected: boolean;
  tiktokConnected: boolean;
  tiktokReconnectRequired: boolean;
  facebookReconnectRequired: boolean;
  facebookPages: FacebookPage[];
  createdAt: string;
  updatedAt: string;
};

export type FacebookPage = {
  id: number;
  pageId: string;
  pageName: string;
  connected: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerInput = {
  name: string;
  contactName?: string | null;
  facebookPageId?: string | null;
  facebookPageName?: string | null;
  tiktokProfileName?: string | null;
  facebookConnected?: boolean;
  tiktokConnected?: boolean;
};

export type PostStatus = "draft" | "scheduled" | "published" | "failed" | "partial";
export type Platform = "facebook" | "tiktok";

export type Post = {
  id: number;
  customerId: number;
  title: string | null;
  content: string;
  platforms: Platform[];
  facebookPageIds: string[];
  mediaUrls: string[];
  hashtags: string | null;
  scheduledTime: string | null;
  publishedTime: string | null;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
  customer?: { id: number; name: string };
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ContentReference = {
  id: number;
  customerId: number;
  platform: "facebook" | "tiktok" | "instagram" | "other";
  sourceUrl: string;
  sourceTitle: string;
  sourceImageUrl: string | null;
  originalImageUrl: string | null;
  views: number | null;
  reactions: number | null;
  comments: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentSheetRow = {
  thoi_gian: string;
  tu_khoa_chinh: string;
  tu_khoa_phu: string;
  y_dinh_tim_kiem: string;
  title_seo: string;
  meta_description: string;
  h1: string;
  slug: string;
  dan_y: string;
  noi_dung_seo: string;
  caption_tiktok: string;
  caption_facebook: string;
  kich_ban_video: string;
  hashtag: string;
  link_nguon: string;
  image: string;
  noi_dau_khach: string;
};

export type ContentDraft = {
  id: number;
  customerId: number;
  referenceIds: number[];
  sheetRow: ContentSheetRow;
  createdAt: string;
  updatedAt: string;
};
