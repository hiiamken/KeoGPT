// commands/gpthelp.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");
const discordUtils = require("../utils/discord");

async function handleHelpCommand(message) {
  const helpEmbed = new EmbedBuilder()
    .setColor("#CF86CA")
    .setTitle("🤖 Hướng Dẫn Sử Dụng KeoGPT 🤖")
    .setDescription(
      "KeoGPT là một chatbot thông minh, sẵn sàng trả lời các câu hỏi của bạn.  Dưới đây là hướng dẫn chi tiết:"
    )
    .addFields(
      {
        name: "❓ Đặt câu hỏi",
        value:
          "Sử dụng lệnh `/ask <câu hỏi>` trong kênh chat để đặt câu hỏi cho bot.  Bot sẽ tạo một thread riêng để trả lời, giúp giữ cho kênh chat chính không bị rối.",
      },
      {
        name: "🖼️ Gửi kèm ảnh",
        value:
          "Bạn có thể đính kèm ảnh vào câu hỏi bằng cách sử dụng option `image` của lệnh `/ask`.",
      },
      {
        name: "🗣️ Tiếp tục trò chuyện",
        value:
          "Trong thread đã tạo, bạn có thể tiếp tục đặt câu hỏi bằng cách sử dụng lệnh `/reply <câu hỏi>`.",
      },
      {
        name: "🆕 Chủ đề mới",
        value:
          "Để bắt đầu một chủ đề mới (và xóa lịch sử trò chuyện trước đó trong thread), hãy sử dụng lệnh `/new <câu hỏi>` trong thread đó.",
      },
      {
        name: "🧹 Xóa lịch sử",
        value:
          "Trong một thread, bạn có thể xóa lịch sử trò chuyện bằng lệnh `/clear`.  Chỉ người tạo thread hoặc admin mới có thể sử dụng lệnh này.",
      },
      {
        name: "🌐 Đổi ngôn ngữ",
        value:
          "Sử dụng lệnh `/lang <mã ngôn ngữ>` để thay đổi ngôn ngữ trả lời của bot.  Ví dụ: `/lang en` để chuyển sang tiếng Anh.  Xem danh sách các ngôn ngữ được hỗ trợ bằng cách nhập `/lang` mà không có mã ngôn ngữ nào.",
      },
      {
        name: "📊 Thống kê cá nhân",
        value:
          "Xem thống kê của bạn (số thread đã tạo, tổng điểm) bằng lệnh `/stats`.",
      },
      {
        name: "🏆 Bảng xếp hạng",
        value:
          "Xem bảng xếp hạng điểm số của các thành viên trong tháng bằng lệnh `/ranking-gpt`.",
      },
      {
        name: "ℹ️ Trợ giúp",
        value: "Xem lại hướng dẫn này bằng lệnh `/gpthelp`.",
      }
    )
    .addFields({
      name: "⭐ Cách tính điểm",
      value: `
*   **+2 điểm:**  Cho mỗi câu hỏi mới bằng lệnh \`/ask\`.
*   **+3 điểm:**  Cho mỗi câu hỏi được tạo bằng lệnh \`/new\`.
*   **+1 điểm:**  Cho mỗi câu trả lời trong thread bằng lệnh \`/reply\`.
*   Điểm số được reset vào đầu mỗi tháng.
`,
    })
    .addFields({
      name: "📝 Lưu ý:",
      value: `•  Bot chỉ hoạt động trong kênh <#${config.allowedChannelId}> và các thread được tạo trong kênh đó.
• Sử dụng các lệnh prefix tương ứng (ví dụ: \`!ask\`, \`!reply\`, \`!new\`, ...) nếu bạn không dùng được slash commands.
• Các lệnh \`!clear\` và \`/cleardata\` (xóa toàn bộ dữ liệu) chỉ dành cho admin.`,
    })
    .setTimestamp()
    .setFooter({ text: `KeoGPT - Được phát triển bởi TKen` });

  const isSlash = discordUtils.isSlashCommand(message);
  const replyOptions = { embeds: [helpEmbed], ephemeral: isSlash };

  try {
    isSlash
      ? await message.reply(replyOptions)
      : await message.channel.send(replyOptions);
  } catch (error) {
    console.error("Lỗi khi gửi message:", error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gpthelp")
    .setDescription("Hiển thị thông tin trợ giúp về bot."),
  async execute(interaction) {
    try {
      await handleHelpCommand(interaction);
    } catch (error) {
      console.error("Lỗi trong lệnh gạch chéo help:", error);
      await discordUtils.sendErrorMessage(
        interaction,
        "Đã có lỗi xảy ra khi thực hiện lệnh này!",
        true
      );
    }
  },
  handleHelpCommand,
};
