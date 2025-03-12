const { EmbedBuilder, SlashCommandBuilder, ChannelType } = require("discord.js");
const { executeQuery } = require("../utils/database");

/**
 * Lấy dữ liệu xếp hạng của người dùng theo tháng.
 * @param {Client} client - Đối tượng client của bot.
 * @returns {Object} - Dữ liệu xếp hạng hoặc thông báo lỗi.
 */
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
            console.warn("⚠️ [fetchRankingData] Không có dữ liệu xếp hạng.");
            return { noData: true, message: "⚠️ Không có dữ liệu xếp hạng tháng này." };
        }

        // Kiểm tra xem client.user có tồn tại không, nếu không thì dùng link ảnh mặc định
        const botAvatar = client?.user?.displayAvatarURL
            ? client.user.displayAvatarURL()
            : "https://cdn.discordapp.com/embed/avatars/0.png"; // Avatar mặc định

        const embed = new EmbedBuilder()
            .setColor("#CF86CA")
            .setTitle(`🏆 Bảng Xếp Hạng KeoGPT - Tháng ${now.getMonth() + 1}/${now.getFullYear()}`)
            .setThumbnail(botAvatar)
            .setTimestamp()
            .setDescription("Bảng xếp hạng thành viên dựa trên tổng số điểm tích lũy trong tháng.");

        for (let i = 0; i < 10; i++) {
            if (result[i]) {
                const user = result[i];
                embed.addFields({ 
                    name: `#${i + 1} ${user.username || "Không tên"}`, 
                    value: `**Điểm:** ${user.total_points || 0}`, 
                    inline: false 
                });
            } else {
                embed.addFields({ 
                    name: `#${i + 1} Trống`, 
                    value: `Chưa có người dùng`, 
                    inline: false 
                });
            }
        }

        // Tính thời gian còn lại đến khi reset
        const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const remainingTime = Math.floor((nextReset - now) / 1000);
        const days = Math.floor(remainingTime / (24 * 3600));
        const hours = Math.floor((remainingTime % (24 * 3600)) / 3600);
        const minutes = Math.floor((remainingTime % 3600) / 60);

        embed.setFooter({ text: `Bảng xếp hạng sẽ reset sau: ${days}d ${hours}h ${minutes}m` });

        return { embeds: [embed] };
    } catch (error) {
        console.error("❌ [fetchRankingData] Lỗi:", error);
        return { error: true, message: "❌ Có lỗi xảy ra khi lấy bảng xếp hạng." };
    }
}

/**
 * Xử lý lệnh xếp hạng.
 * @param {Object} messageOrInteraction - Đối tượng tin nhắn hoặc interaction.
 * @param {Client} client - Đối tượng client của bot.
 * @returns {Object} - Nội dung phản hồi.
 */
async function handleRankingCommand(messageOrInteraction, client) {
    const rankingData = await fetchRankingData(client);

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
        await interaction.deferReply({ ephemeral: false });

        const rankingData = await handleRankingCommand(interaction, interaction.client);
        await interaction.followUp(rankingData);
    },

    name: "ranking-gpt",
    description: "Xem bảng xếp hạng (prefix).",
    async executePrefix(message) {
        try {
            await message.channel.sendTyping();

            const rankingData = await handleRankingCommand(message, message.client);
            await message.channel.send(rankingData);
        } catch (error) {
            console.error("❌ [executePrefix] Lỗi khi thực hiện prefix ranking-gpt:", error);
            await message.channel.send("❌ Đã xảy ra lỗi khi lấy bảng xếp hạng.");
        }
    },

    handleRankingCommand,
};
