// prefixcommands/cleardata.js
const { handleClearDataCommand } = require("../commands/cleardata");
const config = require("../config");
const discordUtils = require("../utils/discord");
module.exports = {
  name: "cleardata",
  description: "Xóa dữ liệu (prefix, admin only).",
  async execute(message, args) {
    if (message.author.id !== config.adminUserId) {
        return await discordUtils.sendErrorMessage(message, 'Bạn không có quyền', false)
    }

    const mockInteraction = {
        user: message.author,
        channel: message.channel,
        guild: message.guild,
        reply: async (options) => {
          return await message.channel.send(options);
        },
        followUp: async (options) => {
          return await message.channel.send(options);
        },
        options: {
            getSubcommand: () => {
                if (args[0] === 'user') return 'user';
                if (args[0] === 'all') return 'all';
                return null;
            },
            getUser: (name) => {
                if (name === 'target') {
                  if(!args[1]) return null;
                    const userId = args[1].replace(/[<@!>]/g, ''); // Remove <@!> or <@>
                   return {id: userId}
                }
                return null;
            },
             getString: (name) => {
              if(name === 'type') return args[2] || args[1]; // args[2] for "all", args[1] for user
              return null;
            }
        }

    };


    if (mockInteraction.options.getSubcommand() === 'user') {
        const targetUser = mockInteraction.options.getUser('target');
        const type = mockInteraction.options.getString('type');

        if(!targetUser) return await discordUtils.sendErrorMessage(mockInteraction, 'Vui lòng tag người dùng', false);
        if(!type) return await discordUtils.sendErrorMessage(mockInteraction, 'Vui lòng chọn loại dữ liệu cần xoá: `stats` hoặc `data`', false)
        if(type !== 'stats' && type !== 'data') return await discordUtils.sendErrorMessage(mockInteraction, 'Loại dữ liệu không hợp lệ', false);

        await handleClearDataCommand(mockInteraction, targetUser.id, type);

    } else if (mockInteraction.options.getSubcommand() === 'all') {
        const type = mockInteraction.options.getString('type');
         if(!type) return await discordUtils.sendErrorMessage(mockInteraction, 'Vui lòng chọn loại dữ liệu cần xoá: `stats` hoặc `data`', false)
        if(type !== 'stats' && type !== 'data') return await discordUtils.sendErrorMessage(mockInteraction, 'Loại dữ liệu không hợp lệ', false);
        await handleClearDataCommand(mockInteraction, 'all', type);
    }
    else{
        return await discordUtils.sendErrorMessage(mockInteraction, 'Lệnh không hợp lệ', false);
    }
  },
};