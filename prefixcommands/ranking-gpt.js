// prefixcommands/ranking-gpt.js
const { handleRankingCommand } = require("../commands/ranking-gpt");
const { ChannelType } = require("discord.js");
const config = require("../config");
module.exports = {
  name: "ranking-gpt",
  description: "Xem bảng xếp hạng (prefix).",
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
      deferReply: async (option) => {
        return await message.channel.sendTyping();
      },
      client: message.client,
    };

    await handleRankingCommand(mockInteraction);
  },
};
