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

// Load commands from the interactions folder
if (fs.existsSync(interactionsPath)) {
  const commandFiles = fs
    .readdirSync(interactionsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(interactionsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
      console.log(`Loaded command ${command.data.name} from ${filePath}`); // Log loaded commands
    } else {
      console.warn(`⚠️ The command at ${filePath} is missing a required "data" or "execute" property.`);
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
    console.error(`❌ No command matching ${interaction.commandName} was found.`);
    return;
  }

    // Moved permission and channel checks inside the command execution
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "❌ There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "❌ There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

// Prefix command handler (optional, but good for compatibility)
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName);

  // Nếu command hợp lệ, thực thi bình thường
  if (command) {
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
    return;
  }

  // Nếu command không hợp lệ, chỉ phản hồi trong kênh được phép
  if (message.channel.id === config.allowedChannelId) {
    await message.reply(`❌ Lệnh \`${config.prefix}${commandName}\` không hợp lệ. Vui lòng sử dụng \`${config.prefix}gpthelp\` để xem danh sách lệnh.`);
    console.warn(`⚠️ Prefix command not found: ${commandName}`);
  }
});


// Auto-reply with a help suggestion (optional, and likely redundant with /gpthelp)
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
      const cooldownAmount = (config.helpCooldown || 60) * 1000; // Default to 60 seconds

      if (helpCooldowns.has(message.author.id)) {
        const lastMessageTime = helpCooldowns.get(message.author.id);
        if (now < lastMessageTime + cooldownAmount) {
          return; // Too soon, don't send another help message
        }
      }

      try {
        const { getRandomHelpSuggestion } = require("./utils/help"); // Make sure this path is correct
        const helpMessage = getRandomHelpSuggestion();
        await message.reply({
          content: helpMessage,
          allowedMentions: { repliedUser: false }, // Don't ping the user
        });
        helpCooldowns.set(message.author.id, now); // Update the last message time
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
