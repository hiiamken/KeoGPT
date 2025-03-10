// bot.js
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
  partials: [Partials.Channel],
});

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

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

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
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
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
      console.log(
        `[WARNING] The prefix command at ${filePath} is missing a required "name" or "execute" property.`
      );
    }
  }

  cron.schedule("0 3 * * *", async () => {
    await deleteExpiredThreads();
  });

  cron.schedule("0 0 1 * *", async () => {
    await resetPoints();
  });
  setRandomActivity();
  setInterval(setRandomActivity, 10000);
  runTests();
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
          console.log(`Deleted thread: ${row.threadId}`);
        } else {
          console.log(`Thread ${row.threadId} not found.`);
        }
      } catch (threadError) {
        console.error(threadError);
      }
    });

    await Promise.all(deletePromises);

    await connection.execute("DELETE FROM threads WHERE expiresAt < NOW()");
    await connection.commit();
    console.log("Deleted expired threads");
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error deleting expired threads:", error);
  } finally {
    if (connection) connection.release();
  }
}
async function resetPoints() {
  let connection;
  try {
    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    await connection.execute(`
            UPDATE users
            SET total_points = 0,
                last_reset = NOW()
        `);

    await connection.commit();
    console.log("Đã reset điểm cho tất cả người dùng.");
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error resetting points:", error);
  } finally {
    if (connection) connection.release();
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.content.startsWith(config.prefix) || message.author.bot) {
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
          console.error("Error sending help suggestion:", error);
        }
      }
    }
    return;
  }
  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.prefixCommands.get(commandName);

  if (!command) return;

  try {
    await command.execute(message, args, client);
  } catch (error) {
    console.error(error);
    await message.reply({
      content: "Có lỗi xảy ra khi thực hiện lệnh!",
      allowedMentions: { repliedUser: false },
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
