import prisma from '../../infrastructure/database/prisma.client.js';

export class ConfigRepository {
  async findAll() {
    return await prisma.systemConfig.findMany({
      orderBy: { key: 'asc' }
    });
  }

  async findByKey(key) {
    return await prisma.systemConfig.findUnique({
      where: { key }
    });
  }

  async create(key, value) {
    return await prisma.systemConfig.create({
      data: { key, value }
    });
  }

  async updateByKey(key, value) {
    return await prisma.systemConfig.update({
      where: { key },
      data: { value }
    });
  }

  async deleteByKey(key) {
    return await prisma.systemConfig.delete({
      where: { key }
    });
  }
}
