require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  Partials,
  ChannelType,
  ActivityType,
} = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const config = require("./config");
const db = require("./utils/database");
const cron = require("node-cron");
const { runTests } = require("./utils/test");
const { hasBotPermissions, sendErrorMessage } = require("./utils/discord");

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing in .env file!");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
    Partials.User,
    Partials.ThreadMember,
  ],
});

client.commands = new Collection();
const interactionsPath = path.join(__dirname, "interactions");

if (fs.existsSync(interactionsPath)) {
  const commandFiles = fs
    .readdirSync(interactionsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(interactionsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`⚠️ Missing "data" or "execute" in ${filePath}`);
    }
  }
} else {
  console.warn("⚠️ 'interactions/' folder not found!");
}

const helpCooldowns = new Collection();

const activities = [
  { name: "cùng TKen debug code 🐛", type: ActivityType.Watching },
  { name: "hướng dẫn /gpthelp", type: ActivityType.Watching },
  { name: "nhạc Jack", type: ActivityType.Listening },
  { name: "mẹo lập trình", type: ActivityType.Watching },
  { name: "Podcast chữa lành", type: ActivityType.Listening },
  { name: "nhạc không lời để code", type: ActivityType.Listening },
  { name: "JaValorant", type: ActivityType.Playing },
  { name: "TKen ngủ", type: ActivityType.Watching },
];

function setRandomActivity() {
  const activity = activities[Math.floor(Math.random() * activities.length)];
  client.user.setPresence({ activities: [activity], status: "online" });
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Bot is ready! Logged in as ${c.user.tag}`);

  if (process.env.NODE_ENV !== "production") {
    console.log("🛠 Running tests...");
    await runTests();
  }

  await db.initializeDatabase();

  const guild = client.guilds.cache.get(config.guildId);
  if (guild) await guild.members.fetch();

  setRandomActivity();
  setInterval(setRandomActivity, 10000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`❌ Command not found: ${interaction.commandName}`);
    return;
  }

  if (
    (!interaction.channel.isThread() &&
      interaction.channelId !== config.allowedChannelId) ||
    (interaction.channel.isThread() &&
      interaction.channel.parentId !== config.allowedChannelId)
  ) {
    return await sendErrorMessage(
      interaction,
      `Use this command in <#${config.allowedChannelId}> or its threads!`
    );
  }

  if (
    !(await hasBotPermissions(interaction.channel, [
      "SendMessages",
      "ReadMessageHistory",
      "ViewChannel",
      "CreatePublicThreads",
    ]))
  ) {
    return await sendErrorMessage(
      interaction,
      "❌ Bot lacks required permissions."
    );
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "❌ Error executing command!",
      ephemeral: true,
    });
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName);

  if (!command) {
    console.warn(`⚠️ Prefix command not found: ${commandName}`);
    return;
  }

  if (
    message.channel.id !== config.allowedChannelId &&
    message.channel.parentId !== config.allowedChannelId &&
    commandName !== "gpthelp"
  ) {
    return await message.reply(
      `⚠️ Use \`${config.prefix}${commandName}\` in <#${config.allowedChannelId}> or its threads!`
    );
  }

  if (
    !(await hasBotPermissions(message.channel, [
      "SendMessages",
      "ReadMessageHistory",
      "ViewChannel",
    ]))
  ) {
    return await message.reply("❌ Bot lacks required permissions.");
  }

  try {
    if (command.executePrefix) {
      await command.executePrefix(message, args);
    } else {
      console.warn(`⚠️ Command ${commandName} missing 'executePrefix'.`);
    }
  } catch (error) {
    console.error("❌ Error executing prefix command:", error);
    await message.reply("❌ An error occurred while executing the command.");
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (
    !message.author.bot &&
    !message.content.startsWith(config.prefix) &&
    !message.reference
  ) {
    if (
      message.channelId === config.allowedChannelId ||
      message.channel.type === ChannelType.PublicThread ||
      message.channel.type === ChannelType.PrivateThread
    ) {
      const now = Date.now();
      const cooldownAmount = (config.helpCooldown || 60) * 1000;

      if (helpCooldowns.has(message.author.id)) {
        const lastMessageTime = helpCooldowns.get(message.author.id);
        if (now < lastMessageTime + cooldownAmount) {
          return;
        }
      }

      try {
        const { getRandomHelpSuggestion } = require("./utils/help");
        const helpMessage = getRandomHelpSuggestion();
        await message.reply({
          content: helpMessage,
          allowedMentions: { repliedUser: false },
        });
        helpCooldowns.set(message.author.id, now);
      } catch (error) {
        console.error("❌ Error sending help suggestion:", error);
      }
    }
  }
});

cron.schedule("0 3 * * *", async () => {
  await deleteExpiredThreads();
});

cron.schedule("0 0 1 * *", async () => {
  await resetMonthlyPoints();
});

cron.schedule("0 0 * * *", async () => {
  console.log("Resetting daily token usage...");
  await db.resetDailyTokenUsage();
  console.log("Daily token usage reset.");
});

async function deleteExpiredThreads() {
  let connection;
  try {
    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      "SELECT threadId FROM threads WHERE expiresAt < NOW()"
    );
    const deletePromises = rows.map(async (row) => {
      try {
        const thread = await client.channels.fetch(row.threadId);
        if (thread) {
          await thread.delete();
          console.log(`Deleted expired thread: ${row.threadId}`);
        }
      } catch (error) {
        console.error(`Error deleting thread ${row.threadId}:`, error);
      }
    });

    await Promise.all(deletePromises);
    await connection.execute("DELETE FROM threads WHERE expiresAt < NOW()");
    await connection.commit();
    console.log("✅ Expired threads cleaned up.");
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("❌ Error cleaning up expired threads:", error);
  } finally {
    if (connection) connection.release();
  }
}

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("❌ Bot login error:", error);
  process.exit(1);
});
