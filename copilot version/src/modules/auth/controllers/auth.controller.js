import { registerUser, loginUser, setupMfa, verifyMfa, changePassword, refreshAccessToken, logoutUser } from '../services/auth.service.js';

// Controller: Register
const register = async (req, res, next) => {
  try {
    const userData = req.body;
    const result = await registerUser(userData);
    res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Controller: Login
const login = async (req, res, next) => {
  try {
    const { astuEmail, password } = req.body;
    const result = await loginUser(astuEmail, password);
    // Set httpOnly cookies for security
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 min
    });
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.status(200).json({
      status: 'success',
      data: { user: result.user },
    });
  } catch (error) {
    next(error);
  }
};

// Controller: Setup MFA
const setupMfa = async (req, res, next) => {
  try {
    const result = await setupMfa(req.user.userId);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Controller: Verify MFA
const verifyMfa = async (req, res, next) => {
  try {
    const { token } = req.body;
    await verifyMfa(req.user.userId, token);
    res.status(200).json({
      status: 'success',
      message: 'MFA verified',
    });
  } catch (error) {
    next(error);
  }
};

// Controller: Change Password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await changePassword(req.user.userId, currentPassword, newPassword);
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Controller: Refresh Token
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies?.refreshToken || req.body.refreshToken;
    const result = await refreshAccessToken(refreshToken);
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Controller: Logout
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (refreshToken) {
      await logoutUser(refreshToken);
    }
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

export {
  register,
  login,
  setupMfa,
  verifyMfa,
  changePassword,
  refreshToken,
  logout,
};