export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    return;
  }

  try {
    process.env.JWT_SECRET ||= "cron-only-runtime-secret";
    const { waitUntil } = await import("@vercel/functions");
    const { assertCronAuth, enqueueDailyContentRowJobs, resolvePublicOrigin } = await import(
      "../../dist/modules/content/daily-content.service.js"
    );

    assertCronAuth(req);
    const runKey = req.query?.run ?? req.url?.match(/[?&]run=([^&]+)/)?.[1];
    const decodedRunKey = typeof runKey === "string" ? decodeURIComponent(runKey) : undefined;
    const origin = resolvePublicOrigin(req.headers["x-forwarded-host"], req.headers.host, req.headers["x-forwarded-proto"]);
    const { triggered, rowIndexes, work } = await enqueueDailyContentRowJobs(origin, decodedRunKey);
    waitUntil(work);

    res.status(202).json({
      ok: true,
      mode: "split_parallel",
      triggered,
      rowIndexes,
      runKey: decodedRunKey,
      message: "Đã kích hoạt từng dòng chạy song song. Refresh Google Sheet sau ~1–2 phút."
    });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    res.status(statusCode).json({
      ok: false,
      error: error?.code || "INTERNAL_ERROR",
      message: error?.message || "Daily content orchestrator failed."
    });
  }
}
