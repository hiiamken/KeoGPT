exports.up = function(knex) {
  return knex.schema
      .createTable('users', function (table) {
          table.bigInteger('userId').primary(); // Sử dụng bigInteger cho ID Discord
          table.string('username').notNullable();
          table.integer('total_threads').defaultTo(0);
          table.integer('total_points').defaultTo(0);
          table.datetime('last_reset');
      })
      .createTable('threads', function (table) {
          table.string('threadId').primary();
          table.bigInteger('userId').notNullable();
          table.text('prompt'); // Sử dụng text() cho câu hỏi dài
          table.string('language');
          table.datetime('expiresAt');
          table.datetime('createdAt').defaultTo(knex.fn.now()); // Mặc định là thời gian hiện tại
          table.integer('points').defaultTo(0);
          table.foreign('userId').references('users.userId').onDelete("CASCADE"); // Nếu user bị xóa, xóa luôn threads
      })
      .createTable('messages', function(table) {
          table.increments('messageId').primary(); // Tự động tăng ID tin nhắn
          table.string('threadId').notNullable();
          table.bigInteger('userId').notNullable();
          table.text('message');
          table.datetime('timestamp').defaultTo(knex.fn.now()); // Lưu timestamp tự động
          table.boolean('isPrompt');
          table.text('ai_response');
          table.foreign('threadId').references('threads.threadId').onDelete("CASCADE"); // Nếu thread bị xóa, xóa luôn messages
          table.foreign('userId').references('users.userId').onDelete("CASCADE"); // Nếu user bị xóa, xóa luôn messages
      });
};

exports.down = function(knex) {
  return knex.schema
      .dropTableIfExists('messages')
      .dropTableIfExists('threads')
      .dropTableIfExists('users');
};
