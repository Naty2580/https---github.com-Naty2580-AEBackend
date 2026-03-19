import bcrypt from 'bcryptjs';
import prisma from '../../infrastructure/database/prisma.client.js';
import { NotFoundError, BusinessLogicError, ConflictError } from '../../core/errors/domain.errors.js';
import { USER_ERRORS } from '../../core/errors/error.codes.js';

export class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async _ensureNoActiveOrders(userId) {
    const hasActive = await this.userRepository.hasActiveOrders(userId);
    if (hasActive) {
      throw new BusinessLogicError('Cannot perform this action while you have an active order or delivery.');
    }
  }

   async _validateRoleExclusivity(userId, targetRole) {
    const user = await this.userRepository.findByIdWithProfiles(userId);
    
    if (targetRole === 'DELIVERER' && user.vendorProfile) {
      throw new BusinessLogicError('Restaurant staff cannot apply to be deliverers on the same account.');
    }
    
    if (targetRole === 'VENDOR_STAFF' && user.delivererProfile) {
      throw new BusinessLogicError('Verified deliverers cannot be assigned as restaurant staff.');
    }
  }



  async getUserProfile(userId) {
    const user = await this.userRepository.findByIdWithProfiles(userId);
    if (!user) throw new NotFoundError(USER_ERRORS.NOT_FOUND);
    return user;
  }

   async getMeWithStats(userId) {
    const user = await this.userRepository.findByIdWithStats(userId);
    if (!user) throw new NotFoundError(USER_ERRORS.NOT_FOUND);
    return user;
  }

  async updateProfile(userId, data) {

    await this._ensureNoActiveOrders(userId);
    // Prevent Phone Number Collisions
    if (data.phoneNumber) {
      const existing = await this.userRepository.findByPhoneNumber(data.phoneNumber);
      if (existing && existing.id !== userId) {
        throw new ConflictError('Phone number is already in use by another account.');
      }
    }

    return await this.userRepository.update(userId, data);
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await this.userRepository.findById(userId);
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new UnauthorizedError('Invalid current password.');

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.userRepository.updatePassword(userId, hashed);
  }

  async applyForDeliverer(userId, data) {
    const user = await this.userRepository.findByIdWithProfiles(userId);
    
    if (!user) throw new NotFoundError(USER_ERRORS.NOT_FOUND);
    
    await this._validateRoleExclusivity(userId, 'DELIVERER');

    if (user.delivererProfile) {
      throw new ConflictError(USER_ERRORS.DELIVERER_PROFILE_EXISTS);
    }

    if (user.role !== 'CUSTOMER') {
      throw new BusinessLogicError('Only users with CUSTOMER role can apply to be deliverers.');
    }

    return await this.userRepository.createDelivererProfile(userId, data);
  }

  async reviewDelivererApplication(adminId, targetUserId, status) {
    const user = await this.userRepository.findByIdWithProfiles(targetUserId);
    
    if (!user) throw new NotFoundError(USER_ERRORS.NOT_FOUND);
    
    if (!user.delivererProfile) {
      throw new NotFoundError('Deliverer application not found for this user.');
    }

    if (user.delivererProfile.verificationStatus !== 'PENDING') {
      throw new BusinessLogicError('This application has already been processed.');
    }

    await this.userRepository.updateDelivererStatus(targetUserId, status);

    await this.userRepository.logAction({
      targetUserId,
      actorId: adminId,
      action: 'DELIVERER_REVIEW',
      previousValue: user.delivererProfile.verificationStatus,
      newValue: status,
      reason
    });

  }

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await this.userRepository.findById(userId);
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new BusinessLogicError('Incorrect current password');
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    return await this.userRepository.update(userId, { password: hashedPassword });
  }

  async toggleActiveMode(userId, targetMode) {

   

    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError(USER_ERRORS.NOT_FOUND);

 await this._ensureNoActiveOrders(userId);

    // Security Rule: Only users with DELIVERER role can switch to DELIVERER mode
    if (targetMode === 'DELIVERER' && user.role !== 'DELIVERER') {
      throw new BusinessLogicError('You must be a verified deliverer to switch to Deliverer mode.');
    }

    // Role check for VENDOR_STAFF or ADMIN (Optional: restrict their modes if necessary)
    if (user.role === 'VENDOR_STAFF' || user.role === 'ADMIN') {
       // Admins/Staff usually stay in their roles, but for P2P they can be customers.
    }

    return await this.userRepository.updateActiveMode(userId, targetMode);
  }

    async assignVendorStaff(adminId, targetUserId, restaurantId, isOwner) {
      //checking for admin
    const admin = await this.userRepository.findByIdWithProfiles(adminId);
    if (!admin) throw new NotFoundError(USER_ERRORS.NOT_FOUND);
    if (admin.role !== 'ADMIN') {
      throw new BusinessLogicError('Only admins can assign vendor staff.');
    }
    //checking for user
    const user = await this.userRepository.findByIdWithProfiles(targetUserId);
    if (!user) throw new NotFoundError(USER_ERRORS.NOT_FOUND);

    await this._validateRoleExclusivity(targetUserId, 'VENDOR_STAFF');

    if (user.role === 'ADMIN' || user.role === 'DELIVERER') {
      throw new BusinessLogicError('Cannot assign ADMIN or DELIVERER as Vendor Staff. Demote them first.');
    }

    const restaurant = await this.userRepository.checkRestaurantExists(restaurantId);
    if (!restaurant) {
      throw new NotFoundError('Restaurant not found.');
    }

    await this.userRepository.assignVendorStaff(targetUserId, restaurantId, isOwner);
  }

  async setAvailability(userId, isAvailable) {
    const user = await this.userRepository.findByIdWithProfiles(userId);
    
    if (user.role !== 'DELIVERER') {
      throw new BusinessLogicError('Only verified deliverers can set availability.');
    }

    if (user.activeMode !== 'DELIVERER' && isAvailable === true) {
      throw new BusinessLogicError('You must switch to Deliverer mode before going online.');
    }

    if (!user.delivererProfile?.payoutAccount && isAvailable) {
      throw new BusinessLogicError('Payout details must be configured before going online.');
    }

    return await this.userRepository.updateAvailability(userId, isAvailable);
  }

  async listUsers(filters) {
    const skip = (filters.page - 1) * filters.limit;
    return await this.userRepository.findAllUsers({
      skip,
      take: filters.limit,
      role: filters.role,
      status: filters.status,
      search: filters.search
    });
  }

   async updatePayoutDetails(userId, data) {
    const user = await this.userRepository.findByIdWithProfiles(userId);
    if (!user.delivererProfile) throw new BusinessLogicError('Deliverer profile not found.');
    
    // Safety: Cannot change payout info during active delivery (prevents hijacking)
    await this._ensureNoActiveOrders(userId);

    return await this.userRepository.updatePayoutInfo(userId, data);
  }

   async changeUserStatus(adminId, targetUserId, { status, reason }) {
    if (adminId === targetUserId) throw new BusinessLogicError('Cannot modify own status.');

    const user = await this.userRepository.findById(targetUserId);
    if (!user) throw new NotFoundError(USER_ERRORS.NOT_FOUND);

    const result = await this.userRepository.updateUserStatus(targetUserId, status);

    await this.userRepository.logAction({
      targetUserId,
      actorId: adminId,
      action: 'STATUS_CHANGE',
      previousValue: user.status,
      newValue: status,
      reason: reason || 'N/A'
    });

    return result;
  }

  async selfDeactivate(userId, password) {
    const user = await this.userRepository.findById(userId);
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) throw new UnauthorizedError('Invalid password confirmation.');

    await this.userRepository.deactivate(userId);
  }

//test only
  async getAllUsers() {
    return await this.userRepository.findAll();
  }
  
}