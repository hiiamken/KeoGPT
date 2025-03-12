const { handleNewCommand } = require("../commands/new");
const config = require("../config");
const { ChannelType, PermissionsBitField } = require("discord.js");
const discordUtils = require("../utils/discord");

module.exports = {
  name: "new",
  description: "Tạo thread mới (prefix).",
  async execute(message, args) {
    // Kiểm tra xem có đang ở trong một thread không
    if (
      message.channel.type !== ChannelType.PublicThread &&
      message.channel.type !== ChannelType.PrivateThread
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bạn chỉ có thể sử dụng lệnh này trong một thread."
      );
    }

    // Kiểm tra thread có thuộc kênh được chỉ định không
    if (message.channel.parentId !== config.allowedChannelId) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bạn chỉ có thể sử dụng lệnh này trong thread của kênh đã được chỉ định."
      );
    }

    const prompt = args.join(" ");
    if (!prompt) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bạn cần nhập câu hỏi!"
      );
    }

    // Kiểm tra quyền bot
    if (
      !discordUtils.hasBotPermissions(message.channel, [
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.CreatePublicThreads,
        PermissionsBitField.Flags.ManageThreads,
        PermissionsBitField.Flags.EmbedLinks, // Để bot gửi embed
        PermissionsBitField.Flags.AttachFiles, // Để bot gửi ảnh
        PermissionsBitField.Flags.ReadMessageHistory,
      ])
    ) {
      return await discordUtils.sendErrorMessage(
        message,
        "Bot không có đủ quyền để thực hiện lệnh này!"
      );
    }

    // Gửi typing indicator
    await message.channel.sendTyping();

    // Gọi hàm xử lý lệnh "new"
    await handleNewCommand(
      message,
      prompt,
      config.defaultLanguage,
      message.client
    );
  },
};
