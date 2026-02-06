import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || '../bot-data/scheduler.db',
  },
});
