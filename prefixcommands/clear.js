// prefixcommands/clear.js
const { handleClearCommand } = require('../commands/clear');
const config = require('../config');
const { ChannelType, PermissionsBitField } = require('discord.js');
const discordUtils = require('../utils/discord');


module.exports = {
    name: 'clear', // Thêm name
    description: 'Xóa lịch sử trò chuyện trong database (prefix).', // Mô tả chi tiết hơn
    async execute(message, args, client) { // Thêm tham số client, mặc dù không sử dụng

        if (message.channel.type !== ChannelType.PublicThread && message.channel.type !== ChannelType.PrivateThread) {
          return; // Im lặng
        }
      // Kiểm tra xem người dùng có phải là admin hoặc người tạo thread không
        if(message.channel.parentId !== config.allowedChannelId){
          return;
        }
         try {
            const mockInteraction = {
                user: message.author, // Sử dụng message.author cho lệnh tiền tố
                channel: message.channel, // Sử dụng message.channel
                guild: message.guild,   // Sử dụng message.guild
                reply: async (options) => {  // reply/followUp nhất quán
                    return await message.channel.send(options);
                },
                followUp: async (options) => {
                    return await message.channel.send(options);
                },
                client: message.client
            };

            const result = await handleClearCommand(mockInteraction, false); // Chuyển false cho isSlash
             if (result) { // Kiểm tra kết quả trước khi trả lời
                await message.channel.send(result); // Sử dụng channel.send, không phải reply
            }

        } catch (error) {
            console.error("Lỗi trong lệnh clear tiền tố:", error);
            await discordUtils.sendErrorMessage(message, "Đã xảy ra lỗi khi xóa dữ liệu.");
        }
    },
};