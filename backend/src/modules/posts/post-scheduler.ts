import { publishDuePosts } from "./posts.service.js";

const pollIntervalMs = 30_000;

export function startPostScheduler() {
  let running = false;

  const run = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const result = await publishDuePosts();
      if (result.count > 0) {
        console.log(`Published ${result.count} due post(s).`);
      }
    } catch (error) {
      console.error("Failed to publish due posts.", error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(run, pollIntervalMs);
  void run();

  return () => clearInterval(timer);
}
