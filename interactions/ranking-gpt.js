const {
  EmbedBuilder,
  SlashCommandBuilder,
  ChannelType,
} = require("discord.js");
const { executeQuery } = require("../utils/database");
const config = require("../config");

async function fetchRankingData(client) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = await executeQuery(
      `SELECT u.username, u.total_points, u.userId
             FROM users u
             LEFT JOIN threads t ON u.userId = t.userId
             WHERE t.createdAt >= ?
             GROUP BY u.userId
             ORDER BY u.total_points DESC
             LIMIT 10`,
      [startOfMonth]
    );

    if (!result || result.length === 0) {
      return {
        noData: true,
        message: "⚠️ Không có dữ liệu xếp hạng tháng này.",
      };
    }

    const botAvatar = client.user ? client.user.displayAvatarURL() : null;

    const embed = new EmbedBuilder()
      .setColor("#CF86CA")
      .setTitle(
        `🏆 Bảng Xếp Hạng Tháng ${now.getMonth() + 1}/${now.getFullYear()}`
      )
      .setThumbnail(botAvatar)
      .setTimestamp()
      .setDescription(
        "📊 **Danh sách top 10 người dùng tích cực nhất tháng này.**"
      );

    for (let i = 0; i < 10; i++) {
      if (result[i]) {
        const user = result[i];
        embed.addFields({
          name: `${i + 1}. ${user.username || "Ẩn danh"}`,
          value: `🎖 **Điểm:** ${user.total_points}`,
          inline: false,
        });
      } else {
        embed.addFields({
          name: `${i + 1}. Trống`,
          value: `🎖 **Điểm:** 0`,
          inline: false,
        });
      }
    }

    const resetTime = new Date(now.getFullYear(), now.getMonth() + 1, 1) - now;
    const days = Math.floor(resetTime / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (resetTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((resetTime % (1000 * 60 * 60)) / (1000 * 60));

    embed.setFooter({ text: `⏳ Reset sau: ${days}d ${hours}h ${minutes}m` });

    return { embeds: [embed] };
  } catch (error) {
    console.error("❌ [fetchRankingData] Lỗi:", error);
    return { error: true, message: "❌ Có lỗi xảy ra khi lấy bảng xếp hạng." };
  }
}

async function handleRankingCommand(message, client) {
  return await fetchRankingData(client);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ranking-gpt")
    .setDescription("📊 Xem bảng xếp hạng người dùng trong tháng.")
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply();
    const rankingData = await handleRankingCommand(
      interaction,
      interaction.client
    );
    await interaction.followUp(rankingData);
  },

  name: "ranking-gpt",
  description: "📊 Xem bảng xếp hạng (prefix).",
  async executePrefix(message) {
    if (message.channel.type === ChannelType.DM) return;

    try {
      await message.channel.sendTyping();
      const rankingData = await handleRankingCommand(message, message.client);
      await message.channel.send(rankingData);
    } catch (error) {
      console.error("❌ [executePrefix] Lỗi khi thực hiện ranking-gpt:", error);
      await message.channel.send("❌ Đã xảy ra lỗi khi lấy bảng xếp hạng.");
    }
  },

  handleRankingCommand,
};
