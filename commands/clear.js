// commands/clear.js
const db = require('../utils/database');
const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const config = require('../config');
const discordUtils = require('../utils/discord');

// Mảng các tin nhắn "đã dọn" vui nhộn
const clearMessages = [
    "✅ Xong! Coi như chưa có gì xảy ra nhé. 😉",
    "✅ Đã quét sạch mọi dấu vết! Bắt đầu lại thôi nào. 😎",
    "✅ Thread này đã được dọn dẹp sạch sẽ, tinh tươm! ✨",
    "✅ Rẹt rẹt! Lịch sử trò chuyện đã 'bay màu'. 💨",
    "✅ *phù phép* ✨ Biến mất! Giờ thì tha hồ mà hỏi lại nhé.",
    "✅ Thread đã được reset. Hãy coi như chúng ta chưa từng quen biết! 😉",
    "✅ Đã xóa sạch mọi bằng chứng... ý tôi là, tin nhắn cũ. 😅",
    "✅ Như một tờ giấy trắng, sẵn sàng cho những câu hỏi mới! 📝",
    "✅ Đã bấm nút F5 cho thread này! 🔄",
    "✅ Thread đã được 'tẩy trắng'. Sạch bong kin kít! 🧼",
    "✅ Xong! Mọi chuyện đã trở về con số 0. 🤸",
    "✅ 💥 BÙM! 💥 Thread đã nổ tung... và được dọn dẹp. 🧹",
];

function getRandomClearMessage() {
    return clearMessages[Math.floor(Math.random() * clearMessages.length)];
}

async function handleClearCommand(interaction, isSlash) { // Nhận isSlash làm tham số

    if (interaction.channel.type !== ChannelType.PublicThread && interaction.channel.type !== ChannelType.PrivateThread) {
        return await discordUtils.sendErrorMessage(interaction, 'Lệnh này chỉ có thể sử dụng trong thread!', isSlash);
    }

    let connection;
    try {
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        const [threadRows] = await connection.execute(
            'SELECT userId FROM threads WHERE threadId = ?',
            [interaction.channel.id]
        );

        if (threadRows.length === 0) {
          return await discordUtils.sendErrorMessage(
                interaction, // Thay message = interaction
                "Thread này đã bị xoá dữ liệu chủ đề trước, hãy sử dụng !new <câu hỏi> hoặc /new <câu hỏi> để bắt đầu 1 chủ đề mới",
                isSlash
            );
        }
        const userId = interaction.user?.id || interaction.author?.id; // ID người dùng nhất quán

        if (userId !== threadRows[0].userId && userId !== config.adminUserId) {
          return await discordUtils.sendErrorMessage(interaction, 'Bạn không có quyền xóa thread này.', false); // Không phải ephemeral
        }

        if (!discordUtils.hasBotPermissions(interaction.channel, [PermissionsBitField.Flags.ReadMessageHistory])) {
            return await discordUtils.sendErrorMessage(interaction, 'Bot thiếu quyền cần thiết (Đọc lịch sử tin nhắn).', isSlash);
        }

        // Xóa khỏi cơ sở dữ liệu. Quan trọng, chúng ta xóa từ CẢ HAI bảng.
        await connection.execute('DELETE FROM messages WHERE threadId = ?', [interaction.channel.id]);
        await connection.execute('DELETE FROM threads WHERE threadId = ?', [interaction.channel.id]); // Cũng xóa mục nhập thread
        await connection.commit();

        // Đổi tên thread (chúng ta giữ lại phần này, nó khá hay)
        await discordUtils.safeRenameThread(interaction.channel, "🚀 Sẵn sàng tiếp nhận câu hỏi!");

        const randomClearMessage = getRandomClearMessage();
        const clearMessageWithHelp = `${randomClearMessage} Sử dụng \`/new <câu hỏi>\` hoặc \`!new <câu hỏi>\` để bắt đầu một chủ đề mới.`;

        // Sử dụng followUp một cách nhất quán, cho cả thành công và lỗi
        return { content: clearMessageWithHelp, ephemeral: isSlash };


    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Lỗi khi xử lý lệnh clear:', error);
        return { content: 'Đã xảy ra lỗi khi xóa lịch sử thread.', ephemeral: true };

    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Xóa lịch sử thread (chỉ người tạo thread/admin).')
        .setDMPermission(false),  // Không thể sử dụng trong DM
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
      try{
        const result = await handleClearCommand(interaction, true); // Chuyển true cho isSlash
        await interaction.followUp(result); // Luôn sử dụng followUp sau deferReply
      }
      catch(error){
        console.error("Lỗi khi thực thi lệnh clear:", error)
        await interaction.followUp({ content: 'Có lỗi khi xoá', ephemeral: true})
      }

    },
    handleClearCommand // Xuất hàm xử lý
};