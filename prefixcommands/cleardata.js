// prefixcommands/cleardata.js
const { handleClearDataCommand } = require("../commands/cleardata");
const config = require("../config");
const { ChannelType } = require("discord.js");
const discordUtils = require("../utils/discord");

module.exports = {
  name: "cleardata",
  description: "Xóa dữ liệu (prefix, admin only).",
  async execute(message, args) {
    if (message.author.id !== config.adminUserId) {
      return;
    }
    if (message.channel.type === ChannelType.DM) {
      return;
    }

    const target = args[0];
    const type = args[1];

    if (!target || !type) {
      return await message.channel.send(
        "Sử dụng: `!cleardata <user_id | all> <stats | data>`"
      );
    }

    const mockInteraction = {
      user: message.author,
      guild: message.guild,
      reply: async (options) => {
        return await message.channel.send(options);
      },
      followUp: async (options) => {
        return await message.channel.send(options);
      },
      deferReply: async () => {
        return await message.channel.sendTyping();
      },
      client: message.client,
    };

    await handleClearDataCommand(mockInteraction, target, type);
  },
};
