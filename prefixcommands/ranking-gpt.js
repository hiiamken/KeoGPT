const { handleRankingCommand } = require("../commands/ranking-gpt");
const { ChannelType } = require("discord.js");

module.exports = {
    name: "ranking-gpt",
    description: "Xem bảng xếp hạng (prefix).",
    async execute(message) {
        if (message.channel.type === ChannelType.DM) {
            return;
        }

        try {
            await message.channel.sendTyping();

            const rankingData = await handleRankingCommand({
                user: message.author,
                guild: message.guild,
                channel: message.channel,
                reply: async (options) => await message.channel.send(options),
            });

            await message.channel.send(rankingData);
        } catch (error) {
            console.error("❌ [execute] Lỗi khi thực hiện prefix ranking-gpt:", error);
            await message.channel.send("❌ Đã xảy ra lỗi khi lấy bảng xếp hạng.");
        }
    },
};
