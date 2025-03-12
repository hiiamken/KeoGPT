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
const config = require("../config");
const discordUtils = require("../utils/discord");
const fs = require("fs");
const path = require("node:path");
const {
  getRandomReplySuggestion,
  getRandomLoadingMessage,
} = require("../utils/help");
const {
  executeQuery,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  releaseConnection,
  saveThreadInfo,
  saveMessage,
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
          `❌ Loại tệp không được hỗ trợ.`,
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
    return undefined;
  } finally {
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }
}

async function createOrResetThread(message, prompt, userId) {
  let thread;
  const isSlashCommand = discordUtils.isSlashCommand(message);

  try {
    if (message.channel.isThread()) {
      thread = message.channel;
      const threadOwnerId = thread.ownerId || userId;

      if (userId === threadOwnerId || userId === config.adminUserId) {
        const newThreadTitle = await generateTitle(prompt);
        await discordUtils.safeRenameThread(
          thread,
          `💬 ${newThreadTitle.substring(0, 90)}`
        );
        await executeQuery("DELETE FROM messages WHERE threadId = ?", [
          thread.id,
        ]);
      } else {
        return await discordUtils.sendErrorMessage(
          message,
          "❌ Bạn không có quyền làm mới thread này!",
          isSlashCommand
        );
      }
    } else {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Lệnh này chỉ dùng trong thread.",
        isSlashCommand
      );
    }

    return thread;
  } catch (error) {
    console.error("❌ Lỗi khi tạo/làm mới thread:", error);
    throw error;
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

async function handleNewCommand(
  message,
  prompt,
  language,
  client,
  imageAttachment = null
) {
  let trx;
  let imagePart = null;
  const isSlashCommand = discordUtils.isSlashCommand(message);
  const userId = isSlashCommand ? message.user.id : message.author.id;

  try {
    trx = await beginTransaction();

    if (
      !discordUtils.hasBotPermissions(message.channel, [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.EmbedLinks,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.ReadMessageHistory,
      ])
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Bot không có đủ quyền!",
        isSlashCommand
      );
    }

    if (!message.channel.isThread()) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Bạn chỉ có thể sử dụng lệnh này trong một thread.",
        isSlashCommand
      );
    }

    const thread = await createOrResetThread(message, prompt, userId);
    if (!thread) return;

    imagePart = await processImageAttachment(message);
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

    const replyMessage = await thread.send({
      content: `📢 <@${userId}>, bạn muốn nhận câu trả lời theo kiểu nào?\n\n**🔹 Đơn giản:** Giải thích ngắn gọn, dễ hiểu.\n**🔹 Chuyên nghiệp:** Giải thích chi tiết, đầy đủ, có thể kèm theo công thức hoặc ví dụ.`,
      components: [row],
    });

    try {
      const interaction = await replyMessage.awaitMessageComponent({
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

      const messages = [{ role: "user", parts: [{ text: prompt }] }];
      if (imagePart) messages[0].parts.unshift(imagePart);

      const loadingMessage = await thread.send(getRandomLoadingMessage());

      const geminiResponse = await generateContentWithHistory(messages);
      let text = formatMath(geminiResponse);

      await sendMessageAndSave(
        thread,
        text,
        message.client.user.id,
        false,
        geminiResponse
      );
      await sendMessageAndSave(thread, prompt, userId, true, null);

      await thread.send(getRandomReplySuggestion(thread.name));
      await discordUtils.safeDeleteMessage(loadingMessage);
    } catch {
      await discordUtils.safeDeleteMessage(replyMessage);
    }

    await commitTransaction(trx);
  } catch (error) {
    if (trx) await rollbackTransaction(trx);
    console.error("❌ Lỗi trong handleNewCommand:", error);
    await discordUtils.sendErrorMessage(
      message,
      "❌ Có lỗi khi xử lý.",
      isSlashCommand
    );
  } finally {
    if (config.databaseType === "mysql" && trx) releaseConnection(trx);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("new")
    .setDescription("Tạo một thread mới để thảo luận.")
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
    await handleNewCommand(
      interaction,
      prompt,
      config.defaultLanguage,
      interaction.client,
      image
    );
  },

  async executePrefix(message, args) {
    const prompt = args.join(" ");
    if (!prompt) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Bạn cần nhập câu hỏi!"
      );
    }
    await handleNewCommand(
      message,
      prompt,
      config.defaultLanguage,
      message.client
    );
  },

  handleNewCommand,
};
