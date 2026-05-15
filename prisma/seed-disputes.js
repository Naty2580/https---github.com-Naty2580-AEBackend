import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import config from '../src/config/env.config.js';
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${config.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function seedDisputes() {
  console.log('⚖️ Starting Isolated Dispute Seeder...');

  // Get orders that are delivered, disputed, or cancelled to attach disputes to
  const orders = await prisma.order.findMany({ take: 20 });
  if (orders.length === 0) {
    console.log('❌ No orders found! Please run the full seed first with: npm run db:seed');
    process.exit(1);
  }

  // Get users who can raise disputes (customers)
  const customers = await prisma.user.findMany({ where: { role: 'CUSTOMER' }, take: 10 });
  const deliverers = await prisma.user.findMany({ where: { role: 'DELIVERER' }, take: 5 });

  if (customers.length === 0) {
    console.log('❌ No customers found! Please run the full seed first.');
    process.exit(1);
  }

  const disputesData = [
    { reason: "Order arrived extremely cold and the packaging was damaged.", status: "OPEN" },
    { reason: "The deliverer asked for extra money outside the app.", status: "UNDER_REVIEW" },
    { reason: "Food was completely spilled inside the bag. Inedible.", status: "OPEN", evidence: "https://example.com/spilled-food.jpg" },
    { reason: "I waited for 2 hours and the order never came. I want a refund.", status: "OPEN" },
    { reason: "Missing items! I ordered 3 burgers but only received 1.", status: "UNDER_REVIEW" },
    { reason: "The driver left the food at the wrong building and refuses to answer my calls.", status: "OPEN" },
    { reason: "Food quality was terrible, meat was undercooked. Vendor issue.", status: "OPEN", evidence: "https://example.com/raw-meat.jpg" },
    { reason: "Deliverer was extremely rude and unprofessional.", status: "OPEN" },
    { reason: "The order was marked as delivered but I haven't received anything.", status: "UNDER_REVIEW" },
    { reason: "I received someone else's order. This is a mix-up.", status: "OPEN", evidence: "https://example.com/wrong-order.jpg" },
  ];

  const newDisputes = [];

  for (let i = 0; i < 25; i++) {
    const order = orders[i % orders.length];
    const raiser = i % 3 === 0 ? deliverers[i % deliverers.length] : customers[i % customers.length]; // Mix of customer and deliverer complaints
    const dataTemplate = disputesData[i % disputesData.length];

    if (raiser) {
        newDisputes.push({
            id: crypto.randomUUID(),
            orderId: order.id,
            raisedById: raiser.id,
            reason: dataTemplate.reason,
            evidence: dataTemplate.evidence || null,
            status: dataTemplate.status,
            resolution: dataTemplate.resolution || null
        });
    }
  }

  // Clear existing disputes
  await prisma.dispute.deleteMany();
  console.log('🧹 Cleared existing disputes...');

  await prisma.dispute.createMany({ data: newDisputes });
  console.log(`✅ Successfully seeded ${newDisputes.length} varied disputes!`);
}

seedDisputes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
