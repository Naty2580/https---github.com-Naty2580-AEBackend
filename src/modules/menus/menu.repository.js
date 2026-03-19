import prisma from '../../infrastructure/database/prisma.client.js';

export class MenuRepository {
  async updateItem(id, data) {
    return await prisma.menuItem.update({ where: { id }, data });
  }

  async deleteItem(id) {
    return await prisma.menuItem.delete({ where: { id } });
  }
}