const { handleCheckCommand } = require("../commands/check");
const config = require("../config");

module.exports = {
    name: "check",
    description: "Kiểm tra trạng thái database (prefix, admin only).",
    async execute(message) {
        if (message.author.id !== config.adminUserId) {
            return; 
        }

        const mockInteraction = {
            user: message.author,
            guild: message.guild,
            channel: message.channel,
            reply: async (options) => await message.channel.send(options),
            followUp: async (options) => await message.channel.send(options),
        };

        const checkResult = await handleCheckCommand(mockInteraction);
        await message.channel.send(checkResult);
    },
};
