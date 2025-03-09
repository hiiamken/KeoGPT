// prefixcommands/help.js
const { handleHelpCommand } = require("../commands/gpthelp");

module.exports = {
  name: "gpthelp",
  description: "Hiển thị hướng dẫn (prefix).",
  execute(message) {
    handleHelpCommand(message);
  },
};
