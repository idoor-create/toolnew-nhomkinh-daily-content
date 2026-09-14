import jwt from "jsonwebtoken";
import { config } from "../../config.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";

type FacebookState = {
  customerId: number;
};

type FacebookTokenResponse = {
  access_token?: string;
  error?: {
    message?: string;
  };
};

type FacebookAccountsResponse = {
  data?: Array<{
    id: string;
    name: string;
    access_token: string;
  }>;
  error?: {
    message?: string;
  };
};

function assertFacebookConfigured() {
  if (!config.facebook.appId || !config.facebook.appSecret) {
    throw new AppError(
      400,
      "FACEBOOK_APP_NOT_CONFIGURED",
      "Facebook App ID/Secret chưa được cấu hình trên backend."
    );
  }
}

export async function createFacebookConnectUrl(customerId: number) {
  assertFacebookConfigured();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true }
  });

  if (!customer) {
    throw new AppError(404, "NOT_FOUND", "Customer not found.");
  }

  const state = jwt.sign({ customerId }, config.jwtSecret, { expiresIn: "15m" });
  const url = new URL(`https://www.facebook.com/${config.facebook.graphVersion}/dialog/oauth`);

  url.searchParams.set("client_id", config.facebook.appId);
  url.searchParams.set("redirect_uri", config.facebook.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", config.facebook.scopes.join(","));
  url.searchParams.set("response_type", "code");

  return { authUrl: url.toString() };
}

export async function handleFacebookCallback(query: { code?: string; state?: string }) {
  assertFacebookConfigured();

  if (!query.code || !query.state) {
    throw new AppError(400, "FACEBOOK_CALLBACK_INVALID", "Facebook callback thiếu code hoặc state.");
  }

  let state: FacebookState;

  try {
    state = jwt.verify(query.state, config.jwtSecret) as FacebookState;
  } catch {
    throw new AppError(400, "FACEBOOK_STATE_INVALID", "Facebook state không hợp lệ hoặc đã hết hạn.");
  }

  const tokenUrl = new URL(`https://graph.facebook.com/${config.facebook.graphVersion}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", config.facebook.appId);
  tokenUrl.searchParams.set("client_secret", config.facebook.appSecret);
  tokenUrl.searchParams.set("redirect_uri", config.facebook.redirectUri);
  tokenUrl.searchParams.set("code", query.code);

  const tokenResponse = (await (await fetch(tokenUrl)).json()) as FacebookTokenResponse;

  if (!tokenResponse.access_token) {
    throw new AppError(
      400,
      "FACEBOOK_TOKEN_EXCHANGE_FAILED",
      tokenResponse.error?.message || "Không đổi được Facebook code thành access token."
    );
  }

  const pagesUrl = new URL(`https://graph.facebook.com/${config.facebook.graphVersion}/me/accounts`);
  pagesUrl.searchParams.set("fields", "id,name,access_token");
  pagesUrl.searchParams.set("access_token", tokenResponse.access_token);

  const pagesResponse = (await (await fetch(pagesUrl)).json()) as FacebookAccountsResponse;
  const pages = pagesResponse.data ?? [];

  if (pages.length === 0) {
    throw new AppError(
      400,
      "FACEBOOK_PAGE_NOT_FOUND",
      pagesResponse.error?.message || "Facebook account này chưa cấp Page phù hợp."
    );
  }

  const primaryPage = pages[0];

  await prisma.$transaction(async (tx) => {
    for (const page of pages) {
      await tx.facebookPage.upsert({
        where: {
          customerId_pageId: {
            customerId: state.customerId,
            pageId: page.id
          }
        },
        update: {
          pageName: page.name,
          pageAccessToken: page.access_token,
          connected: true
        },
        create: {
          customerId: state.customerId,
          pageId: page.id,
          pageName: page.name,
          pageAccessToken: page.access_token,
          connected: true
        }
      });
    }

    await tx.customer.update({
      where: { id: state.customerId },
      data: {
        facebookConnected: true,
        facebookPageId: primaryPage.id,
        facebookPageName: primaryPage.name,
        facebookToken: primaryPage.access_token,
        facebookReconnectRequired: false
      }
    });
  });

  return {
    customerId: state.customerId,
    pages: pages.map((page) => ({
      pageId: page.id,
      pageName: page.name
    }))
  };
}

export async function listFacebookPages(customerId: number) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true }
  });

  if (!customer) {
    throw new AppError(404, "NOT_FOUND", "Customer not found.");
  }

  const pages = await prisma.facebookPage.findMany({
    where: {
      customerId,
      connected: true
    },
    select: {
      id: true,
      pageId: true,
      pageName: true,
      connected: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { pageName: "asc" }
  });

  return { pages };
}
