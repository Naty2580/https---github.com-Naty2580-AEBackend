import prisma from '../src/infrastructure/database/prisma.client.js';

const admins = await prisma.user.findMany({
  where: { role: 'ADMIN' },
  select: { astuEmail: true, status: true, isEmailVerified: true, failedLoginAttempts: true, lockedUntil: true }
});

console.log(JSON.stringify(admins, null, 2));
await prisma.$disconnect();
