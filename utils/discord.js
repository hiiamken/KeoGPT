// utils/discord.js

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
      .setStyle(ButtonStyle.Primary)
  );
}

function hasBotPermissions(channel, permissions) {
  if (!channel || !channel.guild) {
    // Thêm kiểm tra này
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
    console.error("Failed to send error message:", error);
  }
}

async function safeDeleteMessage(message) {
  if (!message || !message.delete) return;
  try {
    await message.delete();
  } catch (error) {
    console.warn(`Failed to delete message: ${error.message}`);
  }
}
async function safeRenameThread(thread, newName) {
  try {
    await thread.setName(newName);
  } catch (error) {
    console.error("Lỗi đổi tên thread:", error);
    if (error.code === 50013) {
      sendErrorMessage(thread, "Bot không có quyền đổi tên thread này!");
    }
  }
}

function createMockSlashInteraction(
  commandName,
  options = {},
  userId = "123",
  channelId = config.allowedChannelId
) {
  return {
    isChatInputCommand: () => true,
    commandName,
    options: {
      getString: (name) => options[name] || null,
      getAttachment: (name) => options[name] || null,
      getBoolean: (name) => options[name] || null,
    },
    user: { id: userId },
    channelId,
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
                  customId: "simple",
                  user: { id: userId },
                  deferUpdate: () => Promise.resolve(),
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
  authorId = "456",
  channelId = config.allowedChannelId,
  attachments = []
) {
  const attachmentsCollection = new Map();

  for (let i = 0; i < attachments.length; i++) {
    attachmentsCollection.set(String(i), attachments[i]);
  }
  return {
    content,
    author: { id: authorId },
    channelId,
    attachments: {
      size: attachmentsCollection.size,
      first: () =>
        attachmentsCollection.size > 0
          ? attachmentsCollection.values().next().value
          : null,
      entries: () => attachmentsCollection.entries(),
    },
    channel: {
      type: "GUILD_TEXT",
      sendTyping: () => Promise.resolve(),
      send: (content) => Promise.resolve({ content }),
      threads: {
        create: (data) =>
          Promise.resolve({
            id: "thread123",
            send: (msg) => Promise.resolve({ content: msg }),
            setName: () => Promise.resolve(),
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
    reply: (options) => {
      return Promise.resolve({
        content: typeof options === "string" ? options : options.content,
        createMessageComponentCollector: () => {
          return {
            on: (event, callback) => {
              if (event === "collect") {
                callback({
                  customId: "simple",
                  user: { id: authorId },
                  deferUpdate: () => Promise.resolve(),
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
  };
}

function createCodeEmbed(code, language = "python", title = "Code") {
  const embed = new EmbedBuilder()
    .setColor("#0099ff")
    .setTitle(title)
    .setDescription(`\`\`\`${language}\n${code}\n\`\`\``);

  return embed;
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
