import { config } from 'dotenv';

config();

export default {
  schema: './prisma/schema.prisma',
  connectionString: process.env.DATABASE_URL,
};