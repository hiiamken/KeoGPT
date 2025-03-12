require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const {
    Client,
    GatewayIntentBits,
    Collection,
    Partials,
    ActivityType,
    Events
} = require("discord.js");

const {
    executeQuery,
    initializeDatabase,
    deleteExpiredThreads: deleteExpiredThreadsDB, // Rename để tránh xung đột
    resetAllPoints: resetAllPointsDB // Rename để tránh xung đột
} = require("./utils/database");
const { checkAndHandleOnboarding } = require("./utils/onboarding");
const config = require("./config");
const { runTests } = require("./utils/test");
const { hasBotPermissions, sendErrorMessage } = require("./utils/discord");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.DirectMessageReactions
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User, Partials.ThreadMember],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.prefixCommands = new Collection();
const prefixCommandsPath = path.join(__dirname, "prefixcommands");
const prefixCommandFiles = fs
    .readdirSync(prefixCommandsPath)
    .filter((file) => file.endsWith(".js"));

for (const file of prefixCommandFiles) {
    const filePath = path.join(prefixCommandsPath, file);
    const command = require(filePath);
    if ("name" in command && "execute" in command) {
        client.prefixCommands.set(command.name, command);
    } else {
        console.log(`[WARNING] The prefix command at ${filePath} is missing a required "name" or "execute" property.`);
    }
}

client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Ready! Logged in as ${c.user.tag}!`);
    await initializeDatabase();

    deleteExpiredThreads();
    setInterval(deleteExpiredThreads, 60 * 60 * 1000);
    resetPoints();
    setInterval(resetPoints, 24 * 60 * 60 * 1000);

    if (process.env.NODE_ENV !== 'production') {
        console.log("🛠 Running tests...");
        await runTests();
    }

    const guild = client.guilds.cache.get(config.guildId);
    if (guild) {
        await guild.members.fetch();
    }
});

client.on(Events.GuildMemberAdd, (member) => {
    checkAndHandleOnboarding(member);
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`❌ No command matching ${interaction.commandName} was found.`);
        return;
    }
    if (interaction.channelId !== config.allowedChannelId && interaction.commandName !== "gpthelp") {
        await sendErrorMessage(interaction, `Vui lòng sử dụng lệnh ${interaction.commandName} trong kênh <#${config.allowedChannelId}>!`);
        return;
    }
    const requiredPermissions = ['SendMessages', 'ReadMessageHistory', 'ViewChannel', 'CreatePublicThreads'];
    if (!hasBotPermissions(interaction.channel, requiredPermissions)) {
        await sendErrorMessage(interaction, `Bot không có đủ quyền để thực hiện lệnh ${interaction.commandName} trong kênh này. Yêu cầu quyền: ${requiredPermissions.join(', ')}.`);
        return;
    }
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "❌ There was an error while executing this command!", ephemeral: true });
        } else {
            await interaction.reply({ content: "❌ There was an error while executing this command!", ephemeral: true });
        }
    }
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.content.startsWith(config.prefix)) {
        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.prefixCommands.get(commandName);
        if (!command) return;

        if (message.channel.id !== config.allowedChannelId && commandName !== "gpthelp") {
            await message.reply(`⚠️ Vui lòng sử dụng lệnh \`${config.prefix}${commandName}\` trong kênh <#${config.allowedChannelId}>!`);
            return;
        }

        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error("❌ Error executing prefix command:", error);
            await message.reply("❌ There was an error trying to execute that command!");
        }
    }
});

async function deleteExpiredThreads() {
    try {
        await executeQuery("DELETE FROM threads WHERE expiresAt < datetime('now')");
        console.log("✅ Deleted expired threads.");
    } catch (error) {
        console.error("❌ Error deleting expired threads:", error);
    }
}

async function resetPoints() {
    try {
        await executeQuery("UPDATE users SET total_points = 0");
        await executeQuery("UPDATE users SET last_reset = ?", [new Date().toISOString()]);
        console.log("✅ Reset user points and updated last_reset.");
    } catch (error) {
        console.error("❌ Error resetting points:", error);
    }
}

process.on("unhandledRejection", (error) => {
    console.error("❌ Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught exception:", error);
    process.exit(1);
});

client.login(process.env.DISCORD_TOKEN);
