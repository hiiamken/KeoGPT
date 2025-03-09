const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");
const db = require("../utils/database");
const config = require("../config");
const discordUtils = require("../utils/discord");

async function handleClearDataCommand(interaction, target, type) {
  if (interaction.user.id !== config.adminUserId) {
    return await discordUtils.sendErrorMessage(
      interaction,
      "Bạn không có quyền sử dụng lệnh này.",
      true
    );
  }

  let confirmMessage = "";
  let action = "";

  if (target === "all") {
    if (type === "stats") {
      confirmMessage =
        "Bạn có chắc chắn muốn XÓA TOÀN BỘ ĐIỂM của tất cả người dùng? Hành động này không thể hoàn tác!";
      action = "resetAllPoints";
    } else if (type === "data") {
      confirmMessage =
        "Bạn có chắc chắn muốn XÓA TOÀN BỘ DỮ LIỆU (threads và tin nhắn) của tất cả người dùng? Hành động này không thể hoàn tác!";
      action = "deleteAllData";
    } else {
      return await discordUtils.sendErrorMessage(
        interaction,
        "Lệnh không hợp lệ.  Ví dụ: `/cleardata all stats` hoặc `/cleardata <user_id> data`",
        true
      );
    }
  } else {
    if (!/^\d+$/.test(target)) {
      return await discordUtils.sendErrorMessage(
        interaction,
        "ID người dùng không hợp lệ.",
        true
      );
    }

    if (type === "stats") {
      confirmMessage = `Bạn có chắc chắn muốn XÓA ĐIỂM của người dùng có ID \`${target}\`? Hành động này không thể hoàn tác!`;
      action = "resetUserPoints";
    } else if (type === "data") {
      confirmMessage = `Bạn có chắc chắn muốn XÓA DỮ LIỆU (threads và tin nhắn) của người dùng có ID \`${target}\`? Hành động này không thể hoàn tác!`;
      action = "deleteUserData";
    } else {
      return await discordUtils.sendErrorMessage(
        interaction,
        "Lệnh không hợp lệ.  Ví dụ: `/cleardata all stats` hoặc `/cleardata <user_id> data`",
        true
      );
    }
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
  const response = await interaction.reply({
    content: confirmMessage,
    components: [row],
    ephemeral: true,
    fetchReply: true,
  });

  const collector = response.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "confirm") {
      await i.deferUpdate();
      let connection;
      try {
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        if (action === "resetAllPoints") {
          const [rows] = await connection.execute(
            "SELECT COUNT(*) as count FROM users"
          );
          let num = rows[0].count;
          await connection.execute(
            "UPDATE users SET total_points = 0, last_reset = NOW()"
          );
          await interaction.followUp({
            content: `✅ Đã reset điểm của ${num} người dùng.`,
            ephemeral: true,
          });
        } else if (action === "deleteAllData") {
          const [rows1] = await connection.execute(
            "SELECT COUNT(*) as count FROM threads"
          );
          const [rows2] = await connection.execute(
            "SELECT COUNT(*) as count FROM messages"
          );
          let thread = rows1[0].count;
          let message = rows2[0].count;
          await connection.execute("DELETE FROM messages");
          await connection.execute("DELETE FROM threads");
          await interaction.followUp({
            content: `✅ Đã xóa toàn bộ dữ liệu:\n- Threads: ${thread}\n- Messages: ${message}`,
            ephemeral: true,
          });
        } else if (action === "resetUserPoints") {
          const [rows] = await connection.execute(
            "SELECT username FROM users WHERE userId = ?",
            [target]
          );
          let name = rows[0].username;
          await connection.execute(
            "UPDATE users SET total_points = 0, last_reset = NOW() WHERE userId = ?",
            [target]
          );
          await interaction.followUp({
            content: `✅ Đã reset điểm của người dùng ${name} (ID: ${target}).`,
            ephemeral: true,
          });
        } else if (action === "deleteUserData") {
          const [rows] = await connection.execute(
            "SELECT username FROM users WHERE userId = ?",
            [target]
          );
          let name = rows[0].username;
          const [threadCountRows] = await connection.execute(
            "SELECT COUNT(*) AS count FROM threads WHERE userId = ?",
            [target]
          );
          const threadCount = threadCountRows[0].count;

          const [messageCountRows] = await connection.execute(
            "SELECT COUNT(*) AS count FROM messages WHERE userId = ?",
            [target]
          );
          const messageCount = messageCountRows[0].count;

          await connection.execute(
            "DELETE FROM messages WHERE threadId IN (SELECT threadId FROM threads WHERE userId = ?)",
            [target]
          );
          await connection.execute("DELETE FROM threads WHERE userId = ?", [
            target,
          ]);
          await connection.execute("DELETE FROM users WHERE userId = ?", [
            target,
          ]);
          await interaction.followUp({
            content: `✅ Đã xóa dữ liệu của người dùng ${name} (ID: ${target}):\n- Threads: ${threadCount}\n- Messages: ${messageCount}`,
            ephemeral: true,
          });
        }

        await connection.commit();
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
      await i.update({ content: "Đã hủy thao tác.", components: [] });
    }
  });
  collector.on("end", (collected) => {
    if (collected.size === 0) {
      response.edit({ components: [] }).catch(console.error);
    }
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cleardata")
    .setDescription("Xóa dữ liệu (CHỈ ADMIN).")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("user")
        .setDescription("Xóa dữ liệu của một người dùng cụ thể.")
        .addUserOption((option) =>
          option
            .setName("target")
            .setDescription("Người dùng cần xóa")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription(
              "Loại dữ liệu muốn xóa: stats (điểm) hoặc data (threads và tin nhắn)."
            )
            .setRequired(true)
            .addChoices(
              { name: "stats", value: "stats" },
              { name: "data", value: "data" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("all")
        .setDescription("Xóa toàn bộ dữ liệu.")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription(
              "Loại dữ liệu muốn xóa: stats (điểm) hoặc data (threads và tin nhắn)."
            )
            .setRequired(true)
            .addChoices(
              { name: "stats", value: "stats" },
              { name: "data", value: "data" }
            )
        )
    )

    .setDMPermission(false),

  async execute(interaction) {
    if (interaction.options.getSubcommand() === "user") {
      const targetUser = interaction.options.getUser("target");
      const type = interaction.options.getString("type");
      await handleClearDataCommand(interaction, targetUser.id, type);
    } else if (interaction.options.getSubcommand() === "all") {
      const type = interaction.options.getString("type");
      await handleClearDataCommand(interaction, "all", type);
    }
  },
  handleClearDataCommand,
};
