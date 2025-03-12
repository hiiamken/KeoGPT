const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");
const config = require("../config");
const db = require("../utils/database");
const discordUtils = require("../utils/discord");

const supportedLanguages = config.supportedLanguages;

async function handleLangCommand(message, newLang) {
  const isSlash = discordUtils.isSlashCommand(message);

  if (!newLang) {
    return await discordUtils.sendErrorMessage(
      message,
      "❌ Vui lòng nhập mã ngôn ngữ. Ví dụ: `/lang en` hoặc `!lang en`.",
      isSlash
    );
  }

  newLang = newLang.toLowerCase().trim();

  if (!Object.keys(supportedLanguages).includes(newLang)) {
    const supportedLanguagesString = Object.entries(supportedLanguages)
      .map(([code, name]) => `${name} (${code})`)
      .join(", ");
    return await discordUtils.sendErrorMessage(
      message,
      `❌ Ngôn ngữ '${newLang}' không được hỗ trợ. Các ngôn ngữ được hỗ trợ: ${supportedLanguagesString}`,
      isSlash
    );
  }

  if (
    !discordUtils.hasBotPermissions(message.channel, [
      PermissionsBitField.Flags.SendMessages,
    ])
  ) {
    return await discordUtils.sendErrorMessage(
      message,
      "❌ Bot không có quyền gửi tin nhắn!",
      isSlash
    );
  }

  let threadId = null;

  if (
    message.channel.type === ChannelType.GuildText ||
    message.channel.isThread()
  ) {
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
    console.error("❌ Lỗi khi cập nhật ngôn ngữ:", error);
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
  name: "lang",
  description: "Thay đổi ngôn ngữ của bot (prefix).",
  async executePrefix(message, args) {
    const newLang = args[0];

    if (
      message.channelId !== config.allowedChannelId &&
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    ) {
      try {
        const channel = await message.client.channels.fetch(
          config.allowedChannelId
        );
        if (channel) {
          return await message.reply({
            content: `❌ Lệnh \`!lang\` chỉ có thể sử dụng trong kênh **#${channel.name}**! 😉`,
            allowedMentions: { repliedUser: false },
          });
        }
      } catch (err) {
        console.error("❌ Lỗi khi tìm nạp thông tin kênh:", err);
        return await message.reply({
          content: "❌ Đã xảy ra lỗi khi xác định kênh hợp lệ.",
          allowedMentions: { repliedUser: false },
        });
      }
    }

    await handleLangCommand(message, newLang);
  },

  handleLangCommand,
};
