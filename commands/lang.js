const config = require("../config");
const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require("discord.js");
const db = require("../utils/database");
const discordUtils = require("../utils/discord");

const supportedLanguages = config.supportedLanguages;

async function handleLangCommand(message, newLang) {
    const isSlash = discordUtils.isSlashCommand(message);
    
    if (!newLang) {
        return await discordUtils.sendErrorMessage(
            message,
            "Vui lòng nhập mã ngôn ngữ. Ví dụ: `/lang en`",
            isSlash
        );
    }

    newLang = newLang.toLowerCase().trim(); // Chuẩn hóa mã ngôn ngữ

    if (!Object.keys(supportedLanguages).includes(newLang)) {
        const supportedLanguagesString = Object.entries(supportedLanguages)
            .map(([code, name]) => `${name} (${code})`)
            .join(", ");
        return await discordUtils.sendErrorMessage(
            message,
            `Ngôn ngữ '${newLang}' không được hỗ trợ. Các ngôn ngữ được hỗ trợ: ${supportedLanguagesString}`,
            isSlash
        );
    }

    if (!discordUtils.hasBotPermissions(message.channel, [PermissionsBitField.Flags.SendMessages])) {
        return await discordUtils.sendErrorMessage(message, "Bot không có quyền gửi tin nhắn!", isSlash);
    }

    let threadId = null;

    if (message.channel.type === ChannelType.GuildText || message.channel.isThread()) {
        threadId = message.channel.isThread() ? message.channel.id : null;
    }

    try {
        if (threadId) {
            await db.updateThreadLanguage(threadId, newLang);
        }
        const successMessage = `✅ Đã chuyển sang ngôn ngữ: **${supportedLanguages[newLang]}** (${newLang}).`;
        await message.reply({
            content: successMessage,
            ephemeral: isSlash,
            allowedMentions: { repliedUser: false },
        });
    } catch (error) {
        console.error("Error updating language:", error);
        await discordUtils.sendErrorMessage(
            message,
            "❌ Có lỗi xảy ra khi cập nhật ngôn ngữ.",
            isSlash
        );
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lang")
        .setDescription("Thay đổi ngôn ngữ của bot.")
        .addStringOption((option) =>
            option
                .setName("language")
                .setDescription("Mã ngôn ngữ (ví dụ: vi, en)")
                .setRequired(true)
                .addChoices(
                    ...Object.entries(config.supportedLanguages).map(([code, name]) => ({
                        name: `${name} (${code})`,
                        value: code,
                    }))
                )
        )
        .setDMPermission(false),

    async execute(interaction) {
        const newLang = interaction.options.getString("language");
        await handleLangCommand(interaction, newLang);
    },
    handleLangCommand,
};
