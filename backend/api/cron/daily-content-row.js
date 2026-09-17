export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    return;
  }

  try {
    process.env.JWT_SECRET ||= "cron-only-runtime-secret";
    const { assertCronAuth, runDailyContentRow } = await import("../../dist/modules/content/daily-content.service.js");
    assertCronAuth(req);

    const rawIndex = req.query?.index ?? req.url?.match(/[?&]index=(\d+)/)?.[1];
    const rowIndex = Number(rawIndex);
    if (!Number.isInteger(rowIndex)) {
      res.status(400).json({ ok: false, error: "INVALID_ROW_INDEX", message: "Thiếu query index=0,1,..." });
      return;
    }

    const rawRun = req.query?.run ?? req.url?.match(/[?&]run=([^&]+)/)?.[1];
    const runKey = typeof rawRun === "string" ? decodeURIComponent(rawRun) : undefined;
    const result = await runDailyContentRow(rowIndex, { runKey });
    res.status(200).json({ ok: true, result });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    res.status(statusCode).json({
      ok: false,
      error: error?.code || "INTERNAL_ERROR",
      message: error?.message || "Daily content row failed."
    });
  }
}
