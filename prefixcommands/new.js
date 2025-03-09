// prefixcommands/new.js
const { handleNewCommand } = require("../commands/new");
const config = require("../config");
const { ChannelType, PermissionsBitField } = require("discord.js");
const discordUtils = require("../utils/discord");

module.exports = {
  name: "new",
  description: "Tạo thread mới (prefix).",
  async execute(message, args) {
    if (
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    ) {
      return;
    }
    if (message.channel.parentId !== config.allowedChannelId) {
      return;
    }

    const prompt = args.join(" ");
    if (!prompt) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bạn cần nhập câu hỏi!"
      );
    }

    if (
      !discordUtils.hasBotPermissions(message.channel, [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.CreatePublicThreads,
        PermissionsBitField.Flags.ManageThreads,
        PermissionsBitField.Flags.EmbedLinks,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.ReadMessageHistory,
      ])
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bot không có đủ quyền!"
      );
    }
    await message.channel.sendTyping();
    await handleNewCommand(
      message,
      prompt,
      config.defaultLanguage,
      message.client
    );
  },
};
