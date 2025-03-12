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
  generateContentWithHistory,
  downloadImage,
  fileToGenerativePart,
} = require("../utils/gemini");
const { formatMath } = require("../utils/format");
const config = require("../config");
const discordUtils = require("../utils/discord");
const { getRandomReplySuggestion } = require("../utils/help");
const fs = require("fs");
const path = require("node:path");
const {
  executeQuery,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  saveMessage,
  getThreadHistory,
} = require("../utils/database");

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
          `❌ Loại tệp không được hỗ trợ. Chỉ hỗ trợ: ${allowedTypes.join(
            ", "
          )}`,
          discordUtils.isSlashCommand(message)
        );
        return undefined;
      }

      await downloadImage(attachment.url, imagePath);
      return fileToGenerativePart(imagePath, "image/png");
    }

    return null;
  } catch (error) {
    console.error("❌ Lỗi khi xử lý ảnh:", error);
    await discordUtils.sendErrorMessage(message, "❌ Có lỗi khi xử lý ảnh.");
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    return undefined;
  }
}

async function sendMessageAndSave(
  thread,
  content,
  userId,
  isPrompt = false,
  aiResponse = null
) {
  try {
    const msg = await thread.send(content);
    await saveMessage(
      thread.id,
      userId,
      typeof content === "string" ? content : "Embed Message",
      isPrompt,
      aiResponse
    );
    return msg;
  } catch (error) {
    console.error("❌ Lỗi khi gửi hoặc lưu tin nhắn:", error);
    throw error;
  }
}

async function handleReplyCommand(message, prompt, language, imageAttachment) {
  let trx;
  const isSlash = discordUtils.isSlashCommand(message);
  const userId = isSlash ? message.user.id : message.author.id;

  try {
    trx = await beginTransaction();

    if (
      !discordUtils.hasBotPermissions(message.channel, [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.EmbedLinks,
        PermissionsBitField.Flags.AttachFiles,
      ])
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Bot không có đủ quyền!",
        isSlash
      );
    }

    if (!message.channel.isThread()) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Lệnh này chỉ dùng trong thread!",
        isSlash
      );
    }

    let parentChannel;
    if (message.channel.parentId) {
      parentChannel = await message.client.channels.fetch(
        message.channel.parentId
      );
    }

    if (!parentChannel || parentChannel.id !== config.allowedChannelId) {
      return await discordUtils.sendErrorMessage(
        message,
        `❌ Bạn chỉ có thể sử dụng lệnh này trong thread của kênh <#${config.allowedChannelId}>`,
        isSlash
      );
    }

    const threadRows = await executeQuery(
      "SELECT userId, prompt, language FROM threads WHERE threadId = ?",
      [message.channel.id]
    );

    if (!threadRows || threadRows.length === 0) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Không tìm thấy thread hoặc thread đã bị xóa.",
        isSlash
      );
    }

    const imagePart = await processImageAttachment(message);
    if (imagePart === undefined) return;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("simple")
        .setLabel("Đơn giản")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("detailed")
        .setLabel("Chuyên nghiệp")
        .setStyle(ButtonStyle.Success)
    );

    const replyMessage = await message.channel.send({
      content: `<@${userId}>, bạn muốn nhận câu trả lời theo kiểu nào?\n\n**Đơn giản:** Giải thích ngắn gọn, dễ hiểu.\n**Chuyên nghiệp:** Giải thích chi tiết, đầy đủ, có thể kèm theo công thức hoặc ví dụ.`,
      components: [row],
    });

    try {
      const interaction = await replyMessage.awaitMessageComponent({
        time: 60000,
      });
      const responseStyle = interaction.customId;
      await interaction.deferUpdate();
      await discordUtils.safeDeleteMessage(replyMessage);

      const historyRows = await getThreadHistory(
        message.channel.id,
        config.maxHistoryLength
      );
      const languageInstruction = getLanguageInstruction(
        language || threadRows[0].language
      );
      let currentPrompt =
        responseStyle === "simple"
          ? `${languageInstruction}\nTrả lời ngắn gọn.`
          : `${languageInstruction}\nTrả lời chi tiết, đầy đủ.`;

      const messages = [
        { role: "user", parts: [{ text: threadRows[0].prompt }] },
        ...historyRows.flatMap((row) => [
          { role: "user", parts: [{ text: row.message }] },
          { role: "model", parts: [{ text: row.ai_response || "" }] },
        ]),
        { role: "user", parts: [{ text: currentPrompt }] },
      ];

      if (imagePart) messages[messages.length - 1].parts.unshift(imagePart);

      const geminiResponse = await generateContentWithHistory(messages);
      let text = formatMath(geminiResponse);

      await sendMessageAndSave(
        message.channel,
        text,
        message.client.user.id,
        false,
        geminiResponse
      );
      await executeQuery(
        "UPDATE users SET total_points = total_points + 1 WHERE userId = ?",
        [userId]
      );

      await message.channel.send(
        getRandomReplySuggestion(threadRows[0].prompt)
      );
    } catch {
      await discordUtils.safeDeleteMessage(replyMessage);
    }

    await saveMessage(message.channel.id, userId, prompt, true, null);
    await commitTransaction(trx);
  } catch (error) {
    if (trx) await rollbackTransaction(trx);
    console.error("❌ Lỗi trong handleReplyCommand:", error);
    await discordUtils.sendErrorMessage(
      message,
      "❌ Có lỗi xảy ra khi xử lý.",
      isSlash
    );
  } finally {
    if (trx && config.databaseType === "mysql") trx.release();
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reply")
    .setDescription("Trả lời trong thread hiện tại.")
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Nội dung trả lời")
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Ảnh (tùy chọn)")
        .setRequired(false)
    )
    .setDMPermission(false),

  async execute(interaction) {
    await handleReplyCommand(
      interaction,
      interaction.options.getString("prompt"),
      null,
      interaction.options.getAttachment("image")
    );
  },

  async executePrefix(message, args) {
    if (!args.length) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Vui lòng nhập nội dung trả lời!",
        false
      );
    }
    await handleReplyCommand(message, args.join(" "), null);
  },

  handleReplyCommand,
};
