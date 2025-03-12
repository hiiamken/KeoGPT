const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { executeQuery } = require("../utils/database");
const config = require("../config");
const discordUtils = require("../utils/discord");

function getBotUptime() {
  const totalSeconds = Math.floor(process.uptime());
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);

  return `${days}d ${hours}h ${minutes}m`;
}

async function handleCheckCommand(user, client) {
  try {
    const startTime = Date.now();

    const [threadCountRow, messageCountRow] = await Promise.all([
      executeQuery("SELECT COUNT(*) as count FROM threads"),
      executeQuery("SELECT COUNT(*) as count FROM messages"),
    ]);

    const threadCount = threadCountRow[0].count;
    const messageCount = messageCountRow[0].count;

    let dbSizeMB = 0;
    if (config.databaseType === "mysql") {
      const sizeRows = await executeQuery(
        `SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
                 FROM information_schema.TABLES
                 WHERE table_schema = ?`,
        [config.mysqlConfig.database]
      );
      dbSizeMB = sizeRows.length > 0 ? sizeRows[0].size_mb : 0;
    } else if (config.databaseType === "sqlite") {
      const [pageCountRow, pageSizeRow] = await Promise.all([
        executeQuery("PRAGMA page_count;"),
        executeQuery("PRAGMA page_size;"),
      ]);
      dbSizeMB =
        (pageCountRow[0]["page_count"] * pageSizeRow[0]["page_size"]) /
        (1024 * 1024);
    }

    const maxDBSizeMB = config.dbSizeThreshold || 1024;
    const percentage = Math.min((dbSizeMB / maxDBSizeMB) * 100, 100);
    const progressBar =
      "█".repeat(Math.round(percentage / 5)) +
      "░".repeat(20 - Math.round(percentage / 5));

    const ping = Date.now() - startTime;

    const uptime = getBotUptime();

    let embedColor = "#57F287";
    let statusMessage = "✅ Cơ sở dữ liệu hoạt động ổn định.";

    if (percentage >= 80) {
      embedColor = "#ED4245";
      statusMessage =
        "⚠️ Dung lượng database sắp đầy! Hãy xóa dữ liệu cũ hoặc nâng cấp.";
    } else if (percentage >= 60) {
      embedColor = "#FAA61A";
      statusMessage = "⚠️ Dung lượng database đang tăng, hãy theo dõi.";
    }

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle("📊 Trạng thái Hệ thống")
      .setDescription(
        "Thông tin về cơ sở dữ liệu, độ trễ và thời gian hoạt động của bot."
      )
      .addFields(
        {
          name: "📂 Threads",
          value: `\`${threadCount.toLocaleString()}\``,
          inline: true,
        },
        {
          name: "💬 Tin nhắn",
          value: `\`${messageCount.toLocaleString()}\``,
          inline: true,
        },
        {
          name: "💾 Dung lượng",
          value: `\`${dbSizeMB.toFixed(2)} MB / ${maxDBSizeMB} MB\``,
          inline: true,
        },
        {
          name: "📊 Mức sử dụng",
          value: `${progressBar} \`${percentage.toFixed(2)}%\``,
        },
        { name: "📡 Ping", value: `\`${ping}ms\``, inline: true },
        { name: "⏳ Uptime", value: `\`${uptime}\``, inline: true },
        { name: "ℹ️ Tình trạng", value: statusMessage }
      )
      .setTimestamp();

    try {
      await user.send({ embeds: [embed] });
      return {
        content: "✅ Đã gửi báo cáo hệ thống vào tin nhắn riêng của bạn!",
        ephemeral: true,
      };
    } catch (error) {
      console.error("❌ Không thể gửi DM cho Admin:", error);
      return {
        content: "⚠️ Không thể gửi DM cho bạn. Hãy mở DM để nhận thông báo!",
        ephemeral: true,
      };
    }
  } catch (error) {
    console.error("❌ [handleCheckCommand] Lỗi:", error);
    return { content: "❌ Có lỗi khi kiểm tra hệ thống.", ephemeral: true };
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("check")
    .setDescription("📊 Kiểm tra trạng thái hệ thống (chỉ admin).")
    .setDMPermission(false),

  async execute(interaction) {
    if (interaction.user.id !== config.adminUserId) {
      return await interaction.reply({
        content: "⛔ Bạn không có quyền sử dụng lệnh này.",
        ephemeral: true,
      });
    }
    await interaction.deferReply({ ephemeral: true });

    const checkResult = await handleCheckCommand(
      interaction.user,
      interaction.client
    );
    await interaction.followUp(checkResult);
  },

  name: "check",
  description: "📊 Kiểm tra trạng thái hệ thống (prefix, admin only).",
  async executePrefix(message) {
    if (message.author.id !== config.adminUserId) {
      return;
    }

    const checkResult = await handleCheckCommand(
      message.author,
      message.client
    );
    await message.reply(checkResult);
  },

  handleCheckCommand,
};
