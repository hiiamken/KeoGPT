const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
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
} = require("../utils/help");

const { createCodeEmbed } = require("../utils/discord");
const {
    executeQuery,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    releaseConnection,
    saveThreadInfo,
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
        attachment = message.attachments?.first() || null;
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
            `Loại tệp không được hỗ trợ. Vui lòng tải lên: ${allowedTypes.join(", ")}`,
            discordUtils.isSlashCommand(message)
          );
          return undefined;
        }

        await downloadImage(attachment.url, imagePath);
        return fileToGenerativePart(imagePath, "image/png");
      }

      return null; // No image
    } catch (error) {
      console.error("Error processing image:", error);
      await discordUtils.sendErrorMessage(
        message,
        "Có lỗi khi xử lý ảnh.",
        discordUtils.isSlashCommand(message)
      );

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      return undefined;
    }
}

async function createOrResetThread(message, prompt, userId, trx) {
    let thread;
    const isSlashCommand = discordUtils.isSlashCommand(message);

    try {
        if (message.channel.type === ChannelType.GuildText) {
          return null;
        } else if (
            message.channel.type === ChannelType.PublicThread ||
            message.channel.type === ChannelType.PrivateThread
        ) {
            thread = message.channel;
            const idToCheck = isSlashCommand ? message.user.id : message.author.id;

            if (idToCheck === thread.ownerId || idToCheck === config.adminUserId) {
              const newThreadTitle = await generateTitle(prompt);
              await discordUtils.safeRenameThread(
                thread,
                `💬 ${newThreadTitle.substring(0, 90)}`
              );
              await executeQuery("DELETE FROM messages WHERE threadId = ?", [thread.id]);
            } else {
                return await discordUtils.sendErrorMessage(message, "Bạn không có quyền làm mới thread này!", isSlashCommand);
            }
        } else {
            return await discordUtils.sendErrorMessage(message, "Lệnh này chỉ dùng trong kênh/thread.", isSlashCommand);
        }

        if (!thread) {
            return await discordUtils.sendErrorMessage(message, "Không thể tạo thread.", isSlashCommand);
        }
        return thread;
    } catch (error) {
        console.error("Error creating/resetting thread:", error);
        throw error;
    }
}

async function sendMessageAndSave(thread, content, userId, isPrompt = false, aiResponse = null) {
    try {
      const msg = await thread.send(content);
      await saveMessage(thread.id, userId, typeof content === 'string' ? content : "Embed Message", isPrompt, aiResponse);

      return msg;
    } catch (error) {
        if (error.code === 10008) {
          console.warn(`Thread ${thread.id} was likely deleted before the message could be sent.`);
        } else {
          console.error("Error sending or saving message:", error);
          throw error;
        }
    }
}

async function handleNewCommand(message, prompt, language, client, imageAttachment = null) {
    let trx;
    let imagePart = null;
    const isSlashCommand = discordUtils.isSlashCommand(message);

    try {
      trx = await beginTransaction();

      if (!discordUtils.hasBotPermissions(message.channel, [
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.CreatePublicThreads,
          PermissionsBitField.Flags.ManageThreads,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.ReadMessageHistory
      ])) {
        return await discordUtils.sendErrorMessage(message, 'Bot không có đủ quyền!', isSlashCommand);
      }

      if (message.channel.type !== ChannelType.PublicThread &&
          message.channel.type !== ChannelType.PrivateThread) {
          return await discordUtils.sendErrorMessage(message, 'Bạn chỉ có thể sử dụng lệnh này trong một thread.', isSlashCommand);
      }

      if (message.channel.parentId !== config.allowedChannelId) {
          return await discordUtils.sendErrorMessage(message, 'Bạn chỉ có thể sử dụng lệnh này trong thread của kênh đã được chỉ định', isSlashCommand);
      }

      const userId = isSlashCommand ? message.user.id : message.author.id;

      imagePart = await processImageAttachment(message);
      if (imagePart === undefined) return;

      const thread = await createOrResetThread(message, prompt, userId, trx);
      if (!thread) return;

      await saveThreadInfo(thread.id, userId, prompt, language, new Date(Date.now() + config.threadLifetimeDays * 24 * 60 * 60 * 1000));

      try {
          await executeQuery(
              "INSERT INTO users (userId, username) VALUES (?, ?)",
              [userId, isSlashCommand ? message.user.username : message.author.username]
          );
      } catch (error) {
          if (error.code === 'SQLITE_CONSTRAINT' || error.code.startsWith('ER_DUP_ENTRY')) {
            await executeQuery(
                "UPDATE users SET total_threads = total_threads + 1, total_points = total_points + 3, username = ? WHERE userId = ?",
                [isSlashCommand ? message.user.username : message.author.username, userId]
            );
          } else {
              throw error;
          }
      }

      const [historyRows] = await executeQuery(
          "SELECT message, ai_response FROM messages WHERE threadId = ? ORDER BY timestamp ASC LIMIT ?",
          [thread.id, config.maxHistoryLength]
      );

      const row = discordUtils.createResponseStyleButtons();
      let responseStyle = 'simple';
      let replyMessage;

      if (isSlashCommand) {
        replyMessage = await message.followUp({ 
          content: 'Chọn kiểu trả lời:', 
          components: [row], 
          ephemeral: true, 
          fetchReply: true 
        });
      } else {
        replyMessage = await thread.send({ 
          content: `<@${userId}>, bạn muốn câu trả lời kiểu nào?\n\n**Đơn giản:** Ngắn gọn, dễ hiểu.\n**Chi tiết:** Giải thích đầy đủ, có công thức, ví dụ (nếu có).`, 
          components: [row] 
        });
      }
      const collector = replyMessage.createMessageComponentCollector({ 
        filter: i => i.user.id === userId, 
        time: 60000 
    });

    collector.on('collect', async i => {
        responseStyle = i.customId;
        await i.deferUpdate();
        collector.stop();
    });

    collector.on('end', async collected => {
      await discordUtils.safeDeleteMessage(replyMessage);

      if (collected.size === 0) {
        if (isSlashCommand) {
          await message.followUp({content: "Không có lựa chọn, hệ thống tự động chọn chế độ 'Đơn Giản'", ephemeral: true});
        } else {
          await thread.send("Không có lựa chọn, hệ thống tự động chọn chế độ 'Đơn Giản'");
        }
      }

      const languageInstruction = getLanguageInstruction(language);
      let currentPrompt = `${languageInstruction}\n`;
      currentPrompt += responseStyle === 'simple' ? 'Trả lời ngắn gọn.' : 'Trả lời chi tiết.';

      const messages = [
        { role: "user", parts: [{ text: prompt }] },
        ...historyRows.flatMap(row => [
            { role: "user", parts: [{ text: row.message }] },
            { role: "model", parts: [{ text: row.ai_response || "" }] },
        ]),
        { role: "user", parts: [{ text: currentPrompt }] },
      ];

      if (imagePart) {
        messages[0].parts.unshift(imagePart);
      }

      const geminiResponse = await generateContentWithHistory(messages);
      let text = formatMath(geminiResponse);

      if (text.includes('```')) {
        const codeStartIndex = text.indexOf('```');
        const codeEndIndex = text.indexOf('```', codeStartIndex + 3);

        if (codeStartIndex !== -1 && codeEndIndex !== -1) {
            const codeBlock = text.substring(codeStartIndex + 3, codeEndIndex);
            const languageMatch = codeBlock.match(/^([a-z]+)\n/);
            const language = languageMatch ? languageMatch[1] : 'plaintext';
            const code = codeBlock.replace(/^([a-z]+)\n/, '');

            const embed = createCodeEmbed(code, language);

            const beforeCode = text.substring(0, codeStartIndex).trim();
            if (beforeCode) {
              await sendMessageAndSave(thread, beforeCode, message.client.user.id, false, geminiResponse);
            }

            await sendMessageAndSave(thread, { embeds: [embed] }, message.client.user.id, false, geminiResponse);

            const afterCode = text.substring(codeEndIndex + 3).trim();
            if (afterCode) {
              await sendMessageAndSave(thread, afterCode, message.client.user.id, false, geminiResponse);
            }
        } else {
            await sendMessageAndSave(thread, text, message.client.user.id, false, geminiResponse);
        }
      } else {
        await sendMessageAndSave(thread, text, message.client.user.id, false, geminiResponse);
      }

      await sendMessageAndSave(thread, prompt, userId, true, null);

      await commitTransaction(trx);
      const suggestion = getRandomReplySuggestion(thread.name);
      await thread.send(suggestion);
      if (isSlashCommand) {
        await message.followUp({ content: `Thread: ${thread.url}`, ephemeral: true });
      }
    });
  } catch (error) {
    if (trx) await rollbackTransaction(trx);
    console.error("Error in handleNewCommand:", error);
    await discordUtils.sendErrorMessage(message, "Có lỗi khi xử lý.", isSlashCommand);
  } finally {
    if (config.databaseType === 'mysql') if (trx) releaseConnection(trx);
    const imagePath = path.join(__dirname, "..", "temp", "temp_image.png");
    if (imagePart && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
      .setName("new")
      .setDescription("Tạo một thread mới để thảo luận, có thể đính kèm ảnh.")
      .addStringOption((option) =>
          option
              .setName("prompt")
              .setDescription("Câu hỏi của bạn")
              .setRequired(true)
      )
      .addAttachmentOption((option) =>
          option.setName("image").setDescription("Ảnh (không bắt buộc)").setRequired(false)
      )
      .addStringOption(option =>
        option.setName('language')
          .setDescription('Ngôn ngữ (ví dụ: vi, en)')
          .setRequired(false)
          .addChoices(...Object.entries(config.supportedLanguages).map(([code, name]) => ({ name: `${name} (${code})`, value: code })))
      )
      .setDMPermission(false),

  async execute(interaction) {
    if (
          interaction.channel.type !== ChannelType.PublicThread &&
          interaction.channel.type !== ChannelType.PrivateThread
      ) {
          return await discordUtils.sendErrorMessage(
              interaction,
              "Bạn chỉ có thể sử dụng lệnh này trong một thread.",
            true
          );
      }
      if (interaction.channel.parentId !== config.allowedChannelId) {
        return await discordUtils.sendErrorMessage(interaction, 'Bạn chỉ có thể sử dụng lệnh này trong thread của kênh đã được chỉ định', true);
      }
      await interaction.deferReply({ ephemeral: false });
      const prompt = interaction.options.getString("prompt");
      const image = interaction.options.getAttachment("image");
      const language = interaction.options.getString("language") || config.defaultLanguage;

      await handleNewCommand(interaction, prompt, language, interaction.client, image);
  },
  handleNewCommand,
};
