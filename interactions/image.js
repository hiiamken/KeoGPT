const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const { generateImage: generateImageGemini, editImage: editImageGemini, imageUrlToBase64 } = require("../utils/gemini");
const discordUtils = require("../utils/discord");
const config = require("../config");

async function handleEditImage(interaction) {
  await interaction.deferReply();

  const prompt = interaction.options.getString("prompt");
  const imageAttachments = interaction.options.getAttachment("image");
  const otherImages = interaction.options.getAttachment("images");

  if (!imageAttachments && !otherImages) {
    return await interaction.followUp("Bạn cần đính kèm ít nhất một ảnh để chỉnh sửa.");
  }

  try {
    const imageParts = [];
    const originalImages = [];

    if (imageAttachments) {
      if (!imageAttachments.contentType.startsWith("image/")) {
        return await interaction.followUp("Tệp tải lên không phải là ảnh hợp lệ (jpg, png, gif, webp, heic).");
      }
      const imageUrl = imageAttachments.url;
      const mimeType = imageAttachments.contentType;
      const base64Image = await imageUrlToBase64(imageUrl);
      imageParts.push({ base64: base64Image, mimeType });
      originalImages.push({ url: imageUrl, name: "original_image_1" });
    }

    if (otherImages) {
      if (!otherImages.contentType.startsWith("image/")) {
        return await interaction.followUp("Tệp tải lên không phải là ảnh hợp lệ (jpg, png, gif, webp, heic).");
      }
      const imageUrl = otherImages.url;
      const mimeType = otherImages.contentType;
      const base64Image = await imageUrlToBase64(imageUrl);
      imageParts.push({ base64: base64Image, mimeType });
      originalImages.push({ url: imageUrl, name: "original_image_2" });
    }

    const editedImageResult = await editImageGemini(prompt, imageParts);

    if (!editedImageResult) {
      await interaction.followUp("⚠️ Không thể chỉnh sửa ảnh do vi phạm chính sách an toàn của AI. Hãy thử một ảnh khác hoặc thay đổi yêu cầu chỉnh sửa.");
      return;
    }

    const { base64, mimeType } = editedImageResult;
    const buffer = Buffer.from(base64, "base64");

    // Gửi tin nhắn đầu tiên chứa ảnh gốc
    if (originalImages.length > 0) {
      await interaction.followUp({
        content: `**Ảnh gốc:**`,
        files: originalImages.map(img => ({ attachment: img.url, name: `${img.name}.png` })),
      });
    }

    // Gửi tin nhắn thứ hai chứa ảnh đã chỉnh sửa
    await interaction.followUp({
      content: `Ảnh đã chỉnh sửa theo yêu cầu: "${prompt}"`,
      files: [{ attachment: buffer, name: "edited_image.png" }],
    });

  } catch (error) {
    console.error("Error in /editimage:", error);
    await interaction.followUp("Đã xảy ra lỗi khi chỉnh sửa ảnh.");
  }
}

async function handleGenerateImage(interaction) {
  await interaction.deferReply();

  const prompt = interaction.options.getString("prompt");

  try {
    const imageResult = await generateImageGemini(prompt);

    if (!imageResult) {
      await interaction.followUp("⚠️ AI từ chối tạo ảnh do vi phạm chính sách an toàn. Hãy thử mô tả khác.");
      return;
    }

    const { base64, mimeType } = imageResult;
    const buffer = Buffer.from(base64, "base64");

    await interaction.followUp({
      content: `Ảnh được tạo theo yêu cầu: "${prompt}"`,
      files: [{ attachment: buffer, name: "generated_image.png" }],
    });

  } catch (error) {
    console.error("Error in /generateimage:", error);
    await interaction.followUp("Đã xảy ra lỗi khi tạo ảnh.");
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("image")
    .setDescription("Tạo hoặc chỉnh sửa ảnh bằng AI.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("generate")
        .setDescription("Tạo ảnh mới dựa trên mô tả.")
        .addStringOption((option) =>
          option.setName("prompt").setDescription("Mô tả ảnh bạn muốn tạo").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription("Chỉnh sửa ảnh đã có.")
        .addStringOption((option) =>
          option.setName("prompt").setDescription("Hướng dẫn chỉnh sửa ảnh").setRequired(true)
        )
        .addAttachmentOption((option) =>
          option.setName("image").setDescription("Ảnh cần chỉnh sửa").setRequired(true)
        )
        .addAttachmentOption((option) =>
          option.setName("images").setDescription("Ảnh thứ hai để chỉnh sửa").setRequired(false)
        )
    )
    .setDMPermission(false),

  async execute(interaction) {
    if (!discordUtils.hasBotPermissions(interaction.channel, [PermissionsBitField.Flags.AttachFiles])) {
      return await discordUtils.sendErrorMessage(interaction, "Bot không có quyền gửi tệp tin (AttachFiles).", true);
    }

    if (interaction.channelId !== config.allowedChannelId) {
      return await discordUtils.sendErrorMessage(
        interaction,
        `❌ Bạn chỉ có thể sử dụng lệnh này trong kênh <#${config.allowedChannelId}>!`,
        true
      );
    }

    if (interaction.options.getSubcommand() === "generate") {
      await handleGenerateImage(interaction);
    } else if (interaction.options.getSubcommand() === "edit") {
      await handleEditImage(interaction);
    }
  },
};
