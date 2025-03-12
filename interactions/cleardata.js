const {
  SlashCommandBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  executeQuery,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  releaseConnection,
} = require("../utils/database");
const discordUtils = require("../utils/discord");
const config = require("../config");

async function handleClearDataCommand(message, target, type) {
  const isSlash = discordUtils.isSlashCommand(message);

  if (
    message.user?.id !== config.adminUserId &&
    message.author?.id !== config.adminUserId
  ) {
    return await discordUtils.sendErrorMessage(
      message,
      "⛔ Bạn không có quyền sử dụng lệnh này.",
      isSlash
    );
  }

  if (
    !discordUtils.hasBotPermissions(message.channel, [
      PermissionsBitField.Flags.ManageMessages,
    ])
  ) {
    return await discordUtils.sendErrorMessage(
      message,
      "❌ Bot không có đủ quyền để xóa dữ liệu!",
      isSlash
    );
  }

  let confirmMessage = "";
  let action = "";

  if (target === "all") {
    confirmMessage =
      type === "stats"
        ? "⚠️ Bạn có chắc chắn muốn XÓA TOÀN BỘ ĐIỂM của tất cả người dùng? Hành động này không thể hoàn tác!"
        : "⚠️ Bạn có chắc chắn muốn XÓA TOÀN BỘ DỮ LIỆU (threads và tin nhắn) của tất cả người dùng? Hành động này không thể hoàn tác!";
    action = type === "stats" ? "resetAllPoints" : "deleteAllData";
  } else {
    if (!/^\d+$/.test(target)) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ ID người dùng không hợp lệ.",
        isSlash
      );
    }
    confirmMessage =
      type === "stats"
        ? `⚠️ Bạn có chắc chắn muốn XÓA ĐIỂM của người dùng có ID \`${target}\`?`
        : `⚠️ Bạn có chắc chắn muốn XÓA DỮ LIỆU (threads và tin nhắn) của người dùng có ID \`${target}\`?`;
    action = type === "stats" ? "resetUserPoints" : "deleteUserData";
  }

  const confirm = new ButtonBuilder()
    .setCustomId("confirm")
    .setLabel("✅ Xác nhận")
    .setStyle(ButtonStyle.Danger);
  const cancel = new ButtonBuilder()
    .setCustomId("cancel")
    .setLabel("❌ Hủy")
    .setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder().addComponents(cancel, confirm);

  const response = isSlash
    ? await message.reply({
        content: confirmMessage,
        components: [row],
        ephemeral: true,
        fetchReply: true,
      })
    : await message.channel.send({
        content: confirmMessage,
        components: [row],
      });

  const collector = response.createMessageComponentCollector({
    filter: (i) =>
      i.user.id === (isSlash ? message.user.id : message.author.id),
    time: 60000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "confirm") {
      await i.deferUpdate();
      let trx;
      try {
        trx = await beginTransaction();

        if (action === "resetAllPoints") {
          await executeQuery(
            `UPDATE users SET total_points = 0, last_reset = ${
              config.databaseType === "mysql" ? "NOW()" : "datetime('now')"
            } `
          );
          await sendConfirmationMessage(
            message,
            "✅ Đã reset điểm của tất cả người dùng."
          );
        } else if (action === "deleteAllData") {
          await executeQuery("DELETE FROM messages");
          await executeQuery("DELETE FROM threads");
          await executeQuery("DELETE FROM users");
          await sendConfirmationMessage(
            message,
            "✅ Đã xóa toàn bộ dữ liệu người dùng."
          );
        } else if (action === "resetUserPoints") {
          const rows = await executeQuery(
            "SELECT username FROM users WHERE userId = ?",
            [target]
          );
          if (rows.length === 0) {
            return await i.followUp({
              content: `❌ Không tìm thấy người dùng có ID ${target}.`,
              ephemeral: true,
            });
          }
          await executeQuery(
            `UPDATE users SET total_points = 0, last_reset = ${
              config.databaseType === "mysql" ? "NOW()" : "datetime('now')"
            } WHERE userId = ?`,
            [target]
          );
          await sendConfirmationMessage(
            message,
            `✅ Đã reset điểm của người dùng **${rows[0].username}** (ID: ${target}).`
          );
        } else if (action === "deleteUserData") {
          await executeQuery("DELETE FROM messages WHERE userId = ?", [target]);
          await executeQuery("DELETE FROM threads WHERE userId = ?", [target]);
          await executeQuery("DELETE FROM users WHERE userId = ?", [target]);
          await sendConfirmationMessage(
            message,
            `✅ Đã xóa dữ liệu của người dùng có ID **${target}**.`
          );
        }

        await commitTransaction(trx);
      } catch (error) {
        if (trx) await rollbackTransaction(trx);
        console.error("❌ Lỗi khi xóa dữ liệu:", error);
        await sendConfirmationMessage(
          message,
          "❌ Có lỗi xảy ra khi xóa dữ liệu."
        );
      } finally {
        if (config.databaseType === "mysql" && trx) releaseConnection(trx);
      }
    } else {
      await i.update({ content: "❌ Đã hủy thao tác.", components: [] });
    }
  });

  collector.on("end", async () => {
    try {
      await response.edit({ components: [] });
    } catch (err) {
      console.error("❌ Lỗi khi xóa nút xác nhận:", err);
    }
  });
}

async function sendConfirmationMessage(message, content) {
  try {
    const adminUser = await message.client.users.fetch(config.adminUserId);
    await adminUser.send(content);
  } catch (error) {
    console.error("❌ Không thể gửi tin nhắn DM:", error);
    await message.channel.send(content);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cleardata")
    .setDescription("📂 Xóa dữ liệu người dùng (CHỈ ADMIN).")
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
            .setDescription("Loại dữ liệu muốn xóa")
            .setRequired(true)
            .addChoices(
              { name: "Điểm số", value: "stats" },
              { name: "Dữ liệu", value: "data" }
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
            .setDescription("Loại dữ liệu muốn xóa")
            .setRequired(true)
            .addChoices(
              { name: "Điểm số", value: "stats" },
              { name: "Dữ liệu", value: "data" }
            )
        )
    ),

  async execute(interaction) {
    if (interaction.user.id !== config.adminUserId) {
      return await interaction.reply({
        content: "⛔ Bạn không có quyền sử dụng lệnh này.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const type = interaction.options.getString("type");
    const targetUser =
      subcommand === "user" ? interaction.options.getUser("target") : "all";

    await handleClearDataCommand(interaction, targetUser?.id, type);
  },

  handleClearDataCommand,
};
