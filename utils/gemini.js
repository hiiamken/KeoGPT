// utils/gemini.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config");
const fs = require("node:fs");
const path = require("node:path");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const GEMINI_TIMEOUT = 15000;

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: config.geminiModel });

async function generateContent(prompt) {
  try {
    const result = await Promise.race([
      geminiModel.generateContent(prompt),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Gemini API timeout")),
          GEMINI_TIMEOUT
        )
      ),
    ]);
    return await result.response.text();
  } catch (error) {
    console.error("Gemini API error (generateContent):", error);
    if (error.message === "Gemini API timeout") {
      return "Xin lỗi, Gemini API mất quá nhiều thời gian để phản hồi. Bạn vui lòng thử lại sau.";
    }
    throw error;
  }
}
async function startChat(history) {
  try {
    const chat = geminiModel.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 4096,
      },
    });
    return chat;
  } catch (error) {
    console.error("Gemini API error (startChat):", error);
    throw error;
  }
}

async function sendMessage(chat, prompt) {
  try {
    const result = await Promise.race([
      chat.sendMessage(prompt),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Gemini API timeout")),
          GEMINI_TIMEOUT
        )
      ),
    ]);
    return await result.response.text();
  } catch (error) {
    console.error("Gemini API error (sendMessage):", error);
    if (error.message === "Gemini API timeout") {
      return "Xin lỗi, Gemini API mất quá nhiều thời gian để phản hồi. Bạn vui lòng thử lại sau.";
    }
    throw error;
  }
}

async function generateTitle(prompt) {
  const titlePrompt = `Tạo một tiêu đề RẤT NGẮN GỌN (1-5 chữ, tối đa 25 kí tự) cho câu hỏi sau: "${prompt}". CHỈ TRẢ VỀ TIÊU ĐỀ, không giải thích, không giới thiệu, không thêm bất kỳ ký tự nào khác.\nTiêu đề:`;
  return await generateContent([titlePrompt]);
}

async function generateContentWithHistory(messages) {
  const chat = await geminiModel.startChat({
    history: messages,
    generationConfig: {
      maxOutputTokens: 4096,
    },
  });

  const result = await chat.sendMessage(
    messages[messages.length - 1].parts[0].text
  );
  return await result.response.text();
}

function getLanguageInstruction(language) {
  switch (language) {
    case "vi":
      return "Hãy trả lời bằng tiếng Việt. Trình bày lời giải chi tiết, rõ ràng, từng bước. Sử dụng Markdown để định dạng (in đậm, gạch đầu dòng, v.v.). Viết các công thức toán học một cách dễ đọc (ví dụ: f'(x), e^x, x > 0, (0, +∞)).";
    case "en":
      return "Please respond in English. Format the response using Markdown.";
    case "ja":
      return "日本語で応答してください。 マークダウンを使用して応答をフォーマットします。";
    case "ko":
      return "한국어로 응답하십시오. 마크다운을 사용하여 응답 형식을 지정합니다.";
    case "fr":
      return "Répondez en français. Formatez la réponse en utilisant Markdown.";
    case "es":
      return "Responde en español. Formatea la respuesta usando Markdown.";
    case "de":
      return "Antworten Sie auf Deutsch. Formatieren Sie die Antwort mit Markdown.";
    case "ru":
      return "Отвечайте на русском языке. Отформатируйте ответ, используя Markdown.";
    case "zh":
      return "请用中文回答。使用 Markdown 格式化响应。";
    case "zh-TW":
      return "請用繁體中文回答。使用 Markdown 格式化回應。";
    case "ar":
      return "الرجاء الرد باللغة العربية. قم بتنسيق الاستجابة باستخدام Markdown.";
    default:
      return `Please respond in ${language}. Format the response using Markdown.`;
  }
}

function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

async function downloadImage(url, filename) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download image: ${response.status} ${response.statusText}`
    );
  }
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(filename, Buffer.from(buffer));
}

module.exports = {
  generateTitle,
  generateContentWithHistory,
  getLanguageInstruction,
  fileToGenerativePart,
  downloadImage,
};
