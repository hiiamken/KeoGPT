// prefixcommands/cleardata.js
const { handleClearDataCommand } = require("../commands/cleardata");
const config = require("../config");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const discordUtils = require("../utils/discord");

module.exports = {
  name: "cleardata",
  description: "Xóa toàn bộ dữ liệu (prefix, admin only).",
  async execute(message, args, client) {
    if (message.author.id !== config.adminUserId) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bạn không có quyền sử dụng lệnh này."
      );
    }

    const confirm = new ButtonBuilder()
      .setCustomId("confirm")
      .setLabel("Có")
      .setStyle(ButtonStyle.Danger);

    const cancel = new ButtonBuilder()
      .setCustomId("cancel")
      .setLabel("Không")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(cancel, confirm);

    const response = await message.reply({
      content:
        "Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu (threads và tin nhắn)? Hành động này không thể hoàn tác!",
      components: [row],
      allowedMentions: { repliedUser: false },
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "confirm") {
        await i.deferUpdate();
        let connection;
        try {
          connection = await db.pool.getConnection();
          await connection.beginTransaction();

          const [threadCountRows] = await connection.execute(
            "SELECT COUNT(*) as count FROM threads"
          );
          const threadCount = threadCountRows[0].count;

          const [messageCountRows] = await connection.execute(
            "SELECT COUNT(*) as count FROM messages"
          );
          const messageCount = messageCountRows[0].count;

          await connection.execute("DELETE FROM messages");
          await connection.execute("DELETE FROM threads");
          await connection.commit();

          await message.channel.send({
            content: `✅ Đã xóa thành công:\n- Threads: ${threadCount}\n- Messages: ${messageCount}`,
          });
        } catch (error) {
          if (connection) await connection.rollback();
          console.error("Error clearing data:", error);
          await i.followUp({
            content: "❌ Có lỗi xảy ra khi xóa dữ liệu.",
            ephemeral: true,
          });
        } finally {
          if (connection) connection.release();
        }
      } else if (i.customId === "cancel") {
        await i.update({
          content: "Đã hủy thao tác xóa dữ liệu.",
          components: [],
        });
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        response.edit({ components: [] }).catch(console.error);
      }
    });
  },
};
