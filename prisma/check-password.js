import prisma from '../src/infrastructure/database/prisma.client.js';
import bcrypt from 'bcryptjs';

const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
console.log('Admin Email:', admin.astuEmail);
const isValid = await bcrypt.compare('admin123', admin.password);
console.log('Is password "admin123" valid?', isValid);
const isValid2 = await bcrypt.compare('Admin123!', admin.password);
console.log('Is password "Admin123!" valid?', isValid2);
const isValid3 = await bcrypt.compare('Admin@123', admin.password);
console.log('Is password "Admin@123" valid?', isValid3);
await prisma.$disconnect();
