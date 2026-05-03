import prisma from '../../infrastructure/database/prisma.client.js';

// We implement this directly in the controller since it's a simple Admin CRUD
export const listAnomalies = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [total, anomalies] = await prisma.$transaction([
      prisma.anomalyFlag.count({ where: { isResolved: false } }),
      prisma.anomalyFlag.findMany({
        where: { isResolved: false },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, astuEmail: true, role: true } },
          order: { select: { shortId: true } }
        }
      })
    ]);

    res.status(200).json({ success: true, total, data: anomalies });
  } catch (error) {
    next(error);
  }
};

export const resolveAnomaly = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;

    const anomaly = await prisma.anomalyFlag.update({
      where: { id },
      data: { isResolved: true } // Admin cleared the flag after investigating
    });

    res.status(200).json({ success: true, message: 'Anomaly resolved', data: anomaly });
  } catch (error) {
    next(error);
  }
};