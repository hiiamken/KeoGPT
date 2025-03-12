exports.up = function (knex) {
  return knex.schema
    .createTable("users", function (table) {
      table.bigInteger("userId").primary();
      table.string("username").notNullable();
      table.integer("total_threads").defaultTo(0);
      table.integer("total_points").defaultTo(0);
      table.datetime("last_reset");
    })
    .createTable("threads", function (table) {
      table.string("threadId").primary();
      table.bigInteger("userId").notNullable();
      table.text("prompt");
      table.string("language");
      table.datetime("expiresAt");
      table.datetime("createdAt").defaultTo(knex.fn.now());
      table.integer("points").defaultTo(0);
      table.foreign("userId").references("users.userId").onDelete("CASCADE");
    })
    .createTable("messages", function (table) {
      table.increments("messageId").primary();
      table.string("threadId").notNullable();
      table.bigInteger("userId").notNullable();
      table.text("message");
      table.datetime("timestamp").defaultTo(knex.fn.now());
      table.boolean("isPrompt");
      table.text("ai_response");
      table
        .foreign("threadId")
        .references("threads.threadId")
        .onDelete("CASCADE");
      table.foreign("userId").references("users.userId").onDelete("CASCADE");
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists("messages")
    .dropTableIfExists("threads")
    .dropTableIfExists("users");
};
