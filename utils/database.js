const mysql = require("mysql2/promise");
const knex = require("knex");
const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config();

let dbInstance = null;
let dbType = null;

async function initializeDatabase(retries = 5, delay = 3000) {
  const config = require("../config");
  dbType = config.databaseType || "mysql";

  if (dbType === "mysql") {
    const dbConfig = {
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "discord_bot_db",
      waitForConnections: true,
      connectionLimit: 50,
      queueLimit: 0,
      charset: "utf8mb4",
    };
    dbInstance = mysql.createPool(dbConfig);

    for (let i = 0; i < retries; i++) {
      try {
        const connection = await dbInstance.getConnection();
        connection.release();
        console.log("✅ MySQL connected successfully!");
        await createTablesMySQL();
        return;
      } catch (error) {
        console.error(
          `⚠️ MySQL connection failed (attempt ${i + 1}/${retries}):`,
          error
        );
        if (i < retries - 1) {
          await new Promise((res) => setTimeout(res, delay));
        } else {
          console.error("❌ Unable to connect to MySQL. Exiting...");
          process.exit(1);
        }
      }
    }
  } else if (dbType === "sqlite") {
    const dbPath = path.join(__dirname, "..", "database.sqlite");
    const dbExists = fs.existsSync(dbPath);
    dbInstance = knex({
      client: "sqlite3",
      connection: { filename: dbPath },
      useNullAsDefault: true,
      pool: { min: 1, max: 1 },
    });

    if (!dbExists) {
      console.log("📂 SQLite database created.");
      await createTablesSQLite();
    } else {
      try {
        const result = await executeQuery("PRAGMA table_info(users)");

        if (result && Array.isArray(result)) {
          const columns = result;
          if (!columns.some((col) => col.name === "monthly_points")) {
            await executeQuery(
              "ALTER TABLE users ADD COLUMN monthly_points INTEGER DEFAULT 0"
            );
            console.log("✅ Added monthly_points column to users.");
          }
        }
      } catch (err) {
        if (!err.message.toLowerCase().includes("duplicate column name")) {
          console.error("❌ Error checking/adding monthly_points column:", err);
        }
      }
    }
  } else {
    console.error(
      "❌ Invalid databaseType in config.js. Must be 'mysql' or 'sqlite'."
    );
    process.exit(1);
  }
}

async function executeQuery(sql, params = []) {
  if (!dbInstance) {
    console.error("❌ Database connection is null. Reinitializing...");
    await initializeDatabase();
  }
  if (!dbInstance) {
    throw new Error("❌ Database connection failed after reinitialization.");
  }
  try {
    return await dbInstance.raw(sql, params);
  } catch (error) {
    console.error("❌ Database query error:", error, sql, params);
    throw error;
  }
}

async function beginTransaction() {
  return null;
}

async function commitTransaction(transaction) {}

async function rollbackTransaction(transaction) {}

async function ensureUserExists(userId, username) {
  try {
    const result = await executeQuery(
      "SELECT userId FROM users WHERE userId = ?",
      [userId]
    );
    if (!result || result.length === 0) {
      await executeQuery(
        "INSERT INTO users (userId, username, total_threads, total_points, monthly_points) VALUES (?, ?, 0, 0, 0)",
        [userId, username]
      );
    }
  } catch (error) {
    console.error(`❌ Lỗi khi kiểm tra/thêm userId ${userId}:`, error);
  }
}

async function ensureThreadExists(threadId) {
  try {
    const result = await executeQuery(
      "SELECT threadId FROM threads WHERE threadId = ?",
      [threadId]
    );
    return result && result.length > 0;
  } catch (error) {
    console.error(`❌ Lỗi khi kiểm tra threadId ${threadId}:`, error);
    return false;
  }
}

async function insertOrUpdateUser(userId, username) {
  try {
    const sql =
      dbType === "mysql"
        ? "INSERT INTO users (userId, username) VALUES (?, ?) ON DUPLICATE KEY UPDATE username = VALUES(username)"
        : "INSERT INTO users (userId, username) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET username = excluded.username";
    await executeQuery(sql, [userId, username]);
  } catch (error) {
    console.error("❌ Lỗi khi thêm/cập nhật user:", error);
  }
}

async function deleteExpiredThreads() {
  try {
    const sql =
      dbType === "mysql"
        ? "DELETE FROM threads WHERE expiresAt < NOW()"
        : "DELETE FROM threads WHERE expiresAt < datetime('now')";
    await executeQuery(sql);
    console.log("✅ Các thread hết hạn đã được xóa.");
  } catch (error) {
    console.error("❌ Lỗi khi xóa thread hết hạn:", error);
  }
}

async function resetAllPoints() {
  try {
    await executeQuery("UPDATE users SET total_points = 0, monthly_points = 0");
    console.log("✅ Điểm của tất cả người dùng đã được reset.");
  } catch (error) {
    console.error("❌ Lỗi khi reset điểm:", error);
  }
}

async function resetMonthlyPoints() {
  try {
    await executeQuery("UPDATE users SET monthly_points = 0");
    console.log("✅ Điểm tháng đã được reset cho tất cả người dùng.");
  } catch (error) {
    console.error("❌ Lỗi khi reset điểm tháng:", error);
  }
}

async function saveMessage(threadId, userId, message, isPrompt, aiResponse) {
  try {
    await ensureUserExists(userId, "UnknownUser");
    const threadExists = await ensureThreadExists(threadId);
    if (!threadExists) return;
    const sanitizedMessage = Array.isArray(message)
      ? message.join(" ")
      : message;
    const timestamp = new Date().toISOString();
    await executeQuery(
      "INSERT INTO messages (threadId, userId, message, isPrompt, ai_response, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [threadId, userId, sanitizedMessage, isPrompt, aiResponse, timestamp]
    );
  } catch (error) {
    console.error("❌ Lỗi khi lưu tin nhắn:", error);
    throw error;
  }
}

async function getThreadHistory(threadId, limit = 10) {
  try {
    return await executeQuery(
      "SELECT message, ai_response FROM messages WHERE threadId = ? ORDER BY timestamp DESC LIMIT ?",
      [threadId, limit]
    );
  } catch (error) {
    console.error(`❌ Lỗi khi lấy lịch sử thread ${threadId}:`, error);
    return [];
  }
}

async function closeDatabaseConnection() {
  if (dbInstance) {
    try {
      if (dbType === "mysql") {
        await dbInstance.end();
      } else {
        dbInstance.destroy();
      }
      console.log("🚪 Database connection closed.");
    } catch (error) {
      console.error("❌ Error closing database connection:", error);
    }
    dbInstance = null;
  }
}

async function saveThreadInfo(threadId, userId, prompt, language, expiresAt) {
  try {
    const result = await executeQuery(
      "SELECT threadId FROM threads WHERE threadId = ?",
      [threadId]
    );
    if (result && result.length > 0) {
      await executeQuery(
        "UPDATE threads SET userId = ?, prompt = ?, language = ?, expiresAt = ? WHERE threadId = ?",
        [userId, prompt, language, expiresAt, threadId]
      );
      console.log(`🔄 Cập nhật thông tin thread ${threadId} thành công.`);
    } else {
      await executeQuery(
        "INSERT INTO threads (threadId, userId, prompt, language, expiresAt) VALUES (?, ?, ?, ?, ?)",
        [threadId, userId, prompt, language, expiresAt]
      );
      console.log(`✅ Thêm thread ${threadId} vào database.`);
    }
  } catch (error) {
    console.error(`❌ Lỗi khi lưu thông tin thread ${threadId}:`, error);
    throw error;
  }
}

function getDatabaseInstance() {
  return dbInstance;
}

async function getDailyTokenUsage(userId) {
  const today = new Date().toISOString().split("T")[0];
  const result = await executeQuery(
    "SELECT total_tokens FROM daily_token_usage WHERE userId = ? AND date = ?",
    [userId, today]
  );
  return result && result.length > 0 ? result[0].total_tokens : 0;
}

async function updateDailyTokenUsage(userId, tokensUsed) {
  const today = new Date().toISOString().split("T")[0];
  await executeQuery(
    `INSERT INTO daily_token_usage (userId, date, total_tokens)
     VALUES (?, ?, ?)
     ON CONFLICT(userId, date) DO UPDATE SET total_tokens = total_tokens + ?`,
    [userId, today, tokensUsed, tokensUsed]
  );
}

async function resetDailyTokenUsage() {
  const today = new Date().toISOString().split("T")[0];
  await executeQuery(
    "UPDATE daily_token_usage SET total_tokens = 0 WHERE date = ?",
    [today]
  );
}

async function createTablesMySQL() {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS users (
      userId VARCHAR(255) NOT NULL PRIMARY KEY,
      username VARCHAR(255),
      total_threads INT DEFAULT 0,
      total_points INT DEFAULT 0,
      monthly_points INT DEFAULT 0
    )
  `);

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS threads (
      threadId VARCHAR(255) NOT NULL PRIMARY KEY,
      userId VARCHAR(255),
      prompt TEXT,
      language VARCHAR(10),
      expiresAt DATETIME,
      FOREIGN KEY (userId) REFERENCES users(userId)
    )
  `);

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS messages (
      messageId INT AUTO_INCREMENT PRIMARY KEY,
      threadId VARCHAR(255),
      userId VARCHAR(255),
      message TEXT,
      isPrompt BOOLEAN,
      ai_response TEXT,
      timestamp DATETIME,
      FOREIGN KEY (threadId) REFERENCES threads(threadId)
    )
  `);

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS daily_token_usage (
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      total_tokens INTEGER DEFAULT 0,
      PRIMARY KEY (userId, date)
    )
  `);
}

async function createTablesSQLite() {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS users (
      userId TEXT NOT NULL PRIMARY KEY,
      username TEXT,
      total_threads INTEGER DEFAULT 0,
      total_points INTEGER DEFAULT 0,
      monthly_points INTEGER DEFAULT 0
    )
  `);

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS threads (
      threadId TEXT NOT NULL PRIMARY KEY,
      userId TEXT,
      prompt TEXT,
      language TEXT,
      expiresAt TEXT,
      FOREIGN KEY (userId) REFERENCES users(userId)
    )
  `);

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS messages (
      messageId INTEGER PRIMARY KEY AUTOINCREMENT,
      threadId TEXT,
      userId TEXT,
      message TEXT,
      isPrompt INTEGER,
      ai_response TEXT,
      timestamp TEXT,
      FOREIGN KEY (threadId) REFERENCES threads(threadId)
    )
  `);

  await executeQuery(`
    CREATE TABLE IF NOT EXISTS daily_token_usage (
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      total_tokens INTEGER DEFAULT 0,
      PRIMARY KEY (userId, date)
    )
  `);
}

module.exports = {
  initializeDatabase,
  executeQuery,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  ensureUserExists,
  ensureThreadExists,
  insertOrUpdateUser,
  deleteExpiredThreads,
  resetAllPoints,
  resetMonthlyPoints,
  saveMessage,
  closeDatabaseConnection,
  getDatabaseInstance,
  getThreadHistory,
  saveThreadInfo,
  getDailyTokenUsage,
  updateDailyTokenUsage,
  resetDailyTokenUsage,
};
