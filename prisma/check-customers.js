import prisma from '../src/infrastructure/database/prisma.client.js';

const customers = await prisma.user.findMany({
  where: { role: 'CUSTOMER' },
  select: { astuEmail: true, status: true, isEmailVerified: true, failedLoginAttempts: true, lockedUntil: true },
  take: 5
});

console.log('Customer Accounts:', JSON.stringify(customers, null, 2));

const vendor = await prisma.user.findFirst({
  where: { role: 'VENDOR_STAFF' },
  select: { email: true, phoneNumber: true, status: true, isEmailVerified: true, isPhoneVerified: true }
});
console.log('Vendor Account:', JSON.stringify(vendor, null, 2));

await prisma.$disconnect();
