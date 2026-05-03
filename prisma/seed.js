import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import config from '../src/config/env.config.js';
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${config.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ==========================================
// UTILITY & GENERATOR FUNCTIONS
// ==========================================
const generatePhone = () => `09${Math.floor(10000000 + Math.random() * 90000000)}`;
const generateTelegramId = () => BigInt(Math.floor(Math.random() * 1000000000));
const randomEl = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Adama / ASTU Campus Bounds
const ADAMA_BOUNDS = { minLat: 8.540, maxLat: 8.570, minLng: 39.260, maxLng: 39.300 };
const randomLat = () => Math.random() * (ADAMA_BOUNDS.maxLat - ADAMA_BOUNDS.minLat) + ADAMA_BOUNDS.minLat;
const randomLng = () => Math.random() * (ADAMA_BOUNDS.maxLng - ADAMA_BOUNDS.minLng) + ADAMA_BOUNDS.minLng;

const RESTAURANT_NAMES = [
  "Barch", "Bole Amami", "Geda Mami", "Abenezer", "Bontu", "Beza Mesi",
  "ASTU Lounge", "Fresh Corner", "Adama Fast Food", "Kaku Juice", 
  "Block 40 Cafe", "Student Union Dining", "Rift Valley Burger", "Sheger Traditional", 
  "Awaash Bites", "Unity Cafe", "Zema Resto", "Nafkot Kitfo", "Blen Shiro", "Campus Crave"
];

const MENU_CATEGORIES = [
  {
    name: "Breakfast (ቁርስ)",
    items: [
      { name: "Special Firfir", price: 80, prep: 15, fasting: true },
      { name: "Enkulal Fetfet", price: 65, prep: 10, fasting: false },
      { name: "Chechebsa (Mita)", price: 70, prep: 20, fasting: false },
      { name: "Foul with Bread", price: 50, prep: 10, fasting: true },
      { name: "Kinche", price: 40, prep: 10, fasting: true }
    ]
  },
  {
    name: "Traditional Lunch (የሀገር ባህል)",
    items: [
      { name: "Shiro Tegabino", price: 100, prep: 20, fasting: true },
      { name: "Tibs (Beef)", price: 250, prep: 25, fasting: false },
      { name: "Beyaynetu (Fasting)", price: 120, prep: 15, fasting: true },
      { name: "Doro Wat", price: 350, prep: 40, fasting: false },
      { name: "Kitfo Special", price: 400, prep: 30, fasting: false }
    ]
  },
  {
    name: "Fast Food (ፈጣን ምግቦች)",
    items: [
      { name: "Double Beef Burger", price: 180, prep: 20, fasting: false },
      { name: "Chicken Pizza (M)", price: 250, prep: 30, fasting: false },
      { name: "Fasting Pizza (M)", price: 200, prep: 30, fasting: true },
      { name: "Club Sandwich", price: 150, prep: 15, fasting: false },
      { name: "French Fries (Chips)", price: 80, prep: 15, fasting: true }
    ]
  },
  {
    name: "Beverages (መጠጦች)",
    items: [
      { name: "Avocado & Mango Mix", price: 70, prep: 5, fasting: true },
      { name: "Macchiato", price: 30, prep: 5, fasting: false },
      { name: "Buna (Traditional Coffee)", price: 20, prep: 10, fasting: true },
      { name: "Bottled Water (0.5L)", price: 20, prep: 1, fasting: true },
      { name: "Coca Cola", price: 35, prep: 1, fasting: true }
    ]
  }
];

// ==========================================
// SEEDER EXECUTION
// ==========================================
async function main() {
  console.log('🌱 Starting Comprehensive Enterprise Seeder...');

  // 1. CLEANUP
  console.log('🧹 Wiping existing database records...');
  const tableNames = [
    'SystemConfig', 'SupportTicket', 'Notification', 'AnomalyFlag', 'DispatchLog',
    'Dispute', 'LedgerEntry', 'Review', 'Rating', 'PayoutLog', 'Payment', 'OrderItem',
    'OrderStatusHistory', 'Order', 'MenuItem', 'Category', 'VendorProfile',
    'DelivererProfile', 'Bookmark', 'CustomerProfile', 'Restaurant', 'VerificationToken',
    'RefreshToken', 'UserAuditLog', 'User'
  ];
  for (const table of tableNames) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }

  // 2. CONFIG & ADMIN
  console.log('⚙️ Seeding System Config & Admin...');
  const defaultPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  await prisma.systemConfig.createMany({
    data: [
      { id: crypto.randomUUID(), key: 'PLATFORM_FEE_PERCENT', value: '0.08' },
      { id: crypto.randomUUID(), key: 'MIN_DELIVERY_FEE', value: '33.00' },
      { id: crypto.randomUUID(), key: 'MAINTENANCE_MODE', value: 'false' }
    ]
  });

  const adminId = crypto.randomUUID();
  await prisma.user.create({
    data: {
      id: adminId, telegramId: generateTelegramId(), astuEmail: 'admin@astu.edu.et',
      fullName: 'System Admin', phoneNumber: generatePhone(), password: hashedPassword,
      role: 'ADMIN', activeMode: 'CUSTOMER', status: 'ACTIVE', isEmailVerified: true, isPhoneVerified: true
    }
  });

  // 3. ACTORS
  console.log('👥 Generating Users and Profiles...');
  let users = []; let vendorProfiles = []; let delivererProfiles = []; let customerProfiles = [];
  
  const vendorIds = Array.from({ length: 20 }, () => crypto.randomUUID());
  vendorIds.forEach((id, i) => {
    users.push({ id, telegramId: generateTelegramId(), email: `vendor${i+1}@gmail.com`, fullName: `Vendor Owner ${i+1}`, phoneNumber: generatePhone(), password: hashedPassword, role: 'VENDOR_STAFF', status: 'ACTIVE', isEmailVerified: true, isPhoneVerified: true });
  });

  const delivererIds = Array.from({ length: 10 }, () => crypto.randomUUID());
  delivererIds.forEach((id, i) => {
    users.push({ id, telegramId: generateTelegramId(), astuEmail: `deliverer${i+1}@astu.edu.et`, fullName: `Campus Deliverer ${i+1}`, phoneNumber: generatePhone(), password: hashedPassword, role: 'DELIVERER', activeMode: 'DELIVERER', status: 'ACTIVE', isEmailVerified: true, isPhoneVerified: true });
    
    // CRITICAL FIX: Explicitly generate ID for DelivererProfile
    delivererProfiles.push({ id: crypto.randomUUID(), userId: id, payoutProvider: i % 2 === 0 ? 'TELEBIRR' : 'CBE_BIRR', payoutAccount: `09${Math.floor(10000000 + Math.random() * 90000000)}`, verificationStatus: 'APPROVED', isVerified: true, isAvailable: true, isOnline: true, lat: randomLat(), lng: randomLng(), totalDeliveries: Math.floor(Math.random() * 50), rating: Number((Math.random() * 1 + 4.0).toFixed(1)) });
  });

  const customerIds = Array.from({ length: 20 }, () => crypto.randomUUID());
  customerIds.forEach((id, i) => {
    users.push({ id, telegramId: generateTelegramId(), astuEmail: `student${i+1}@astu.edu.et`, fullName: `ASTU Student ${i+1}`, phoneNumber: generatePhone(), password: hashedPassword, role: 'CUSTOMER', status: 'ACTIVE', isEmailVerified: true, isPhoneVerified: true });
  }); 

  await prisma.user.createMany({ data: users });

  // CRITICAL FIX: Explicitly generate ID for CustomerProfile for ALL users
  users = [{id: adminId}, ...users];
  users.forEach(u => {
    customerProfiles.push({ id: crypto.randomUUID(), userId: u.id, defaultLocation: `Block ${Math.floor(Math.random() * 60) + 1}`, rating: 5.0, totalOrders: Math.floor(Math.random() * 20) });
  });

  await prisma.delivererProfile.createMany({ data: delivererProfiles });
  await prisma.customerProfile.createMany({ data: customerProfiles });

  // 4. RESTAURANTS & MENUS
  console.log('🏪 Seeding Restaurants & Rich Menus...');
  let restaurants = []; let categories = []; let menuItems = [];
  const restaurantIds = Array.from({ length: 20 }, () => crypto.randomUUID());

  RESTAURANT_NAMES.forEach((name, i) => {
    const restId = restaurantIds[i];
    restaurants.push({
      id: restId, name, phone: generatePhone(), location: `ASTU Adama, Zone ${i+1}`,
      lat: randomLat(), lng: randomLng(), isOpen: true, isActive: true, 
      minOrderValue: 50.00, avgRating: Number((Math.random() * 2 + 3).toFixed(1)), totalReviews: Math.floor(Math.random() * 200),
      tags: i % 2 === 0 ? ['Traditional', 'Local'] : ['Fast Food', 'Cafe'],
      openingTime: '06:00', closingTime: '22:00', imageUrl: `https://placehold.co/600x400?text=${encodeURIComponent(name)}`
    });

    vendorProfiles.push({ id: crypto.randomUUID(), userId: vendorIds[i], restaurantId: restId, isOwner: true, businessDocumentUrl: 'https://example.com/doc.pdf', verificationStatus: 'APPROVED' });

    MENU_CATEGORIES.forEach((cat, catIdx) => {
      const catId = crypto.randomUUID();
      categories.push({ id: catId, restaurantId: restId, name: cat.name, sortOrder: catIdx, isArchived: false });
      cat.items.forEach(item => {
        menuItems.push({
          id: crypto.randomUUID(), restaurantId: restId, categoryId: catId,
          name: `${item.name} (${i})`, // Enforce unique name per restaurant
          description: `Authentic ${item.name}`, price: item.price,
          isFasting: item.fasting, isAvailable: true, isArchived: false, prepTimeMins: item.prep,
          imageUrl: `https://placehold.co/400x400?text=${encodeURIComponent(item.name)}`
        });
      });
    });
  });

  await prisma.restaurant.createMany({ data: restaurants });
  await prisma.vendorProfile.createMany({ data: vendorProfiles });
  await prisma.category.createMany({ data: categories });
  await prisma.menuItem.createMany({ data: menuItems });

  // 5. COMPLEX RELATIONS
  console.log('📦 Seeding Complex Lifecycles (Orders, Ledgers, Disputes, Bookmarks)...');
  
  let bookmarks = [];
  customerIds.slice(0, 5).forEach(cId => {
    bookmarks.push({ id: crypto.randomUUID(), userId: cId, type: 'RESTAURANT', targetId: restaurantIds[0] });
    bookmarks.push({ id: crypto.randomUUID(), userId: cId, type: 'MENU_ITEM', targetId: menuItems[0].id });
  });
  await prisma.bookmark.createMany({ data: bookmarks });

  let tickets = [];
  tickets.push({ id: crypto.randomUUID(), userId: customerIds[0], subject: 'App Crashing', description: 'Map fails to load', status: 'OPEN' });
  tickets.push({ id: crypto.randomUUID(), userId: delivererIds[0], subject: 'Payout Missing', description: 'Did not get money for last order', status: 'RESOLVED', resolution: 'Bank delay, fixed.' });
  tickets.push({ id: crypto.randomUUID(), userId: vendorIds[0], subject: 'Change Name', description: 'Please change my restaurant name', status: 'IN_PROGRESS' });
  await prisma.supportTicket.createMany({ data: tickets });

  let notifications = [];
  customerIds.slice(0, 3).forEach(cId => {
    notifications.push({ id: crypto.randomUUID(), userId: cId, title: 'Promo!', message: 'Free delivery today!', type: 'PROMO' });
  });
  await prisma.notification.createMany({ data: notifications });

  // Seed Orders
  for (let i = 0; i < 3; i++) {
    const orderId = crypto.randomUUID();
    const cUserId = customerIds[i];
    const dUserId = delivererIds[i];
    
    // CRITICAL FIX: Resolve the Profile IDs for the Order FK constraints
    const custProfileId = customerProfiles.find(p => p.userId === cUserId).id;
    const delivProfileId = delivererProfiles.find(p => p.userId === dUserId).id;

    const rId = restaurantIds[i];
    
    const statuses = ['COMPLETED', 'DISPUTED', 'CANCELLED'];
    const currentStatus = statuses[i];

    await prisma.order.create({
      data: {
        id: orderId, shortId: `AE-SD-${1000+i}`, 
        customerId: custProfileId, // Profile ID
        delivererId: delivProfileId, // Profile ID
        restaurantId: rId,
        foodPrice: 200, deliveryFee: 40, serviceFee: 16, tip: 10, totalAmount: 266, payoutAmount: 250,
        status: currentStatus, paymentStatus: currentStatus === 'CANCELLED' ? 'REFUNDED' : 'CAPTURED',
        otpCode: `12345${i}`, chapaRef: `TXN-SEED-${i}`, pickupLat: randomLat(), pickupLng: randomLng(),
        items: { create: [{ menuId: menuItems[i*10].id, quantity: 2, unitPrice: 100 }] },
        // History uses User ID
        statusHistory: { create: [{ newStatus: 'CREATED', changedById: cUserId }, { newStatus: currentStatus, changedById: adminId }] }
      }
    });

    if (currentStatus === 'COMPLETED') {
      await prisma.payment.create({ data: { id: crypto.randomUUID(), orderId, amount: 266, deliveryFee: 40, serviceFee: 16, tip: 10, payoutAmount: 250, status: 'CAPTURED', transactionId: `CHAPA-${i}` } });
      await prisma.ledgerEntry.createMany({ data: [
        { id: crypto.randomUUID(), orderId, userId: cUserId, amount: 266, type: 'ESCROW_RESERVE', status: 'COMPLETED' },
        { id: crypto.randomUUID(), orderId, userId: dUserId, amount: 250, type: 'REIMBURSEMENT_PAYMENT', status: 'COMPLETED' },
        { id: crypto.randomUUID(), orderId, amount: 16, type: 'PLATFORM_REVENUE', status: 'COMPLETED' }
      ]});
      await prisma.payoutLog.create({ data: { id: crypto.randomUUID(), orderId, status: 'SUCCESS', apiResponse: 'Telebirr OK' } });
      await prisma.dispatchLog.create({ data: { id: crypto.randomUUID(), orderId, delivererId: dUserId, action: 'ACCEPTED' }});
      await prisma.review.create({ data: { id: crypto.randomUUID(), orderId, restaurantRating: 5, delivererRating: 5, customerComment: 'Fast!', customerRating: 5, delivererComment: 'Good' }});
      await prisma.rating.create({ data: { id: crypto.randomUUID(), raterId: cUserId, rateeId: dUserId, orderId, rating: 5, comment: 'Nice' }});
    }

    if (currentStatus === 'DISPUTED') {
      await prisma.dispute.create({ data: { id: crypto.randomUUID(), orderId, raisedById: cUserId, reason: 'Food never arrived', status: 'OPEN' }});
      await prisma.anomalyFlag.create({ data: { id: crypto.randomUUID(), orderId, userId: dUserId, reason: 'GPS_MISMATCH', severity: 'HIGH' }});
    }
  }

  console.log('✅ Enterprise Database Seeding Completed Successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());