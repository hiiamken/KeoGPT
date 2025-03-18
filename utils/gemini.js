const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config");
const { formatMath } = require("./format");
const genAI = new GoogleGenerativeAI(config.geminiKeys);
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
      mimeType: mimeType,

      data: base64Data,
    },
  };
}
async function generateContent(request) {
  try {
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
    if (!request.history || !Array.isArray(request.history)) {
      throw new Error("⚠️ Lỗi: Dữ liệu lịch sử không hợp lệ.");
    }
    if (!request.contents || !Array.isArray(request.contents)) {
      throw new Error("⚠️ Lỗi: Dữ liệu nội dung không hợp lệ.");
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
    const lastMessage = request.contents[request.contents.length - 1];
    const result = await Promise.race([
      chat.sendMessage(lastMessage.parts),
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
    throw new Error("⚠️ Lỗi: Dữ liệu không hợp lệ.");
  }
}
async function generateImageGemini(prompt) {
  const imageModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp-image-generation",

    generationConfig: {
      responseModalities: ["Text", "Image"],
    },
  });
  try {
    const result = await imageModel.generateContent(prompt);
    const response = await result.response;
    if (
      response.candidates &&
      response.candidates.length > 0 &&
      response.candidates[0].content
    ) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageBase64 = part.inlineData.data;

          const mimeType = part.inlineData.mimeType;

          return { base64: imageBase64, mimeType: mimeType };
        }
      }
    }
    console.error("Không tìm thấy dữ liệu ảnh trong phản hồi của Gemini.");
    return null;
  } catch (error) {
    console.error("Error generating image with Gemini:", error);
    throw error;
  }
}
async function editImageGemini(prompt, imageParts) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp-image-generation",

      generationConfig: {
        responseModalities: ["Text", "Image"],
      },
    });
    const contents = [{ text: prompt }];
    for (const img of imageParts) {
      contents.push({
        inlineData: {
          mimeType: img.mimeType,

          data: img.base64,
        },
      });
    }
    const result = await model.generateContent(contents);
    const response = result?.response;
    if (!response || !response.candidates || response.candidates.length === 0) {
      console.error(
        "Gemini API did not return a valid response:",
        JSON.stringify(response, null, 2)
      );
      return null;
    }
    let editedImage = null;
    let responseText = "";
    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      console.error(
        "Gemini API response does not contain valid content parts:",
        JSON.stringify(candidate, null, 2)
      );
      return null;
    }
    for (const part of candidate.content.parts) {
      if (part.text) {
        responseText += part.text + "\n";
      } else if (part.inlineData) {
        editedImage = {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        };
      }
    }
    if (!editedImage) {
      console.error(
        "Không tìm thấy dữ liệu ảnh trong phản hồi của Gemini (edit)."
      );
      return null;
    }
    return { ...editedImage, responseText };
  } catch (error) {
    console.error("Error editing image with Gemini:", error);
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
  generateContentWithHistory,
  generateImage: generateImageGemini,
  editImage: editImageGemini,
  generateTitle,
  imageUrlToBase64,
};
