const { handleStatsCommand } = require("../commands/stats");
const { ChannelType } = require("discord.js");

module.exports = {
    name: "stats",
    description: "📊 Xem thống kê cá nhân (prefix).",
    async execute(message) {
        if (message.channel.type === ChannelType.DM) {
            return; // Không thực hiện lệnh trong DM
        }

        const mockInteraction = {
            user: message.author, // Sử dụng `author` cho prefix commands
            guild: message.guild,
            reply: async (options) => await message.channel.send(options),
            followUp: async (options) => await message.channel.send(options),
            client: message.client,
        };

        try {
            const result = await handleStatsCommand(mockInteraction);
            if (result) await message.channel.send(result);
        } catch (error) {
            console.error("❌ Lỗi trong lệnh prefix stats:", error);
            await message.reply("❌ Đã xảy ra lỗi khi lấy thống kê của bạn.");
        }
    },
};
