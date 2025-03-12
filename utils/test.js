const {
  createMockSlashInteraction,
  createMockPrefixMessage,
} = require("./discord");
const config = require("../config");
const {
  getDatabaseInstance,
  insertOrUpdateUser,
  deleteExpiredThreads,
  resetAllPoints,
  executeQuery,
} = require("./database");
const Table = require("cli-table3");
const fs = require("fs");

const TEST_DB_FILE = "test_database.sqlite";
const MAIN_DB_FILE = "database.sqlite";

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
};

const SYMBOLS = {
  success: "✅",
  failure: "❌",
};

function colorize(text, color) {
  return COLORS[color] ? `${COLORS[color]}${text}${COLORS.reset}` : text;
}

async function runTests() {
  console.log(colorize("\n🚀 KeoGPT Test Suite Started 🚀", "blue"));

  if (fs.existsSync(MAIN_DB_FILE)) {
    fs.copyFileSync(MAIN_DB_FILE, `${MAIN_DB_FILE}.backup`);
  }

  if (fs.existsSync(TEST_DB_FILE)) {
    fs.unlinkSync(TEST_DB_FILE);
  }
  fs.copyFileSync(MAIN_DB_FILE, TEST_DB_FILE);

  process.env.DATABASE_FILE = TEST_DB_FILE;
  const db = getDatabaseInstance();

  const testResults = [];
  const testUserId = "test-user-123";
  const testUserName = "TestUser";

  function expect(condition, message, commandName, type) {
    const result = condition
      ? `${SYMBOLS.success} ${colorize("PASS", "green")}`
      : `${SYMBOLS.failure} ${colorize("FAIL", "red")}`;
    testResults.push({ command: `${type} ${commandName}`, message, result });
  }

  try {
    const dbTests = [
      {
        func: () => insertOrUpdateUser(testUserId, testUserName),
        name: "insertOrUpdateUser",
      },
      { func: deleteExpiredThreads, name: "deleteExpiredThreads" },
      { func: () => resetAllPoints(true), name: "resetAllPoints" },
    ];

    for (const test of dbTests) {
      try {
        await test.func();
        expect(true, `Executed ${test.name}`, test.name, "DB");
      } catch (error) {
        expect(false, error.message, test.name, "DB");
      }
    }

    async function testCommands(commandList, type) {
      for (const [commandName, command] of Object.entries(commandList)) {
        if (!command || typeof command.execute !== "function") {
          expect(false, `Missing execute() function`, commandName, type);
          continue;
        }

        try {
          if (type === "/") {
            const params =
              commandName === "ask"
                ? { prompt: "test prompt", language: "vi" }
                : {};

            const interaction = {
              ...createMockSlashInteraction(
                commandName,
                params,
                testUserId,
                config.allowedChannelId,
                "test-guild-id"
              ),
              editReply: async (msg) =>
                console.log("✅ [Mock] editReply() called with:", msg),
            };

            await command.execute(interaction, db);
          } else {
            const message = createMockPrefixMessage(
              `!${commandName} test prompt`,
              testUserId,
              config.allowedChannelId
            );

            await command.execute(
              message,
              ["test", "prompt"],
              { user: { id: "some-id" } },
              db
            );
          }

          expect(true, `Executed ${commandName}`, commandName, type);
        } catch (error) {
          expect(false, error.message, commandName, type);
        }
      }
    }

    const loadCommandSafely = (path) => {
      try {
        return require(path);
      } catch (error) {
        console.error(
          colorize(`⚠️ Failed to load ${path}: ${error.message}`, "red")
        );
        return null;
      }
    };

    const slashCommands = {
      ask: loadCommandSafely("../interactions/ask"),
      reply: loadCommandSafely("../interactions/reply"),
      new: loadCommandSafely("../interactions/new"),
      clear: loadCommandSafely("../interactions/clear"),
      gpthelp: loadCommandSafely("../interactions/gpthelp"),
      cleardata: loadCommandSafely("../interactions/cleardata"),
      lang: loadCommandSafely("../interactions/lang"),
      stats: loadCommandSafely("../interactions/stats"),
      "ranking-gpt": loadCommandSafely("../interactions/ranking-gpt"),
    };

    await testCommands(slashCommands, "/");

    const table = new Table({
      head: [
        colorize("Command", "cyan"),
        colorize("Description", "cyan"),
        colorize("Result", "cyan"),
      ],
      colWidths: [25, 50, 15],
      style: { head: [], border: ["gray"] },
      wordWrap: true,
    });

    for (const result of testResults) {
      table.push([result.command, result.message, result.result]);
    }

    console.log(table.toString());
  } catch (error) {
    console.error(
      colorize(`❌ Test execution failed: ${error.message}`, "red")
    );
  } finally {
    console.log(colorize("\n🔄 Restoring main database...", "cyan"));

    if (fs.existsSync(`${MAIN_DB_FILE}.backup`)) {
      console.log("📂 Restoring database from backup...");
      fs.copyFileSync(`${MAIN_DB_FILE}.backup`, MAIN_DB_FILE);
      fs.unlinkSync(`${MAIN_DB_FILE}.backup`);
    }

    if (fs.existsSync(TEST_DB_FILE)) {
      console.log("🗑️  Removing test database...");
      fs.unlinkSync(TEST_DB_FILE);
    }

    console.log(colorize("✅ Tests completed successfully.", "yellow"));
  }
}

module.exports = {
  runTests,
};
