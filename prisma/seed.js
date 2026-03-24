import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import  config from '../src/config/env.config.js';
import { PrismaPg } from "@prisma/adapter-pg";


const connectionString = `${config.DATABASE_URL}`;



 const adapter = new PrismaPg({ connectionString });
 const prisma =  new PrismaClient({ adapter });

// ==========================================
// REALISTIC MOCK DATA GENERATORS
// ==========================================
const CAMPUS_CENTER = { lat: 8.563, lng: 39.291 };

const generatePhone = () => {
  const prefix = Math.random() > 0.5 ? '09' : '07';
  const number = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}${number}`;
};

const generateTelegramId = () => BigInt(Math.floor(Math.random() * 1000000000));

const generateJitteredLocation = () => ({
  lat: CAMPUS_CENTER.lat + (Math.random() - 0.5) * 0.01,
  lng: CAMPUS_CENTER.lng + (Math.random() - 0.5) * 0.01,
});

// ==========================================
// SEEDER EXECUTION
// ==========================================
async function main() {
  console.log('🌱 Starting Enterprise Database Seeder...');

  // 1. CLEANUP (Reverse order of dependencies to avoid Foreign Key conflicts)
  console.log('🧹 Wiping existing data...');
  await prisma.userAuditLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.dispatchLog.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.vendorProfile.deleteMany();
  await prisma.delivererProfile.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.user.deleteMany();

  // 2. PERFORMANCE OPTIMIZATION: Hash password once for all seeded users
  const defaultPassword = 'Password123!';
  console.log(`🔐 Hashing default password ('${defaultPassword}')...`);
  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  // 3. GENERATE IDENTIFIERS IN MEMORY (For blazing fast relational inserts)
  const adminId = crypto.randomUUID();
  const vendorIds = Array.from({ length: 4 }, () => crypto.randomUUID());
  const delivererIds = Array.from({ length: 6 }, () => crypto.randomUUID());
  const customerIds = Array.from({ length: 15 }, () => crypto.randomUUID());
  const restaurantIds = Array.from({ length: 4 }, () => crypto.randomUUID());

  // 4. SEED USERS
  console.log('👤 Seeding Users...');
  const allUsers = [
    // Admin
    { id: adminId, telegramId: generateTelegramId(), astuEmail: 'admin.seed@astu.edu.et', fullName: 'System Admin', phoneNumber: generatePhone(), password: hashedPassword, role: 'ADMIN', activeMode: 'CUSTOMER', status: 'ACTIVE', isEmailVerified: true },
    // Vendors
    ...vendorIds.map((id, i) => ({ id, telegramId: generateTelegramId(), astuEmail: `vendor${i+1}.seed@astu.edu.et`, fullName: `Vendor Staff ${i+1}`, phoneNumber: generatePhone(), password: hashedPassword, role: 'VENDOR_STAFF', activeMode: 'CUSTOMER', status: 'ACTIVE', isEmailVerified: true })),
    // Deliverers
    ...delivererIds.map((id, i) => ({ id, telegramId: generateTelegramId(), astuEmail: `deliverer${i+1}.seed@astu.edu.et`, fullName: `Campus Deliverer ${i+1}`, phoneNumber: generatePhone(), password: hashedPassword, role: 'DELIVERER', activeMode: 'DELIVERER', status: 'ACTIVE', isEmailVerified: true })),
    // Customers
    ...customerIds.map((id, i) => ({ id, telegramId: generateTelegramId(), astuEmail: `student${i+1}.seed@astu.edu.et`, fullName: `Astu Student ${i+1}`, phoneNumber: generatePhone(), password: hashedPassword, role: 'CUSTOMER', activeMode: 'CUSTOMER', status: 'ACTIVE', isEmailVerified: true })),
  ];
  await prisma.user.createMany({ data: allUsers });

  // 5. SEED PROFILES
  console.log('📋 Seeding Profiles...');
  const customerProfiles = allUsers.map(u => ({
    userId: u.id, defaultLocation: `Block ${Math.floor(Math.random() * 50) + 1}`, rating: 5.0
  }));
  await prisma.customerProfile.createMany({ data: customerProfiles });

  const delivererProfiles = delivererIds.map((id, i) => ({
    userId: id,
    payoutProvider: i % 2 === 0 ? 'TELEBIRR' : 'CBE_BIRR', payoutAccount: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
    verificationStatus: 'APPROVED', isVerified: true, isAvailable: true, rating: (Math.random() * (5.0 - 4.0) + 4.0).toFixed(1)
  }));
  await prisma.delivererProfile.createMany({ data: delivererProfiles });

  // 6. SEED RESTAURANTS
  console.log('🏪 Seeding Restaurants...');
  const restaurantsData = [
    { id: restaurantIds[0], name: 'ASTU Student Lounge', mode: 'VENDOR_MANAGED', location: 'Near Block 40', phone: generatePhone(), ...generateJitteredLocation(), isOpen: true, isActive: true, minOrderValue: 50.00, avgRating: 4.8, totalReviews: 120, tags: ['Cafe', 'Breakfast'], openingTime: '06:00', closingTime: '22:00', imageUrl: 'https://placehold.co/800x600?text=Student+Lounge' },
    { id: restaurantIds[1], name: 'Fresh Juice & Burger', mode: 'VENDOR_MANAGED', location: 'Gate 2', phone: generatePhone(), ...generateJitteredLocation(), isOpen: true, isActive: true, minOrderValue: 100.00, avgRating: 4.5, totalReviews: 85, tags: ['Fast Food', 'Juice'], openingTime: '10:00', closingTime: '23:00', imageUrl: 'https://placehold.co/800x600?text=Juice+Bar' },
    { id: restaurantIds[2], name: 'Traditional Corner', mode: 'VENDOR_MANAGED', location: 'Block 45', phone: generatePhone(), ...generateJitteredLocation(), isOpen: false, isActive: true, minOrderValue: 150.00, avgRating: 4.9, totalReviews: 200, tags: ['Traditional', 'Dinner'], openingTime: '11:00', closingTime: '21:00', imageUrl: 'https://placehold.co/800x600?text=Traditional+Food' },
    { id: restaurantIds[3], name: 'Admin Listed Cafe', mode: 'ADMIN_MANAGED', location: 'Library Area', phone: generatePhone(), ...generateJitteredLocation(), isOpen: true, isActive: true, minOrderValue: 30.00, avgRating: 4.2, totalReviews: 45, tags: ['Snacks', 'Coffee'], openingTime: '07:00', closingTime: '18:00', imageUrl: 'https://placehold.co/800x600?text=Library+Cafe' },
  ];
  await prisma.restaurant.createMany({ data: restaurantsData });

  // 7. ASSIGN VENDOR STAFF
  console.log('👔 Assigning Vendor Staff...');
  const vendorProfiles = vendorIds.slice(0, 3).map((id, i) => ({
    userId: id, restaurantId: restaurantIds[i], isOwner: true
  }));
  await prisma.vendorProfile.createMany({ data: vendorProfiles });

  // 8. SEED MENUS & CATEGORIES
  console.log('🍔 Seeding Categories & Menu Items...');
  
  const menuConfig = [
    { cat: 'Breakfast', fasting: false, items: [{ name: 'Special Firfir', price: 80, prep: 15 }, { name: 'Enkulal Fetfet', price: 60, prep: 10 }, { name: 'Foul', price: 50, prep: 10, fasting: true }] },
    { cat: 'Lunch & Dinner', fasting: false, items: [{ name: 'Shiro Tegabino', price: 100, prep: 20, fasting: true }, { name: 'Tibs (Beef)', price: 250, prep: 25 }, { name: 'Half-Half (Beyaynetu)', price: 120, prep: 15, fasting: true }] },
    { cat: 'Fast Food', fasting: false, items: [{ name: 'Double Burger', price: 180, prep: 20 }, { name: 'Chicken Pizza', price: 220, prep: 30 }, { name: 'Fasting Pizza', price: 190, prep: 30, fasting: true }] },
    { cat: 'Beverages', fasting: false, items: [{ name: 'Avocado Juice', price: 60, prep: 5, fasting: true }, { name: 'Macchiato', price: 25, prep: 5 }, { name: 'Bottled Water', price: 20, prep: 2, fasting: true }] }
  ];

  let categoriesToInsert = [];
  let itemsToInsert = [];

  restaurantIds.forEach((restId) => {
    menuConfig.forEach((config, catIndex) => {
      const categoryId = crypto.randomUUID();
      categoriesToInsert.push({
        id: categoryId, restaurantId: restId, name: config.cat, sortOrder: catIndex, isArchived: false
      });

      config.items.forEach((item, itemIndex) => {
        itemsToInsert.push({
          id: crypto.randomUUID(), restaurantId: restId, categoryId: categoryId,
          name: `${item.name} (${catIndex}-${itemIndex})`, // Ensure uniqueness per restaurant
          description: `Delicious ${item.name} prepared fresh.`,
          price: item.price, isAvailable: Math.random() > 0.1, // 90% chance available
          isArchived: false, isFasting: item.fasting || false, prepTimeMins: item.prep,
          imageUrl: `https://placehold.co/400x400?text=${encodeURIComponent(item.name)}`
        });
      });
    });
  });

  await prisma.category.createMany({ data: categoriesToInsert });
  await prisma.menuItem.createMany({ data: itemsToInsert });

  console.log('✅ Enterprise Database Seeding Completed Successfully!');
  console.log('==================================================');
  console.log(`🔑 Test Accounts (Password: ${defaultPassword})`);
  console.log(`   Admin:      admin.seed@astu.edu.et`);
  console.log(`   Vendor:     vendor1.seed@astu.edu.et`);
  console.log(`   Deliverer:  deliverer1.seed@astu.edu.et`);
  console.log(`   Customer:   student1.seed@astu.edu.et`);
  console.log('==================================================');
}

main()
  .catch((e) => {
    console.error('❌ Fatal Seeder Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });