
import { UserRepository } from './users.repository.js';
import { UserService } from './users.service.js';

const userRepository = new UserRepository();
const userService = new UserService(userRepository);


export const getMe = async (req, res, next) => {
  try {
    const user = await userService.getUserProfile(req.user.id);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// export const getMe = async (req, res, next) => {
//   try {
//     const user = await userService.getMeWithStats(req.user.id);
//     res.status(200).json({ success: true, data: user });
//   } catch (error) {
//     next(error);
//   }
// };

export const deactivateMe = async (req, res, next) => {
  try {
    await userService.selfDeactivate(req.user.id, req.body.password);
    res.status(200).json({ success: true, message: 'Account deactivated successfully.' });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfile = async (req, res, next) => {
  try {
    const updatedUser = await userService.updateProfile(req.user.id, req.body);
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};

export const requestEmailUpdate = async (req, res, next) => {
  try {
    const updated = await userService.requestEmailUpdate(req.user.id, req.body.newEmail);
    res.status(200).json({ 
      success: true, 
      message: 'Email updated. A new verification OTP has been sent.',
      data: updated 
    });
  } catch (error) {
    next(error);
  }
};

export const requestPhoneUpdate = async (req, res, next) => {
  try {
    const updated = await userService.requestPhoneUpdate(req.user.id, req.body.newPhone);
    res.status(200).json({ 
      success: true, 
      message: 'Phone updated. A new verification SMS has been sent.',
      data: updated 
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    await userService.changePassword(req.user.id, req.body);
    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const applyDeliverer = async (req, res, next) => {
  try {
    const profile = await userService.applyForDeliverer(req.user.id, req.body);
    res.status(201).json({ 
      success: true, 
      message: 'Deliverer application submitted successfully.',
      data: profile 
    });
  } catch (error) {
    next(error);
  }
};

export const reviewDeliverer = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;
    await userService.reviewDelivererApplication(req.user.id, userId, status, reason);

    res.status(200).json({ 
      success: true, 
      message: `Deliverer application ${status.toLowerCase()} successfully.` 
    });
  } catch (error) {
    next(error);
  }
};

export const reviewVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { status, reason } = req.body;
    await userService.reviewVendorApplication(req.user.id, vendorId, status, reason);

    res.status(200).json({ 
      success: true, 
      message: `Vendor application ${status.toLowerCase()} successfully.` 
    });
  } catch (error) {
    next(error);
  }
};



export const toggleMode = async (req, res, next) => {
  try {
    const { mode } = req.body;
    const updated = await userService.toggleActiveMode(req.user.id, mode);
    res.status(200).json({ 
      success: true, 
      message: `Switched to ${mode} mode.`,
      data: updated 
    });
  } catch (error) {
    next(error);
  }
};

export const assignVendorStaff = async (req, res, next) => {
  try {
    const { userId, restaurantId, isOwner } = req.body;
    await userService.assignVendorStaff(req.user.id, userId, restaurantId, isOwner);
    
    res.status(200).json({ 
      success: true, 
      message: 'Vendor staff assigned successfully. User role upgraded.' 
    });
  } catch (error) {
    next(error);
  }
};

export const setAvailability = async (req, res, next) => {
  try {
    const { isAvailable } = req.body;
    const result = await userService.setAvailability(req.user.id, isAvailable);
    res.status(200).json({ 
      success: true, 
      message: `You are now ${isAvailable ? 'online' : 'offline'}.`,
      data: result 
    });
  } catch (error) {
    next(error);
  }
};

export const updatePayout = async (req, res, next) => {
  try {
    await userService.updatePayoutDetails(req.user.id, req.body);
    res.status(200).json({ success: true, message: 'Payout details updated' });
  } catch (error) {
    next(error);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const result = await userService.listUsers(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getPendingDelivererApplications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await userService.listPendingDelivererApplications(page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getPendingVendorApplications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const result = await userService.listPendingVendorApplications(page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;
    if(!reason) reason = 'No reason provided';
    await userService.changeUserStatus(req.user.id, userId, status, reason);
    res.status(200).json({ success: true, message: `User status updated to ${status}.` });
  } catch (error) {
    next(error);
  }
};

//TESTING PURPOSES ONLY - TO BE REMOVED
export const fetchAllUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const toggleBookmark = async (req, res, next) => {
  try {
    const result = await userService.toggleBookmark(req.user.id, req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getBookmarks = async (req, res, next) => {
  try {
    const result = await userService.getBookmarks(req.user.id, req.query.type);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const createTicket = async (req, res, next) => {
  try {
    const ticket = await userService.createSupportTicket(req.user.id, req.body);
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

export const listTickets = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await userService.listSupportTickets(req.user.id, req.user.role, page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const updateTicketStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await userService.resolveSupportTicket(req.user.id, id, req.body);
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};