const OpenAI = require("openai");
const config = require("../config");
const { formatMath } = require("./format");

const openai = new OpenAI({ apiKey: config.apiKey });

async function generateContent(prompt, base64Image, mimeType = "image/jpeg") {
  const messages = [
    {
      role: "user",
      content: [{ type: "text", text: prompt }],
    },
  ];

  if (base64Image) {
    messages[0].content.push({
      type: "image_url",
      image_url: {
        url: `data:${mimeType};base64,${base64Image}`,
      },
    });
  }

  try {
    const response = await Promise.race([
      openai.chat.completions.create({
        model: config.chatgptModel,
        messages: messages,
        max_tokens: config.chatgptMaxTokens,
        temperature: config.chatgptTemperature,
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("ChatGPT API timeout")),
          config.chatgptTimeout || 15000
        )
      ),
    ]);

    const text = response.choices?.[0]?.message?.content;
    return text || "⚠️ Không nhận được phản hồi từ ChatGPT.";
  } catch (error) {
    console.error("❌ ChatGPT API error (generateContent):", error);
    throw error;
  }
}

async function generateContentWithHistory(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "⚠️ Lỗi: Dữ liệu lịch sử không hợp lệ.";
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.content && Array.isArray(lastMessage.content)) {
    const hasImage = lastMessage.content.some(
      (item) => item.type === "image_url"
    );
    if (hasImage && config.chatgptModel !== "gpt-4-vision-preview") {
      console.warn("Sử dụng model không hỗ trợ hình ảnh khi có image_url");

      messages[messages.length - 1].content = messages[
        messages.length - 1
      ].content.filter((item) => item.type !== "image_url");
    }
  }

  try {
    const response = await Promise.race([
      openai.chat.completions.create({
        model: config.chatgptModel,
        messages: messages,
        max_tokens: config.chatgptMaxTokens,
        temperature: config.chatgptTemperature,
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("ChatGPT API timeout")),
          config.chatgptTimeout || 15000
        )
      ),
    ]);

    let text = response.choices?.[0]?.message?.content;

    text = formatMath(text);
    return text || "⚠️ Không nhận được phản hồi từ ChatGPT.";
  } catch (error) {
    console.error("❌ ChatGPT API error (generateContentWithHistory):", error);
    throw error;
  }
}

async function generateTitle(prompt) {
  if (!prompt || !prompt.trim()) {
    return "Câu hỏi chưa có tiêu đề";
  }

  const titlePrompt = `Tạo một tiêu đề ngắn (3-6 từ, tối đa 50 ký tự) tóm tắt câu hỏi sau: "${prompt}".
Chỉ trả về tiêu đề, không giải thích, không thêm ký tự nào khác.`;

  try {
    const response = await openai.chat.completions.create({
      model: config.chatgptModel,
      messages: [{ role: "user", content: titlePrompt }],
      max_tokens: 30,
      temperature: 0.5,
    });

    let title = response.choices?.[0]?.message?.content;

    title = formatMath(title);
    return title || "Câu hỏi chưa có tiêu đề";
  } catch (error) {
    console.error("❌ ChatGPT API error (generateTitle):", error);
    throw error;
  }
}
module.exports = {
  generateContent,
  generateContentWithHistory,
  generateTitle,
};
