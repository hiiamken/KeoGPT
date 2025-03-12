const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const commands = [];
const commandsPath = path.join(__dirname, "interactions");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(
      `[⚠️ WARNING] Lệnh tại ${filePath} thiếu "data" hoặc "execute".`
    );
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🚀 Bắt đầu cập nhật ${commands.length} lệnh (/) lên máy chủ.`);

    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log(`✅ Đã tải lại ${data.length} lệnh thành công:`);
    data.forEach((cmd) => console.log(` - /${cmd.name}`));
  } catch (error) {
    console.error("❌ Lỗi khi deploy commands:", error);
  }
})();
