// commands/stats.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../utils/database");
const config = require("../config");

async function handleStatsCommand(interaction) {
  try {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    const [userRows] = await db.pool.execute(
      "SELECT * FROM users WHERE userId = ?",
      [userId]
    );

    let userData;
    if (userRows.length === 0) {
      await db.pool.execute(
        "INSERT INTO users (userId, username) VALUES (?, ?)",
        [userId, username]
      );
      userData = { userId, username, total_threads: 0, total_points: 0 };
    } else {
      userData = userRows[0];
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [monthlyPointsRows] = await db.pool.execute(
      `
            SELECT SUM(t.points) as monthly_points
            FROM threads t
            WHERE t.userId = ? AND t.createdAt >= ?
        `,
      [userId, startOfMonth]
    );

    const monthlyPoints = monthlyPointsRows[0].monthly_points || 0;

    const [rankingRows] = await db.pool.execute(
      `
            SELECT u.userId, SUM(t.points) as monthly_points
            FROM users u
            JOIN threads t ON u.userId = t.userId
            WHERE t.createdAt >= ?
            GROUP BY u.userId
            ORDER BY monthly_points DESC
        `,
      [startOfMonth]
    );

    let rank = "Chưa có hạng";
    if (rankingRows.length > 0) {
      const userRank =
        rankingRows.findIndex((row) => row.userId === userId) + 1;
      if (userRank > 0) {
        rank = `${userRank}/${rankingRows.length}`;
      }
    }

    const monthYear = `${now.getMonth() + 1}/${now.getFullYear()}`;

    const embed = new EmbedBuilder()
      .setColor("#CF86CA")
      .setTitle(`Thống kê của ${username}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: "📊 Tổng quan",
          value: `**Số thread đã tạo:** ${userData.total_threads}\n**Tổng điểm:** ${userData.total_points}`,
        },
        {
          name: `⭐ Tháng ${monthYear}`,
          value: `**Điểm:** ${monthlyPoints}\n**Thứ hạng:** ${rank}`,
        }
      )
      .setTimestamp();

    await interaction.followUp({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error("Error in stats command:", error);
    await interaction.followUp({
      content: "Có lỗi xảy ra khi lấy thông tin thống kê.",
      ephemeral: true,
    });
  }
}
module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Xem thống kê cá nhân.")
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    await handleStatsCommand(interaction);
  },
  handleStatsCommand,
};
