// prefixcommands/check.js
const { handleCheckCommand } = require("../commands/check");
const config = require("../config");
const { ChannelType } = require("discord.js"); // Not strictly necessary here, but good for consistency
// const discordUtils = require('../utils/discord'); // No longer needed

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

      reply: async (options) => {
        return await message.channel.send(options);
      },
      followUp: async (options) => {
        return await message.channel.send(options);
      },
      client: message.client,
      author: message.author,
    };

    const checkResult = await handleCheckCommand(mockInteraction, false);
    await message.channel.send(checkResult);
  },
};
