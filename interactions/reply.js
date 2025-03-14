const {
  SlashCommandBuilder,
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
  generateContentWithHistory: generateContentWithHistoryChatGPT,
} = require("../utils/chatgpt");
const { formatMath } = require("../utils/format");
const config = require("../config");
const discordUtils = require("../utils/discord");
const { getRandomReplySuggestion } = require("../utils/help");
const db = require("../utils/database");

async function sendMessageAndSave(
  thread,
  content,
  userId,
  isPrompt = false,
  aiResponse = null
) {
  const msg = await thread.send(content);

  await db.saveMessage(
    thread.id,
    userId,
    typeof content === "string" ? content : "Embed Message",
    isPrompt,
    aiResponse
  );
  return msg;
}

async function handleReplyCommand(message, prompt, language) {
  const isSlash = discordUtils.isSlashCommand(message);
  const userId = isSlash ? message.user.id : message.author.id;
  const username = isSlash ? message.user.username : message.author.username;

  try {
    if (
      !discordUtils.hasBotPermissions(message.channel, [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
      ])
    ) {
      console.error("DEBUG: handleReplyCommand - Bot lacks permissions");
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Bot không có đủ quyền!",
        isSlash
      );
    }

    if (!message.channel.isThread()) {
      console.error("DEBUG: handleReplyCommand - Not in thread");
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Lệnh này chỉ dùng trong thread!",
        isSlash
      );
    }

    await db.ensureUserExists(userId, username);

    const threadRowsRaw = await db.executeQuery(
      "SELECT userId, prompt, language FROM threads WHERE threadId = ?",
      [message.channel.id]
    );

    let threadRows;
    if (Array.isArray(threadRowsRaw) && threadRowsRaw.length > 0) {
      threadRows = threadRowsRaw[0]; // Lấy object đầu tiên
    } else if (!Array.isArray(threadRowsRaw) && threadRowsRaw) {
      threadRows = threadRowsRaw;
    }

    if (!threadRows) {
      console.error("DEBUG: handleReplyCommand - Thread not found in DB");
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Không tìm thấy thread hoặc thread đã bị xóa.",
        isSlash
      );
    }

    const originalPrompt = threadRows.prompt;
    language = language || threadRows.language;

    let attachment = null;
    if (isSlash) {
      attachment = message.options.getAttachment("image");
    } else {
      attachment = message.attachments?.first() || null;
    }
    const imageUrl = attachment ? attachment.url : null;
    const mimeType = attachment ? attachment.contentType : null;

    const row = discordUtils.createResponseStyleButtons();
    const styleMessage = await message.channel.send({
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
      } else {
        chosenPrompt = "Trả lời chi tiết, tối thiểu 300 từ, có ví dụ.";
      }
    } catch (error) {
      console.warn(
        "DEBUG: handleReplyCommand - user did not choose style:",
        error.message
      );
      await discordUtils.safeDeleteMessage(styleMessage);
      chosenPrompt = "Trả lời chi tiết, đầy đủ thông tin.";
    }

    const languageInstruction = config.languageInstruction;
    const markdownInstruction = `
Định dạng câu trả lời của bạn bằng Markdown, tuân thủ NGHIÊM NGẶT các quy tắc sau đây. Đây là YÊU CẦU BẮT BUỘC, không được phép sai lệch:
1. **Code Python:**
   - Luôn đặt code Python trong code block (bắt đầu với \`\`\`python và kết thúc với \`\`\`).
2. **Tiêu đề và phần:**
   - Sử dụng dấu sao đôi (**) để IN ĐẬM tiêu đề chính.
3. **Giải thích chi tiết:**
   - Sử dụng gạch đầu dòng (-) cho mỗi ý giải thích.
4. **Công thức toán học:**
   - Hiển thị công thức bằng ký tự Unicode.
5. **Ví dụ (nếu có):**
   - Trình bày ví dụ rõ ràng.
6. **Không:**
   - Không sử dụng LaTeX thô.
7. **Văn phong:**
   - Sử dụng ngôn ngữ chính xác và dễ hiểu.
`;

    const finalPrompt = `${languageInstruction}\n${markdownInstruction}\n\nOriginal Prompt: ${originalPrompt}\n\nUser Reply: ${prompt}\n\n${chosenPrompt}`;

    const historyRows = await db.getThreadHistory(
      message.channel.id,
      config.maxHistoryLength
    );
    let historyPrompt = "";
    historyRows.reverse().forEach((row) => {
      historyPrompt += `User: ${row.message}\n`;
      if (row.ai_response) {
        historyPrompt += `Bot: ${row.ai_response}\n`;
      }
    });

    const fullPrompt = `
${languageInstruction}\n${markdownInstruction}\n\n
Original Prompt: ${originalPrompt}\n
${historyPrompt}\n
User Reply: ${prompt}\n
${chosenPrompt}
`;

    const estimatedPromptTokens = Math.round(fullPrompt.length / 4);
    const dailyTokenUsage = await db.getDailyTokenUsage(userId);
    const MAX_DAILY_TOKENS = 510000;
    let useGemini = true;
    if (dailyTokenUsage + estimatedPromptTokens > MAX_DAILY_TOKENS) {
      useGemini = false;
    }

    let responseText;
    try {
      if (useGemini) {
        const messages = [
          {
            role: "user",
            parts: [{ text: fullPrompt }],
          },
        ];
        let base64Image = null;
        if (imageUrl) {
          base64Image = await imageUrlToBase64(imageUrl);
          messages[0].parts.push({
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          });
        }
        const geminiResponse = await generateContentWithHistoryGemini(messages);
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
            content: `Original Prompt: ${originalPrompt}\n${historyPrompt}User Reply: ${prompt}\n${chosenPrompt}`,
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
      console.error("DEBUG: handleReplyCommand - API error:", err);
      await discordUtils.sendErrorMessage(
        message,
        "❌ Có lỗi khi xử lý. Vui lòng thử lại sau.",
        isSlash
      );
      return;
    }

    await sendMessageAndSave(
      message.channel,
      responseText,
      message.client.user.id,
      false,
      responseText
    );

    await sendMessageAndSave(message.channel, prompt, userId, true, null);

    await db.executeQuery(
      "UPDATE users SET total_points = total_points + 1, monthly_points = monthly_points + 1 WHERE userId = ?",
      [userId]
    );

    await message.channel.send(getRandomReplySuggestion());
  } catch (error) {
    console.error("DEBUG: handleReplyCommand - catch error:", error);
    await discordUtils.sendErrorMessage(
      message,
      "❌ Đã xảy ra lỗi khi xử lý yêu cầu của bạn.",
      isSlash
    );
  }
}

async function executePrefix(message, args) {
  if (!args.length) {
    return await discordUtils.sendErrorMessage(
      message,
      "❌ Bạn chưa nhập nội dung trả lời!"
    );
  }
  const prompt = args.join(" ");
  await handleReplyCommand(message, prompt, config.defaultLanguage);
}

const cmdData = new SlashCommandBuilder()
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
      .setDescription("Ảnh (không bắt buộc)")
      .setRequired(false)
  )
  .setDMPermission(false);

module.exports = {
  data: cmdData,
  async execute(interaction) {
    const prompt = interaction.options.getString("prompt");
    const language =
      interaction.options.getString("language") || config.defaultLanguage;
    const image = interaction.options.getAttachment("image");

    await handleReplyCommand(interaction, prompt, language);
  },
  executePrefix,
  handleReplyCommand,
};
