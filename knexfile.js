require("dotenv").config();
const path = require("path");

module.exports = {
  development: {
    client: "better-sqlite3",
    connection: {
      filename: path.join(__dirname, "./database.sqlite"),
    },
    migrations: {
      directory: path.join(__dirname, "./migrations"),
    },
    seeds: {
      directory: path.join(__dirname, "./seeds"),
    },
    useNullAsDefault: true,
    pool: {
      min: 2,
      max: 50,
    },
  },

  production: {
    client: "mysql2",
    connection: {
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "keogpt",
      charset: "utf8mb4",
      port: process.env.DB_PORT || 3306,
    },
    migrations: {
      directory: path.join(__dirname, "./migrations"),
    },
    seeds: {
      directory: path.join(__dirname, "./seeds"),
    },
    pool: {
      min: 2,
      max: 100,
    },
  },

  staging: {
    client: "mysql2",
    connection: {
      host: process.env.STAGING_DB_HOST || "localhost",
      user: process.env.STAGING_DB_USER || "root",
      password: process.env.STAGING_DB_PASSWORD || "",
      database: process.env.STAGING_DB_NAME || "keogpt_staging",
      charset: "utf8mb4",
      port: process.env.STAGING_DB_PORT || 3306,
    },
    migrations: {
      directory: path.join(__dirname, "./migrations"),
    },
    seeds: {
      directory: path.join(__dirname, "./seeds"),
    },
    pool: {
      min: 2,
      max: 50,
    },
  },

  test: {
    client: "better-sqlite3",
    connection: {
      filename: path.join(__dirname, "./test.sqlite"),
    },
    migrations: {
      directory: path.join(__dirname, "./migrations"),
    },
    seeds: {
      directory: path.join(__dirname, "./seeds"),
    },
    useNullAsDefault: true,
  },
};
