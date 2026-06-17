import app from "./app";
import { logger } from "./lib/logger";
import { initDiscordBot } from "./lib/discord-bot";
import { checkAllSeriesForUpdates } from "./lib/checker";
import cron from "node-cron";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  await initDiscordBot();

  cron.schedule("*/15 * * * *", async () => {
    logger.info("Cron: checking for new manga chapters...");
    await checkAllSeriesForUpdates();
  });

  logger.info("Manga checker cron scheduled (every 15 minutes)");
});
