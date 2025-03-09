// prefixcommands/reply.js
const { handleReplyCommand } = require("../commands/reply");
const config = require("../config");
const { ChannelType, PermissionsBitField } = require("discord.js");
const discordUtils = require("../utils/discord");

module.exports = {
  name: "reply",
  description: "Trả lời trong thread hiện tại (prefix command)",
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
        "Bạn cần nhập nội dung trả lời!"
      );
    }
    if (
      !discordUtils.hasBotPermissions(message.channel, [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.EmbedLinks,
        PermissionsBitField.Flags.AttachFiles,
      ])
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bot không có đủ quyền (gửi tin nhắn, đọc lịch sử, nhúng link)."
      );
    }
    await message.channel.sendTyping();
    await handleReplyCommand(message, prompt, config.defaultLanguage);
  },
};
