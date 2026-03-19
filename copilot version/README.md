# ASTU Eats Backend - Copilot Version

A Node.js backend for the ASTU Eats P2P campus food delivery platform.

## Features Implemented (Enhanced Authentication Module)

- User registration with Telegram verification and password strength checking
- Secure login with Argon2 hashing, account lockout, and MFA support
- JWT authentication with httpOnly cookies
- Rate limiting and audit logging
- MFA setup and verification (TOTP)
- Password change with strength validation
- Comprehensive error handling and logging

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register a new user (rate limited)
- `POST /api/v1/auth/login` - Login user (rate limited, sets cookies)
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/setup-mfa` - Setup MFA (protected)
- `POST /api/v1/auth/verify-mfa` - Verify MFA token (protected)
- `POST /api/v1/auth/change-password` - Change password (protected)
- `POST /api/v1/auth/logout` - Logout user (clears cookies)

## Security Enhancements

- **Password Hashing**: Argon2 (resistant to rainbow tables)
- **Password Strength**: zxcvbn library for strength checking
- **Account Lockout**: After 5 failed attempts, lock for 15 minutes
- **MFA**: TOTP-based two-factor authentication
- **Rate Limiting**: 5 auth attempts per 15 minutes per IP
- **Cookies**: httpOnly, secure, sameSite for token storage
- **Audit Logs**: All auth events logged with details
- **Generic Errors**: Prevent user enumeration

## Example Requests

### Register
```json
POST /api/v1/auth/register
{
  "telegramId": "123456789",
  "astuEmail": "student@astu.edu.et",
  "fullName": "John Doe",
  "phoneNumber": "+251911123456",
  "password": "StrongP@ssw0rd2026!",
  "role": "CUSTOMER"
}
```

Response:
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "fullName": "John Doe",
      "role": "CUSTOMER"
    }
  }
}
```

### Login
```json
POST /api/v1/auth/login
{
  "astuEmail": "student@astu.edu.et",
  "password": "StrongP@ssw0rd2026!"
}
```

Response:
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "fullName": "John Doe",
      "role": "CUSTOMER",
      "activeMode": "CUSTOMER"
    }
  }
}
```
*Cookies set: accessToken, refreshToken*

### Setup MFA
```json
POST /api/v1/auth/setup-mfa
Authorization: Bearer <accessToken>
```

Response:
```json
{
  "status": "success",
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "otpauthUrl": "otpauth://totp/AstuEats:john@example.com?secret=JBSWY3DPEHPK3PXP&issuer=AstuEats"
  }
}
```

## Setup

1. Install dependencies: `npm install`
2. Set up environment variables in `.env`
3. Run database migrations: `npm run db:migrate`
4. Generate Prisma client: `npm run db:generate`
5. Start server: `npm run dev`