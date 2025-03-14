const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config");
const { formatMath } = require("./format");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function imageUrlToBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image: ${response.status} ${response.statusText}`
      );
    }
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return base64;
  } catch (error) {
    console.error("Error converting image to base64:", error);
    throw error;
  }
}

function createImagePart(base64Data, mimeType) {
  return {
    inlineData: {
      mimeType,
      data: base64Data,
    },
  };
}

async function generateContent(request) {
  try {
    // Nếu không cung cấp model thì dùng từ config
    if (!request.model) {
      request.model = config.geminiModel;
    }
    const model = genAI.getGenerativeModel({ model: request.model });
    const result = await Promise.race([
      model.generateContent(request.contents),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Gemini API timeout")),
          config.geminiTimeout || 15000
        )
      ),
    ]);

    const response = await result.response;
    let text = response.text();
    text = formatMath(text);
    const usage = result.promptFeedback;
    return { text, usage };
  } catch (error) {
    console.error("Error generating content with Gemini:", error);
    throw error;
  }
}

async function generateContentWithHistory(request) {
  try {
    if (!request.history || request.history.length === 0) {
      throw new Error("⚠️ Lỗi: Dữ liệu lịch sử không hợp lệ.");
    }
    if (!request.model) {
      request.model = config.geminiModel;
    }
    const model = genAI.getGenerativeModel({ model: request.model });
    const chat = model.startChat({
      history: request.history,
      generationConfig: {
        maxOutputTokens: config.geminiMaxTokens,
        temperature: config.geminiTemperature,
      },
    });

    const result = await Promise.race([
      chat.sendMessage(request.prompt),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Gemini API timeout")),
          config.geminiTimeout || 15000
        )
      ),
    ]);

    const response = await result.response;
    let text = response.text();
    text = formatMath(text);
    const usage = result.promptFeedback;
    return { text, usage };
  } catch (error) {
    console.error("Error generating content with history using Gemini:", error);
    throw error;
  }
}

async function generateTitle(request) {
  const prompt = request.prompt;
  if (!prompt || !prompt.trim()) {
    return "Câu hỏi chưa có tiêu đề";
  }
  const titlePrompt = `Tạo một tiêu đề ngắn (3-6 từ, tối đa 50 ký tự) tóm tắt câu hỏi sau: "${prompt}".
Chỉ trả về tiêu đề, không giải thích, không thêm ký tự nào khác.`;
  try {
    if (!request.model) {
      request.model = config.geminiModel;
    }
    const model = genAI.getGenerativeModel({ model: request.model });
    const result = await model.generateContent(titlePrompt);
    const response = await result.response;
    let text = response.text();
    text = formatMath(text);
    return text;
  } catch (error) {
    console.error("Error generating title Gemini:", error);
    throw error;
  }
}

module.exports = {
  generateContent,
  imageUrlToBase64,
  generateContentWithHistory,
  generateTitle,
  createImagePart,
};
