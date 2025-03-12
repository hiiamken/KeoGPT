// prefixcommands/ask.js
const {
  handleAskCommand,
  processImageAttachment,
  sendMessageAndSave,
} = require("../commands/ask");
const config = require("../config");
const { ChannelType, PermissionsBitField } = require("discord.js");
const discordUtils = require("../utils/discord");

module.exports = {
  name: "ask",
  description: "Đặt câu hỏi (prefix).",
  async execute(message, args) {
    if (
      message.channel.type !== ChannelType.GuildText ||
      message.channelId !== config.allowedChannelId
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        `Xin lỗi, nhưng hình như bạn lạc đường rồi. Lệnh \`!ask\` này chỉ dùng ở kênh <#${config.allowedChannelId}> thôi nha! 😉`
      );
    }

    const prompt = args.join(" ");
    if (!prompt) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bạn cần nhập câu hỏi!"
      );
    }

    if (
      !discordUtils.hasBotPermissions(message.channel, [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.CreatePublicThreads,
        PermissionsBitField.Flags.EmbedLinks,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
      ])
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bot không có đủ quyền để thực hiện lệnh này (gửi tin nhắn, tạo thread, nhúng link, đọc lịch sử tin nhắn, đính kèm file)!"
      );
    }
    await message.channel.sendTyping();
    await handleAskCommand.call(
      { processImageAttachment, sendMessageAndSave },
      message,
      prompt,
      config.defaultLanguage
    );
  },
};
