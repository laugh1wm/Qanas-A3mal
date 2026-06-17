import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  trackedSeriesTable,
  discordConfigTable,
  chapterNotificationsTable,
} from "@workspace/db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { searchManga } from "../lib/mangadex";
import { checkAllSeriesForUpdates } from "../lib/checker";

const router: IRouter = Router();

router.get("/manga/stats", async (_req, res): Promise<void> => {
  const [totalSeriesRow] = await db
    .select({ count: count() })
    .from(trackedSeriesTable)
    .where(eq(trackedSeriesTable.isActive, true));

  const [totalNotifRow] = await db
    .select({ count: count() })
    .from(chapterNotificationsTable);

  const [totalServersRow] = await db
    .select({ count: count() })
    .from(discordConfigTable)
    .where(eq(discordConfigTable.isActive, true));

  const [arabicRow] = await db
    .select({ count: count() })
    .from(trackedSeriesTable)
    .where(
      and(
        eq(trackedSeriesTable.isActive, true),
        eq(trackedSeriesTable.hasArabicTranslation, true)
      )
    );

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [recentRow] = await db
    .select({ count: count() })
    .from(trackedSeriesTable)
    .where(
      and(
        eq(trackedSeriesTable.isActive, true),
        sql`${trackedSeriesTable.updatedAt} > ${sevenDaysAgo.toISOString()}`
      )
    );

  res.json({
    totalSeries: totalSeriesRow?.count ?? 0,
    totalNotifications: totalNotifRow?.count ?? 0,
    totalServers: totalServersRow?.count ?? 0,
    arabicTranslated: arabicRow?.count ?? 0,
    recentlyUpdated: recentRow?.count ?? 0,
  });
});

router.get("/manga/notifications", async (req, res): Promise<void> => {
  const limitRaw = req.query.limit as string | undefined;
  const limit = limitRaw ? parseInt(limitRaw, 10) : 50;

  const notifs = await db
    .select({
      id: chapterNotificationsTable.id,
      seriesId: chapterNotificationsTable.seriesId,
      seriesTitle: trackedSeriesTable.title,
      coverUrl: trackedSeriesTable.coverUrl,
      chapterNumber: chapterNotificationsTable.chapterNumber,
      chapterTitle: chapterNotificationsTable.chapterTitle,
      chapterUrl: chapterNotificationsTable.chapterUrl,
      notifiedAt: chapterNotificationsTable.notifiedAt,
    })
    .from(chapterNotificationsTable)
    .innerJoin(
      trackedSeriesTable,
      eq(chapterNotificationsTable.seriesId, trackedSeriesTable.id)
    )
    .orderBy(desc(chapterNotificationsTable.notifiedAt))
    .limit(limit);

  res.json(notifs);
});

router.get("/manga/servers", async (_req, res): Promise<void> => {
  const servers = await db
    .select()
    .from(discordConfigTable)
    .where(eq(discordConfigTable.isActive, true))
    .orderBy(desc(discordConfigTable.createdAt));

  res.json(servers);
});

router.get("/manga/series", async (_req, res): Promise<void> => {
  const series = await db
    .select()
    .from(trackedSeriesTable)
    .where(eq(trackedSeriesTable.isActive, true))
    .orderBy(desc(trackedSeriesTable.updatedAt));

  res.json(series);
});

router.get("/manga/series/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [series] = await db
    .select()
    .from(trackedSeriesTable)
    .where(eq(trackedSeriesTable.id, id));

  if (!series) {
    res.status(404).json({ error: "Series not found" });
    return;
  }

  const notifications = await db
    .select()
    .from(chapterNotificationsTable)
    .where(eq(chapterNotificationsTable.seriesId, id))
    .orderBy(desc(chapterNotificationsTable.notifiedAt))
    .limit(20);

  res.json({ series, notifications });
});

router.delete("/manga/series/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db
    .update(trackedSeriesTable)
    .set({ isActive: false })
    .where(eq(trackedSeriesTable.id, id));

  res.sendStatus(204);
});

router.get("/manga/search", async (req, res): Promise<void> => {
  const query = req.query.q as string;
  if (!query) {
    res.status(400).json({ error: "q parameter required" });
    return;
  }

  const results = await searchManga(query);
  res.json(results);
});

router.post("/manga/track", async (req, res): Promise<void> => {
  const body = req.body as {
    externalId?: string;
    title?: string;
    titleAr?: string | null;
    coverUrl?: string | null;
    language?: string;
    hasArabicTranslation?: boolean;
    latestChapter?: string | null;
  };

  if (!body.externalId || !body.title || !body.language) {
    res.status(400).json({ error: "externalId, title, and language are required" });
    return;
  }

  const existing = await db
    .select()
    .from(trackedSeriesTable)
    .where(
      and(
        eq(trackedSeriesTable.externalId, body.externalId),
        eq(trackedSeriesTable.sourceName, "mangadex")
      )
    );

  if (existing.length > 0) {
    if (!existing[0].isActive) {
      const [reactivated] = await db
        .update(trackedSeriesTable)
        .set({ isActive: true })
        .where(eq(trackedSeriesTable.id, existing[0].id))
        .returning();
      res.status(201).json(reactivated);
      return;
    }
    res.status(409).json({ error: "Already tracked" });
    return;
  }

  const [series] = await db
    .insert(trackedSeriesTable)
    .values({
      title: body.title,
      titleAr: body.titleAr ?? null,
      coverUrl: body.coverUrl ?? null,
      sourceUrl: `https://mangadex.org/title/${body.externalId}`,
      sourceName: "mangadex",
      externalId: body.externalId,
      latestChapter: body.latestChapter ?? null,
      latestChapterCount: 0,
      hasArabicTranslation: body.hasArabicTranslation ?? false,
      language: body.language,
      isActive: true,
    })
    .returning();

  res.status(201).json(series);
});

router.get("/manga/config", async (_req, res): Promise<void> => {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    res.json(null);
    return;
  }

  const [config] = await db
    .select()
    .from(discordConfigTable)
    .where(
      and(
        eq(discordConfigTable.guildId, guildId),
        eq(discordConfigTable.isActive, true)
      )
    );

  res.json(config || null);
});

router.post("/manga/check", async (req, res): Promise<void> => {
  res.json({ message: "Check started" });
  checkAllSeriesForUpdates().catch((err) => {
    req.log.error({ err }, "Manual check failed");
  });
});

export default router;
