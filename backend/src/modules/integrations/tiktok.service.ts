import jwt from "jsonwebtoken";
import { config } from "../../config.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../middleware/error.js";

type TiktokState = {
  customerId: number;
};

type TiktokTokenResponse = {
  access_token?: string;
  expires_in?: number;
  open_id?: string;
  refresh_expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
  message?: string;
};

type ValidTiktokTokenResponse = TiktokTokenResponse & {
  access_token: string;
};

type TiktokUserInfoResponse = {
  data?: {
    user?: {
      open_id?: string;
      avatar_url?: string;
      display_name?: string;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
};

function assertTiktokConfigured() {
  if (!config.tiktok.clientKey || !config.tiktok.clientSecret) {
    throw new AppError(
      400,
      "TIKTOK_APP_NOT_CONFIGURED",
      "TikTok Client Key/Secret chưa được cấu hình trên backend."
    );
  }
}

function secondsFromNow(seconds: number | undefined) {
  if (!seconds || !Number.isFinite(seconds)) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000);
}

async function exchangeToken(body: URLSearchParams): Promise<ValidTiktokTokenResponse> {
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache"
    },
    body
  });
  const data = (await response.json()) as TiktokTokenResponse;

  if (!response.ok || !data.access_token) {
    throw new AppError(
      400,
      "TIKTOK_TOKEN_EXCHANGE_FAILED",
      data.error_description || data.message || data.error || "Không đổi được TikTok code thành access token."
    );
  }

  return data as ValidTiktokTokenResponse;
}

export async function createTiktokConnectUrl(customerId: number) {
  assertTiktokConfigured();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true }
  });

  if (!customer) {
    throw new AppError(404, "NOT_FOUND", "Customer not found.");
  }

  const state = jwt.sign({ customerId }, config.jwtSecret, { expiresIn: "15m" });
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");

  url.searchParams.set("client_key", config.tiktok.clientKey);
  url.searchParams.set("redirect_uri", config.tiktok.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", config.tiktok.scopes.join(","));
  url.searchParams.set("response_type", "code");

  return { authUrl: url.toString() };
}

export async function handleTiktokCallback(query: { code?: string; state?: string; error?: string; errorDescription?: string }) {
  assertTiktokConfigured();

  if (query.error) {
    throw new AppError(400, "TIKTOK_AUTH_DENIED", query.errorDescription || query.error);
  }

  if (!query.code || !query.state) {
    throw new AppError(400, "TIKTOK_CALLBACK_INVALID", "TikTok callback thiếu code hoặc state.");
  }

  let state: TiktokState;

  try {
    state = jwt.verify(query.state, config.jwtSecret) as TiktokState;
  } catch {
    throw new AppError(400, "TIKTOK_STATE_INVALID", "TikTok state không hợp lệ hoặc đã hết hạn.");
  }

  const token = await exchangeToken(
    new URLSearchParams({
      client_key: config.tiktok.clientKey,
      client_secret: config.tiktok.clientSecret,
      code: query.code,
      grant_type: "authorization_code",
      redirect_uri: config.tiktok.redirectUri
    })
  );

  const profile = await fetchTiktokProfile(token.access_token);

  const displayName = profile.displayName || token.open_id || "TikTok profile";
  await prisma.customer.update({
    where: { id: state.customerId },
    data: {
      tiktokOpenId: token.open_id || profile.openId || null,
      tiktokProfileName: displayName,
      tiktokAvatarUrl: profile.avatarUrl,
      tiktokAccessToken: token.access_token,
      tiktokRefreshToken: token.refresh_token || null,
      tiktokAccessTokenExpiresAt: secondsFromNow(token.expires_in),
      tiktokRefreshTokenExpiresAt: secondsFromNow(token.refresh_expires_in),
      tiktokConnected: true,
      tiktokReconnectRequired: false
    }
  });

  return {
    customerId: state.customerId,
    profile: {
      openId: token.open_id || profile.openId || null,
      displayName,
      avatarUrl: profile.avatarUrl
    }
  };
}

export async function fetchTiktokProfile(accessToken: string | undefined) {
  if (!accessToken) {
    return { openId: null, displayName: null, avatarUrl: null };
  }

  const url = new URL("https://open.tiktokapis.com/v2/user/info/");
  url.searchParams.set("fields", "open_id,avatar_url,display_name");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const data = (await response.json()) as TiktokUserInfoResponse;

  if (!response.ok || data.error?.code && data.error.code !== "ok") {
    return { openId: null, displayName: null, avatarUrl: null };
  }

  return {
    openId: data.data?.user?.open_id || null,
    displayName: data.data?.user?.display_name || null,
    avatarUrl: data.data?.user?.avatar_url || null
  };
}

export async function getFreshTiktokAccessToken(customerId: number) {
  assertTiktokConfigured();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      tiktokAccessToken: true,
      tiktokRefreshToken: true,
      tiktokAccessTokenExpiresAt: true
    }
  });

  const currentAccessToken = customer?.tiktokAccessToken;
  if (!currentAccessToken) {
    throw new AppError(400, "TIKTOK_NOT_CONFIGURED", "Customer has not connected TikTok.");
  }

  const expiresAt = customer.tiktokAccessTokenExpiresAt?.getTime() ?? 0;
  const refreshMarginMs = 5 * 60 * 1000;
  if (expiresAt > Date.now() + refreshMarginMs) {
    return currentAccessToken;
  }

  if (!customer.tiktokRefreshToken) {
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        tiktokConnected: false,
        tiktokReconnectRequired: true
      }
    });
    throw new AppError(400, "TIKTOK_RECONNECT_REQUIRED", "TikTok token đã hết hạn. Cần kết nối lại TikTok.");
  }

  const token = await exchangeToken(
    new URLSearchParams({
      client_key: config.tiktok.clientKey,
      client_secret: config.tiktok.clientSecret,
      grant_type: "refresh_token",
      refresh_token: customer.tiktokRefreshToken
    })
  );

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      tiktokAccessToken: token.access_token,
      tiktokRefreshToken: token.refresh_token || customer.tiktokRefreshToken,
      tiktokAccessTokenExpiresAt: secondsFromNow(token.expires_in),
      tiktokRefreshTokenExpiresAt: secondsFromNow(token.refresh_expires_in),
      tiktokConnected: true,
      tiktokReconnectRequired: false
    }
  });

  return token.access_token;
}
