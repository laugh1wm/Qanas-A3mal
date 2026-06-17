import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  TextChannel,
  SlashCommandBuilder,
  REST,
  Routes,
  type ChatInputCommandInteraction,
} from "discord.js";
import { db } from "@workspace/db";
import {
  trackedSeriesTable,
  discordConfigTable,
  chapterNotificationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { searchManga, getLatestChapters, checkArabicTranslation } from "./mangadex";

const ADMIN_USERNAME = "mostafa_el6arsh";

let client: Client | null = null;

export function getClient(): Client | null {
  return client;
}

const commands = [
  new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("تحديد الروم الذي سترسل فيه الإشعارات")
    .addChannelOption((o) =>
      o.setName("channel").setDescription("الروم المطلوب").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("track")
    .setDescription("تتبع مانهوا/مانجا جديدة")
    .addStringOption((o) =>
      o.setName("query").setDescription("اسم العمل").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("untrack")
    .setDescription("إيقاف تتبع مانهوا/مانجا")
    .addStringOption((o) =>
      o.setName("id").setDescription("رقم العمل من قائمة /list").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("عرض جميع الأعمال المتتبعة"),

  new SlashCommandBuilder()
    .setName("servers")
    .setDescription("عرض السيرفرات المسجلة والرومات"),
];

function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  return interaction.user.username === ADMIN_USERNAME;
}

async function replyForbidden(interaction: ChatInputCommandInteraction) {
  await interaction.reply({
    content: "🚫 هذا الأمر متاح للأدمن فقط.",
    ephemeral: true,
  });
}

export async function initDiscordBot(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set — bot disabled");
    return;
  }

  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  client.once("clientReady", async (c) => {
    logger.info({ tag: c.user.tag }, "Discord bot ready");

    const rest = new REST({ version: "10" }).setToken(token);
    await rest.put(Routes.applicationCommands(c.application.id), {
      body: commands.map((cmd) => cmd.toJSON()),
    });
    logger.info("Global slash commands registered");
  });

  client.on("guildCreate", async (guild) => {
    logger.info({ guildId: guild.id, guildName: guild.name }, "Bot added to new server");
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await handleCommand(interaction);
  });

  client.on("error", (err) => {
    logger.error({ err }, "Discord client error");
  });

  await client.login(token);
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
  const { commandName } = interaction;

  try {
    if (!isAdmin(interaction)) {
      await replyForbidden(interaction);
      return;
    }

    if (commandName === "setchannel") {
      await handleSetChannel(interaction);
    } else if (commandName === "track") {
      await handleTrack(interaction);
    } else if (commandName === "untrack") {
      await handleUntrack(interaction);
    } else if (commandName === "list") {
      await handleList(interaction);
    } else if (commandName === "servers") {
      await handleServers(interaction);
    }
  } catch (err) {
    logger.error({ err, commandName }, "Error handling Discord command");
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ حصل خطأ. حاول تاني.", ephemeral: true });
    }
  }
}

async function handleSetChannel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel("channel", true);
  const guildId = interaction.guildId!;
  const guildName = interaction.guild?.name ?? null;

  await db
    .delete(discordConfigTable)
    .where(eq(discordConfigTable.guildId, guildId));

  await db.insert(discordConfigTable).values({
    guildId,
    guildName,
    channelId: channel.id,
    channelName: channel.name ?? null,
    isActive: true,
  });

  logger.info({ guildId, guildName, channelId: channel.id }, "Channel configured");
  await interaction.editReply(
    `✅ تم ربط سيرفر **${guildName ?? guildId}** بروم <#${channel.id}> للإشعارات!`
  );
}

async function handleTrack(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const query = interaction.options.getString("query", true);

  const results = await searchManga(query);
  if (results.length === 0) {
    await interaction.editReply("❌ مفيش نتايج. جرب اسم تاني.");
    return;
  }

  const top = results[0];

  const existing = await db
    .select()
    .from(trackedSeriesTable)
    .where(
      and(
        eq(trackedSeriesTable.externalId, top.id),
        eq(trackedSeriesTable.sourceName, "mangadex")
      )
    );

  if (existing.length > 0) {
    await interaction.editReply(`⚠️ "${top.title}" بيتاتبع بالفعل!`);
    return;
  }

  const latestChapter = top.latestChapters[0]?.chapterNumber || null;
  const latestCount = top.latestChapters[0]
    ? parseFloat(top.latestChapters[0].chapterNumber)
    : 0;

  await db.insert(trackedSeriesTable).values({
    title: top.title,
    titleAr: top.titleAr,
    coverUrl: top.coverUrl,
    sourceUrl: `https://mangadex.org/title/${top.id}`,
    sourceName: "mangadex",
    externalId: top.id,
    latestChapter,
    latestChapterCount: Math.floor(latestCount),
    hasArabicTranslation: top.hasArabicTranslation,
    language: top.language,
    isActive: true,
  });

  const embed = new EmbedBuilder()
    .setTitle(`✅ تم إضافة "${top.title}" للمتابعة`)
    .setColor(0x00ae86)
    .addFields(
      { name: "📚 المصدر", value: "MangaDex", inline: true },
      { name: "🌐 اللغة", value: top.language, inline: true },
      {
        name: "🇸🇦 ترجمة عربية",
        value: top.hasArabicTranslation ? "✅ موجودة" : "❌ غير موجودة",
        inline: true,
      },
      {
        name: "📖 آخر فصل",
        value: latestChapter ? `الفصل ${latestChapter}` : "غير معروف",
        inline: true,
      }
    );

  if (top.coverUrl) embed.setThumbnail(top.coverUrl);

  await interaction.editReply({ embeds: [embed] });
}

async function handleUntrack(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const idStr = interaction.options.getString("id", true);
  const id = parseInt(idStr, 10);

  if (isNaN(id)) {
    await interaction.editReply("❌ رقم غير صحيح.");
    return;
  }

  const [series] = await db
    .select()
    .from(trackedSeriesTable)
    .where(eq(trackedSeriesTable.id, id));

  if (!series) {
    await interaction.editReply(`❌ مفيش عمل بالرقم ${id}.`);
    return;
  }

  await db
    .update(trackedSeriesTable)
    .set({ isActive: false })
    .where(eq(trackedSeriesTable.id, id));

  await interaction.editReply(`✅ تم إيقاف متابعة "${series.title}".`);
}

async function handleList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const series = await db
    .select()
    .from(trackedSeriesTable)
    .where(eq(trackedSeriesTable.isActive, true));

  if (series.length === 0) {
    await interaction.editReply(
      "📭 مفيش أعمال متتبعة حالياً. استخدم `/track` لإضافة عمل."
    );
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("📚 الأعمال المتتبعة")
    .setColor(0x5865f2)
    .setDescription(
      series
        .map(
          (s) =>
            `**#${s.id}** ${s.title}\n` +
            `└ 📖 آخر فصل: ${s.latestChapter || "؟"} | 🌐 ${s.language} | 🇸🇦 ${s.hasArabicTranslation ? "✅" : "❌"}`
        )
        .join("\n\n")
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleServers(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const configs = await db
    .select()
    .from(discordConfigTable)
    .where(eq(discordConfigTable.isActive, true));

  if (configs.length === 0) {
    await interaction.editReply(
      "📭 مفيش سيرفرات مسجلة. استخدم `/setchannel` في السيرفر المطلوب."
    );
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("🌐 السيرفرات المسجلة")
    .setColor(0xffa500)
    .setDescription(
      configs
        .map(
          (c, i) =>
            `**${i + 1}.** ${c.guildName ?? "سيرفر غير معروف"}\n` +
            `└ 📢 الروم: ${c.channelName ? `#${c.channelName}` : c.channelId}`
        )
        .join("\n\n")
    )
    .setFooter({ text: `${configs.length} سيرفر مسجل` });

  await interaction.editReply({ embeds: [embed] });
}

export async function sendNewChapterNotification(
  series: {
    title: string;
    coverUrl: string | null;
    sourceUrl: string;
    latestChapter: string | null;
    hasArabicTranslation: boolean;
    language: string;
  },
  chapter: { chapterNumber: string; title: string | null; url: string },
  totalChapters: number
): Promise<void> {
  if (!client) return;

  const allConfigs = await db
    .select()
    .from(discordConfigTable)
    .where(eq(discordConfigTable.isActive, true));

  if (allConfigs.length === 0) {
    logger.warn("No Discord channels configured. Use /setchannel to set one.");
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🆕 فصل جديد! — ${series.title}`)
    .setURL(chapter.url)
    .setColor(0xff6b35)
    .addFields(
      {
        name: "📖 الفصل",
        value: `الفصل ${chapter.chapterNumber}${chapter.title ? ` — ${chapter.title}` : ""}`,
        inline: false,
      },
      { name: "📚 إجمالي الفصول", value: `${totalChapters} فصل`, inline: true },
      { name: "🌐 اللغة الأصلية", value: series.language, inline: true },
      {
        name: "🇸🇦 ترجمة عربية",
        value: series.hasArabicTranslation ? "✅ موجودة" : "❌ غير موجودة",
        inline: true,
      }
    )
    .setFooter({ text: "MangaDex • بوت المانهوا" })
    .setTimestamp();

  if (series.coverUrl) embed.setThumbnail(series.coverUrl);

  for (const config of allConfigs) {
    try {
      const channel = await client.channels.fetch(config.channelId);
      if (!channel || !(channel instanceof TextChannel)) {
        logger.warn(
          { channelId: config.channelId, guildName: config.guildName },
          "Channel not found or not text"
        );
        continue;
      }
      await channel.send({ embeds: [embed] });
      logger.info(
        { title: series.title, chapter: chapter.chapterNumber, guildName: config.guildName },
        "Sent chapter notification"
      );
    } catch (err) {
      logger.error({ err, guildId: config.guildId }, "Failed to send notification to guild");
    }
  }
}
