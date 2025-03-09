// utils/test.js
const {
  createMockSlashInteraction,
  createMockPrefixMessage,
} = require("../utils/discord");
const config = require("../config");
const db = require("./database");
const { generateTitle } = require("./gemini");
const fs = require("node:fs");
const path = require("node:path");
const Table = require("cli-table3");
async function runTests() {
  const testResults = [];

  function expect(condition, message, commandName, type) {
    const result = condition ? "✅" : "❌";
    testResults.push({
      command: `${type} ${commandName}`,
      message: message,
      result: result,
    });
    return condition;
  }

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
    testResults.push({ command: "utils", message: "Gemini API", result: "✅" });
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
  };

  for (const [commandName, command] of Object.entries(slashCommands)) {
    try {
      const interaction = createMockSlashInteraction(commandName, {
        prompt: "test prompt",
        language: "vi",
      });
      await command.execute(interaction);
      expect(true, "Chạy lệnh", commandName, "/");
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
  };

  for (const [commandName, command] of Object.entries(prefixCommands)) {
    try {
      const message = createMockPrefixMessage(`!${commandName} test prompt`);
      await command.execute(message, ["test", "prompt"]);
      expect(true, "Chạy lệnh", commandName, "!");
    } catch (error) {
      expect(false, error.message, commandName, "!");
    }
  }

  const table = new Table({
    head: ["Tính năng", "Trạng thái"],
    colWidths: [30, 50],
    style: { head: ["cyan"] },
  });

  for (const result of testResults) {
    if (result.command === "utils") table.push([result.message, result.result]);
  }

  table.push(
    ["---", "---"],
    [{ content: "Slash Commands", colSpan: 2, hAlign: "center" }],
    ["---", "---"]
  );

  for (const result of testResults) {
    if (result.command.startsWith("/"))
      table.push([result.command, result.result]);
  }

  table.push(
    ["---", "---"],
    [{ content: "Prefix Commands", colSpan: 2, hAlign: "center" }],
    ["---", "---"]
  );
  for (const result of testResults) {
    if (result.command.startsWith("!"))
      table.push([result.command, result.result]);
  }

  console.log(table.toString());
}

module.exports = {
  runTests,
};
