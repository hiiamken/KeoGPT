// commands/lang.js
const config = require("../config");
const { SlashCommandBuilder } = require("discord.js");
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

  if (Object.keys(supportedLanguages).includes(newLang)) {
    let threadId = null;

    if (
      message.channel.type === "GUILD_TEXT" ||
      message.channel.type === "PUBLIC_THREAD" ||
      message.channel.type === "PRIVATE_THREAD"
    ) {
      threadId = message.channel.isThread() ? message.channel.id : null;
    }

    try {
      if (threadId) {
        await db.updateThreadLanguage(threadId, newLang);
      }
      const successMessage = `Đã chuyển sang ngôn ngữ: ${newLang}.`;
      const replyOptions = {
        content: successMessage,
        ephemeral: isSlash,
        allowedMentions: { repliedUser: false },
      };
      isSlash
        ? await message.reply(replyOptions)
        : await message.reply(replyOptions);
    } catch (error) {
      console.error("Error updating language:", error);
      await discordUtils.sendErrorMessage(
        message,
        "Có lỗi xảy ra khi cập nhật ngôn ngữ.",
        isSlash
      );
    }
  } else {
    const supportedLanguagesString = Object.entries(supportedLanguages)
      .map(([code, name]) => `${name} (${code})`)
      .join(", ");
    await discordUtils.sendErrorMessage(
      message,
      `Ngôn ngữ '${newLang}' không được hỗ trợ. Các ngôn ngữ được hỗ trợ: ${supportedLanguagesString}`,
      isSlash
    );
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lang")
    .setDescription("Thay đổi ngôn ngữ của bot")
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
