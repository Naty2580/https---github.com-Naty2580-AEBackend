import prisma from '../../infrastructure/database/prisma.client.js';

export class DisputeRepository {
  async findAll({ skip, take, status }) {
    const where = {};
    if (status) where.status = status;

    const [total, disputes] = await prisma.$transaction([
      prisma.dispute.count({ where }),
      prisma.dispute.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'asc' }, // Admins need to see oldest disputes first (SLA)
        include: {
          order: {
            select: {
              shortId: true, totalAmount: true, status: true,
              restaurant: { select: { name: true, phone: true } },
              customer: { select: { user: { select: { fullName: true, phoneNumber: true } } } },
              deliverer: { select: { user: { select: { fullName: true, phoneNumber: true } } } },
               ledgerEntries: {
                select: { type: true, amount: true, status: true, createdAt: true },
                orderBy: { createdAt: 'desc' }
              }
            }
          },
          raisedBy: { select: { fullName: true, role: true } },
          assignedAdmin: { select: { fullName: true } }
        }
      })
    ]);

    return { total, disputes };
  }

  async update(id, data) {
    return await prisma.dispute.update({
      where: { id },
      data
    });
  }
}