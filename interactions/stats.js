const {
  EmbedBuilder,
  SlashCommandBuilder,
  ChannelType,
} = require("discord.js");
const { executeQuery } = require("../utils/database");

async function handleStatsCommand(interaction) {
  try {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    const userRows = await executeQuery(
      "SELECT * FROM users WHERE userId = ? LIMIT 1",
      [userId]
    );

    let userData = userRows && userRows.length > 0 ? userRows[0] : null;

    if (!userData) {
      console.warn(`⚠️ Không có dữ liệu cho ${username}, tạo bản ghi mới.`);
      await executeQuery(
        "INSERT INTO users (userId, username, total_threads, total_points) VALUES (?, ?, 0, 0)",
        [userId, username]
      );
      userData = { total_threads: 0, total_points: 0, last_reset: null };
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyPointsRows = await executeQuery(
      `SELECT COALESCE(SUM(t.points), 0) AS monthly_points
             FROM threads t
             WHERE t.userId = ? AND t.createdAt >= ?`,
      [userId, startOfMonth]
    );

    const monthlyPoints = monthlyPointsRows?.[0]?.monthly_points || 0;

    const rankingRows = await executeQuery(
      `SELECT u.userId, COALESCE(SUM(t.points), 0) AS monthly_points
             FROM users u
             LEFT JOIN threads t ON u.userId = t.userId
             WHERE t.createdAt >= ?
             GROUP BY u.userId
             ORDER BY monthly_points DESC`,
      [startOfMonth]
    );

    let rank = "Chưa có hạng";
    if (rankingRows.length > 0) {
      const userRank =
        rankingRows.findIndex((row) => row.userId === userId) + 1;
      if (userRank > 0) {
        rank = `#${userRank}/${rankingRows.length}`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor("#CF86CA")
      .setTitle(`📊 Thống kê của ${username}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: "📌 Tổng quan",
          value: `**Threads đã tạo:** ${userData.total_threads}\n**Tổng điểm:** ${userData.total_points}`,
        },
        {
          name: "🏆 Điểm trong tháng",
          value: `**Điểm:** ${monthlyPoints}\n**Thứ hạng:** ${rank}`,
        }
      )
      .setTimestamp()
      .addFields({
        name: "📖 Hướng dẫn",
        value: "Xem cách tính điểm bằng lệnh `/gpthelp`",
      });

    return { embeds: [embed], ephemeral: true };
  } catch (error) {
    console.error("❌ Lỗi khi lấy dữ liệu stats:", error);
    return {
      content: "❌ Có lỗi xảy ra khi lấy thông tin thống kê.",
      ephemeral: true,
    };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("📊 Xem thống kê cá nhân.")
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const embedData = await handleStatsCommand(interaction);
    await interaction.followUp(embedData);
  },

  async executePrefix(message) {
    if (message.channel.type === ChannelType.DM) {
      return;
    }

    const mockInteraction = {
      user: message.author,
      guild: message.guild,
      reply: async (options) => await message.channel.send(options),
      followUp: async (options) => await message.channel.send(options),
      client: message.client,
    };

    try {
      const result = await handleStatsCommand(mockInteraction);
      if (result) await message.channel.send(result);
    } catch (error) {
      console.error("❌ Lỗi trong lệnh prefix stats:", error);
      await message.reply("❌ Đã xảy ra lỗi khi lấy thống kê của bạn.");
    }
  },

  handleStatsCommand,
};
