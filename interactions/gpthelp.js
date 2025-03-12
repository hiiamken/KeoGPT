const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");
const config = require("../config");
const discordUtils = require("../utils/discord");

async function handleHelpCommand(message) {
  const helpEmbed = new EmbedBuilder()
    .setColor("#FFC0CB")
    .setTitle("🤖 **Hướng Dẫn Sử Dụng KeoGPT** 🤖")
    .setDescription(
      "KeoGPT là chatbot thông minh, giúp bạn giải đáp thắc mắc. Dưới đây là hướng dẫn chi tiết về cách sử dụng bot:"
    )
    .addFields(
      {
        name: "❓ **Đặt câu hỏi**",
        value:
          "Sử dụng `/ask <câu hỏi>` hoặc `!ask` để đặt câu hỏi. Bot sẽ tạo một thread riêng để trả lời.",
      },
      {
        name: "🖼️ **Gửi kèm ảnh**",
        value: "Có thể đính kèm ảnh bằng tùy chọn `image` trong lệnh `/ask`.",
      },
      {
        name: "🗣️ **Tiếp tục trò chuyện**",
        value:
          "Dùng `/reply <câu hỏi>` hoặc `!reply` để tiếp tục hội thoại trong thread.",
      },
      {
        name: "🆕 **Bắt đầu chủ đề mới**",
        value: "Dùng `/new <câu hỏi>` hoặc `!new` để tạo thread mới.",
      },
      {
        name: "🧹 **Xóa lịch sử**",
        value:
          "Dùng `/clear` hoặc `!clear` để xóa lịch sử thread (chỉ áp dụng cho admin hoặc người tạo thread).",
      },
      {
        name: "🌐 **Đổi ngôn ngữ**",
        value:
          "Dùng `/lang <mã ngôn ngữ>` để đổi ngôn ngữ bot (ví dụ: `/lang en`).",
      },
      {
        name: "📊 **Thống kê cá nhân**",
        value:
          "Dùng `/stats` hoặc `!stats` để xem số điểm và số thread đã tạo.",
      },
      {
        name: "🏆 **Bảng xếp hạng**",
        value:
          "Dùng `/ranking-gpt` hoặc `!ranking-gpt` để xem bảng xếp hạng người dùng.",
      },
      {
        name: "ℹ️ **Trợ giúp**",
        value:
          "Dùng `/gpthelp` hoặc `!gpthelp` để xem hướng dẫn này bất cứ lúc nào.",
      }
    )
    .addFields({
      name: "⭐ **Cách tính điểm**",
      value: `- **+2 điểm** cho mỗi câu hỏi qua \`/ask\` hoặc \`!ask\`
- **+3 điểm** khi tạo thread mới bằng \`/new\` hoặc \`!new\`
- **+1 điểm** khi trả lời trong thread bằng \`/reply\` hoặc \`!reply\`
- Điểm số sẽ được reset vào đầu mỗi tháng.`,
    })
    .addFields({
      name: "📝 **Lưu ý quan trọng**",
      value: `- Bot chỉ hoạt động trong kênh <#${config.allowedChannelId}>.
- Nếu không dùng được slash command, hãy sử dụng các lệnh dạng prefix như \`!ask\`, \`!reply\`, \`!new\`.
- Các lệnh \`/cleardata\` hoặc \`!cleardata\` chỉ dành cho admin.`,
    })
    .setFooter({
      text: "KeoGPT - Được phát triển bởi TKen",
      iconURL: "https://i.imgur.com/Ot7vFGk.png",
    })
    .setTimestamp();

  const isSlash = discordUtils.isSlashCommand(message);

  if (
    !discordUtils.hasBotPermissions(message.channel, [
      PermissionsBitField.Flags.EmbedLinks,
    ])
  ) {
    return await discordUtils.sendErrorMessage(
      message,
      "❌ Bot cần quyền `Embed Links` để gửi hướng dẫn này!",
      isSlash
    );
  }

  try {
    if (isSlash) {
      if (message.deferred || message.replied) {
        await message.followUp({ embeds: [helpEmbed], ephemeral: true });
      } else {
        await message.reply({ embeds: [helpEmbed], ephemeral: true });
      }
    } else {
      await message.channel.send({ embeds: [helpEmbed] });
    }
  } catch (error) {
    console.error("❌ Lỗi khi gửi tin nhắn trợ giúp:", error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gpthelp")
    .setDescription("Hiển thị hướng dẫn sử dụng bot."),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      await handleHelpCommand(interaction);
    } catch (error) {
      console.error("❌ Lỗi trong `/gpthelp`:", error);
      await discordUtils.sendErrorMessage(
        interaction,
        "❌ Đã có lỗi xảy ra khi thực hiện lệnh!",
        true
      );
    }
  },

  name: "gpthelp",
  description: "Hiển thị hướng dẫn sử dụng bot (prefix).",
  async executePrefix(message) {
    try {
      await handleHelpCommand(message);
    } catch (error) {
      console.error("❌ Lỗi trong `!gpthelp`:", error);
    }
  },

  handleHelpCommand,
};
