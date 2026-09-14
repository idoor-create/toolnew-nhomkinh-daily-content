import { config } from "./config.js";
import { createApp } from "./app.js";
import { startPostScheduler } from "./modules/posts/post-scheduler.js";

const app = createApp();
const stopPostScheduler = startPostScheduler();

const server = app.listen(config.port, config.host, () => {
  console.log(`API listening on http://${config.host}:${config.port}`);
});

server.on("error", (error) => {
  console.error("Failed to start API server:", error);
  process.exit(1);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down API server.`);
  stopPostScheduler();
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
