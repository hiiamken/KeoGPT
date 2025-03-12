const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");
const config = require("../config");
const discordUtils = require("../utils/discord");
const {
  executeQuery,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  releaseConnection,
} = require("../utils/database");

const clearMessages = [
  `${config.successEmoji} Tất cả đã được quét sạch! Bây giờ hãy thử hỏi lại điều gì đó mới nào. 😉`,
  `${config.successEmoji} Dữ liệu đã 'bay màu'! Giờ đây bạn có thể bắt đầu lại từ đầu. ✨`,
  `${config.successEmoji} Như một tờ giấy trắng! Hãy sử dụng \`/new <câu hỏi>\` để bắt đầu ngay.`,
  `${config.successEmoji} Đã xóa xong! Bạn có thể hỏi lại ngay bằng cách gõ \`!new <câu hỏi>\`. 🚀`,
  `${config.successEmoji} Lịch sử đã được dọn dẹp! Giờ thì cứ thoải mái đặt câu hỏi mới đi nào. 😎`,
  `${config.successEmoji} Quay ngược thời gian... Xong! Bây giờ bạn có thể hỏi lại. 🔄`,
  `${config.successEmoji} Xóa xong! Cần một câu hỏi mới? Hãy thử \`/new <câu hỏi>\`. 😉`,
  `${config.successEmoji} Đã dọn dẹp thread! Không ai biết chuyện gì đã xảy ra ở đây đâu... 🤫`,
  `${config.successEmoji} Thread đã sạch bong! Hãy thử bắt đầu một câu hỏi mới ngay bây giờ. 📝`,
  `${config.successEmoji} Reset hoàn tất! Giờ thì tiếp tục hành trình hỏi đáp của bạn thôi. 🚀`,
];

function getRandomClearMessage() {
  return clearMessages[Math.floor(Math.random() * clearMessages.length)];
}

async function handleClearCommand(message) {
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

  if (
    !discordUtils.hasBotPermissions(message.channel, [
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
    ])
  ) {
    return await discordUtils.sendErrorMessage(
      message,
      "Bot không có đủ quyền để thực hiện lệnh này.",
      isSlash
    );
  }

  let trx;
  try {
    trx = await beginTransaction();

    const threadRows = await executeQuery(
      "SELECT userId FROM threads WHERE threadId = ?",
      [message.channel.id]
    );

    if (!threadRows || threadRows.length === 0) {
      return await discordUtils.sendErrorMessage(
        message,
        "Thread này không còn dữ liệu trong hệ thống. Hãy sử dụng `/new` hoặc `!new` để bắt đầu chủ đề mới.",
        isSlash
      );
    }

    const threadOwnerId = threadRows[0].userId;

    if (!threadOwnerId) {
      return await discordUtils.sendErrorMessage(
        message,
        "Không thể xác định người tạo thread này. Có thể dữ liệu đã bị xóa.",
        isSlash
      );
    }

    const userRows = await executeQuery(
      "SELECT username FROM users WHERE userId = ?",
      [threadOwnerId]
    );

    const threadOwnerName =
      userRows.length > 0 ? userRows[0].username : "Không xác định";

    const userId = isSlash ? message.user.id : message.author.id;
    if (userId !== threadOwnerId && userId !== config.adminUserId) {
      return await discordUtils.sendErrorMessage(
        message,
        `Người tạo thread này là **${threadOwnerName}**. Chỉ họ hoặc admin mới có thể xóa thread này.`,
        isSlash
      );
    }

    await executeQuery(
      "DELETE FROM messages WHERE threadId = ?",
      [message.channel.id],
      trx
    );
    await executeQuery(
      "DELETE FROM threads WHERE threadId = ?",
      [message.channel.id],
      trx
    );
    await commitTransaction(trx);

    await discordUtils.safeRenameThread(
      message.channel,
      "🚀 Sẵn sàng tiếp nhận câu hỏi!"
    );

    const randomClearMessage = getRandomClearMessage();
    const clearMessageWithHelp = `${randomClearMessage} Sử dụng \`/new <câu hỏi>\` hoặc \`!new <câu hỏi>\` để bắt đầu một chủ đề mới.`;

    if (isSlash) {
      await message.followUp({
        content: clearMessageWithHelp,
        ephemeral: true,
      });
    } else {
      await message.channel.send(clearMessageWithHelp);
    }
  } catch (error) {
    if (trx) await rollbackTransaction(trx);
    console.error("❌ Lỗi trong `clear`:", error);
    await discordUtils.sendErrorMessage(
      message,
      "Có lỗi xảy ra khi xóa lịch sử.",
      isSlash
    );
  } finally {
    if (config.databaseType === "mysql" && trx) releaseConnection(trx);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Xóa lịch sử thread (chỉ người tạo thread hoặc admin).")
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      await handleClearCommand(interaction);
    } catch (error) {
      console.error("❌ Lỗi trong `clear` execute:", error);
      await discordUtils.sendErrorMessage(interaction, "Có lỗi khi xoá", true);
    }
  },

  name: "clear",
  description: "Xóa lịch sử thread trong database (prefix).",
  async executePrefix(message) {
    if (
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    ) {
      return;
    }

    if (message.channel.parentId !== config.allowedChannelId) {
      return;
    }

    try {
      await handleClearCommand(message);
    } catch (error) {
      console.error("❌ Lỗi trong `clear` tiền tố:", error);
      await discordUtils.sendErrorMessage(
        message,
        "Đã xảy ra lỗi khi xóa dữ liệu."
      );
    }
  },

  handleClearCommand,
};
