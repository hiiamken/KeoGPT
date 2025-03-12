const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
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
const { createCodeEmbed } = require("../utils/discord");

const fs = require("fs");
const path = require("node:path");
const {
  executeQuery,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  releaseConnection,
  getThreadHistory,
  saveMessage
} = require("../utils/database");

async function processImageAttachment(message) {
  const tempDir = path.join(__dirname, "..", "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const imagePath = path.join(tempDir, "temp_image.png");

  try {
    let attachment;
    if (discordUtils.isSlashCommand(message)) {
      attachment = message.options.getAttachment("image");
    } else {
      if (message.attachments && message.attachments.size > 0) {
        attachment = message.attachments.first();
      } else {
        attachment = null;
      }
    }

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
          `❌ Loại tệp không được hỗ trợ. Vui lòng tải lên: ${allowedTypes.join(
            ", "
          )}`,
          discordUtils.isSlashCommand(message)
        );
        return undefined; // Use undefined to signal failure
      }

      await downloadImage(attachment.url, imagePath);
      return fileToGenerativePart(imagePath, "image/png");
    }

    return null; // No image
  } catch (error) {
    console.error("❌ Lỗi khi xử lý ảnh:", error);
    await discordUtils.sendErrorMessage(
      message,
      "❌ Có lỗi khi xử lý ảnh.",
      discordUtils.isSlashCommand(message)
    );
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    return undefined; // Use undefined to signal failure
  }
}
async function sendMessageAndSave(thread, content, userId, isPrompt = false, aiResponse = null) {
  try {
    const msg = await thread.send(content);
    await saveMessage(thread.id, userId, typeof content === 'string' ? content : "Embed Message", isPrompt, aiResponse);
    return msg;
  } catch (error) {
    if (error.code === 10008) { // Unknown Message (bị xóa trước khi gửi)
      console.warn(`⚠️ Thread ${thread.id} đã bị xóa trước khi gửi tin nhắn.`);
    } else {
      console.error("❌ Lỗi khi gửi hoặc lưu tin nhắn:", error);
      throw error;
    }
  }
}

async function handleReplyCommand(message, prompt, language, imageAttachment) {
  let connection;
  const isSlash = discordUtils.isSlashCommand(message);
  try {
    connection = await beginTransaction();
    const userId = isSlash ? message.user.id : message.author.id;

    if (!discordUtils.hasBotPermissions(message.channel, [
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.AttachFiles
    ])) {
      return await discordUtils.sendErrorMessage(message, "❌ Bot không có đủ quyền!", isSlash);
    }

    if (message.channel.type !== ChannelType.PublicThread && message.channel.type !== ChannelType.PrivateThread) {
      return await discordUtils.sendErrorMessage(message, "❌ Lệnh này chỉ dùng trong thread!", isSlash);
    }

    if (message.channel.parentId !== config.allowedChannelId) {
      return await discordUtils.sendErrorMessage(message, "❌ Bạn chỉ có thể sử dụng lệnh này trong thread của kênh được chỉ định.", isSlash);
    }

    const [threadData] = await executeQuery("SELECT userId, prompt, language FROM threads WHERE threadId = ?", [message.channel.id]);

    if (threadData.length === 0) {
      return await discordUtils.sendErrorMessage(message, "❌ Không tìm thấy thread hoặc thread đã bị xóa.", isSlash);
    }

    const threadInfo = threadData[0];

    if (threadInfo.userId !== userId) {
      return await discordUtils.sendErrorMessage(message, "❌ Bạn không phải là người tạo thread này.", isSlash);
    }

    const imagePart = await processImageAttachment(message);
    if (imagePart === undefined) return;

    const historyRows = await getThreadHistory(message.channel.id, config.maxHistoryLength);
    const row = discordUtils.createResponseStyleButtons();
    let responseStyle = "simple";
    let replyMessage;

    if (isSlash) {
      replyMessage = await message.followUp({ content: "📝 Chọn kiểu trả lời:", components: [row], ephemeral: true, fetchReply: true });
    } else {
      replyMessage = await message.channel.send({
        content: `<@${userId}>, bạn muốn nhận câu trả lời theo kiểu nào?\n\n**🔹 Đơn giản:** Ngắn gọn, dễ hiểu.\n**🔸 Chi tiết:** Giải thích đầy đủ, có công thức hoặc ví dụ.`,
        components: [row],
      });
    }

    const collector = replyMessage.createMessageComponentCollector({ filter: (i) => i.user.id === userId, time: 60000 });

    collector.on("collect", async (i) => {
      responseStyle = i.customId;
      await i.deferUpdate();
      collector.stop();
    });

    collector.on("end", async (collected) => {
      await discordUtils.safeDeleteMessage(replyMessage);
      if (collected.size === 0) {
        await message.channel.send("⚠️ Không có lựa chọn, hệ thống tự động chọn chế độ 'Đơn Giản'");
      }

      const languageInstruction = getLanguageInstruction(language || threadInfo.language);
      let currentPrompt = `${languageInstruction}\n`;
      currentPrompt += responseStyle === "simple" ? "Trả lời ngắn gọn." : "Trả lời chi tiết.";
      currentPrompt += `\n\n${prompt}`;

      const messages = [
        { role: "user", parts: [{ text: threadInfo.prompt }] },
        ...historyRows.flatMap((row) => [
          { role: "user", parts: [{ text: row.message }] },
          { role: "model", parts: [{ text: row.ai_response || "" }] },
        ]),
        { role: "user", parts: [{ text: currentPrompt }] },
      ];

      if (imagePart) messages[messages.length - 1].parts.unshift(imagePart);

      const geminiResponse = await generateContentWithHistory(messages);
      let text = formatMath(geminiResponse);

      if (text.includes("```")) {
        const codeStartIndex = text.indexOf("```");
        const codeEndIndex = text.indexOf("```", codeStartIndex + 3);

        if (codeStartIndex !== -1 && codeEndIndex !== -1) {
          const codeBlock = text.substring(codeStartIndex + 3, codeEndIndex);
          const languageMatch = codeBlock.match(/^([a-z]+)\n/);
          const codeLanguage = languageMatch ? languageMatch[1] : "plaintext";
          const code = codeBlock.replace(/^([a-z]+)\n/, "");

          const embed = createCodeEmbed(code, codeLanguage);
          const beforeCode = text.substring(0, codeStartIndex).trim();
          if (beforeCode) await sendMessageAndSave(message.channel, beforeCode, message.client.user.id, false, geminiResponse);
          await sendMessageAndSave(message.channel, { embeds: [embed] }, message.client.user.id, false, geminiResponse);
          const afterCode = text.substring(codeEndIndex + 3).trim();
          if (afterCode) await sendMessageAndSave(message.channel, afterCode, message.client.user.id, false, geminiResponse);
        } else {
          await sendMessageAndSave(message.channel, text, message.client.user.id, false, geminiResponse);
        }
      } else {
        await sendMessageAndSave(message.channel, text, message.client.user.id, false, geminiResponse);
      }

      await executeQuery("UPDATE users SET total_points = total_points + 1 WHERE userId = ?", [userId]);
      await saveMessage(message.channel.id, userId, prompt, true, null);
      await commitTransaction(connection);
    });
  } catch (error) {
    if (connection) await rollbackTransaction(connection);
    console.error("❌ Lỗi trong handleReplyCommand:", error);
    await discordUtils.sendErrorMessage(message, "❌ Có lỗi xảy ra khi xử lý.", isSlash);
  } finally {
    if (connection) releaseConnection(connection);
    const imagePath = path.join(__dirname, "..", "temp", "temp_image.png");
    if (imageAttachment && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reply")
    .setDescription("Trả lời trong thread hiện tại.")
    .addStringOption((option) =>
      option.setName("prompt").setDescription("Nội dung trả lời").setRequired(true)
    )
    .addAttachmentOption((option) =>
      option.setName("image").setDescription("Ảnh (tùy chọn)").setRequired(false)
    )
    .setDMPermission(false),
  
  async execute(interaction) {
    if (interaction.channel.type !== ChannelType.PublicThread && interaction.channel.type !== ChannelType.PrivateThread) {
      return await discordUtils.sendErrorMessage(interaction, "❌ Lệnh này chỉ dùng trong thread!", true);
    }

    if (interaction.channel.parentId !== config.allowedChannelId) {
      return await discordUtils.sendErrorMessage(interaction, "❌ Bạn chỉ có thể sử dụng lệnh này trong thread của kênh được chỉ định.", true);
    }

    await interaction.deferReply({ ephemeral: false });
    const prompt = interaction.options.getString("prompt");
    const image = interaction.options.getAttachment("image");

    await handleReplyCommand(interaction, prompt, null, image);
  },

  handleReplyCommand,
};
