// commands/ranking-gpt.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../utils/database");

async function handleRankingCommand(interaction) {
  try {
    const userId = interaction.user.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthYear = `${now.getMonth() + 1}/${now.getFullYear()}`;

    const [rows] = await db.pool.execute(
      `
                SELECT u.username, u.total_points, u.userId
                FROM users u
                JOIN threads t ON u.userId = t.userId
                WHERE t.createdAt >= ?
                GROUP BY u.userId
                ORDER BY u.total_points DESC
                LIMIT 10
            `,
      [startOfMonth]
    );

    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const timeLeft = nextReset.getTime() - now.getTime();
    const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor(
      (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    const embed = new EmbedBuilder()
      .setColor("#CF86CA")
      .setTitle(`🏆 BXH KeoGPT Tháng ${monthYear}`)
      .setTimestamp()
      .setDescription(
        "Bảng xếp hạng thành viên dựa trên tổng số điểm tích lũy trong tháng. Cùng leo top nào!"
      )
      .setFooter({
        text: `⏰ Reset: ${daysLeft}d ${hoursLeft}h ${minutesLeft}m`,
      });

    let userRank = "Chưa có hạng";
    const [allRanks] = await db.pool.execute(
      `
                SELECT u.userId, SUM(t.points) AS total_points
                FROM users u
                JOIN threads t ON u.userId = t.userId
                WHERE t.createdAt >= ?
                GROUP BY u.userId
                ORDER BY total_points DESC
            `,
      [startOfMonth]
    );

    const rankIndex = allRanks.findIndex((r) => r.userId === userId);
    if (rankIndex !== -1) {
      userRank = rankIndex + 1;
      userRank = `#${userRank}/${allRanks.length}`;
    }
    embed.addFields({
      name: "👤 Xếp hạng của bạn",
      value: `**${userRank}**`,
      inline: false,
    });

    for (let i = 0; i < 3; i++) {
      if (rows[i]) {
        const user = rows[i];
        let medal = "";
        if (i === 0) medal = "🥇";
        else if (i === 1) medal = "🥈";
        else if (i === 2) medal = "🥉";

        embed.addFields({
          name: `${medal} ${user.username}`,
          value: `**Điểm:** ${user.total_points}`,
          inline: false,
        });
      } else {
        embed.addFields({
          name: `**${i + 1}.**`,
          value: "Trống",
          inline: false,
        });
      }
    }

    let remaining = "";
    for (let i = 3; i < rows.length; i++) {
      const user = rows[i];
      remaining += `**${i + 1}.** ${user.username} - ${
        user.total_points
      } điểm\n`;
    }
    if (remaining) {
      embed.addFields({
        name: "Các thứ hạng khác",
        value: remaining,
        inline: false,
      });
    }
    embed.addFields({
      name: "Hướng dẫn",
      value: "Xem cách tính điểm bằng lệnh `/gpthelp`",
    });

    return { embeds: [embed], ephemeral: false };
  } catch (error) {
    console.error("Error in ranking-gpt command:", error);
    return { content: "Có lỗi xảy ra khi lấy bảng xếp hạng.", ephemeral: true };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ranking-gpt")
    .setDescription("Xem bảng xếp hạng người dùng (theo tháng).")
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    try {
      const result = await handleRankingCommand(interaction);
      await interaction.followUp(result);
    } catch (error) {
      console.error("Error in ranking-gpt slash command execution:", error);
      await interaction.followUp({
        content: "Đã xảy ra lỗi khi xử lí lệnh.",
        ephemeral: true,
      });
    }
  },
  handleRankingCommand,
};
