require('dotenv').config(); // Load .env if you haven't already
const path = require('path');

module.exports = {
  development: { // Cấu hình cho development (mặc định)
    client: 'better-sqlite3', // Hoặc 'mysql', tùy bạn chọn môi trường mặc định
    connection: {
      filename: path.join(__dirname, './database.sqlite') // Đường dẫn đến file SQLite
    },
    migrations: {
      directory: path.join(__dirname, './migrations') // Thư mục chứa migrations
    },
    useNullAsDefault: true, // Bắt buộc với SQLite
    pool: { // Thêm cấu hình pool
      min: 2,
      max: 50 // Tăng giá trị max để cho phép nhiều kết nối hơn
    }
  },

  // Cấu hình cho MySQL (nếu bạn muốn)
  mysql: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    migrations: {
      directory: path.join(__dirname, './migrations') // Cùng thư mục với SQLite
    }
  },

  // Bạn có thể thêm các môi trường khác (production, staging,...)
};