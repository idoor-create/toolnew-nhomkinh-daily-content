function secretFromRequest(req) {
  const authorization = req.headers.authorization || "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1] || req.headers["x-cron-secret"] || authorization;
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    return;
  }

  try {
    process.env.JWT_SECRET ||= "cron-only-runtime-secret";
    const { assertCronSecret, runDailyContentJob } = await import("../../dist/modules/content/daily-content.service.js");
    assertCronSecret(secretFromRequest(req));
    const result = await runDailyContentJob();
    res.status(200).json({ ok: true, result });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    res.status(statusCode).json({
      ok: false,
      error: error?.code || "INTERNAL_ERROR",
      message: error?.message || "Daily content job failed."
    });
  }
}
