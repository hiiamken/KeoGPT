const { handleReplyCommand } = require("../commands/reply");
const config = require("../config");
const { ChannelType, PermissionsBitField } = require("discord.js");
const discordUtils = require("../utils/discord");

module.exports = {
  name: "reply",
  description: "Trả lời trong thread hiện tại (prefix).",
  
  async execute(message, args) {
    if (message.channel.type === ChannelType.DM) {
      return; // Không hỗ trợ trong tin nhắn riêng
    }

    if (
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Lệnh này chỉ được dùng trong một thread!"
      );
    }

    if (message.channel.parentId !== config.allowedChannelId) {
      return await discordUtils.sendErrorMessage(
        message,
        `❌ Bạn chỉ có thể sử dụng lệnh này trong thread của kênh <#${config.allowedChannelId}>`
      );
    }

    if (!args.length) {
      return await discordUtils.sendErrorMessage(
        message,
        "❌ Vui lòng cung cấp nội dung trả lời. Ví dụ: `!reply <nội dung>`"
      );
    }

    // Kiểm tra quyền của bot
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
        "❌ Bot không có đủ quyền trong thread này!"
      );
    }

    const prompt = args.join(" ");
    await message.channel.sendTyping(); // Hiển thị bot đang phản hồi
    await handleReplyCommand(message, prompt, null);
  },
};
