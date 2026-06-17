import { db } from "@workspace/db";
import {
  trackedSeriesTable,
  chapterNotificationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { getLatestChapters, checkArabicTranslation } from "./mangadex";
import { sendNewChapterNotification } from "./discord-bot";

export async function checkAllSeriesForUpdates(): Promise<void> {
  logger.info("Starting manga update check...");

  const activeSeries = await db
    .select()
    .from(trackedSeriesTable)
    .where(eq(trackedSeriesTable.isActive, true));

  if (activeSeries.length === 0) {
    logger.info("No active series to check");
    return;
  }

  logger.info({ count: activeSeries.length }, "Checking series for updates");

  for (const series of activeSeries) {
    try {
      await checkSeriesForUpdates(series);
      await sleep(1500);
    } catch (err) {
      logger.error({ err, seriesId: series.id, title: series.title }, "Error checking series");
    }
  }

  logger.info("Finished manga update check");
}

async function checkSeriesForUpdates(series: typeof trackedSeriesTable.$inferSelect): Promise<void> {
  const newChapters = await getLatestChapters(series.externalId, series.latestChapter ?? undefined);

  if (newChapters.length === 0) return;

  const sortedNew = newChapters.sort(
    (a, b) => parseFloat(a.chapterNumber) - parseFloat(b.chapterNumber)
  );

  for (const chapter of sortedNew) {
    const alreadyNotified = await db
      .select()
      .from(chapterNotificationsTable)
      .where(
        and(
          eq(chapterNotificationsTable.seriesId, series.id),
          eq(chapterNotificationsTable.chapterNumber, chapter.chapterNumber)
        )
      );

    if (alreadyNotified.length > 0) continue;

    logger.info({ title: series.title, chapter: chapter.chapterNumber }, "New chapter found");

    const hasArabic = await checkArabicTranslation(series.externalId);

    const totalChapters = Math.max(
      parseFloat(chapter.chapterNumber),
      series.latestChapterCount ?? 0
    );

    await sendNewChapterNotification(
      {
        title: series.title,
        coverUrl: series.coverUrl,
        sourceUrl: series.sourceUrl,
        latestChapter: chapter.chapterNumber,
        hasArabicTranslation: hasArabic,
        language: series.language,
      },
      chapter,
      Math.floor(totalChapters)
    );

    await db.insert(chapterNotificationsTable).values({
      seriesId: series.id,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.title,
      chapterUrl: chapter.url,
    });

    await db
      .update(trackedSeriesTable)
      .set({
        latestChapter: chapter.chapterNumber,
        latestChapterCount: Math.floor(totalChapters),
        hasArabicTranslation: hasArabic,
      })
      .where(eq(trackedSeriesTable.id, series.id));
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
