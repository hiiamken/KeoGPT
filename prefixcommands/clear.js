const { handleClearCommand } = require("../commands/clear");
const config = require("../config");
const { ChannelType } = require("discord.js");
const discordUtils = require("../utils/discord");

module.exports = {
  name: "clear",
  description: "Xóa lịch sử trò chuyện trong database (prefix).",
  async execute(message) {
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
      const result = await handleClearCommand(message);
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
