const config = require('../config');

function createMockSlashInteraction(
    commandName,
    options = {},
    userId = "1234567890",
    channelId = config.allowedChannelId,
    guildId = "test-guild-id"
) {
    const getOption = (name) => options[name] || null;

    return {
        isChatInputCommand: () => true,
        commandName,
        options: {
            getString: getOption,
            getAttachment: getOption,
            getBoolean: getOption,
            getInteger: getOption,
            getUser: (name) => name === "target" && options.subcommand === "user" ? { id: options.target } : null,
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
                        id: "test-thread-id",
                        send: (msg) => Promise.resolve({ content: msg }),
                        setName: (name) => Promise.resolve(),
                    }),
            },
            isThread: () => false,
            ownerId: userId,
            parentId: config.allowedChannelId,
            guild: {
                members: {
                    me: {
                        permissionsIn: () => ({
                            has: () => true
                        })
                    }
                }
            },
            permissionFor: () => ({
                has: () => true
            })
        },
        client: {
            user: {
                id: "some_bot_id",
                username: "KeoGPT",
                avatarURL: () => "https://example.com/bot_avatar.png",
            },
        },
        deferReply: () => Promise.resolve(),
        followUp: (content) => Promise.resolve({ content }),
        reply: (options) => Promise.resolve({ content: options.content }),
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
        guild: { id: "test-guild-id" },
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
            ownerId: authorId,
            parentId: config.allowedChannelId,
            guild: {
                members: {
                    me: {
                        permissionsIn: () => ({
                            has: () => true
                        })
                    }
                }
            },
            permissionFor: () => ({
                has: () => true
            })
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

async function sendErrorMessage(target, message) {
    try {
        if (target.isChatInputCommand && target.isChatInputCommand()) {
            if (target.deferred || target.replied) {
                await target.followUp({ content: `❌ ${message}`, ephemeral: true });
            } else {
                await target.reply({ content: `❌ ${message}`, ephemeral: true });
            }
        } else {
            await target.reply(`❌ ${message}`);
        }
    } catch (error) {
        console.error("❌ Error sending error message:", error);
    }
}

function hasBotPermissions(channel, permissions) {
    if (!channel.guild || !channel.guild.members || !channel.guild.members.me) return false;
    return channel.guild.members.me.permissionsIn(channel).has(permissions, true);
}

function isSlashCommand(interaction) {
    return interaction.isChatInputCommand();
}

module.exports = {
    createMockSlashInteraction,
    createMockPrefixMessage,
    sendErrorMessage,
    hasBotPermissions,
    isSlashCommand,
};
