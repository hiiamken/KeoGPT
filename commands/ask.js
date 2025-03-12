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
  const { getRandomReplySuggestion } = require("../utils/help");
  
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
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
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
          await discordUtils.sendErrorMessage(message, `Loại tệp không được hỗ trợ.`);
          return null;
        }
        await downloadImage(attachment.url, imagePath);
        return fileToGenerativePart(imagePath, "image/png");
      }
      return null;
    } catch (error) {
      console.error("Error processing image:", error);
      await discordUtils.sendErrorMessage(message, "Có lỗi khi xử lý ảnh.");
      return null;
    } finally {
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }
  }
  
  async function sendMessageAndSave(
    thread,
    content,
    userId,
    isPrompt = false,
    aiResponse = null,
    trx
  ) {
    try {
      const msg = await thread.send(content);
      await saveMessage(
        thread.id,
        userId,
        typeof content === "string" ? content : "Embed Message",
        isPrompt,
        aiResponse,
        trx
      );
      return msg;
    } catch (error) {
      console.error("Error sending or saving message:", error);
      throw error;
    }
  }
  
  async function handleAskCommand(message, prompt, language, imageAttachment = null) {
    let trx;
    const isSlash = discordUtils.isSlashCommand(message);
    const userId = isSlash ? message.user.id : message.author.id;

    if (!message.channel || !discordUtils.hasBotPermissions(message.channel, [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.CreatePublicThreads,
        PermissionsBitField.Flags.EmbedLinks,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
    ])) {
        return await discordUtils.sendErrorMessage(message, "Bot không có đủ quyền!", isSlash);
    }

    if (message.channel.type === ChannelType.PublicThread || message.channel.type === ChannelType.PrivateThread) {
        return await discordUtils.sendErrorMessage(message, "Bạn không thể sử dụng lệnh này trong thread.", isSlash);
    }

    if (message.channelId !== config.allowedChannelId) {
        return await discordUtils.sendErrorMessage(message, "Bạn chỉ có thể sử dụng lệnh này trong kênh chỉ định.", isSlash);
    }

    try {
        trx = await beginTransaction();
        const imagePart = await processImageAttachment(message);
        if (imagePart === undefined) return;

        const threadTitle = await generateTitle(prompt);
        const thread = await message.channel.threads.create({
            name: `💬 ${threadTitle.substring(0, 90)}`,
            autoArchiveDuration: 60,
            reason: "Trả lời câu hỏi của người dùng",
            type: ChannelType.PublicThread,
        });

        if (!thread) {
            return await discordUtils.sendErrorMessage(message, "Không thể tạo thread.", isSlash);
        }



        // Lưu thông tin thread vào database
        await saveThreadInfo(
            thread.id,
            userId,
            prompt,
            language,
            new Date(Date.now() + config.threadLifetimeDays * 24 * 60 * 60 * 1000),
            trx
        );

        await commitTransaction(trx);

        // **THÊM CHỜ 100ms ĐỂ ĐẢM BẢO GIAO DỊCH ĐƯỢC XỬ LÝ**
        await new Promise((res) => setTimeout(res, 100));

        // Kiểm tra lại threadId sau khi đã lưu
        const checkThreadExists = await executeQuery(
            "SELECT threadId FROM threads WHERE threadId = ?",
            [thread.id]
        );

        if (!checkThreadExists || checkThreadExists.length === 0) {
            console.error(`❌ Lỗi: Không thể tìm thấy threadId ${thread.id} trong database sau khi insert.`);
            throw new Error("Thread chưa được lưu vào database");
        }



        // Cập nhật thông tin user
        await executeQuery(
            "INSERT INTO users (userId, username) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET total_threads = total_threads + 1, total_points = total_points + 2, username = excluded.username",
            [userId, isSlash ? message.user.username : message.author.username]
        );

        // Gửi câu trả lời AI
        const response = await generateContentWithHistory([{ role: "user", parts: [{ text: prompt }] }]);
        let text = formatMath(response);

        const MAX_MESSAGE_LENGTH = 2000;
        const chunks = text.match(new RegExp(`.{1,${MAX_MESSAGE_LENGTH}}`, "g")) || [];

        for (const chunk of chunks) {
            await sendMessageAndSave(thread, chunk, message.client.user.id, false, response);
        }

        // **CHỜ 100ms TRƯỚC KHI LƯU TIN NHẮN ĐỂ ĐẢM BẢO THREAD ĐÃ ĐƯỢC XÁC NHẬN**
        await new Promise((res) => setTimeout(res, 100));

        await saveMessage(thread.id, userId, prompt, true, null);

        const suggestion = getRandomReplySuggestion(thread.name);
        await thread.send(suggestion);

        if (isSlash) {
            await message.followUp({ content: `Đã tạo thread: ${thread.url}`, ephemeral: true });
        }
    } catch (error) {
        if (trx) await rollbackTransaction(trx);
        console.error("Error in handleAskCommand:", error);
        await discordUtils.sendErrorMessage(message, "Có lỗi khi xử lý.", isSlash);
    } finally {
        if (config.databaseType === "mysql" && trx) releaseConnection(trx);
    }
}
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName("ask")
      .setDescription("Đặt câu hỏi cho KeoGPT và tạo một thread mới.")
      .addStringOption(option =>
        option.setName("prompt").setDescription("Câu hỏi của bạn").setRequired(true)
      )
      .setDMPermission(false),
    async execute(interaction) {
      if (interaction.channel.type === ChannelType.PublicThread || interaction.channel.type === ChannelType.PrivateThread) {
        return await discordUtils.sendErrorMessage(interaction, "Bạn không thể sử dụng lệnh này trong thread.", true);
      }
      if (interaction.channelId !== config.allowedChannelId) {
        return await discordUtils.sendErrorMessage(interaction, "Bạn chỉ có thể sử dụng lệnh này trong kênh chỉ định.", true);
      }
      await interaction.deferReply({ ephemeral: false });
  
      const prompt = interaction.options.getString("prompt");
      const language = interaction.options.getString("language") || config.defaultLanguage;
      await handleAskCommand(interaction, prompt, language);
    },
    handleAskCommand,
  };
  