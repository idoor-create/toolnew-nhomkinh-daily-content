import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { config } from "../../config.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";
import { getFreshTiktokAccessToken } from "../integrations/tiktok.service.js";

const phaseOneStatuses = ["draft", "scheduled"] as const;
const terminalStatuses = ["published", "failed", "partial"] as const;
const platforms = ["facebook", "tiktok"] as const;

const urlArraySchema = z.array(z.string().trim().url()).default([]);
const platformArraySchema = z.array(z.enum(platforms)).min(1);
const statusSchema = z.enum(phaseOneStatuses).default("draft");
const dateInputSchema = z
  .string()
  .trim()
  .datetime({ offset: true })
  .optional()
  .nullable();

type FacebookPublishResponse = {
  id?: string;
  error?: {
    message?: string;
  };
};

type TiktokCreatorInfoResponse = {
  data?: {
    privacy_level_options?: string[];
    comment_disabled?: boolean;
    duet_disabled?: boolean;
    stitch_disabled?: boolean;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type TiktokPublishResponse = {
  data?: {
    publish_id?: string;
    upload_url?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export const createPostSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).optional().nullable(),
  content: z.string().trim().min(1),
  platforms: platformArraySchema,
  facebookPageIds: z.array(z.string().trim().min(1)).default([]),
  mediaUrls: urlArraySchema,
  hashtags: z.string().trim().optional().nullable(),
  scheduledTime: dateInputSchema,
  status: statusSchema
});

export const updatePostSchema = z
  .object({
    customerId: z.coerce.number().int().positive().optional(),
    title: z.string().trim().min(1).optional().nullable(),
    content: z.string().trim().min(1).optional(),
    platforms: platformArraySchema.optional(),
    facebookPageIds: z.array(z.string().trim().min(1)).optional(),
    mediaUrls: urlArraySchema.optional(),
    hashtags: z.string().trim().optional().nullable(),
    scheduledTime: dateInputSchema,
    status: statusSchema.optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required."
  });

export const listPostsQuerySchema = z.object({
  customerId: z.coerce.number().int().positive().optional(),
  status: z.enum([...phaseOneStatuses, ...terminalStatuses]).optional(),
  from: z.string().trim().datetime({ offset: true }).optional(),
  to: z.string().trim().datetime({ offset: true }).optional()
});

function normalizeNullableString(value: string | null | undefined) {
  return value?.trim() || null;
}

function parseOptionalDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value);
}

function stringifyArray(values: string[]) {
  return JSON.stringify(values);
}

function parseArray(value: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return [];
  }

  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
}

function postResponse<T extends { platforms: string; facebookPageIds: string; mediaUrls: string }>(post: T) {
  return {
    ...post,
    platforms: parseArray(post.platforms),
    facebookPageIds: parseArray(post.facebookPageIds),
    mediaUrls: parseArray(post.mediaUrls)
  };
}

function buildMessage(content: string, hashtags: string | null) {
  const normalizedHashtags = hashtags?.trim();
  return normalizedHashtags ? `${content}\n\n${normalizedHashtags}` : content;
}

function assertScheduledTime(status: string, scheduledTime: Date | null) {
  if (status === "scheduled" && !scheduledTime) {
    throw new AppError(400, "SCHEDULED_TIME_REQUIRED", "scheduledTime is required when status is scheduled.");
  }

  if (!scheduledTime) {
    return;
  }

  const oneMinuteAgo = Date.now() - 60_000;

  if (scheduledTime.getTime() < oneMinuteAgo) {
    throw new AppError(400, "SCHEDULED_TIME_IN_PAST", "scheduledTime cannot be in the past.");
  }
}

function assertPlatformMedia(platformList: string[], mediaUrls: string[]) {
  if (platformList.includes("tiktok") && mediaUrls.length === 0) {
    throw new AppError(400, "TIKTOK_MEDIA_REQUIRED", "TikTok posts require at least one media URL.");
  }
}

async function assertCustomerExists(customerId: number) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      facebookConnected: true,
      facebookPageId: true,
      tiktokConnected: true,
      tiktokProfileName: true
    }
  });

  if (!customer) {
    throw new AppError(404, "NOT_FOUND", "Customer not found.");
  }

  return customer;
}

async function getPostOrThrow(id: number) {
  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          tiktokProfileName: true
        }
      }
    }
  });

  if (!post) {
    throw new AppError(404, "NOT_FOUND", "Post not found.");
  }

  return post;
}

export async function listPosts(input: unknown) {
  const query = listPostsQuerySchema.parse(input);
  const where: Prisma.PostWhereInput = {};

  if (query.customerId) {
    where.customerId = query.customerId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.from || query.to) {
    where.scheduledTime = {};

    if (query.from) {
      where.scheduledTime.gte = new Date(query.from);
    }

    if (query.to) {
      where.scheduledTime.lte = new Date(query.to);
    }
  }

  const posts = await prisma.post.findMany({
    where,
    include: {
      customer: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: [{ scheduledTime: "asc" }, { createdAt: "desc" }]
  });

  return posts.map(postResponse);
}

export async function getPost(id: number) {
  return postResponse(await getPostOrThrow(id));
}

export async function createPost(input: unknown) {
  const data = createPostSchema.parse(input);
  const customer = await assertCustomerExists(data.customerId);

  const scheduledTime = parseOptionalDate(data.scheduledTime);
  const mediaUrls = data.mediaUrls;

  assertScheduledTime(data.status, scheduledTime);
  assertPlatformMedia(data.platforms, mediaUrls);
  assertCustomerPlatforms(customer, data.platforms);
  await assertFacebookPageTargets(data.customerId, data.platforms, data.facebookPageIds);

  const post = await prisma.post.create({
    data: {
      customerId: data.customerId,
      title: normalizeNullableString(data.title),
      content: data.content,
      platforms: stringifyArray(data.platforms),
      facebookPageIds: stringifyArray(data.facebookPageIds),
      mediaUrls: stringifyArray(mediaUrls),
      hashtags: normalizeNullableString(data.hashtags),
      scheduledTime,
      status: data.status
    }
  });

  return postResponse(post);
}

export async function updatePost(id: number, input: unknown) {
  const currentPost = await getPostOrThrow(id);

  if (currentPost.status === "published") {
    throw new AppError(409, "POST_ALREADY_PUBLISHED", "Published posts cannot be edited.");
  }

  const data = updatePostSchema.parse(input);

  if (data.customerId) {
    await assertCustomerExists(data.customerId);
  }

  const customer = await assertCustomerExists(data.customerId ?? currentPost.customerId);
  const nextStatus = data.status ?? currentPost.status;
  const nextScheduledTime =
    "scheduledTime" in data ? parseOptionalDate(data.scheduledTime) : currentPost.scheduledTime;
  const nextPlatforms = data.platforms ?? parseArray(currentPost.platforms);
  const nextFacebookPageIds = data.facebookPageIds ?? parseArray(currentPost.facebookPageIds);
  const nextMediaUrls = data.mediaUrls ?? parseArray(currentPost.mediaUrls);

  assertScheduledTime(nextStatus, nextScheduledTime);
  assertPlatformMedia(nextPlatforms, nextMediaUrls);
  assertCustomerPlatforms(customer, nextPlatforms);
  await assertFacebookPageTargets(data.customerId ?? currentPost.customerId, nextPlatforms, nextFacebookPageIds);

  const post = await prisma.post.update({
    where: { id },
    data: {
      customerId: data.customerId,
      title: "title" in data ? normalizeNullableString(data.title) : undefined,
      content: data.content,
      platforms: data.platforms ? stringifyArray(data.platforms) : undefined,
      facebookPageIds: data.facebookPageIds ? stringifyArray(data.facebookPageIds) : undefined,
      mediaUrls: data.mediaUrls ? stringifyArray(data.mediaUrls) : undefined,
      hashtags: "hashtags" in data ? normalizeNullableString(data.hashtags) : undefined,
      scheduledTime: "scheduledTime" in data ? nextScheduledTime : undefined,
      status: data.status
    }
  });

  return postResponse(post);
}

async function publishFacebookPost(post: Awaited<ReturnType<typeof getPostOrThrow>>) {
  const targetPageIds = parseArray(post.facebookPageIds);
  const pages = await prisma.facebookPage.findMany({
    where: {
      customerId: post.customerId,
      pageId: { in: targetPageIds },
      connected: true
    },
    select: {
      pageId: true,
      pageName: true,
      pageAccessToken: true
    }
  });

  if (pages.length !== targetPageIds.length) {
    throw new AppError(400, "FACEBOOK_PAGE_INVALID", "One or more Facebook Pages are no longer connected.");
  }

  const message = buildMessage(post.content, post.hashtags);

  return Promise.all(
    pages.map(async (page) => {
      const feedUrl = new URL(`https://graph.facebook.com/${config.facebook.graphVersion}/${page.pageId}/feed`);
      const body = new URLSearchParams({
        message,
        access_token: page.pageAccessToken
      });

      try {
        const response = await fetch(feedUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body
        });
        const data = (await response.json()) as FacebookPublishResponse;

        if (!response.ok || !data.id) {
          const errorMessage = data.error?.message || "Facebook Graph API did not return a post id.";
          await prisma.postLog.create({
            data: {
              postId: post.id,
              platform: "facebook",
              status: "failed",
              errorMessage
            }
          });

          return {
            platform: "facebook",
            pageId: page.pageId,
            pageName: page.pageName,
            status: "failed" as const,
            errorMessage
          };
        }

        await prisma.postLog.create({
          data: {
            postId: post.id,
            platform: "facebook",
            status: "published",
            externalPostId: data.id,
            externalUrl: `https://www.facebook.com/${data.id}`
          }
        });

        return {
          platform: "facebook",
          pageId: page.pageId,
          pageName: page.pageName,
          status: "published" as const,
          externalPostId: data.id,
          externalUrl: `https://www.facebook.com/${data.id}`
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Facebook publish failed.";
        await prisma.postLog.create({
          data: {
            postId: post.id,
            platform: "facebook",
            status: "failed",
            errorMessage
          }
        });

        return {
          platform: "facebook",
          pageId: page.pageId,
          pageName: page.pageName,
          status: "failed" as const,
          errorMessage
        };
      }
    })
  );
}

async function fetchTiktokCreatorInfo(accessToken: string) {
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
  const data = (await response.json()) as TiktokCreatorInfoResponse;

  if (!response.ok || data.error?.code && data.error.code !== "ok") {
    throw new AppError(
      400,
      "TIKTOK_CREATOR_INFO_FAILED",
      data.error?.message || "Không lấy được creator info từ TikTok."
    );
  }

  return data.data ?? {};
}

function pickTiktokPrivacyLevel(options: string[] | undefined) {
  if (!options?.length) {
    return config.tiktok.defaultPrivacyLevel;
  }

  if (options.includes(config.tiktok.defaultPrivacyLevel)) {
    return config.tiktok.defaultPrivacyLevel;
  }

  if (options.includes("SELF_ONLY")) {
    return "SELF_ONLY";
  }

  return options[0];
}

async function publishTiktokPost(post: Awaited<ReturnType<typeof getPostOrThrow>>) {
  const mediaUrls = parseArray(post.mediaUrls);
  const videoUrl = mediaUrls[0];

  if (!videoUrl) {
    throw new AppError(400, "TIKTOK_MEDIA_REQUIRED", "TikTok posts require at least one video URL.");
  }

  const accessToken = await getFreshTiktokAccessToken(post.customerId);
  const creatorInfo = await fetchTiktokCreatorInfo(accessToken);
  const privacyLevel = pickTiktokPrivacyLevel(creatorInfo.privacy_level_options);
  const response = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8"
    },
    body: JSON.stringify({
      post_info: {
        title: buildMessage(post.content, post.hashtags),
        privacy_level: privacyLevel,
        disable_duet: Boolean(creatorInfo.duet_disabled),
        disable_comment: Boolean(creatorInfo.comment_disabled),
        disable_stitch: Boolean(creatorInfo.stitch_disabled),
        brand_content_toggle: false,
        brand_organic_toggle: false
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: videoUrl
      }
    })
  });
  const data = (await response.json()) as TiktokPublishResponse;

  if (!response.ok || data.error?.code && data.error.code !== "ok" || !data.data?.publish_id) {
    const errorMessage = data.error?.message || "TikTok Content Posting API did not return a publish id.";
    await prisma.postLog.create({
      data: {
        postId: post.id,
        platform: "tiktok",
        status: "failed",
        errorMessage
      }
    });

    return {
      platform: "tiktok",
      profileName: post.customer.tiktokProfileName,
      status: "failed" as const,
      errorMessage
    };
  }

  await prisma.postLog.create({
    data: {
      postId: post.id,
      platform: "tiktok",
      status: "published",
      externalPostId: data.data.publish_id
    }
  });

  return {
    platform: "tiktok",
    profileName: post.customer.tiktokProfileName,
    status: "published" as const,
    externalPostId: data.data.publish_id
  };
}

export async function publishPost(id: number) {
  const post = await getPostOrThrow(id);

  if (!phaseOneStatuses.includes(post.status as (typeof phaseOneStatuses)[number])) {
    throw new AppError(409, "POST_CANNOT_BE_PUBLISHED", "Only draft or scheduled posts can be published.");
  }

  const platformList = parseArray(post.platforms);
  const results = [];

  if (platformList.includes("facebook")) {
    results.push(...(await publishFacebookPost(post)));
  }

  if (platformList.includes("tiktok")) {
    results.push(await publishTiktokPost(post));
  }

  const hasSuccess = results.some((result) => result.status === "published");
  const hasFailure = results.some((result) => result.status === "failed");
  const status = hasFailure && hasSuccess ? "partial" : hasFailure ? "failed" : "published";

  const updatedPost = await prisma.post.update({
    where: { id: post.id },
    data: {
      status,
      publishedTime: hasSuccess ? new Date() : null
    }
  });

  return {
    post: postResponse(updatedPost),
    results
  };
}

export async function publishDuePosts(now = new Date()) {
  const posts = await prisma.post.findMany({
    where: {
      status: "scheduled",
      scheduledTime: {
        lte: now
      }
    },
    orderBy: { scheduledTime: "asc" },
    select: { id: true }
  });

  const results = [];
  for (const post of posts) {
    results.push(await publishPost(post.id));
  }

  return {
    count: results.length,
    results
  };
}

async function assertFacebookPageTargets(customerId: number, platformList: string[], facebookPageIds: string[]) {
  if (!platformList.includes("facebook")) {
    return;
  }

  if (facebookPageIds.length === 0) {
    throw new AppError(400, "FACEBOOK_PAGE_REQUIRED", "Select at least one Facebook Page.");
  }

  const uniquePageIds = [...new Set(facebookPageIds)];
  const pages = await prisma.facebookPage.findMany({
    where: {
      customerId,
      pageId: { in: uniquePageIds },
      connected: true
    },
    select: { pageId: true }
  });

  if (pages.length !== uniquePageIds.length) {
    throw new AppError(400, "FACEBOOK_PAGE_INVALID", "One or more Facebook Pages do not belong to this customer.");
  }
}

function assertCustomerPlatforms(
  customer: {
    facebookConnected: boolean;
    facebookPageId: string | null;
    tiktokConnected: boolean;
    tiktokProfileName: string | null;
  },
  platformList: string[]
) {
  if (platformList.includes("facebook") && (!customer.facebookConnected || !customer.facebookPageId)) {
    throw new AppError(400, "FACEBOOK_NOT_CONFIGURED", "Customer has not configured a Facebook page.");
  }

  if (platformList.includes("tiktok") && (!customer.tiktokConnected || !customer.tiktokProfileName)) {
    throw new AppError(400, "TIKTOK_NOT_CONFIGURED", "Customer has not configured a TikTok profile.");
  }
}

export async function deletePost(id: number) {
  const post = await getPostOrThrow(id);

  if (!phaseOneStatuses.includes(post.status as (typeof phaseOneStatuses)[number])) {
    throw new AppError(409, "POST_CANNOT_BE_DELETED", "Only draft or scheduled posts can be deleted.");
  }

  await prisma.post.delete({
    where: { id }
  });
}
