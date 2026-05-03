import  { PrismaClient} from '@prisma/client';
import  config from '../../config/env.config.js';
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma Singleton Pattern
 * Prevents multiple instances of Prisma Client in development (which causes connection limits)
 * Configures query logging based on the environment.
 */

const connectionString = `${config.DATABASE_URL}`;


 const adapter = new PrismaPg({ connectionString });
 const prisma =  new PrismaClient({ adapter });

export default prisma;



