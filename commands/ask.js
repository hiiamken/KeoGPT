const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
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
const { createCodeEmbed } = require("../utils/discord");

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
          `Loại tệp không được hỗ trợ. Vui lòng tải lên: ${allowedTypes.join(
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

async function sendMessageAndSave(
  channel,
  content,
  userId,
  isPrompt = false,
  aiResponse = null,
  connection
) {
  try {
    const msg = await channel.send(content);
    await connection.execute(
      "INSERT INTO messages (threadId, userId, message, timestamp, isPrompt, ai_response) VALUES (?, ?, ?, NOW(), ?, ?)",
      [
        channel.id,
        userId,
        typeof content === "string" ? content : "Embed Message",
        isPrompt,
        aiResponse,
      ]
    );
    return msg;
  } catch (error) {
    console.error("Error sending/saving message:", error);
    throw error;
  }
}
async function handleAskCommand(
  message,
  prompt,
  language,
  imageAttachment = null
) {
  let connection;
  const isSlash = discordUtils.isSlashCommand(message);
  const userId = isSlash ? message.user.id : message.author.id;
  let loadingMessage;
  let imagePart = null;

  try {
    connection = await db.pool.getConnection();
    await connection.beginTransaction();

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

    if (!isSlash) {
      loadingMessage = await message.reply({
        content: `${getRandomLoadingMessage()}`,
        allowedMentions: { repliedUser: false },
      });
    }

    imagePart = await processImageAttachment(message);
    if (imagePart === undefined) return;

    const threadTitle = await generateTitle(prompt);
    const thread = await message.channel.threads.create({
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

    await connection.execute(
      "INSERT INTO threads (threadId, userId, prompt, language, expiresAt, points) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), ?) ON DUPLICATE KEY UPDATE prompt = ?, language = ?, expiresAt = DATE_ADD(NOW(), INTERVAL ? DAY)",
      [
        thread.id,
        userId,
        prompt,
        language,
        config.threadLifetimeDays,
        2,
        prompt,
        language,
        config.threadLifetimeDays,
      ]
    );

    await connection.execute(
      `
            INSERT INTO users (userId, username) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE total_threads = total_threads + 1, total_points = total_points + 2, username = VALUES(username)
        `,
      [userId, isSlash ? message.user.username : message.author.username]
    );

    const [historyRows] = await connection.execute(
      "SELECT message, ai_response FROM messages WHERE threadId = ? ORDER BY timestamp ASC LIMIT ?",
      [thread.id, config.maxHistoryLength]
    );

    const row = discordUtils.createResponseStyleButtons();
    const replyMessage = await thread.send({
      content: `<@${userId}>, bạn muốn nhận câu trả lời theo kiểu nào?\n\n**Đơn giản:** Giải thích ngắn gọn, dễ hiểu.\n**Chuyên nghiệp:** Giải thích chi tiết, đầy đủ, có thể kèm theo công thức hoặc ví dụ (nếu có).`,
      components: [row],
    });

    const collector = replyMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === userId,
      time: 60000,
    });
    let responseStyle = "simple";
    collector.on("collect", async (i) => {
      responseStyle = i.customId;
      await i.deferUpdate();
      collector.stop();
    });

    collector.on("end", async (collected) => {
      await discordUtils.safeDeleteMessage(replyMessage);

      if (collected.size === 0) {
        await thread.send(
          "Không có lựa chọn, hệ thống tự động chọn chế độ 'Đơn Giản'"
        );
      }

      const languageInstruction = getLanguageInstruction(language);
      let currentPrompt = "";

      if (responseStyle === "simple") {
        currentPrompt = `${languageInstruction}\nTrả lời ngắn gọn.`;
      } else {
        currentPrompt = `${languageInstruction}\nTrả lời chi tiết, đầy đủ.`;
      }

      const messages = [
        { role: "user", parts: [{ text: prompt }] },
        ...historyRows.flatMap((row) => [
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

      const MAX_MESSAGE_LENGTH = 2000;
      const chunks = [];

      let currentIndex = 0;
      while (currentIndex < text.length) {
        let nextIndex = currentIndex + MAX_MESSAGE_LENGTH;

        if (text.includes("```", currentIndex)) {
          const nextCodeBlockStart = text.indexOf("```", currentIndex);
          const nextCodeBlockEnd = text.indexOf("```", nextCodeBlockStart + 3);

          if (nextCodeBlockStart < nextIndex && nextCodeBlockEnd !== -1) {
            nextIndex = nextCodeBlockEnd + 3;
          }
        }
        const chunk = text.substring(currentIndex, nextIndex);
        chunks.push(chunk);
        currentIndex = nextIndex;
      }

      for (const chunk of chunks) {
        if (chunk.includes("```")) {
          const codeStartIndex = chunk.indexOf("```");
          const codeEndIndex = chunk.indexOf("```", codeStartIndex + 3);

          if (codeStartIndex !== -1 && codeEndIndex !== -1) {
            const codeBlock = chunk.substring(codeStartIndex + 3, codeEndIndex);
            const languageMatch = codeBlock.match(/^([a-z]+)\n/);
            const language = languageMatch ? languageMatch[1] : "plaintext";
            const code = codeBlock.replace(/^([a-z]+)\n/, "");

            const embed = createCodeEmbed(code, language);

            const beforeCode = chunk.substring(0, codeStartIndex).trim();
            if (beforeCode) {
              await sendMessageAndSave(
                thread,
                beforeCode,
                message.client.user.id,
                false,
                geminiResponse,
                connection
              );
            }

            await sendMessageAndSave(
              thread,
              { embeds: [embed] },
              message.client.user.id,
              false,
              geminiResponse,
              connection
            );

            const afterCode = chunk.substring(codeEndIndex + 3).trim();
            if (afterCode) {
              await sendMessageAndSave(
                thread,
                afterCode,
                message.client.user.id,
                false,
                geminiResponse,
                connection
              );
            }
          } else {
            await sendMessageAndSave(
              thread,
              chunk,
              message.client.user.id,
              false,
              geminiResponse,
              connection
            ); //Sửa
          }
        } else {
          await sendMessageAndSave(
            thread,
            chunk,
            message.client.user.id,
            false,
            geminiResponse,
            connection
          );
        }
      }

      if (loadingMessage && !isSlash) {
        await discordUtils.safeDeleteMessage(loadingMessage);
      }

      await connection.commit();
      const suggestion = getRandomReplySuggestion(thread.name);
      await thread.send(suggestion);
      if (isSlash) {
        await message.followUp({
          content: `Thread: ${thread.url}`,
          ephemeral: true,
        });
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error in handleAskCommand:", error);
    if (isSlash && error.code === 10062) {
      try {
        await message.channel.send("Có lỗi xảy ra (interaction hết hạn).");
      } catch (channelError) {
        console.error("Failed to send error message to channel:", channelError);
      }
    } else {
      await discordUtils.sendErrorMessage(
        message,
        "Bot gặp sự cố khi tạo thread và trả lời câu hỏi của bạn. Vui lòng thử lại sau!",
        isSlash
      );
    }
  } finally {
    if (connection) connection.release();
    const imagePath = path.join(__dirname, "..", "temp", "temp_image.png");
    if (imagePart && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
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
    .addStringOption((option) =>
      option
        .setName("language")
        .setDescription(
          "Ngôn ngữ bạn muốn sử dụng (mã ngôn ngữ, ví dụ: vi, en)"
        )
        .setRequired(false)
        .addChoices(
          ...Object.entries(config.supportedLanguages).map(([code, name]) => ({
            name: `${name} (${code})`,
            value: code,
          }))
        )
    )
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Ảnh (không bắt buộc)")
        .setRequired(false)
    )
    .setDMPermission(false),

  async execute(interaction) {
    if (
      interaction.channel.type !== ChannelType.GuildText ||
      interaction.channelId !== config.allowedChannelId
    ) {
      return await discordUtils.sendErrorMessage(
        interaction,
        "Bạn chỉ có thể sử dụng lệnh này trong kênh đã được chỉ định.",
        true
      );
    }
    await interaction.deferReply({ ephemeral: false });
    const prompt = interaction.options.getString("prompt");
    const language =
      interaction.options.getString("language") || config.defaultLanguage;
    const image = interaction.options.getAttachment("image");
    await handleAskCommand.call(
      { processImageAttachment, sendMessageAndSave },
      interaction,
      prompt,
      language,
      image
    );
  },
  handleAskCommand,
  processImageAttachment,
  sendMessageAndSave,
};
