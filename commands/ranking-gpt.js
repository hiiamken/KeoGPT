const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const { executeQuery } = require("../utils/database");

async function fetchRankingData() {
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
            console.warn("⚠️ [fetchRankingData] Không có dữ liệu xếp hạng.");
            return { noData: true, message: "⚠️ Không có dữ liệu xếp hạng tháng này." };
        }


        const embed = new EmbedBuilder()
            .setColor("#CF86CA")
            .setTitle(`🏆 BXH KeoGPT Tháng ${now.getMonth() + 1}/${now.getFullYear()}`)
            .setTimestamp()
            .setDescription("Bảng xếp hạng thành viên dựa trên tổng số điểm tích lũy trong tháng.");

        for (let i = 0; i < 3; i++) {
            if (result[i]) {
                const user = result[i];
                let medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
                embed.addFields({ name: `${medal} ${user.username}`, value: `**Điểm:** ${user.total_points}`, inline: false });
            }
        }

        return { embeds: [embed] };
    } catch (error) {
        console.error("❌ [fetchRankingData] Lỗi:", error);
        return { error: true, message: "❌ Có lỗi xảy ra khi lấy bảng xếp hạng." };
    }
}

async function handleRankingCommand(interaction) {

    const rankingData = await fetchRankingData();

    if (rankingData.error) {
        return { content: rankingData.message };
    }

    if (rankingData.noData) {
        return { content: rankingData.message };
    }

    return rankingData;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ranking-gpt")
        .setDescription("Xem bảng xếp hạng người dùng (theo tháng).")
        .setDMPermission(false),

    async execute(interaction) {

        await interaction.deferReply({ ephemeral: true });

        const rankingData = await handleRankingCommand(interaction);
        await interaction.followUp(rankingData);
    },

    handleRankingCommand, // ✅ Export để prefix command có thể sử dụng
};
