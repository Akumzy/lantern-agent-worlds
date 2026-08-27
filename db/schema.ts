import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('lantern_workspaces', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  payload: text('payload').notNull(),
  updatedAt: text('updated_at').notNull(),
});
