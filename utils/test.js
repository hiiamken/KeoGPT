// utils/test.js
const {
  createMockSlashInteraction,
  createMockPrefixMessage,
} = require("./discord");
const config = require("../config");
const db = require("./database");
const { generateTitle } = require("./gemini");
const fs = require("node:fs");
const path = require("node:path");
const Table = require("cli-table3");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

const symbols = {
  success: "✅",
  failure: "❌",
  warning: "⚠️",
  info: "ℹ️",
  arrowRight: "➡️",
};

function colorize(text, color) {
  return colors[color] ? `${colors[color]}${text}${colors.reset}` : text;
}
function logWithColor(message, color = "white") {
  console.log(colorize(message, color));
}
function logSuccess(message) {
  console.log(colorize(`${symbols.success} ${message}`, "green"));
}
function logFailure(message) {
  console.error(colorize(`${symbols.failure} ${message}`, "red"));
}
function logWarning(message) {
  console.warn(colorize(`${symbols.warning} ${message}`, "yellow"));
}
function logInfo(message) {
  console.info(colorize(`${symbols.info} ${message}`, "cyan"));
}

async function runTests() {
  console.log(colorize("🚀  KeoGPT Bot Test Suite  🚀", "blue"));

  const testResults = [];

  function expect(condition, message, commandName, type) {
    const result = condition
      ? `${symbols.success} PASS`
      : `${symbols.failure} FAIL`;
    testResults.push({ command: `${type} ${commandName}`, message, result });
    return condition;
  }

  let connection;
  const testUserId = "test-user-id-123";
  const testUserName = "TestUser";

  try {
    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      `
            INSERT INTO users (userId, username) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE username = VALUES(username)
        `,
      [testUserId, testUserName]
    );

    try {
      const db = require("../utils/database");
      testResults.push({
        command: "utils",
        message: "Kết nối Database",
        result: "✅",
      });
    } catch (error) {
      testResults.push({
        command: "utils",
        message: "Kết nối Database",
        result: `❌ (${error.message})`,
      });
    }

    try {
      const gemini = require("../utils/gemini");
      testResults.push({
        command: "utils",
        message: "Gemini API",
        result: "✅",
      });
    } catch (error) {
      testResults.push({
        command: "utils",
        message: "Gemini API",
        result: `❌ (${error.message})`,
      });
    }
    try {
      const gemini = require("../utils/gemini");
      testResults.push({
        command: "utils",
        message: "Gemini Utils",
        result: "✅",
      });
    } catch (error) {
      testResults.push({
        command: "utils",
        message: "Gemini Utils",
        result: `❌ (${error.message})`,
      });
    }
    try {
      const format = require("../utils/format");
      testResults.push({
        command: "utils",
        message: "Format Math",
        result: "✅",
      });
    } catch (error) {
      testResults.push({
        command: "utils",
        message: "Format Math",
        result: `❌ (${error.message})`,
      });
    }

    const slashCommands = {
      ask: require("../commands/ask"),
      reply: require("../commands/reply"),
      new: require("../commands/new"),
      clear: require("../commands/clear"),
      gpthelp: require("../commands/gpthelp"),
      cleardata: require("../commands/cleardata"),
      lang: require("../commands/lang"),
      stats: require("../commands/stats"),
      ["ranking-gpt"]: require("../commands/ranking-gpt"),
    };

    for (const [commandName, command] of Object.entries(slashCommands)) {
      try {
        let interaction;
        if (commandName === "cleardata") {
          interaction = createMockSlashInteraction(
            commandName,
            { subcommand: "all", type: "stats" },
            testUserId,
            config.allowedChannelId,
            "test-guild-id"
          );
          await command.execute(interaction);
          expect(true, "Chạy lệnh cleardata all stats", commandName, "/");

          interaction = createMockSlashInteraction(
            commandName,
            { subcommand: "all", type: "data" },
            testUserId,
            config.allowedChannelId,
            "test-guild-id"
          );
          await command.execute(interaction);
          expect(true, "Chạy lệnh cleardata all data", commandName, "/");

          interaction = createMockSlashInteraction(
            commandName,
            { subcommand: "user", target: testUserId, type: "stats" },
            testUserId,
            config.allowedChannelId,
            "test-guild-id"
          );
          await command.execute(interaction);
          expect(true, "Chạy lệnh cleardata user stats", commandName, "/");

          interaction = createMockSlashInteraction(
            commandName,
            { subcommand: "user", target: testUserId, type: "data" },
            testUserId,
            config.allowedChannelId,
            "test-guild-id"
          );
          await command.execute(interaction);
          expect(true, "Chạy lệnh cleardata user data", commandName, "/");
        } else if (commandName === "stats" || commandName === "ranking-gpt") {
          interaction = createMockSlashInteraction(
            commandName,
            {},
            testUserId,
            config.allowedChannelId,
            "test-guild-id"
          );
          await command.execute(interaction);
          expect(true, "Chạy lệnh", commandName, "/");
        } else {
          interaction = createMockSlashInteraction(
            commandName,
            { prompt: "test prompt", language: "vi" },
            testUserId,
            config.allowedChannelId,
            "test-guild-id"
          );
          await command.execute(interaction);
          expect(true, "Chạy lệnh", commandName, "/");
        }
      } catch (error) {
        expect(false, error.message, commandName, "/");
      }
    }

    const prefixCommands = {
      ask: require("../prefixcommands/ask"),
      reply: require("../prefixcommands/reply"),
      new: require("../prefixcommands/new"),
      clear: require("../prefixcommands/clear"),
      gpthelp: require("../prefixcommands/gpthelp"),
      lang: require("../prefixcommands/lang"),
      cleardata: require("../prefixcommands/cleardata"),
      stats: require("../prefixcommands/stats"),
      ["ranking-gpt"]: require("../prefixcommands/ranking-gpt"),
    };

    for (const [commandName, command] of Object.entries(prefixCommands)) {
      try {
        const message = createMockPrefixMessage(
          `!${commandName} test prompt`,
          testUserId
        );
        await command.execute(message, ["test", "prompt"], {
          user: { id: "some-id" },
        });
        expect(true, "Chạy lệnh", commandName, "!");
      } catch (error) {
        expect(false, error.message, commandName, "!");
      }
    }

    const table = new Table({
      head: [
        colorize("Lệnh", "cyan"),
        colorize("Mô tả", "cyan"),
        colorize("Kết quả", "cyan"),
      ],
      colWidths: [25, 45, 15],
      style: {
        head: [],
        border: ["gray"],
      },
      wordWrap: true,
    });

    for (const result of testResults) {
      if (result.command === "utils")
        table.push([result.message, "", result.result]);
    }

    table.push(
      ["---", "---", "---"],
      [{ content: "Slash Commands", colSpan: 3, hAlign: "center" }],
      ["---", "---", "---"]
    );
    for (const result of testResults) {
      if (result.command.startsWith("/"))
        table.push([result.command, result.message, result.result]);
    }

    table.push(
      ["---", "---", "---"],
      [{ content: "Prefix Commands", colSpan: 3, hAlign: "center" }],
      ["---", "---", "---"]
    );
    for (const result of testResults) {
      if (result.command.startsWith("!"))
        table.push([result.command, result.message, result.result]);
    }

    console.log(table.toString());
  } catch (error) {
    logFailure(`Test run failed: ${error.message}`);
    console.error(error);
  } finally {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
  }
}

module.exports = {
  runTests,
};
