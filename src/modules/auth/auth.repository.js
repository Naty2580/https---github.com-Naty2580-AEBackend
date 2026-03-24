import prisma from '../../infrastructure/database/prisma.client.js';

export class AuthRepository {

  async storeRefreshToken(userId, token, expiresInDays = 7) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    return await prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt
      }
    });
  }

  async findRefreshToken(token) {
    return await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true }
    });
  }

  async revokeRefreshToken(token) {
    return await prisma.refreshToken.update({
      where: { token },
      data: { isRevoked: true }
    });
  }

  async revokeAllUserTokens(userId) {
    return await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true }
    });
  }

  async storeVerificationToken(userId, tokenHash, type, expiresInMinutes = 15) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    // Invalidate previous tokens of the same type for this user
    await prisma.verificationToken.deleteMany({
      where: { userId, type }
    });

    return await prisma.verificationToken.create({
      data: { userId, tokenHash, type, expiresAt }
    });
  }

  async findVerificationToken(userId, type) {
    return await prisma.verificationToken.findFirst({
      where: { userId, type },
      orderBy: { createdAt: 'desc' }
    });
  }

  async deleteVerificationToken(id) {
    return await prisma.verificationToken.delete({ where: { id } });
  }

  async incrementFailedLogin(userId, currentAttempts) {
    const attempts = currentAttempts + 1;
    const updateData = { failedLoginAttempts: attempts };

    // Lock for 15 minutes if 5 or more failures
    if (attempts >= 5) {
      const lockTime = new Date();
      lockTime.setMinutes(lockTime.getMinutes() + 15);
      updateData.lockedUntil = lockTime;
    }

    return await prisma.user.update({
      where: { id: userId },
      data: updateData
    });
  }

  async resetLoginAttempts(userId) {
    return await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null }
    });
  }
}