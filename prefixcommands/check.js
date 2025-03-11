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

    const mockInteraction = {
      user: message.author,
      guild: message.guild,
      channel: message.channel,

      client: message.client,
      author: message.author,
    };

    const result = await handleCheckCommand(mockInteraction, false);

    try {
      await message.channel.send(result);
    } catch (error) {
      console.error("Error sending check result:", error);

      await message.reply({
        content:
          "Không thể gửi tin nhắn riêng cho bạn. Hãy đảm bảo bạn đã cho phép bot gửi DM và không chặn bot.",
        allowedMentions: { repliedUser: false },
      });
    }
  },
};
