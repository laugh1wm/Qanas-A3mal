import axios from "axios";
import { logger } from "./logger";

const MANGADEX_API = "https://api.mangadex.org";

export interface MangaChapter {
  id: string;
  chapterNumber: string;
  title: string | null;
  url: string;
  publishedAt: string;
}

export interface MangaSeries {
  id: string;
  title: string;
  titleAr: string | null;
  coverUrl: string | null;
  latestChapters: MangaChapter[];
  hasArabicTranslation: boolean;
  language: string;
}

const LANG_MAP: Record<string, string> = {
  en: "English",
  ko: "Korean",
  zh: "Chinese",
  ja: "Japanese",
  "zh-hk": "Chinese (HK)",
};

export async function searchManga(query: string): Promise<MangaSeries[]> {
  try {
    const response = await axios.get(`${MANGADEX_API}/manga`, {
      params: {
        title: query,
        limit: 10,
        "order[relevance]": "desc",
        includes: ["cover_art"],
        availableTranslatedLanguage: ["en", "ko", "zh", "ja"],
      },
    });

    const results: MangaSeries[] = [];
    for (const manga of response.data.data) {
      const series = await buildMangaSeries(manga);
      if (series) results.push(series);
    }
    return results;
  } catch (err) {
    logger.error({ err }, "Failed to search manga on MangaDex");
    return [];
  }
}

export async function getMangaById(mangaId: string): Promise<MangaSeries | null> {
  try {
    const response = await axios.get(`${MANGADEX_API}/manga/${mangaId}`, {
      params: { includes: ["cover_art"] },
    });
    return buildMangaSeries(response.data.data);
  } catch (err) {
    logger.error({ err, mangaId }, "Failed to get manga by ID");
    return null;
  }
}

async function buildMangaSeries(manga: any): Promise<MangaSeries | null> {
  try {
    const mangaId = manga.id;
    const attrs = manga.attributes;

    const title =
      attrs.title?.en ||
      attrs.title?.ko ||
      attrs.title?.ja ||
      attrs.title?.["zh"] ||
      Object.values(attrs.title || {})[0] ||
      "Unknown Title";

    const titleAr = attrs.altTitles?.find((t: any) => t.ar)?.ar || null;

    const coverRel = manga.relationships?.find((r: any) => r.type === "cover_art");
    const coverUrl = coverRel?.attributes?.fileName
      ? `https://uploads.mangadex.org/covers/${mangaId}/${coverRel.attributes.fileName}.256.jpg`
      : null;

    const langEntry = Object.keys(attrs.title || {})[0] || "en";
    const language = LANG_MAP[langEntry] || langEntry;

    const chaptersResp = await axios.get(`${MANGADEX_API}/manga/${mangaId}/feed`, {
      params: {
        limit: 5,
        "order[chapter]": "desc",
        "order[publishAt]": "desc",
        translatedLanguage: ["en"],
      },
    });

    const latestChapters: MangaChapter[] = chaptersResp.data.data
      .filter((c: any) => c.attributes.chapter != null)
      .map((c: any) => ({
        id: c.id,
        chapterNumber: c.attributes.chapter,
        title: c.attributes.title || null,
        url: `https://mangadex.org/chapter/${c.id}`,
        publishedAt: c.attributes.publishAt,
      }));

    const arResp = await axios.get(`${MANGADEX_API}/manga/${mangaId}/feed`, {
      params: {
        limit: 1,
        translatedLanguage: ["ar"],
      },
    });
    const hasArabicTranslation = arResp.data.data.length > 0;

    return {
      id: mangaId,
      title: title as string,
      titleAr,
      coverUrl,
      latestChapters,
      hasArabicTranslation,
      language,
    };
  } catch (err) {
    logger.error({ err }, "Failed to build manga series object");
    return null;
  }
}

export async function getLatestChapters(mangaId: string, afterChapter?: string): Promise<MangaChapter[]> {
  try {
    const chaptersResp = await axios.get(`${MANGADEX_API}/manga/${mangaId}/feed`, {
      params: {
        limit: 10,
        "order[chapter]": "desc",
        "order[publishAt]": "desc",
        translatedLanguage: ["en"],
      },
    });

    const chapters: MangaChapter[] = chaptersResp.data.data
      .filter((c: any) => c.attributes.chapter != null)
      .map((c: any) => ({
        id: c.id,
        chapterNumber: c.attributes.chapter,
        title: c.attributes.title || null,
        url: `https://mangadex.org/chapter/${c.id}`,
        publishedAt: c.attributes.publishAt,
      }));

    if (!afterChapter) return chapters;

    const afterNum = parseFloat(afterChapter);
    return chapters.filter((c) => parseFloat(c.chapterNumber) > afterNum);
  } catch (err) {
    logger.error({ err, mangaId }, "Failed to get latest chapters");
    return [];
  }
}

export async function checkArabicTranslation(mangaId: string): Promise<boolean> {
  try {
    const resp = await axios.get(`${MANGADEX_API}/manga/${mangaId}/feed`, {
      params: { limit: 1, translatedLanguage: ["ar"] },
    });
    return resp.data.data.length > 0;
  } catch {
    return false;
  }
}
