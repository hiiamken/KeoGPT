// prefixcommands/stats.js
const { handleStatsCommand } = require("../commands/stats");
const config = require("../config");
const { ChannelType } = require("discord.js");
const discordUtils = require("../utils/discord");

module.exports = {
    name: "stats", // Add the name property!
    description: "Xem thống kê cá nhân (prefix).",
    async execute(message, args, client) {
        if (message.channel.type === ChannelType.DM) {
            return; // Do nothing in DMs
        }

        // Create the mock interaction *after* the DM check
        const mockInteraction = {
            user: message.author,  // Correctly set user
            author: message.author, // Include the author property
            guild: message.guild,
            channel: message.channel,
            reply: async (options) => {
                return await message.channel.send(options);
            },
            followUp: async (options) => {
                return await message.channel.send(options);
            },
             client: message.client,
        };

        // Call handleStatsCommand and *await* the result
        const result = await handleStatsCommand(mockInteraction, false); // Pass false for isSlash
        // Now *send* the result
        await message.channel.send(result);
    },
};