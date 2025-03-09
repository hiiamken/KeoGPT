// prefixcommands/check.js
const { handleCheckCommand } = require("../commands/check");
const config = require("../config");
const { ChannelType } = require("discord.js");

module.exports = {
  name: "check",
  description: "Kiểm tra trạng thái database (prefix, admin only).",
  async execute(message, args, client) {
    if (message.author.id !== config.adminUserId) {
      return;
    }
    if (
      message.channelId !== config.allowedChannelId &&
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    ) {
      return;
    }

    const checkResult = await handleCheckCommand(message);

    try {
      await message.author.send(checkResult);
    } catch (error) {
      console.error("Error sending DM:", error);

      await message.reply({
        content:
          "Không thể gửi tin nhắn riêng cho bạn. Hãy đảm bảo bạn đã cho phép bot gửi DM và không chặn bot.",
        allowedMentions: { repliedUser: false },
      }); // Send to channel.
    }
  },
};
