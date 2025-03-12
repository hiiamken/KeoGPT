const {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const config = require("../config");
const { getRandomHelpSuggestion, getRandomLoadingMessage } = require("./help");

function isSlashCommand(message) {
  return (
    message.type === "APPLICATION_COMMAND" || message.isChatInputCommand?.()
  );
}

function createResponseStyleButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("simple")
      .setLabel("Đơn giản")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("professional")
      .setLabel("Chuyên nghiệp")
      .setStyle(ButtonStyle.Success)
  );
}

function hasBotPermissions(channel, permissions) {
  if (!channel || !channel.guild) {
    return false;
  }
  const botMember = channel.guild.members.me;
  if (!botMember) return false;
  return channel.permissionsFor(botMember).has(permissions);
}

async function sendErrorMessage(message, content, ephemeral = false) {
  const replyOptions = {
    content,
    ephemeral,
    allowedMentions: { repliedUser: false },
  };
  try {
    if (isSlashCommand(message)) {
      if (message.deferred || message.replied) {
        await message.followUp(replyOptions);
      } else {
        await message.reply(replyOptions);
      }
    } else {
      await message.reply(replyOptions);
    }
  } catch (error) {
    console.error("❌ Failed to send error message:", error);
  }
}

async function safeDeleteMessage(message) {
  if (!message || !message.delete) return;
  try {
    await message.delete();
  } catch (error) {
    console.warn(`⚠️ Failed to delete message: ${error.message}`);
  }
}

async function safeRenameThread(thread, newName) {
  try {
    await thread.setName(newName);
  } catch (error) {
    console.error("❌ Lỗi đổi tên thread:", error);
    if (error.code === 50013) {
      sendErrorMessage(thread, "Bot không có quyền đổi tên thread này!");
    }
  }
}

function createMockSlashInteraction(
  commandName,
  options = {},
  userId = "1234567890",
  channelId = config.allowedChannelId,
  guildId = "test-guild-id"
) {
  return {
    isChatInputCommand: () => true,
    commandName,
    options: {
      getString: (name) => options[name] || null,
      getAttachment: (name) => options[name] || null,
      getBoolean: (name) => options[name] || null,
      getUser: (name) => {
        if (name === "target" && options.subcommand === "user") {
          return { id: options.target };
        }
        return null;
      },
      getSubcommand: () => options.subcommand || null,
    },
    user: {
      id: userId,
      username: `User${userId}`,
      displayAvatarURL: () => "https://example.com/default-avatar.png",
    },
    channelId,
    guild: { id: guildId },
    channel: {
      type: "GUILD_TEXT",
      id: channelId,
      sendTyping: () => Promise.resolve(),
      send: (content) => Promise.resolve({ content }),
      threads: {
        create: (data) =>
          Promise.resolve({
            id: "thread123",
            send: (msg) => Promise.resolve({ content: msg }),
            setName: (name) => Promise.resolve(),
          }),
      },
      isThread: () => false,
      ownerId: "someOwnerId",
      parentId: config.allowedChannelId,
      guild: {
        members: {
          me: {
            permissionsIn: (ch) => ({
              has: (perms) => {
                return true;
              },
            }),
          },
        },
      },
      permissionsFor: (member) => {
        return {
          has: (permissions) => {
            return true;
          },
        };
      },
    },
    client: {
      user: {
        id: "some_bot_id",
        username: "KeoGPT",
        avatarURL: () => "https://example.com/bot_avatar.png",
      },
    },
    deferReply: (opts) => Promise.resolve(),
    followUp: (content) => Promise.resolve({ content }),
    reply: (options) => {
      return Promise.resolve({
        content: options.content,
        createMessageComponentCollector: () => {
          return {
            on: (event, callback) => {
              if (event === "collect") {
                callback({
                  customId: "confirm",
                  user: { id: userId },
                  deferUpdate: () => Promise.resolve(),
                  update: (options) => Promise.resolve(),
                });
              } else if (event === "end") {
                callback([]);
              }
            },
          };
        },
        edit: (options) => {
          return Promise.resolve({ content: options.content });
        },
      });
    },
    isReplied: false,
    isDeferred: false,
  };
}

function createMockPrefixMessage(
  content,
  authorId = "4567890123",
  channelId = config.allowedChannelId,
  attachments = []
) {
  const mockAttachments = attachments.map((attachment) => ({
    name: attachment.name,
    url: attachment.url,
    contentType: attachment.contentType,
  }));

  return {
    content,
    author: {
      id: authorId,
      username: `User${authorId}`,
      displayAvatarURL: () => "https://example.com/default-avatar.png",
    },
    channelId,
    attachments: {
      size: mockAttachments.length,
      map: () => mockAttachments,
      first: () => (mockAttachments.length > 0 ? mockAttachments[0] : null),
    },
    reply: (msg) => Promise.resolve({ content: msg }),
    react: (emoji) => Promise.resolve(),
    guild: {
      id: "test-guild-id",
    },
    isChatInputCommand: () => false,
    channel: {
      type: "GUILD_TEXT",
      id: channelId,
      sendTyping: () => Promise.resolve(),
      send: (content) => Promise.resolve({ content }),
      threads: {
        create: (data) =>
          Promise.resolve({
            id: "thread123",
            send: (msg) => Promise.resolve({ content: msg }),
            setName: (name) => Promise.resolve(),
          }),
      },
      isThread: () => true,
      ownerId: "someOwnerId",
      parentId: config.allowedChannelId,
      guild: {
        members: {
          me: {
            permissionsIn: (ch) => ({
              has: (perms) => {
                return true;
              },
            }),
          },
        },
      },
      permissionsFor: (member) => {
        return {
          has: (permissions) => {
            return true;
          },
        };
      },
    },
    client: {
      user: {
        id: "some_bot_id",
        username: "KeoGPT",
        avatarURL: () => "https://example.com/bot_avatar.png",
      },
    },
  };
}

function createCodeEmbed(code, language = "python", title = "Code") {
  return new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle(title)
    .setDescription(`\`\`\`${language}\n${code}\n\`\`\``);
}

module.exports = {
  isSlashCommand,
  createResponseStyleButtons,
  hasBotPermissions,
  sendErrorMessage,
  safeDeleteMessage,
  safeRenameThread,
  createMockPrefixMessage,
  createMockSlashInteraction,
  createCodeEmbed,
};
