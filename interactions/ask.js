const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  getLanguageInstruction,
  generateTitle,
  fileToGenerativePart,
  downloadImage,
  generateContentWithHistory,
} = require("../utils/gemini");
const { formatMath } = require("../utils/format");
const db = require("../utils/database");
const config = require("../config");
const discordUtils = require("../utils/discord");
const {
  getRandomLoadingMessage,
  getRandomReplySuggestion,
} = require("../utils/help");
const fs = require("fs");
const path = require("node:path");

async function processImageAttachment(message) {
  const tempDir = path.join(__dirname, "..", "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const imagePath = path.join(tempDir, "temp_image.png");

  try {
    let attachment = discordUtils.isSlashCommand(message)
      ? message.options.getAttachment("image")
      : message.attachments?.first() || null;

    if (attachment && attachment.contentType?.startsWith("image/")) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/heic",
      ];
      if (!allowedTypes.includes(attachment.contentType)) {
        await discordUtils.sendErrorMessage(
          message,
          "Loại tệp không được hỗ trợ."
        );
        return null;
      }
      await downloadImage(attachment.url, imagePath);
      return fileToGenerativePart(imagePath, "image/png");
    }
    return null;
  } catch (error) {
    console.error("❌ Lỗi khi xử lý ảnh:", error);
    await discordUtils.sendErrorMessage(message, "Có lỗi khi xử lý ảnh.");
    return null;
  } finally {
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }
}

async function sendMessageAndSave(
  channel,
  content,
  userId,
  isPrompt = false,
  aiResponse = null
) {
  try {
    const msg = await channel.send(content);
    await db.saveMessage(channel.id, userId, content, isPrompt, aiResponse);
    return msg;
  } catch (error) {
    console.error("❌ Lỗi khi gửi/lưu tin nhắn:", error);
    throw error;
  }
}

async function handleAskCommand(
  message,
  prompt,
  language,
  imageAttachment = null
) {
  const isSlash = discordUtils.isSlashCommand(message);
  const userId = isSlash ? message.user.id : message.author.id;
  let imagePart = null;

  try {
    if (
      !discordUtils.hasBotPermissions(message.channel, [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.CreatePublicThreads,
        PermissionsBitField.Flags.EmbedLinks,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
      ])
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bot không có đủ quyền!",
        isSlash
      );
    }

    if (
      message.channel.type === ChannelType.PublicThread ||
      message.channel.type === ChannelType.PrivateThread
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bạn không thể sử dụng lệnh này trong thread.",
        isSlash
      );
    }

    if (message.channelId !== config.allowedChannelId) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bạn chỉ có thể sử dụng lệnh này trong kênh đã được chỉ định.",
        isSlash
      );
    }

    imagePart = await processImageAttachment(message);
    if (imagePart === undefined) return;

    const loadingMessage = isSlash
      ? await message.followUp({
          content: getRandomLoadingMessage(),
          ephemeral: false,
        })
      : await message.reply(getRandomLoadingMessage());

    const threadTitle = await generateTitle(prompt);
    let thread = null;

    const existingThread = await db.executeQuery(
      "SELECT threadId FROM threads WHERE prompt = ?",
      [prompt]
    );
    if (existingThread.length > 0) {
      try {
        thread = await message.client.channels.fetch(
          existingThread[0].threadId
        );
      } catch {
        thread = null;
      }

      if (!thread) {
        await db.executeQuery("DELETE FROM threads WHERE threadId = ?", [
          existingThread[0].threadId,
        ]);
      }
    }

    if (!thread) {
      thread = await message.channel.threads.create({
        name: `💬 ${threadTitle.substring(0, 90)}`,
        autoArchiveDuration: 60,
        reason: "Trả lời câu hỏi của người dùng",
        type: ChannelType.PublicThread,
      });

      if (!thread) {
        return await discordUtils.sendErrorMessage(
          message,
          "Không thể tạo thread.",
          isSlash
        );
      }

      await db.executeQuery(
        "INSERT INTO threads (threadId, userId, prompt, language, expiresAt) VALUES (?, ?, ?, ?, ?)",
        [
          thread.id,
          userId,
          prompt,
          language,
          new Date(
            Date.now() + config.threadLifetimeDays * 24 * 60 * 60 * 1000
          ),
        ]
      );

      await db.executeQuery(
        "UPDATE users SET total_points = total_points + 2 WHERE userId = ?",
        [userId]
      );
    }

    await db.ensureUserExists(
      userId,
      isSlash ? message.user.username : message.author.username
    );

    const row = discordUtils.createResponseStyleButtons();
    const replyMessage = await thread.send({
      content: `<@${userId}>, bạn muốn nhận câu trả lời theo kiểu nào?\n\n**Đơn giản:** Giải thích ngắn gọn, dễ hiểu.\n**Chuyên nghiệp:** Giải thích chi tiết, đầy đủ, có thể kèm theo công thức hoặc ví dụ.`,
      components: [row],
    });

    try {
      const interaction = await replyMessage.awaitMessageComponent({
        filter: (i) => i.user.id === userId, // Chỉ cho phép người tạo chọn
        time: 60000,
      });

      const responseStyle = interaction.customId;
      await interaction.deferUpdate();
      await discordUtils.safeDeleteMessage(replyMessage);

      const languageInstruction = getLanguageInstruction(language);
      let currentPrompt =
        responseStyle === "simple"
          ? `${languageInstruction}\nTrả lời ngắn gọn.`
          : `${languageInstruction}\nTrả lời chi tiết, đầy đủ.`;

      const messages = [
        { role: "user", parts: [{ text: prompt }] },
        { role: "user", parts: [{ text: currentPrompt }] },
      ];

      if (imagePart) messages[0].parts.unshift(imagePart);

      const response = await generateContentWithHistory(messages);
      let text = formatMath(response);

      await sendMessageAndSave(
        thread,
        text,
        message.client.user.id,
        false,
        response
      );
      await thread.send(
        `<@${userId}>, ${getRandomReplySuggestion(thread.name)}`
      );

      if (isSlash) {
        await message.followUp({
          content: `Thread: ${thread.url}`,
          ephemeral: true,
        });
      }
    } catch {
      await discordUtils.safeDeleteMessage(replyMessage);
    } finally {
      await discordUtils.safeDeleteMessage(loadingMessage);
    }
  } catch (error) {
    console.error("❌ Lỗi trong `handleAskCommand`:", error);
    await discordUtils.sendErrorMessage(message, "Có lỗi khi xử lý.", isSlash);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Đặt câu hỏi cho bot")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Câu hỏi của bạn")
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Ảnh (không bắt buộc)")
        .setRequired(false)
    )
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply();
    const prompt = interaction.options.getString("prompt");
    const image = interaction.options.getAttachment("image");
    await handleAskCommand(interaction, prompt, config.defaultLanguage, image);
  },

  executePrefix: async (message, args) => {
    const prompt = args.join(" ");
    if (!prompt)
      return discordUtils.sendErrorMessage(message, "Bạn cần nhập câu hỏi!");
    await handleAskCommand(message, prompt, config.defaultLanguage);
  },

  handleAskCommand,
};
