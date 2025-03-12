const { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const {
    executeQuery,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    releaseConnection,
} = require("../utils/database");
const discordUtils = require('../utils/discord');
const config = require("../config");

async function handleClearDataCommand(interaction, target, type) {
    if (interaction.user.id !== config.adminUserId) {
        return await discordUtils.sendErrorMessage(interaction, "Bạn không có quyền sử dụng lệnh này.", true);
    }

    if (!discordUtils.hasBotPermissions(interaction.channel, [PermissionsBitField.Flags.ManageMessages])) {
        return await discordUtils.sendErrorMessage(interaction, "Bot không có đủ quyền để xóa dữ liệu!", true);
    }

    let confirmMessage = "";
    let action = "";

    if (target === "all") {
        confirmMessage = type === "stats" ?
            "Bạn có chắc chắn muốn XÓA TOÀN BỘ ĐIỂM của tất cả người dùng? Hành động này không thể hoàn tác!" :
            "Bạn có chắc chắn muốn XÓA TOÀN BỘ DỮ LIỆU (threads và tin nhắn) của tất cả người dùng? Hành động này không thể hoàn tác!";
        action = type === "stats" ? "resetAllPoints" : "deleteAllData";
    } else {
        if (!/^\d+$/.test(target)) {
            return await discordUtils.sendErrorMessage(interaction, "ID người dùng không hợp lệ.", true);
        }
        confirmMessage = type === "stats" ?
            `Bạn có chắc chắn muốn XÓA ĐIỂM của người dùng có ID \`${target}\`?` :
            `Bạn có chắc chắn muốn XÓA DỮ LIỆU (threads và tin nhắn) của người dùng có ID \`${target}\`?`;
        action = type === "stats" ? "resetUserPoints" : "deleteUserData";
    }

    const confirm = new ButtonBuilder().setCustomId("confirm").setLabel("Có").setStyle(ButtonStyle.Danger);
    const cancel = new ButtonBuilder().setCustomId("cancel").setLabel("Không").setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(cancel, confirm);

    const response = await interaction.reply({ content: confirmMessage, components: [row], ephemeral: true, fetchReply: true });

    const collector = response.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000,
    });

    collector.on("collect", async (i) => {
        if (i.customId === "confirm") {
            await i.deferUpdate();
            let trx;
            try {
                trx = await beginTransaction();
                if (action === "resetAllPoints") {
                    await executeQuery(`UPDATE users SET total_points = 0, last_reset = ${config.databaseType === "mysql" ? "NOW()" : "datetime('now')"}`, [], trx);
                    await interaction.followUp({ content: "✅ Đã reset điểm của tất cả người dùng.", ephemeral: true });

                } else if (action === "deleteAllData") {
                    await executeQuery("DELETE FROM messages", [], trx);
                    await executeQuery("DELETE FROM threads", [], trx);
                    await executeQuery("DELETE FROM users", [], trx);
                    await interaction.followUp({ content: "✅ Đã xóa toàn bộ dữ liệu người dùng.", ephemeral: true });

                } else if (action === "resetUserPoints") {
                    const [rows] = await executeQuery("SELECT username FROM users WHERE userId = ?", [target], trx);
                    if (rows.length === 0) {
                        return await i.followUp({ content: `❌ Không tìm thấy người dùng có ID ${target}.`, ephemeral: true });
                    }
                    await executeQuery(`UPDATE users SET total_points = 0, last_reset = ${config.databaseType === "mysql" ? "NOW()" : "datetime('now')"} WHERE userId = ?`, [target], trx);
                    await interaction.followUp({ content: `✅ Đã reset điểm của người dùng ${rows[0].username} (ID: ${target}).`, ephemeral: true });

                } else if (action === "deleteUserData") {
                    await executeQuery("DELETE FROM messages WHERE userId = ?", [target], trx);
                    await executeQuery("DELETE FROM threads WHERE userId = ?", [target], trx);
                    await executeQuery("DELETE FROM users WHERE userId = ?", [target], trx);
                    await interaction.followUp({ content: `✅ Đã xóa dữ liệu của người dùng có ID ${target}.`, ephemeral: true });
                }

                await commitTransaction(trx);
            } catch (error) {
                if (trx) await rollbackTransaction(trx);
                console.error("Error clearing data:", error);
                await i.followUp({ content: "❌ Có lỗi xảy ra khi xóa dữ liệu.", ephemeral: true });
            } finally {
                if (config.databaseType === 'mysql' && trx) releaseConnection(trx);
            }
        } else {
            await i.update({ content: "Đã hủy thao tác.", components: [] });
        }
    });

    collector.on("end", async () => {
        try {
            await response.edit({ components: [] });
        } catch (err) {
            console.error("Error clearing buttons:", err);
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("cleardata")
        .setDescription("Xóa dữ liệu (CHỈ ADMIN).")
        .addSubcommand(subcommand =>
            subcommand.setName("user").setDescription("Xóa dữ liệu của một người dùng cụ thể.")
                .addUserOption(option => option.setName("target").setDescription("Người dùng cần xóa").setRequired(true))
                .addStringOption(option => option.setName('type').setDescription('Loại dữ liệu muốn xóa').setRequired(true)
                    .addChoices({ name: 'stats', value: 'stats' }, { name: 'data', value: 'data' })))
        .addSubcommand(subcommand =>
            subcommand.setName("all").setDescription("Xóa toàn bộ dữ liệu.")
                .addStringOption(option => option.setName('type').setDescription('Loại dữ liệu muốn xóa').setRequired(true)
                    .addChoices({ name: 'stats', value: 'stats' }, { name: 'data', value: 'data' }))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const type = interaction.options.getString('type');
        if (subcommand === 'user') {
            const targetUser = interaction.options.getUser('target');
            await handleClearDataCommand(interaction, targetUser.id, type);
        } else if (subcommand === 'all') {
            await handleClearDataCommand(interaction, 'all', type);
        }
    },
    handleClearDataCommand,
};
