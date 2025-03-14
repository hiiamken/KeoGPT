const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const config = require("../config");
const { executeQuery } = require("../utils/database");

async function fetchRankingData(client) {
  try {
    const now = new Date();

    let result = await executeQuery(
      `SELECT userId, username, total_points as monthly_points
       FROM users
       WHERE username <> 'TestUser'
       ORDER BY monthly_points DESC
       LIMIT 10`
    );

    if (!result || result.length === 0) {
      return {
        noData: true,
        message: "⚠️ Không có dữ liệu xếp hạng tháng này.",
      };
    }

    const botName = client.user.username;
    let filteredResult = result.filter((row) => row.username !== botName);

    const guild = client.guilds.cache.get(config.guildId);
    if (guild) {
      await guild.members.fetch();

      for (let row of filteredResult) {
        const member = guild.members.cache.get(String(row.userId));
        if (member) {
          row.displayName = member.displayName;
        } else {
          row.displayName = row.username;
        }
      }
    }

    if (filteredResult.length < 10 && guild) {
      const rankingUserIds = new Set(
        filteredResult.map((r) => String(r.userId))
      );
      const candidates = guild.members.cache
        .filter(
          (member) =>
            !member.user.bot &&
            member.displayName !== "TestUser" &&
            member.displayName !== botName &&
            !rankingUserIds.has(member.user.id)
        )
        .map((member) => member.displayName);

      while (filteredResult.length < 10) {
        if (candidates.length === 0) break;
        const randIndex = Math.floor(Math.random() * candidates.length);
        const randomName = candidates[randIndex];
        filteredResult.push({
          userId: "N/A",
          username: randomName, // Lưu tạm
          displayName: randomName,
          monthly_points: 0,
        });
        candidates.splice(randIndex, 1);
      }
    }

    const botAvatar = client.user.displayAvatarURL
      ? client.user.displayAvatarURL()
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    const embed = new EmbedBuilder()
      .setColor("#CF86CA")
      .setTitle(
        `🏆 Bảng Xếp Hạng KeoGPT - Tháng ${
          now.getMonth() + 1
        }/${now.getFullYear()}`
      )
      .setThumbnail(botAvatar)
      .setDescription(
        "Top 10 gương mặt vàng KeoGPT! Hãy tích cực dùng lệnh `/ask`, `/reply`, `/new` để leo rank. " +
          "Đua nhau kiếm điểm và trở thành huyền thoại trong tháng!"
      )
      .setTimestamp();

    for (let i = 0; i < 10; i++) {
      const row = filteredResult[i];
      if (row) {
        const display = row.displayName || row.username || "Không tên";
        embed.addFields({
          name: `#${i + 1} ${display}`,
          value: `**Điểm:** ${row.monthly_points || 0}`,
          inline: false,
        });
      } else {
        embed.addFields({
          name: `#${i + 1}`,
          value: "Chưa có người dùng",
          inline: false,
        });
      }
    }

    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const remainingTime = Math.floor((nextReset - now) / 1000);
    const days = Math.floor(remainingTime / (24 * 3600));
    const hours = Math.floor((remainingTime % (24 * 3600)) / 3600);
    const minutes = Math.floor((remainingTime % 3600) / 60);

    embed.setFooter({
      text: `Bảng xếp hạng sẽ reset sau: ${days}d ${hours}h ${minutes}m`,
    });

    return { embeds: [embed] };
  } catch (error) {
    return { error: true, message: "❌ Có lỗi xảy ra khi lấy bảng xếp hạng." };
  }
}

async function handleRankingCommand(messageOrInteraction, client) {
  const rankingData = await fetchRankingData(client);
  if (rankingData.error) {
    return { content: rankingData.message };
  }
  if (rankingData.noData) {
    return { content: rankingData.message };
  }
  return rankingData;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ranking-gpt")
    .setDescription("Xem bảng xếp hạng người dùng (theo tháng).")
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const rankingData = await handleRankingCommand(
      interaction,
      interaction.client
    );
    await interaction.followUp(rankingData);
  },

  name: "ranking-gpt",
  description: "Xem bảng xếp hạng (prefix).",
  async executePrefix(message) {
    try {
      await message.channel.sendTyping();
      const rankingData = await handleRankingCommand(message, message.client);
      await message.channel.send(rankingData);
    } catch (error) {
      await message.channel.send("❌ Đã xảy ra lỗi khi lấy bảng xếp hạng.");
    }
  },

  handleRankingCommand,
};
