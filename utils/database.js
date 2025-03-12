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
                return;
            } catch (error) {
                console.error(`⚠️ MySQL connection failed (attempt ${i + 1}/${retries}):`, error);
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

        if (!dbExists) await createTables();
    } else {
        console.error("❌ Invalid databaseType in config.js. Must be 'mysql' or 'sqlite'.");
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

    // Nếu có transaction thì dùng trx.raw
    if (trx) {
        return await trx.raw(sql, params);
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await dbInstance.raw(sql, params);
        } catch (error) {
            if (error.code === "SQLITE_BUSY" && attempt < 3) {
                console.warn(`⚠️ Database locked, retrying (${attempt}/3)...`);
                await new Promise((res) => setTimeout(res, 1000));
            } else {
                console.error("❌ Database query error:", error, sql, params);
                throw error;
            }
        }
    }
}

async function beginTransaction() {
    if (dbType === "mysql") {
        const connection = await dbInstance.getConnection();
        await connection.beginTransaction();
        return connection;
    } else if (dbType === "sqlite") {
        // Với knex, transaction() trả về một đối tượng trx
        return dbInstance.transaction();
    }
    throw new Error("Unsupported database type for transactions.");
}

async function commitTransaction(transaction) {
    if (!transaction) return;
    if (dbType === "mysql") {
        await transaction.commit();
        transaction.release();
    } else if (dbType === "sqlite") {
        await transaction.commit();
    }
}

async function rollbackTransaction(transaction) {
    if (!transaction) return;
    if (dbType === "mysql") {
        await transaction.rollback();
        transaction.release();
    } else if (dbType === "sqlite") {
        await transaction.rollback();
    }
}

async function insertOrUpdateUser(userId, username) {
    const sql =
        dbType === "mysql"
            ? "INSERT INTO users (userId, username) VALUES (?, ?) ON DUPLICATE KEY UPDATE username = VALUES(username)"
            : "INSERT INTO users (userId, username) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET username = ?";
    const params = dbType === "mysql" ? [userId, username] : [userId, username, username];

    try {
        await executeQuery(sql, params);
    } catch (error) {
        console.error("❌ Error inserting/updating user:", error);
        throw error;
    }
}

async function deleteExpiredThreads() {
    try {
        const sql =
            dbType === "mysql"
                ? "DELETE FROM threads WHERE expiresAt < NOW()"
                : "DELETE FROM threads WHERE expiresAt < datetime('now')";
        await executeQuery(sql);
    } catch (error) {
        console.error("❌ Error deleting expired threads:", error);
        throw error;
    }
}

async function resetAllPoints() {
    try {
        await executeQuery("UPDATE users SET total_points = 0");
    } catch (error) {
        console.error("❌ Lỗi reset điểm:", error);
    }
}

async function updateThreadLanguage(threadId, language) {
    try {
        await executeQuery("UPDATE threads SET language = ? WHERE threadId = ?", [language, threadId]);
    } catch (error) {
        console.error("❌ Error updating thread language:", error);
        throw error;
    }
}

async function getThreadHistory(threadId, limit) {
    try {
        return await executeQuery(
            "SELECT message, ai_response FROM messages WHERE threadId = ? ORDER BY timestamp ASC LIMIT ?",
            [threadId, limit]
        );
    } catch (error) {
        console.error("❌ Error getting thread history:", error);
        throw error;
    }
}

async function saveThreadInfo(threadId, userId, prompt, language, expiresAt, trx = null) {
    try {
        await executeQuery(
            "INSERT INTO threads (threadId, userId, prompt, language, expiresAt) VALUES (?, ?, ?, ?, ?)",
            [threadId, userId, prompt, language, expiresAt],
            trx
        );
    } catch (error) {
        console.error("❌ Error saving thread info:", error);
        throw error;
    }
}

async function saveMessage(threadId, userId, message, aiResponse) {
  try {
      // Kiểm tra threadId có tồn tại không trước khi chèn tin nhắn
      const checkThreadExists = await executeQuery(
          "SELECT threadId FROM threads WHERE threadId = ?",
          [threadId]
      );

      if (checkThreadExists.length === 0) {
          console.error(`❌ Lỗi: Không thể lưu tin nhắn vì threadId ${threadId} không tồn tại trong bảng threads.`);
          return;
      }

      // Nếu threadId hợp lệ, tiếp tục lưu tin nhắn
      await executeQuery(
          "INSERT INTO messages (threadId, userId, message, ai_response, timestamp) VALUES (?, ?, ?, ?, ?)",
          [threadId, userId, message, aiResponse, new Date().toISOString()]
      );
  } catch (error) {
      console.error("❌ Error saving message:", error);
      throw error;
  }
}

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

module.exports = {
    initializeDatabase,
    executeQuery,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    updateThreadLanguage,
    getThreadHistory,
    saveThreadInfo,
    insertOrUpdateUser,
    deleteExpiredThreads,
    resetAllPoints,
    saveMessage,
    closeDatabaseConnection,
    getDatabaseInstance: () => dbInstance,
};
