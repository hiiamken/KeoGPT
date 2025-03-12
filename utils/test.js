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
} = require("./database"); // ❌ Không gọi `closeDatabaseConnection`
const Table = require("cli-table3");
const fs = require("fs");

const TEST_DB_FILE = "test_database.sqlite";
const MAIN_DB_FILE = "database.sqlite";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
};

const symbols = {
  success: "✅",
  failure: "❌",
};

function colorize(text, color) {
  return colors[color] ? `${colors[color]}${colors.reset}` : text;
}

async function runTests() {
  console.log(colorize("🚀 KeoGPT Bot Test Suite 🚀", "blue"));

  // 👉 **Sao lưu database gốc trước khi test**
  if (fs.existsSync(MAIN_DB_FILE)) {
    fs.copyFileSync(MAIN_DB_FILE, `${MAIN_DB_FILE}.backup`);
  }

  // 👉 **Tạo database test riêng**
  if (fs.existsSync(TEST_DB_FILE)) {
    fs.unlinkSync(TEST_DB_FILE); // Xóa file cũ (nếu có)
  }
  fs.copyFileSync(MAIN_DB_FILE, TEST_DB_FILE);

  process.env.DATABASE_FILE = TEST_DB_FILE; // Chỉ định sử dụng DB test
  const db = getDatabaseInstance();

  const testResults = [];
  const testUserId = "test-user-id-123";
  const testUserName = "TestUser";

  function expect(condition, message, commandName, type) {
    const result = condition
      ? `${symbols.success} ${colorize("PASS", "green")}`
      : `${symbols.failure} ${colorize("FAIL", "red")}`;
    testResults.push({ command: `${type} ${commandName}`, message, result });
  }

  try {
    // 🛠️ **Chạy các lệnh test trên database test**
    const dbTests = [
      { func: () => insertOrUpdateUser(testUserId, testUserName), name: "insertOrUpdateUser" },
      { func: deleteExpiredThreads, name: "deleteExpiredThreads" },
      { func: resetAllPoints, name: "resetAllPoints" },
    ];

    for (const test of dbTests) {
      try {
        await test.func();
        expect(true, `Chạy ${test.name}`, test.name, "DB");
      } catch (error) {
        expect(false, error.message, test.name, "DB");
      }
    }

    // 🛠️ **Chạy lệnh bot**
    async function testCommands(commandList, type) {
      for (const [commandName, command] of Object.entries(commandList)) {
        if (!command || typeof command.execute !== "function") {
          expect(false, `Lệnh ${commandName} không có function execute()`, commandName, type);
          continue;
        }

        try {
          if (type === "/") {
            const params = commandName === "ask"
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
              editReply: async (msg) => console.log("✅ [Mock] editReply() called with:", msg),
            };

            await command.execute(interaction, db);
          } else {
            const message = createMockPrefixMessage(
              `!${commandName} test prompt`,
              testUserId,
              config.allowedChannelId
            );

            await command.execute(message, ["test", "prompt"], { user: { id: "some-id" } }, db);
          }

          expect(true, `Chạy lệnh ${commandName}`, commandName, type);
        } catch (error) {
          expect(false, error.message, commandName, type);
        }
      }
    }

    const loadCommandSafely = (path) => {
      try {
        return require(path);
      } catch (error) {
        console.error(colorize(`⚠️ Lỗi khi load ${path}: ${error.message}`, "red"));
        return null;
      }
    };

    const slashCommands = {
      ask: loadCommandSafely("../commands/ask"),
      reply: loadCommandSafely("../commands/reply"),
      new: loadCommandSafely("../commands/new"),
      clear: loadCommandSafely("../commands/clear"),
      gpthelp: loadCommandSafely("../commands/gpthelp"),
      cleardata: loadCommandSafely("../commands/cleardata"),
      lang: loadCommandSafely("../commands/lang"),
      stats: loadCommandSafely("../commands/stats"),
      "ranking-gpt": loadCommandSafely("../commands/ranking-gpt"),
    };

    const prefixCommands = {
      ask: loadCommandSafely("../prefixcommands/ask"),
      reply: loadCommandSafely("../prefixcommands/reply"),
      new: loadCommandSafely("../prefixcommands/new"),
      clear: loadCommandSafely("../prefixcommands/clear"),
      gpthelp: loadCommandSafely("../prefixcommands/gpthelp"),
      lang: loadCommandSafely("../prefixcommands/lang"),
      cleardata: loadCommandSafely("../prefixcommands/cleardata"),
      stats: loadCommandSafely("../prefixcommands/stats"),
      "ranking-gpt": loadCommandSafely("../prefixcommands/ranking-gpt"),
    };

    await testCommands(slashCommands, "/");
    await testCommands(prefixCommands, "!");

    // 📊 Hiển thị bảng kết quả test
    const table = new Table({
      head: [
        colorize("Lệnh", "cyan"),
        colorize("Mô tả", "cyan"),
        colorize("Kết quả", "cyan"),
      ],
      colWidths: [25, 45, 15],
      style: { head: [], border: ["gray"] },
      wordWrap: true,
    });

    for (const result of testResults) {
      table.push([result.command, result.message, result.result]);
    }

    console.log(table.toString());
  } catch (error) {
    console.error(colorize(`❌ Test run failed: ${error.message}`, "red"));
  } finally {
    console.log(colorize("🔄 Bắt đầu quá trình khôi phục database...", "cyan"));

if (fs.existsSync(`${MAIN_DB_FILE}.backup`)) {
  console.log("📂 Khôi phục database từ bản sao lưu...");
  fs.copyFileSync(`${MAIN_DB_FILE}.backup`, MAIN_DB_FILE);
  fs.unlinkSync(`${MAIN_DB_FILE}.backup`);
}

if (fs.existsSync(TEST_DB_FILE)) {
  console.log("🗑️ Xóa database test...");
  fs.unlinkSync(TEST_DB_FILE);
}

console.log(colorize("🛠 Test completed and database restored.", "yellow"));

  }
}

module.exports = {
  runTests,
};
