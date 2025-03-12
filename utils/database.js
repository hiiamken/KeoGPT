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
    };
    dbInstance = mysql.createPool(dbConfig);

    for (let i = 0; i < retries; i++) {
      try {
        const connection = await dbInstance.getConnection();
        connection.release();
        console.log("✅ MySQL connected successfully!");
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
      client: "better-sqlite3",
      connection: { filename: dbPath },
      useNullAsDefault: true,
      pool: { min: 2, max: 50 },
    });

    await dbInstance.raw("PRAGMA journal_mode = WAL");
    await dbInstance.raw("PRAGMA busy_timeout = 10000");

    if (!dbExists) {
      console.log("📂 SQLite database created.");
      await createTables();
    }
  } else {
    console.error(
      "❌ Invalid databaseType in config.js. Must be 'mysql' or 'sqlite'."
    );
    process.exit(1);
  }
}

async function executeQuery(sql, params = [], trx = null) {
  if (!dbInstance) {
    console.error("❌ Database connection is null. Reinitializing...");
    await initializeDatabase();
  }

  if (!dbInstance) {
    throw new Error("❌ Database connection failed after reinitialization.");
  }

  try {
    return trx ? await trx.raw(sql, params) : await dbInstance.raw(sql, params);
  } catch (error) {
    console.error("❌ Database query error:", error, sql, params);
    throw error;
  }
}

async function beginTransaction() {
  if (dbType === "mysql") {
    const connection = await dbInstance.getConnection();
    await connection.beginTransaction();
    return connection;
  } else if (dbType === "sqlite") {
    return dbInstance.transaction();
  }
  throw new Error("Unsupported database type for transactions.");
}

async function commitTransaction(transaction) {
  if (!transaction) return;
  if (dbType === "mysql") {
    await transaction.commit();
    transaction.release();
  } else {
    await transaction.commit();
  }
}

async function rollbackTransaction(transaction) {
  if (!transaction) return;
  if (dbType === "mysql") {
    await transaction.rollback();
    transaction.release();
  } else {
    await transaction.rollback();
  }
}

async function ensureUserExists(userId, username) {
  try {
    const checkUser = await executeQuery(
      "SELECT userId FROM users WHERE userId = ?",
      [userId]
    );
    if (checkUser.length === 0) {
      await executeQuery(
        "INSERT INTO users (userId, username, total_threads, total_points) VALUES (?, ?, 0, 0)",
        [userId, username]
      );
    }
  } catch (error) {
    console.error(`❌ Lỗi khi kiểm tra/thêm userId ${userId}:`, error);
  }
}

async function ensureThreadExists(threadId) {
  try {
    const checkThread = await executeQuery(
      "SELECT threadId FROM threads WHERE threadId = ?",
      [threadId]
    );
    return checkThread.length > 0;
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
    await executeQuery("UPDATE users SET total_points = 0");
    console.log("✅ Điểm của tất cả người dùng đã được reset.");
  } catch (error) {
    console.error("❌ Lỗi khi reset điểm:", error);
  }
}

async function saveMessage(
  threadId,
  userId,
  message,
  isPrompt,
  aiResponse,
  trx = null
) {
  try {
    await ensureUserExists(userId, "UnknownUser");

    const threadExists = await ensureThreadExists(threadId);
    if (!threadExists) return;

    const timestamp = new Date().toISOString();
    await executeQuery(
      "INSERT INTO messages (threadId, userId, message, isPrompt, ai_response, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [threadId, userId, message, isPrompt, aiResponse, timestamp],
      trx
    );
  } catch (error) {
    console.error("❌ Lỗi khi lưu tin nhắn:", error);
    throw error;
  }
}

/**
 * 🔍 Lấy lịch sử tin nhắn của thread (giới hạn số lượng)
 */
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

/**
 * 🔄 Đóng kết nối database
 */
async function closeDatabaseConnection() {
  if (dbInstance) {
    try {
      await dbInstance.destroy();
      console.log("🔄 Database connection closed.");
    } catch (error) {
      console.error("❌ Error closing database connection:", error);
    }
    dbInstance = null;
  }
}

async function saveThreadInfo(threadId, userId, prompt, language, expiresAt) {
  try {
    const existingThread = await executeQuery(
      "SELECT threadId FROM threads WHERE threadId = ?",
      [threadId]
    );

    if (existingThread.length > 0) {
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
  saveMessage,
  closeDatabaseConnection,
  getDatabaseInstance,
  getThreadHistory,
  saveThreadInfo,
};
