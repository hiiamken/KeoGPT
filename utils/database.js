// utils/database.js
const mysql = require("mysql2/promise");
require("dotenv").config();

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "discord_bot_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Database connection successful!");
    connection.release();
  } catch (error) {
    console.error("Error connecting to database:", error);
    if (error.code === "ER_ACCESS_DENIED_ERROR") {
      console.error("   ->  Check your MySQL username and password.");
    } else if (error.code === "ER_BAD_DB_ERROR") {
      console.error("   ->  Check your database name.");
    } else if (error.code === "ECONNREFUSED") {
      console.error(
        "   ->  Check if MySQL server is running and the host/port are correct."
      );
    }
    process.exit(1);
  }
}

testConnection();

async function executeQuery(sql, params = []) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows, fields] = await connection.execute(sql, params);
    return rows;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function updateThreadLanguage(threadId, language) {
  await executeQuery("UPDATE threads SET language = ? WHERE threadId = ?", [
    language,
    threadId,
  ]);
}

async function getThreadHistory(threadId, limit) {
  const [rows] = await executeQuery(
    "SELECT message, ai_response FROM messages WHERE threadId = ? ORDER BY timestamp ASC LIMIT ?",
    [threadId, limit]
  );
  return rows;
}

async function saveThreadInfo(threadId, userId, prompt, language, expiresAt) {
  await executeQuery(
    "INSERT INTO threads (threadId, userId, prompt, language, expiresAt) VALUES (?, ?, ?, ?, ?)",
    [threadId, userId, prompt, language, expiresAt]
  );
}

async function saveMessage(
  threadId,
  userId,
  message,
  isPrompt,
  aiResponse = null
) {
  await executeQuery(
    "INSERT INTO messages (threadId, userId, message, timestamp, isPrompt, ai_response) VALUES (?, ?, ?, NOW(), ?, ?)",
    [threadId, userId, message, isPrompt, aiResponse]
  );
}

module.exports = {
  pool,
  executeQuery,
  updateThreadLanguage,
  getThreadHistory,
  saveThreadInfo,
  saveMessage,
};
