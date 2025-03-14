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
} = require("../utils/gemini");
const {
  generateContent: generateContentChatGPT,
  generateTitle,
  generateContentWithHistory: generateContentWithHistoryChatGPT,
} = require("../utils/chatgpt");
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

async function downloadImage(url, filename) {
  const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download image: ${response.status} ${response.statusText}`
    );
  }
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filename, Buffer.from(buffer));
}

function fileToGenerativePart(filePath, mimeType) {
  try {
    const fileData = fs.readFileSync(filePath, { encoding: "base64" });
    return `data:${mimeType};base64,${fileData}`;
  } catch (error) {
    return null;
  }
}

async function processImageAttachment(message) {
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
        `❌ Loại tệp không được hỗ trợ. Chỉ hỗ trợ: ${allowedTypes.join(", ")}`,
        discordUtils.isSlashCommand(message)
      );
      return undefined;
    }
    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const imagePath = path.join(tempDir, "temp_image.png");
    try {
      await downloadImage(attachment.url, imagePath);
      const imageData = fileToGenerativePart(imagePath, "image/png");
      fs.unlinkSync(imagePath);
      return imageData;
    } catch (error) {
      await discordUtils.sendErrorMessage(message, "❌ Có lỗi khi xử lý ảnh.");
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      return undefined;
    }
  }
  return null;
}

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

async function ensureUserExists(userId, username) {
  await db.executeQuery(
    `INSERT OR IGNORE INTO users (userId, username, total_points, total_threads) VALUES (?, ?, 0, 0)`,
    [userId, username]
  );
}

async function handleAskCommand(message, prompt, language) {
  let loadingMessage = null;
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
        PermissionsBitField.Flags.CreatePublicThreads,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
      ])
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Bot không có đủ quyền!",
        isSlash
      );
    }

    if (message.channel.isThread()) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Bạn không thể sử dụng lệnh này trong thread.",
        isSlash
      );
    }

    if (message.channelId !== config.allowedChannelId) {
      return await discordUtils.sendErrorMessage(
        message,
        `❌ Bạn chỉ có thể sử dụng lệnh này trong kênh <#${config.allowedChannelId}>!`,
        isSlash
      );
    }

    let attachment = null;
    if (discordUtils.isSlashCommand(message)) {
      attachment = message.options.getAttachment("image");
    } else {
      attachment = message.attachments?.first() || null;
    }

    if (!prompt || !prompt.trim()) {
      if (!attachment) {
        return await discordUtils.sendErrorMessage(
          message,
          "❌ Bạn chưa nhập câu hỏi hoặc gửi ảnh!",
          isSlash
        );
      }
      prompt = "Hãy mô tả hình ảnh";
    } else {
      prompt = prompt.trim();
    }

    await ensureUserExists(userId, username);

    if (isSlash) {
      loadingMessage = await message.followUp({
        content: getRandomLoadingMessage(),
        ephemeral: false,
      });
    } else {
      loadingMessage = await message.reply(getRandomLoadingMessage());
    }

    const imageUrl = attachment ? attachment.url : null;
    const mimeType = attachment ? attachment.contentType : null;

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
        "❌ Không thể tạo thread.",
        isSlash
      );
    }

    try {
      await thread.members.add(userId);
    } catch (e) {}

    await db.saveThreadInfo(
      thread.id,
      userId,
      prompt,
      language,
      new Date(Date.now() + config.threadLifetimeDays * 24 * 60 * 60 * 1000)
    );

    const imagePart = await processImageAttachment(message);

    const row = discordUtils.createResponseStyleButtons();
    const styleMessage = await thread.send({
      content: `<@${userId}>, bạn muốn nhận câu trả lời theo kiểu nào?\n\n**Đơn giản:** Giải thích ngắn gọn\n**Chuyên nghiệp:** Giải thích chi tiết, đầy đủ, có thể kèm theo công thức hoặc ví dụ.`,
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
        chosenPrompt =
          "Trả lời cực kỳ ngắn gọn, không quá 500 ký tự. Ví dụ 1-2 đoạn là đủ.";
      } else if (responseStyle === "detailed") {
        chosenPrompt = "Trả lời chi tiết, tối thiểu 300 từ, có ví dụ.";
      }
    } catch (error) {
      await discordUtils.safeDeleteMessage(styleMessage);
      chosenPrompt = "Trả lời chi tiết, đầy đủ thông tin.";
    }

    const languageInstruction = config.languageInstruction;
    const markdownInstruction = `
  Định dạng câu trả lời của bạn bằng Markdown, tuân thủ NGHIÊM NGẶT các quy tắc sau đây. Đây là YÊU CẦU BẮT BUỘC, không được phép sai lệch:
  
  1. **Code Python:**
     - LUÔN LUÔN đặt code Python trong code block. Sử dụng cú pháp mở đầu là \`\`\`python và cú pháp kết thúc là \`\`\`.
     - Ví dụ:
       \`\`\`python
       def calculate_sum(a, b):
           return a + b
  
       print(calculate_sum(5, 3))
       \`\`\`
  
  2. **Tiêu đề và phần:**
     - Sử dụng dấu sao đôi (**) để IN ĐẬM tiêu đề chính.
     - KHÔNG sử dụng dấu thăng (#) cho tiêu đề.
     - Ví dụ:
       **1. Giới thiệu về bài toán**
       **2. Giải thuật**
       **3. Code mẫu**
  
  3. **Giải thích chi tiết:**
     - Sử dụng gạch đầu dòng (-) cho mỗi ý giải thích.
     - In đậm tên hàm, tên biến, và các thuật ngữ kỹ thuật quan trọng.
     - Xuống dòng đầy đủ sau mỗi gạch đầu dòng để tạo khoảng cách rõ ràng.
  
  4. **Công thức toán học:**
     - Hiển thị các biểu thức, công thức toán một cách rõ ràng, dễ đọc.
     - Nếu có thể, sử dụng các ký tự Unicode để biểu diễn công thức. Ví dụ: x², √(x), π, Σ (tổng), ∫ (tích phân).
     - KHÔNG sử dụng LaTeX trực tiếp (ví dụ: \\sqrt{x}). Thay vào đó, hãy dùng các ký tự Unicode, hoặc biểu diễn gần đúng.
  
  5. **Ví dụ (nếu có):**
     - Trình bày ví dụ một cách rõ ràng, có thể sử dụng gạch đầu dòng hoặc bảng (nếu cần).
  
  6. **TUYỆT ĐỐI KHÔNG:**
     - KHÔNG hiển thị dấu hoa thị (*) trực tiếp trong văn bản, trừ khi nó là một phần của code hoặc có ý nghĩa đặc biệt.
     - KHÔNG hiển thị code Python trực tiếp trong văn bản. LUÔN LUÔN sử dụng code block.
     - KHÔNG sử dụng LaTeX thô.
     - Không xuống hàng quá nhiều, gây loãng nội dung
  
  7. **Văn phong:**
     - Sử dụng ngôn ngữ khoa học, chính xác, dễ hiểu.
     - Tránh viết tắt, trừ khi là các thuật ngữ rất phổ biến.
     - Luôn kiểm tra chính tả và ngữ pháp.
  
  **MỤC TIÊU:** Câu trả lời phải chuyên nghiệp, dễ đọc, dễ hiểu, và có tính thẩm mỹ cao. Hãy tưởng tượng bạn đang trình bày cho một người có chuyên môn.
  `;

    const finalPrompt = imagePart
      ? `${languageInstruction}\n${markdownInstruction}\n\n${prompt}\n\n[Hình ảnh đính kèm]\n\n${chosenPrompt}`
      : `${languageInstruction}\n${markdownInstruction}\n\n${prompt}\n\n${chosenPrompt}`;

    const estimatedPromptTokens = Math.round(finalPrompt.length / 4);
    const dailyTokenUsage = await db.getDailyTokenUsage(userId);
    const MAX_DAILY_TOKENS = 510000;
    let useGemini = true;
    if (dailyTokenUsage + estimatedPromptTokens > MAX_DAILY_TOKENS) {
      useGemini = false;
    }

    let responseText;
    try {
      if (useGemini) {
        const geminiPayload = {
          model: config.geminiModel,
          contents: [{ text: finalPrompt }],
        };
        if (imagePart) {
          geminiPayload.contents.push({
            inlineData: {
              mimeType: mimeType,
              data: imagePart.split(",")[1],
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
        if (imagePart) {
          messages[1].content = [
            { type: "text", text: messages[1].content },
            {
              type: "image_url",
              image_url: {
                url: imagePart,
              },
            },
          ];
        }
        responseText = await generateContentWithHistoryChatGPT(messages);
      }
    } catch (error) {
      await discordUtils.sendErrorMessage(
        message,
        "❌ Bot gặp sự cố khi kết nối với API. Vui lòng thử lại sau!",
        isSlash
      );
      await discordUtils.safeDeleteMessage(loadingMessage);
      return;
    }

    responseText = formatMath(responseText);

    if (chosenPrompt.includes("Trả lời cực kỳ ngắn gọn")) {
      if (responseText.length > 500) {
        responseText = responseText.slice(0, 500) + "...";
      }
    }

    await sendMessageAndSave(
      thread,
      responseText,
      message.client.user.id,
      false,
      responseText,
      0
    );
    await sendMessageAndSave(
      thread,
      prompt,
      userId,
      true,
      null,
      config.pointsPerInteraction
    );

    await db.executeQuery(
      "UPDATE users SET total_points = total_points + ?, monthly_points = monthly_points + ? WHERE userId = ?",
      [config.pointsPerInteraction, config.pointsPerInteraction, userId]
    );

    await thread.send(getRandomReplySuggestion(thread.name));
    if (isSlash) {
      await message.followUp({
        content: `Thread: ${thread.url}`,
        ephemeral: true,
      });
    }
    await discordUtils.safeDeleteMessage(loadingMessage);
  } catch (error) {
    await discordUtils.sendErrorMessage(
      message,
      "❌ Có lỗi khi xử lý.",
      isSlash
    );
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
        .setRequired(false)
    )
    .addStringOption((option) => {
      option
        .setName("language")
        .setDescription("Ngôn ngữ trả lời (mặc định là Tiếng Việt)")
        .setRequired(false);
      for (const [langCode, langName] of Object.entries(
        config.supportedLanguages
      )) {
        option.addChoices({ name: langName, value: langCode });
      }
      return option;
    })
    .addAttachmentOption((option) =>
      option.setName("image").setDescription("Đính kèm ảnh (không bắt buộc)")
    ),
  execute: async (interaction) => {
    const prompt = interaction.options.getString("prompt");
    const language =
      interaction.options.getString("language") || config.defaultLanguage;
    await handleAskCommand(interaction, prompt, language);
  },
  executePrefix: async (message, args) => {
    if (!args.length) return;
    await handleAskCommand(message, args.join(" "), null);
  },
};
