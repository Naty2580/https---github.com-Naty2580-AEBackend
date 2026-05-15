import prisma from '../src/infrastructure/database/prisma.client.js';

const result = await prisma.user.updateMany({
  where: { lockedUntil: { not: null } },
  data: { failedLoginAttempts: 0, lockedUntil: null }
});

console.log(`✅ Unlocked ${result.count} account(s).`);
await prisma.$disconnect();
