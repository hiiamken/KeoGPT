const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { executeQuery } = require("../utils/database"); 
const config = require("../config");
const discordUtils = require("../utils/discord");

async function handleCheckCommand(interaction) {
    const isSlash = discordUtils.isSlashCommand(interaction);
    try {
        const threadCountRows = await executeQuery("SELECT COUNT(*) as count FROM threads");
        const threadCount = threadCountRows[0].count;

        const messageCountRows = await executeQuery("SELECT COUNT(*) as count FROM messages");
        const messageCount = messageCountRows[0].count;

        let dbSizeMB = 0;
        if (config.databaseType === 'mysql') {
            const sizeRows = await executeQuery(
                `SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
                 FROM information_schema.TABLES
                 WHERE table_schema = ?`,
                [config.mysqlDatabase]
            );
            dbSizeMB = sizeRows.length > 0 ? sizeRows[0].size_mb : 0;
        } else if (config.databaseType === 'sqlite') {
            const pageCountRows = await executeQuery("PRAGMA page_count;");
            const pageSizeRows = await executeQuery("PRAGMA page_size;");
            dbSizeMB = (pageCountRows[0]["page_count"] * pageSizeRows[0]["page_size"]) / (1024 * 1024);
        }

        const maxDBSizeMB = config.dbSizeThreshold || 1024;
        const percentage = Math.min((dbSizeMB / maxDBSizeMB) * 100, 100);
        const progressBar = "█".repeat(Math.round(percentage / 5)) + "░".repeat(20 - Math.round(percentage / 5));

        const embed = new EmbedBuilder()
            .setColor("#CF86CA")
            .setTitle("📊 Trạng thái Cơ sở Dữ liệu")
            .addFields(
                { name: "Threads", value: threadCount.toString(), inline: true },
                { name: "Tin nhắn", value: messageCount.toString(), inline: true },
                { name: "Dung lượng", value: `${dbSizeMB.toFixed(2)} MB / ${maxDBSizeMB} MB`, inline: true },
                { name: "Mức sử dụng", value: `${progressBar} ${percentage.toFixed(2)}%` }
            )
            .setTimestamp();

        if (percentage >= 80) {
            embed.addFields({ name: "⚠️ Cảnh báo", value: "Dung lượng database sắp đầy! Hãy xóa dữ liệu cũ hoặc nâng cấp." });
        } else if (percentage >= 60) {
            embed.addFields({ name: "⚠️ Chú ý", value: "Dung lượng database đang tăng, hãy theo dõi." });
        } else {
            embed.addFields({ name: "✅ Tình trạng", value: "Cơ sở dữ liệu ổn định." });
        }

        return { embeds: [embed], ephemeral: isSlash };
    } catch (error) {
        console.error("Error in check command:", error);
        return { content: "❌ Có lỗi khi kiểm tra database.", ephemeral: true };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("check")
        .setDescription("Kiểm tra trạng thái cơ sở dữ liệu (chỉ admin).")
        .setDMPermission(false),

    async execute(interaction) {
        if (interaction.user.id !== config.adminUserId) {
            return await interaction.reply({ content: "Bạn không có quyền sử dụng lệnh này.", ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });

        const checkResult = await handleCheckCommand(interaction);
        await interaction.followUp(checkResult);
    },

    handleCheckCommand,
};
