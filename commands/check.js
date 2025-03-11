// commands/check.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../utils/database");
const config = require("../config");
const discordUtils = require("../utils/discord");

async function handleCheckCommand(interaction, isSlash = true) {
  try {
    const [threadCountRows] = await db.pool.execute(
      "SELECT COUNT(*) as count FROM threads"
    );
    const threadCount = threadCountRows[0].count;

    const [messageCountRows] = await db.pool.execute(
      "SELECT COUNT(*) as count FROM messages"
    );
    const messageCount = messageCountRows[0].count;

    const [sizeRows] = await db.pool.execute(
      `
            SELECT table_schema AS database,
                   ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
            FROM information_schema.TABLES
            WHERE table_schema = ?
            GROUP BY table_schema;
        `,
      [process.env.DB_NAME]
    );

    const dbSizeMB = sizeRows.length > 0 ? sizeRows[0].size_mb : 0;

    const maxDBSizeMB = config.dbSizeThreshold || 1024;
    const percentage = Math.min((dbSizeMB / maxDBSizeMB) * 100, 100);
    const progressBarLength = 20;
    const filledLength = Math.round((percentage / 100) * progressBarLength);
    const emptyLength = progressBarLength - filledLength;
    const progressBar = "█".repeat(filledLength) + "░".repeat(emptyLength);
    const embed = new EmbedBuilder()
      .setColor("#CF86CA")
      .setTitle("📊 Trạng thái Cơ sở Dữ liệu")
      .addFields(
        { name: "Threads", value: threadCount.toString(), inline: true },
        { name: "Tin nhắn", value: messageCount.toString(), inline: true },
        {
          name: "Dung lượng",
          value: `${dbSizeMB} MB / ${maxDBSizeMB} MB`,
          inline: true,
        },
        {
          name: "Mức sử dụng",
          value: `${progressBar} ${percentage.toFixed(2)}%`,
        }
      )
      .setTimestamp();

    if (percentage >= 80) {
      embed.addFields({
        name: "⚠️ Cảnh báo",
        value:
          "Dung lượng cơ sở dữ liệu sắp đầy. Bạn nên xem xét xóa dữ liệu cũ hoặc nâng cấp.",
      });
    } else if (percentage >= 60) {
      embed.addFields({
        name: "⚠️ Chú ý:",
        value: "Dung lượng cơ sở dữ liệu đang tăng. Hãy theo dõi.",
      });
    } else {
      embed.addFields({
        name: "✅ Tình trạng",
        value: "Cơ sở dữ liệu có vẻ ổn.",
      });
    }

    return { embeds: [embed], ephemeral: !isSlash };
  } catch (error) {
    console.error("Error in check command:", error);
    return { content: "Có lỗi khi kiểm tra database.", ephemeral: true };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("check")
    .setDescription("Kiểm tra trạng thái cơ sở dữ liệu (chỉ admin).")
    .setDMPermission(false),

  async execute(interaction) {
    if (interaction.user.id !== config.adminUserId) {
      return await interaction.followUp({
        content: "Bạn không có quyền sử dụng lệnh này.",
        ephemeral: true,
      });
    }
    const checkResult = await handleCheckCommand(interaction);
    await interaction.followUp(checkResult);
  },

  handleCheckCommand,
};
