// prefixcommands/clear.js
const { handleClearCommand } = require("../commands/clear");
const config = require("../config");
const { ChannelType, PermissionsBitField } = require("discord.js");
const discordUtils = require("../utils/discord");

module.exports = {
  name: "clear",
  description: "Xóa lịch sử trò chuyện trong database (prefix).",
  async execute(message, args, client) {
    if (
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    ) {
      return;
    }

    if (message.channel.parentId !== config.allowedChannelId) {
      return;
    }
    try {
      const mockInteraction = {
        user: message.author,
        channel: message.channel,
        guild: message.guild,
        reply: async (options) => {
          return await message.channel.send(options);
        },
        followUp: async (options) => {
          return await message.channel.send(options);
        },
        client: message.client,
      };

      const result = await handleClearCommand(mockInteraction, false);
      if (result) {
        await message.channel.send(result);
      }
    } catch (error) {
      console.error("Lỗi trong lệnh clear tiền tố:", error);
      await discordUtils.sendErrorMessage(
        message,
        "Đã xảy ra lỗi khi xóa dữ liệu."
      );
    }
  },
};
