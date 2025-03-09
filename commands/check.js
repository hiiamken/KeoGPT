// commands/check.js
const { SlashCommandBuilder } = require("discord.js");
const db = require("../utils/database");
const config = require("../config");
const discordUtils = require("../utils/discord");

async function handleCheckCommand(message) {
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
            SELECT table_schema "database",
                   ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS "size_mb"
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

    let replyContent = `**Trạng thái Cơ sở Dữ liệu:**\n\n`;
    replyContent += `*   **Số threads:** ${threadCount}\n`;
    replyContent += `*   **Số tin nhắn:** ${messageCount}\n`;
    replyContent += `*   **Dung lượng:** ${dbSizeMB} MB / ${maxDBSizeMB} MB\n`;
    replyContent += `*   **Mức sử dụng:** \`${progressBar}\` ${percentage.toFixed(
      2
    )}%\n\n`;

    if (percentage >= 80) {
      replyContent +=
        "**⚠️ Cảnh báo:** Dung lượng cơ sở dữ liệu sắp đầy. Bạn nên xem xét xóa dữ liệu cũ hoặc nâng cấp.\n";
    } else if (percentage >= 60) {
      replyContent +=
        "**⚠️ Chú ý:** Dung lượng cơ sở dữ liệu đang tăng. Hãy theo dõi.\n";
    } else {
      replyContent += "**Tình trạng:** Cơ sở dữ liệu có vẻ ổn.\n";
    }
    return replyContent;
  } catch (error) {
    console.error("Error in check command:", error);
    return "Có lỗi khi kiểm tra database.";
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("check")
    .setDescription("Kiểm tra trạng thái cơ sở dữ liệu (chỉ admin).")
    .setDMPermission(false),

  async execute(interaction) {
    if (interaction.user.id !== config.adminUserId) {
      return await discordUtils.sendErrorMessage(
        interaction,
        "Bạn không có quyền sử dụng lệnh này.",
        true
      );
    }
    await interaction.deferReply({ ephemeral: true });
    const checkResult = await handleCheckCommand(interaction);
    await interaction.editReply({ content: checkResult, ephemeral: true });
  },

  handleCheckCommand,
};
