// commands/clear.js
const db = require("../utils/database");
const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");
const config = require("../config");
const discordUtils = require("../utils/discord");

const clearMessages = [
  `${config.successEmoji} Xong! Coi như chưa có gì xảy ra nhé. 😉`,
  `${config.successEmoji} Đã quét sạch mọi dấu vết! Bắt đầu lại thôi nào. 😎`,
  `${config.successEmoji} Thread này đã được dọn dẹp sạch sẽ, tinh tươm! ✨`,
  `${config.successEmoji} Rẹt rẹt! Lịch sử trò chuyện đã 'bay màu'. 💨`,
  `${config.successEmoji} *phù phép* ✨ Biến mất! Giờ thì tha hồ mà hỏi lại nhé.`,
  `${config.successEmoji} Thread đã được reset. Hãy coi như chúng ta chưa từng quen biết! 😉`,
  `${config.successEmoji} Đã xóa sạch mọi bằng chứng... ý tôi là, tin nhắn cũ. 😅`,
  `${config.successEmoji} Như một tờ giấy trắng, sẵn sàng cho những câu hỏi mới! 📝`,
  `${config.successEmoji} Đã bấm nút F5 cho thread này! 🔄`,
  `${config.successEmoji} Thread đã được 'tẩy trắng'. Sạch bong kin kít! 🧼`,
  `${config.successEmoji} Xong! Mọi chuyện đã trở về con số 0. 🤸`,
  `${config.successEmoji} 💥 BÙM! 💥 Thread đã nổ tung... và được dọn dẹp. 🧹`,
];

function getRandomClearMessage() {
  return clearMessages[Math.floor(Math.random() * clearMessages.length)];
}

async function handleClearCommand(message, client) {
  const isSlash = discordUtils.isSlashCommand(message);
  if (
    message.channel.type !== ChannelType.PublicThread &&
    message.channel.type !== ChannelType.PrivateThread
  ) {
    return await discordUtils.sendErrorMessage(
      message,
      "Lệnh này chỉ có thể sử dụng trong thread!",
      isSlash
    );
  }

  let connection;
  try {
    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    const [threadRows] = await connection.execute(
      "SELECT userId FROM threads WHERE threadId = ?",
      [message.channel.id]
    );

    if (threadRows.length === 0) {
      return await discordUtils.sendErrorMessage(
        message,
        "Thread này đã bị xoá dữ liệu chủ đề trước, hãy sử dụng !new <câu hỏi> hoặc /new <câu hỏi> để bắt đầu 1 chủ đề mới",
        isSlash
      );
    }

    const userId = isSlash ? message.user.id : message.author.id;
    if (userId !== threadRows[0].userId && userId !== config.adminUserId) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bạn không có quyền.",
        false
      );
    }

    if (
      !discordUtils.hasBotPermissions(message.channel, [
        PermissionsBitField.Flags.ManageMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
      ])
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bot không có đủ quyền",
        isSlash
      );
    }

    await connection.execute("DELETE FROM messages WHERE threadId = ?", [
      message.channel.id,
    ]);
    await connection.execute("DELETE FROM threads WHERE threadId = ?", [
      message.channel.id,
    ]);

    await connection.commit();
    await discordUtils.safeRenameThread(
      message.channel,
      "🚀 Sẵn sàng tiếp nhận câu hỏi!"
    );

    const randomClearMessage = getRandomClearMessage();
    const clearMessageWithHelp = `${randomClearMessage} Sử dụng \`/new <câu hỏi>\` hoặc \`!new <câu hỏi>\` để bắt đầu một chủ đề mới.`;
    const reply = { content: clearMessageWithHelp, ephemeral: isSlash };
    isSlash ? await message.followUp(reply) : await message.channel.send(reply);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error handling clear command:", error);
    await discordUtils.sendErrorMessage(
      message,
      "Có lỗi xảy ra khi xóa lịch sử",
      isSlash
    );
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Xóa lịch sử (người tạo thread/admin).")
    .setDMPermission(false),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      await handleClearCommand(interaction, interaction.client);
    } catch (error) {
      console.error("Error in clear command execute:", error);
      await discordUtils.sendErrorMessage(interaction, "Có lỗi khi xoá", true);
    }
  },
  handleClearCommand,
};
