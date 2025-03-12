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
    return (
      result?.response?.text() || "⚠️ Lỗi: Không nhận được phản hồi từ Gemini."
    );
  } catch (error) {
    console.error("❌ Gemini API error (generateContent):", error);
    return error.message === "Gemini API timeout"
      ? "⚠️ Xin lỗi, API Gemini mất quá nhiều thời gian để phản hồi. Vui lòng thử lại sau."
      : "⚠️ Đã xảy ra lỗi khi kết nối với API Gemini.";
  }
}

async function generateTitle(prompt) {
  const titlePrompt = `Tạo một tiêu đề RẤT NGẮN GỌN (1-5 chữ, tối đa 25 kí tự) cho câu hỏi sau: "${prompt}". CHỈ TRẢ VỀ TIÊU ĐỀ, không giải thích, không giới thiệu, không thêm bất kỳ ký tự nào khác.\nTiêu đề:`;
  return generateContent([titlePrompt]);
}

async function generateContentWithHistory(messages) {
  try {
    if (
      !messages ||
      messages.length === 0 ||
      !messages[messages.length - 1]?.parts?.[0]?.text
    ) {
      throw new Error("⚠️ Lỗi: Dữ liệu lịch sử không hợp lệ.");
    }

    const chat = await geminiModel.startChat({
      history: messages,
      generationConfig: { maxOutputTokens: 4096 },
    });

    const result = await chat.sendMessage(
      messages[messages.length - 1].parts[0].text
    );
    return (
      result?.response?.text() || "⚠️ Lỗi: Không nhận được phản hồi từ Gemini."
    );
  } catch (error) {
    console.error("❌ Gemini API error (generateContentWithHistory):", error);
    return "⚠️ Đã xảy ra lỗi khi xử lý dữ liệu.";
  }
}

const languageInstructions = Object.freeze({
  vi: "Hãy trả lời bằng tiếng Việt. Trình bày lời giải chi tiết, rõ ràng, từng bước. Sử dụng Markdown để định dạng (in đậm, gạch đầu dòng, v.v.). Viết các công thức toán học một cách dễ đọc (ví dụ: f'(x), e^x, x > 0, (0, +∞)).",
  en: "Please respond in English. Format the response using Markdown.",
  ja: "日本語で応答してください。 マークダウンを使用して応答をフォーマットします。",
  ko: "한국어로 응답하십시오. 마크다운을 사용하여 응답 형식을 지정합니다.",
  fr: "Répondez en français. Formatez la réponse en utilisant Markdown.",
  es: "Responde en español. Formatea la respuesta usando Markdown.",
  de: "Antworten Sie auf Deutsch. Formatieren Sie die Antwort mit Markdown.",
  ru: "Отвечайте на русском языке. Отформатируйте ответ, используя Markdown.",
  zh: "请用中文回答。使用 Markdown 格式化响应。",
  "zh-TW": "請用繁體中文回答。使用 Markdown 格式化回應。",
  ar: "الرجاء الرد باللغة العربية. قم بتنسيق الاستجابة باستخدام Markdown.",
});

function getLanguageInstruction(language) {
  return (
    languageInstructions[language] ||
    `Please respond in ${language}. Format the response using Markdown.`
  );
}

function fileToGenerativePart(filePath, mimeType) {
  try {
    return {
      inlineData: {
        data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
        mimeType,
      },
    };
  } catch (error) {
    console.error("❌ Error reading file for Gemini API:", error);
    return null;
  }
}

async function downloadImage(url, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `⚠️ Failed to download image: ${response.status} ${response.statusText}`
      );
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filename, Buffer.from(buffer));
    console.log(`✅ Image downloaded successfully: ${filename}`);
  } catch (error) {
    console.error("❌ Error downloading image:", error);
    throw error;
  }
}

module.exports = {
  generateContent,
  generateTitle,
  generateContentWithHistory,
  getLanguageInstruction,
  fileToGenerativePart,
  downloadImage,
};
