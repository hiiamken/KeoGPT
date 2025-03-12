const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require("discord.js");
const config = require("../config");
const discordUtils = require("../utils/discord");

async function handleHelpCommand(message) {
    const helpEmbed = new EmbedBuilder()
        .setColor("#CF86CA")
        .setTitle("🤖 Hướng Dẫn Sử Dụng KeoGPT 🤖")
        .setDescription("KeoGPT là một chatbot thông minh, sẵn sàng trả lời các câu hỏi của bạn. Dưới đây là hướng dẫn chi tiết:")
        .addFields(
            { name: "❓ Đặt câu hỏi", value: "Sử dụng lệnh `/ask <câu hỏi>` để đặt câu hỏi cho bot. Bot sẽ tạo một thread riêng để trả lời." },
            { name: "🖼️ Gửi kèm ảnh", value: "Bạn có thể đính kèm ảnh vào câu hỏi bằng cách sử dụng option `image` của lệnh `/ask`." },
            { name: "🗣️ Tiếp tục trò chuyện", value: "Trong thread đã tạo, bạn có thể tiếp tục đặt câu hỏi bằng cách sử dụng lệnh `/reply <câu hỏi>`." },
            { name: "🆕 Chủ đề mới", value: "Dùng lệnh `/new <câu hỏi>` để bắt đầu chủ đề mới." },
            { name: "🧹 Xóa lịch sử", value: "Dùng `/clear` để xóa lịch sử trong thread (chỉ admin hoặc người tạo thread)." },
            { name: "🌐 Đổi ngôn ngữ", value: "Dùng `/lang <mã ngôn ngữ>` để đổi ngôn ngữ bot. Ví dụ: `/lang en`." },
            { name: "📊 Thống kê cá nhân", value: "Dùng `/stats` để xem điểm số và số thread đã tạo." },
            { name: "🏆 Bảng xếp hạng", value: "Dùng `/ranking-gpt` để xem bảng xếp hạng người dùng." },
            { name: "ℹ️ Trợ giúp", value: "Dùng `/gpthelp` để xem hướng dẫn này." },
        )
        .addFields({
            name: "⭐ Cách tính điểm",
            value: `*   **+2 điểm:**  Cho mỗi câu hỏi mới bằng lệnh \`/ask\`.
*   **+3 điểm:**  Cho mỗi câu hỏi được tạo bằng lệnh \`/new\`.
*   **+1 điểm:**  Cho mỗi câu trả lời trong thread bằng lệnh \`/reply\`.
*   Điểm số được reset vào đầu mỗi tháng.`,
        })
        .addFields({
            name: "📝 Lưu ý:",
            value: `• Bot chỉ hoạt động trong kênh <#${config.allowedChannelId}>.
• Dùng \`!ask\`, \`!reply\`, \`!new\` nếu không dùng được slash command.
• Các lệnh \`/cleardata\` chỉ dành cho admin.`,
        })
        .setTimestamp()
        .setFooter({ text: `KeoGPT - Được phát triển bởi TKen` });

    const isSlash = discordUtils.isSlashCommand(message);
    
    // Kiểm tra quyền bot
    if (!discordUtils.hasBotPermissions(message.channel, [PermissionsBitField.Flags.EmbedLinks])) {
        return await discordUtils.sendErrorMessage(message, "Bot cần quyền `Embed Links` để gửi hướng dẫn!", isSlash);
    }

    try {
        if (isSlash) {
            if (message.deferred || message.replied) {
                await message.followUp({ embeds: [helpEmbed], ephemeral: true });
            } else {
                await message.reply({ embeds: [helpEmbed], ephemeral: true });
            }
        } else {
            await message.channel.send({ embeds: [helpEmbed] });
        }
    } catch (error) {
        console.error("Lỗi khi gửi message:", error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("gpthelp")
        .setDescription("Hiển thị thông tin trợ giúp về bot."),
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true }); // Luôn defer để tránh lỗi timeout
            await handleHelpCommand(interaction);
        } catch (error) {
            console.error("Lỗi trong lệnh gạch chéo help:", error);
            await discordUtils.sendErrorMessage(interaction, "Đã có lỗi xảy ra khi thực hiện lệnh này!", true);
        }
    },
    handleHelpCommand,
};
