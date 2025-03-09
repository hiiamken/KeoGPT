// prefixcommands/lang.js
const { handleLangCommand } = require("../commands/lang");
const config = require("../config");
const { ChannelType } = require("discord.js");
const discordUtils = require("../utils/discord");

module.exports = {
  name: "lang",
  description: "Thay đổi ngôn ngữ (prefix).",
  async execute(message, args) {
    const newLang = args[0];
    if (
      message.channelId !== config.allowedChannelId &&
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    ) {
      message.client.channels
        .fetch(config.allowedChannelId)
        .then((channel) => {
          if (channel) {
            message.reply({
              content: `Xin lỗi, nhưng hình như bạn lạc đường rồi. Lệnh \`!lang\` này chỉ dùng ở kênh **#${channel.name}** thôi nha! 😉`,
              allowedMentions: { repliedUser: false },
            });
          } else {
            message.reply({
              content: "Không tìm thấy kênh được chỉ định.",
              allowedMentions: { repliedUser: false },
            });
          }
        })
        .catch((err) => {
          console.error("Lỗi khi tìm nạp thông tin kênh:", err);
          message.reply({
            content: "Đã xảy ra lỗi khi xác định kênh hợp lệ.",
            allowedMentions: { repliedUser: false },
          });
        });
      return;
    }
    await handleLangCommand(message, newLang);
  },
};
