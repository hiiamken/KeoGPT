const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  generateContent: generateContentGemini,
  imageUrlToBase64,
  generateContentWithHistory: generateContentWithHistoryGemini,
} = require("../utils/gemini");
const {
  generateContent: generateContentChatGPT,
  generateTitle,
  generateContentWithHistory: generateContentWithHistoryChatGPT,
} = require("../utils/chatgpt");
const db = require("../utils/database");
const config = require("../config");
const discordUtils = require("../utils/discord");
const fs = require("fs");
const path = require("node:path");
const {
  getRandomReplySuggestion,
  getRandomLoadingMessage,
} = require("../utils/help");

async function sendMessageAndSave(
  channel,
  content,
  userId,
  isPrompt = false,
  aiResponse = null,
  points = 0
) {
  const MAX_LENGTH = 2000;
  if (content.length <= MAX_LENGTH) {
    const msg = await channel.send(content);
    await db.saveMessage(
      channel.id,
      userId,
      typeof content === "string" ? content : "Embed Message",
      isPrompt,
      aiResponse,
      points
    );
    return msg;
  } else {
    const parts = discordUtils.chunkString(content, MAX_LENGTH);
    let firstMessage = null;
    for (const part of parts) {
      const msg = await channel.send(part);
      if (!firstMessage) {
        firstMessage = msg;
      }
      await db.saveMessage(
        channel.id,
        userId,
        part,
        isPrompt,
        aiResponse,
        points
      );
    }
    return firstMessage;
  }
}

async function handleNewCommand(
  message,
  prompt,
  language,
  client,
  imageAttachment = null
) {
  const isSlash = discordUtils.isSlashCommand(message);
  const userId = isSlash ? message.user.id : message.author.id;
  const username = isSlash ? message.user.username : message.author.username;
  language = language || config.defaultLanguage;

  try {
    if (isSlash && !message.deferred && !message.replied) {
      await message.deferReply({ ephemeral: false });
    }

    if (
      !discordUtils.hasBotPermissions(message.channel, [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
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
        "❌ Bạn chỉ có thể sử dụng lệnh này trong một thread.",
        isSlash
      );
    }

    await db.ensureUserExists(userId, username);

    const thread = message.channel;
    const threadOwnerId = thread.ownerId || userId;

    if (userId !== threadOwnerId && userId !== config.adminUserId) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Bạn không có quyền làm mới thread này!",
        isSlash
      );
    }

    const newThreadTitle = await generateTitle(prompt);
    await discordUtils.safeRenameThread(
      thread,
      `💬 ${newThreadTitle.substring(0, 90)}`
    );
    await db.executeQuery("DELETE FROM messages WHERE threadId = ?", [
      thread.id,
    ]);
    await db.executeQuery("DELETE FROM threads WHERE threadId = ?", [
      thread.id,
    ]);

    if (!prompt || !prompt.trim()) {
      if (!imageAttachment) {
        return await discordUtils.sendErrorMessage(
          message,
          "❌ Bạn cần cung cấp nội dung để làm mới thread!",
          isSlash
        );
      }
      prompt = "Hãy mô tả hình ảnh";
    } else {
      prompt = prompt.trim();
    }

    let loadingMessage;
    if (isSlash) {
      loadingMessage = await message.followUp({
        content: getRandomLoadingMessage(),
        ephemeral: false,
      });
    } else {
      loadingMessage = await message.reply(getRandomLoadingMessage());
    }

    const row = discordUtils.createResponseStyleButtons();
    const styleMessage = await thread.send({
      content: `<@${userId}>, bạn muốn nhận câu trả lời theo kiểu nào?\n\n**Đơn giản:** Giải thích ngắn gọn\n**Chuyên nghiệp:** Giải thích chi tiết, đầy đủ.`,
      components: [row],
    });

    let chosenPrompt = "";
    try {
      const interaction = await styleMessage.awaitMessageComponent({
        filter: (i) => i.user.id === userId,
        time: 60000,
      });
      const responseStyle = interaction.customId;
      await interaction.deferUpdate();
      await discordUtils.safeDeleteMessage(styleMessage);

      if (responseStyle === "simple") {
        chosenPrompt = "Trả lời đơn giản, 3-4 đoạn, 150 từ.";
      } else if (responseStyle === "detailed") {
        chosenPrompt = "Trả lời chi tiết, tối thiểu 300 từ, có ví dụ.";
      }
    } catch (err) {
      await discordUtils.safeDeleteMessage(styleMessage);
      chosenPrompt = "Trả lời chi tiết, đầy đủ thông tin.";
    }

    let imageUrl = null;
    let mimeType = null;
    if (discordUtils.isSlashCommand(message)) {
      const attachment = message.options.getAttachment("image");
      if (attachment) {
        imageUrl = attachment.url;
        mimeType = attachment.contentType;
      }
    } else {
      const attachment = message.attachments?.first();
      if (attachment) {
        imageUrl = attachment.url;
        mimeType = attachment.contentType;
      }
    }

    const languageInstruction = config.languageInstruction;
    const markdownInstruction = `
      Định dạng câu trả lời của bạn bằng Markdown:

      - Sử dụng **in đậm** cho tiêu đề và các ý chính.
      - Sử dụng gạch đầu dòng (-) cho danh sách.
      - Nếu có code (Python, JavaScript, v.v.), đặt trong code block (\`\`\`<ngôn ngữ>\n...\n\`\`\`).
      - Hiển thị công thức toán học bằng ký tự Unicode (ví dụ: f'(x), e^x, x > 0, (0, +∞)). Tránh LaTeX thô.
      - Sử dụng ngôn ngữ chính xác và dễ hiểu.
    `;

    const finalPrompt = `${languageInstruction}\n${markdownInstruction}\n\n${prompt}\n\n${chosenPrompt}`;

    await db.saveThreadInfo(
      thread.id,
      userId,
      prompt,
      language,
      new Date(Date.now() + config.threadLifetimeDays * 24 * 60 * 60 * 1000)
    );

    let responseText;
    const dailyTokenUsage = await db.getDailyTokenUsage(userId);
    const estimatedPromptTokens = Math.round(finalPrompt.length / 4);
    const MAX_DAILY_TOKENS = 510000;
    let useGemini = true;
    if (dailyTokenUsage + estimatedPromptTokens > MAX_DAILY_TOKENS) {
      useGemini = false;
    }

    try {
      if (useGemini) {
        const geminiPayload = {
          model: config.geminiModel,
          contents: [{ text: finalPrompt }],
        };
        if (imageUrl) {
          const base64Image = await imageUrlToBase64(imageUrl);
          geminiPayload.contents.push({
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          });
        }
        const geminiResponse = await generateContentGemini(geminiPayload);
        responseText = geminiResponse.text;

        const tokensUsed =
          (geminiResponse.usage?.promptTokenCount || 0) +
          (geminiResponse.usage?.completionTokenCount || 0);
        await db.updateDailyTokenUsage(userId, tokensUsed);
      } else {
        const messages = [
          {
            role: "system",
            content: languageInstruction + "\n" + markdownInstruction,
          },
          {
            role: "user",
            content: `${prompt}\n\n${chosenPrompt}`,
          },
        ];
        if (imageUrl) {
          const base64Image = await imageUrlToBase64(imageUrl);
          messages[1].content = [
            { type: "text", text: messages[1].content },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ];
        }
        const chatGPTResponse = await generateContentWithHistoryChatGPT(
          messages
        );
        responseText = chatGPTResponse;
      }
    } catch (err) {
      console.error("❌ Lỗi gọi API Gemini/ChatGPT:", err);
      await discordUtils.sendErrorMessage(
        message,
        "❌ Có lỗi khi xử lý. Vui lòng thử lại sau.",
        isSlash
      );
      await discordUtils.safeDeleteMessage(loadingMessage);
      return;
    }

    await sendMessageAndSave(
      thread,
      responseText,
      client.user.id,
      false,
      responseText,
      0
    );

    await db.executeQuery(
      "UPDATE users SET total_points = total_points + ? WHERE userId = ?",
      [config.newThreadPoints, userId]
    );

    await message.channel.send(getRandomReplySuggestion());
    if (isSlash) {
      await message.followUp({
        content: `Thread: ${message.channel.url}`,
        ephemeral: true,
      });
    }
    await discordUtils.safeDeleteMessage(loadingMessage);
  } catch (error) {
    console.error("❌ Error in handleNewCommand:", error);
    await discordUtils.sendErrorMessage(
      message,
      "❌ Đã xảy ra lỗi khi xử lý yêu cầu của bạn.",
      isSlash
    );
  }
}

const cmdData = new SlashCommandBuilder()
  .setName("new")
  .setDescription("Làm mới thread hiện tại")
  .addStringOption((option) =>
    option
      .setName("prompt")
      .setDescription("Nội dung prompt mới (không bắt buộc)")
      .setRequired(false)
  )
  .addAttachmentOption((option) =>
    option
      .setName("image")
      .setDescription("Ảnh (không bắt buộc)")
      .setRequired(false)
  )
  .setDMPermission(false);

module.exports = {
  data: cmdData,
  async execute(interaction) {
    const prompt = interaction.options.getString("prompt") || "";
    const language =
      interaction.options.getString("language") || config.defaultLanguage;
    const image = interaction.options.getAttachment("image");
    await handleNewCommand(
      interaction,
      prompt,
      language,
      interaction.client,
      image
    );
  },
  async executePrefix(message, args) {
    const prompt = args.join(" ") || "";
    await handleNewCommand(
      message,
      prompt,
      config.defaultLanguage,
      message.client
    );
  },
  handleNewCommand,
};
