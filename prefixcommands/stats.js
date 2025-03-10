// prefixcommands/stats.js
const { handleStatsCommand } = require("../commands/stats");
const config = require("../config");
const { ChannelType } = require("discord.js");

module.exports = {
  name: "stats",
  description: "Xem thống kê cá nhân (prefix).",
  async execute(message, args, client) {
    if (message.channel.type === ChannelType.DM) {
      return;
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
      client: message.client,
    };
    await handleStatsCommand(mockInteraction, false);
  },
};
