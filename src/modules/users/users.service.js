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
    return await this.userRepository.update(userId, data);
  }

   async requestEmailUpdate(userId, newEmail) {
    await this._ensureNoActiveOrders(userId);

    const user = await this.userRepository.findByIdWithProfiles(userId);
    
    // 1. Uniqueness Check
    const existing = await this.userRepository.findByEmail(newEmail);
    if (existing) throw new ConflictError('This email is already registered.');

    // 2. Update DB and revoke verification status
    const updatedUser = await this.userRepository.updateSensitiveIdentifier(userId, 'EMAIL', newEmail);

    // 3. Trigger new OTP to the new email
    // Note: We use the existing authService logic to keep OTP generation centralized
    await authService._generateAndSendOTP(updatedUser, 'EMAIL_VERIFICATION', 'Email Update Verification');

    return updatedUser;
  }

  async requestPhoneUpdate(userId, newPhone) {
    await this._ensureNoActiveOrders(userId);

    const user = await this.userRepository.findByIdWithProfiles(userId);
    
    // 1. Uniqueness Check
    const existing = await this.userRepository.findByPhoneNumber(newPhone);
    if (existing) throw new ConflictError('This phone number is already registered.');

    // 2. Update DB and revoke verification status
    const updatedUser = await this.userRepository.updateSensitiveIdentifier(userId, 'PHONE', newPhone);

    // 3. Trigger new SMS OTP
    await authService._generateAndSendPhoneOTP(updatedUser);

    // 4. Operational Safety: If they are a Deliverer, force them offline until they verify the new phone
    if (user.activeMode === 'DELIVERER') {
      await this.userRepository.updateAvailability(userId, false);
    }

    return updatedUser;
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

  async reviewDelivererApplication(adminId, targetUserId, status, reason) {
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
  async reviewVendorApplication(adminId, targetUserId, status, reason) {
    const user = await this.userRepository.findByIdWithProfiles(targetUserId);
    
    if (!user) throw new NotFoundError(USER_ERRORS.NOT_FOUND);
    
    if (!user.vendorProfile) {
      throw new NotFoundError('Vendor application not found for this user.');
    }

    if (user.vendorProfile.verificationStatus !== 'PENDING') {
      throw new BusinessLogicError('This application has already been processed.');
    }

    await this.userRepository.updateVendorStatus(targetUserId, status);

    await this.userRepository.logAction({
      targetUserId,
      actorId: adminId,
      action: 'VENDOR_REVIEW',
      previousValue: user.vendorProfile.verificationStatus,
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
      throw new BusinessLogicError('You are not allowed to switch modes.');
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

    if (restaurant.mode === 'ADMIN_MANAGED') {
      throw new BusinessLogicError('Cannot assign Vendor Staff to an ADMIN_MANAGED restaurant.');
    }

    await this.userRepository.assignVendorStaff(targetUserId, restaurantId, isOwner);
  }

  async setAvailability(userId, isAvailable) {
    const user = await this.userRepository.findByIdWithProfiles(userId);
    
    if (user.role !== 'DELIVERER') {
      throw new BusinessLogicError('Only verified deliverers can set availability.');
    }

    if (user.activeMode !== 'DELIVERER') {
      throw new BusinessLogicError('You must switch to Deliverer mode before going online.');
    }

    if (!user.delivererProfile?.payoutAccount) {
      throw new BusinessLogicError('Payout Account must be configured before going online.');
    } else if (!user.delivererProfile?.payoutProvider) {
      throw new BusinessLogicError('Payout Provider must be configured before going online.');
    } else if (!user.phoneNumber) {
      throw new BusinessLogicError('phone number must be set and verified before going online.');
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

   async changeUserStatus(adminId, targetUserId, status, reason = 'No reason provided') {
    if (adminId === targetUserId) throw new BusinessLogicError('Cannot modify own status.');

    const user = await this.userRepository.findById(targetUserId);
    if (!user) throw new NotFoundError(USER_ERRORS.NOT_FOUND);

    status = status.toUpperCase();
    if(!status) throw new BusinessLogicError('Status is required.');
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
    
    // If registered via Telegram Mini-App auto-auth, bypass password check
    if (user.password !== 'NO_PASSWORD_TELEGRAM_OAUTH') {
      if (!password) throw new UnauthorizedError('Password is required for deactivation.');
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) throw new UnauthorizedError('Invalid password confirmation.');
    }

    // Existing safety check (Cannot deactivate if holding active orders or disputes)
    const canDeactivate = await this.userRepository.canDeactivate(userId);
    if (!canDeactivate) {
      throw new BusinessLogicError("Cannot deactivate account while you have active orders or unresolved disputes.");
    }

    await this.userRepository.deactivate(userId);
  }

//test only
  async getAllUsers() {
    return await this.userRepository.findAll();
  }
  
}