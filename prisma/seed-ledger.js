import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import config from '../src/config/env.config.js';
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${config.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function seedLedger() {
  console.log('💰 Starting Isolated Ledger Seeder...');

  // 1. We need an order to attach these to
  const order = await prisma.order.findFirst();
  if (!order) {
    console.log('❌ No orders found! Please run the full seed first with: npm run db:seed');
    process.exit(1);
  }

  // 2. We need users to associate transactions to
  const users = await prisma.user.findMany({ take: 3 });
  if (users.length === 0) {
      console.log('❌ No users found! Please run the full seed first.');
      process.exit(1);
  }

  const entries = [];
  const numTransactions = 50;

  for (let i = 0; i < numTransactions; i++) {
    // Escrow entry
    entries.push({
      id: crypto.randomUUID(),
      orderId: order.id,
      userId: users[0].id,
      amount: 500.00 + (Math.random() * 100),
      type: 'ESCROW_RESERVE',
      status: 'COMPLETED'
    });

    // Platform Revenue (No user ID, belongs to system)
    entries.push({
      id: crypto.randomUUID(),
      orderId: order.id,
      userId: null,
      amount: 50.00 + (Math.random() * 20),
      type: 'PLATFORM_REVENUE',
      status: 'COMPLETED'
    });

    // Completed Reimbursement
    entries.push({
      id: crypto.randomUUID(),
      orderId: order.id,
      userId: users[1].id,
      amount: 450.00 + (Math.random() * 100),
      type: 'REIMBURSEMENT_PAYMENT',
      status: 'COMPLETED'
    });

    // Pending Reimbursement (Wait for Payout)
    entries.push({
        id: crypto.randomUUID(),
        orderId: order.id,
        userId: users[2].id,
        amount: 200.00 + (Math.random() * 50),
        type: 'REIMBURSEMENT_PAYMENT',
        status: 'PENDING'
      });

    // Refund
    if (i % 5 === 0) {
      entries.push({
        id: crypto.randomUUID(),
        orderId: order.id,
        userId: users[0].id,
        amount: 150.00,
        type: 'REFUND',
        status: 'COMPLETED'
      });
    }
  }

  // 3. Delete old ledger entries to reset the board (optional, but good for testing)
  await prisma.ledgerEntry.deleteMany();
  console.log('🧹 Cleared old ledger entries...');

  // 4. Insert new entries
  await prisma.ledgerEntry.createMany({ data: entries });
  console.log(`✅ Successfully seeded ${entries.length} realistic ledger entries!`);
}

seedLedger()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
