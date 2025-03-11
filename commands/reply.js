// commands/reply.js
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
const db = require("../utils/database");
const config = require("../config");
const discordUtils = require("../utils/discord");
const { getRandomLoadingMessage } = require("../utils/help");
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
  thread,
  content,
  userId,
  isPrompt = false,
  aiResponse = null,
  connection
) {
  try {
      const msg = await thread.send(content);
      await connection.execute(
          "INSERT INTO messages (threadId, userId, message, timestamp, isPrompt, ai_response) VALUES (?, ?, ?, NOW(), ?, ?)",
          [
              thread.id,
              userId,
              typeof content === "string" ? content : "Embed Message",
              isPrompt,
              aiResponse,
          ]
      );
      return msg;
  } catch (error) {
      if (error.code === 10008) {
          console.warn(
              `Thread ${thread.id} was likely deleted before the message could be sent.`
          );
      } else {
          console.error("Error sending or saving message:", error);
          throw error;
      }
  }
}

async function handleReplyCommand(
  message,
  prompt,
  language,
  imageAttachment = null
) {
  let connection;
  const isSlash = discordUtils.isSlashCommand(message);
  const userId = isSlash ? message.user.id : message.author.id;
  let imagePart = null;
  let loadingMessage;

  try {
      connection = await db.pool.getConnection();
      await connection.beginTransaction();

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
              "Bot không có đủ quyền!",
              isSlash
          );
      }

      if (
          message.channel.type !== ChannelType.PublicThread &&
          message.channel.type !== ChannelType.PrivateThread
      ) {
          return await discordUtils.sendErrorMessage(
              message,
              "Bạn chỉ có thể sử dụng lệnh này trong một thread.",
              isSlash
          );
      }
      if (message.channel.parentId !== config.allowedChannelId) {
          return await discordUtils.sendErrorMessage(
              message,
              "Bạn chỉ có thể sử dụng lệnh này trong một thread của kênh đã được chỉ định",
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

      const [threadData] = await connection.execute(
            "SELECT userId, prompt, language FROM threads WHERE threadId = ?",
            [message.channel.id]
        );

        if (threadData.length === 0) {
          // --- XỬ LÝ LỖI KHÔNG TÌM THẤY THREAD ---
          if (loadingMessage && !isSlash) {
              await discordUtils.safeDeleteMessage(loadingMessage); // Xóa tin nhắn loading
          }
          return await discordUtils.sendErrorMessage(
              message,
              "🤔 Rất tiếc, có vẻ như chủ đề này đã bị xóa hoặc chưa được tạo.  Bạn thử tạo chủ đề mới bằng cách dùng `!new <câu hỏi>` hoặc `/new <câu hỏi>` nhé!",
              isSlash
          );
          // --- KẾT THÚC XỬ LÝ LỖI ---
      }

      const threadInfo = threadData[0];

      if (threadInfo.userId !== userId) {
          return await discordUtils.sendErrorMessage(
              message,
              "Bạn không phải là người tạo thread này.",
              isSlash
          );
      }

      const [historyRows] = await connection.execute(
          "SELECT message, ai_response FROM messages WHERE threadId = ? ORDER BY timestamp ASC LIMIT ?",
          [message.channel.id, config.maxHistoryLength]
      );

      const row = discordUtils.createResponseStyleButtons();
      const replyMessage = await message.reply({
          content: "Chọn kiểu trả lời:",
          components: [row],
          ephemeral: isSlash,
          allowedMentions: { repliedUser: false },
      });

      const filter = (i) => i.user.id === userId;

      const collector = replyMessage.createMessageComponentCollector({
          filter,
          time: 60000,
      });
      let responseStyle = "simple";

      collector.on("collect", async (i) => {
          if (i.user.id !== userId) {
              await i.reply({
                  content: "Chỉ người đặt câu hỏi mới có thể chọn kiểu trả lời.",
                  ephemeral: true,
              });
              return;
          }
          responseStyle = i.customId;
          await i.deferUpdate();
          collector.stop();
      });

      collector.on("end", async (collected) => {
          await discordUtils.safeDeleteMessage(replyMessage);

          if (collected.size === 0) {
              await discordUtils.sendErrorMessage(
                  message,
                  "Không có lựa chọn, hệ thống tự động chọn chế độ 'Đơn Giản'",
                  isSlash
              );
          }

          const languageInstruction = getLanguageInstruction(language);
          let currentPrompt = `${languageInstruction}\n`;
          currentPrompt +=
              responseStyle === "simple" ? "Trả lời ngắn gọn." : "Trả lời chi tiết.";
          currentPrompt += `\n${prompt}`;

          let messages = [];
          messages.push({ role: "user", parts: [{ text: threadInfo.prompt }] });
          if (imagePart) {
              messages[0].parts.unshift(imagePart);
          }

          historyRows.forEach((row) => {
              messages.push({ role: "user", parts: [{ text: row.message }] });
              if (row.ai_response) {
                  messages.push({ role: "model", parts: [{ text: row.ai_response }] });
              }
          });

          messages.push({ role: "user", parts: [{ text: currentPrompt }] });

          const geminiResponse = await generateContentWithHistory(messages);
          let text = formatMath(geminiResponse);

          // --- SPLIT MESSAGES ---
          const MAX_MESSAGE_LENGTH = 2000;
          const chunks = [];
          let currentIndex = 0;

          while (currentIndex < text.length) {
              let nextIndex = currentIndex + MAX_MESSAGE_LENGTH;

              if (text.includes('```', currentIndex)) {
                  const nextCodeBlockStart = text.indexOf('```', currentIndex);
                  const nextCodeBlockEnd = text.indexOf('```', nextCodeBlockStart + 3);

                  if (nextCodeBlockStart < nextIndex && nextCodeBlockEnd !== -1) {
                      nextIndex = nextCodeBlockEnd + 3;
                  }
              }

              const chunk = text.substring(currentIndex, nextIndex);
              chunks.push(chunk);
              currentIndex = nextIndex;
          }
          // --- END SPLIT MESSAGES ---

          //Loop through the chunks and send them
          for (const chunk of chunks) {
              // Handle code blocks within EACH CHUNK
              if (chunk.includes('```')) {
                  const codeStartIndex = chunk.indexOf('```');
                  const codeEndIndex = chunk.indexOf('```', codeStartIndex + 3);

                  if (codeStartIndex !== -1 && codeEndIndex !== -1) {
                      const codeBlock = chunk.substring(codeStartIndex + 3, codeEndIndex);
                      const languageMatch = codeBlock.match(/^([a-z]+)\n/);
                      const language = languageMatch ? languageMatch[1] : 'plaintext';
                      const code = codeBlock.replace(/^([a-z]+)\n/, '');

                      const embed = createCodeEmbed(code, language);

                       // Send text *before* the code block
                      const beforeCode = chunk.substring(0, codeStartIndex).trim();
                      if (beforeCode) {
                          await sendMessageAndSave(message.channel, beforeCode, message.client.user.id, false, geminiResponse, connection);
                      }

                      // Send the embed
                      await sendMessageAndSave(message.channel, { embeds: [embed] }, message.client.user.id, false, geminiResponse, connection);

                      // Send text *after* the code block
                      const afterCode = chunk.substring(codeEndIndex + 3).trim();
                       if (afterCode) {
                          await sendMessageAndSave(message.channel, afterCode, message.client.user.id, false, geminiResponse, connection);
                      }
                  } else {
                      // Inconsistent code blocks?  Just send the chunk.
                    await sendMessageAndSave(message.channel, chunk, message.client.user.id, false, geminiResponse, connection);
                  }
              } else {
                  // No code block, just send the chunk.
                await sendMessageAndSave(message.channel, chunk, message.client.user.id, false, geminiResponse, connection)
              }
          }


          if (loadingMessage && !isSlash) {
              await discordUtils.safeDeleteMessage(loadingMessage);
          }
          await connection.execute(
              "UPDATE users SET total_points = total_points + 1 WHERE userId = ?",
              [userId]
          );
          await sendMessageAndSave(
              message.channel,
              prompt,
              userId,
              true,
              null,
              connection
          );

          await connection.commit();
      });
  } catch (error) {
      if (connection) await connection.rollback();
      console.error("Error handling reply command:", error);
      await discordUtils.sendErrorMessage(
          message,
          "Có lỗi xảy ra khi xử lý yêu cầu của bạn.",
          discordUtils.isSlashCommand(message)
      );
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
      .setName("reply")
      .setDescription("Trả lời trong một thread đã có")
      .addStringOption((option) =>
          option
              .setName("prompt")
              .setDescription("Câu trả lời của bạn")
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
          return await discordUtils.sendErrorMessage(
              interaction,
              "Bạn chỉ có thể sử dụng lệnh này trong một thread của kênh đã được chỉ định",
              true
          );
      }
      await interaction.deferReply({ ephemeral: false });
      const prompt = interaction.options.getString("prompt");
      const language =
          interaction.options.getString("language") || config.defaultLanguage;
      const image = interaction.options.getAttachment("image");
      await handleReplyCommand(interaction, prompt, language, image);
  },
  handleReplyCommand,
};