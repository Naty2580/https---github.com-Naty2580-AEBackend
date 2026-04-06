import { z } from 'zod';

const ethioPhoneRegex = /^(09|07)\d{8}$/;
const astuEmailRegex = /^[a-z0-9._%+-]+@astu\.edu\.et$/;

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(3).optional(),
    defaultLocation: z.string().trim().min(1).optional(),
    email: z.email().optional(),
    avatarUrl: z.url().optional(),
  }).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided"
  }), 
});

export const updateEmailSchema = z.object({
  body: z.object({
    newEmail: z.string().trim().toLowerCase().regex(astuEmailRegex, "Must be a valid @astu.edu.et email")
  })
});

export const updatePhoneSchema = z.object({
  body: z.object({
    newPhone: z.string().trim().regex(ethioPhoneRegex, "Must be a valid Ethiopian phone number")
  })
});

export const applyDelivererSchema = z.object({
  body: z.object({
    payoutProvider: z.enum(['TELEBIRR', 'CBE_BIRR'], { required_error: "Payout provider is required" }),
    payoutAccount: z.string().min(10, { message: "Valid payout account number required" })
  })
});

export const updateDelivererStatusSchema = z.object({
  params: z.object({
    userId: z.uuid()
  }),
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED' , 'REVOKED']),
    reason: z.string().min(10, { message: "please insert a reason that makes sense" }).optional()
  })
});
export const updateVendorStatusSchema = z.object({
  params: z.object({
    vendorId: z.uuid()
  }),
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED' , 'REVOKED']),
    reason: z.string().min(10, { message: "please insert a reason that makes sense" }).optional()
  })
});

export const assignVendorStaffSchema = z.object({
  body: z.object({
    userId: z.uuid("Invalid user ID"),
    restaurantId: z.uuid("Invalid restaurant ID"),
    isOwner: z.boolean().default(false)
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8)
  })
});

export const toggleModeSchema = z.object({
  body: z.object({
    mode: z.enum(['CUSTOMER', 'DELIVERER'], { required_error: "Target mode is required" })
  })
});

export const updatePayoutSchema = z.object({
  body: z.object({
    payoutProvider: z.enum(['TELEBIRR', 'CBE_BIRR']),
    payoutAccount: z.string().min(10)
  })
});

export const setAvailabilitySchema = z.object({
  body: z.object({
    isAvailable: z.boolean({ required_error: "Availability status is required" })
  })
});

export const userQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    role: z.enum(['CUSTOMER', 'DELIVERER', 'VENDOR_STAFF', 'ADMIN']).optional(),
    status: z.string().optional(),
    search: z.string().optional() // Searches fullName or astuEmail
  })
});

export const deactivateAccountSchema = z.object({
  body: z.object({
    password: z.string().min(8, "Password required to confirm deactivation")
  })
});

export const updateUserStatusSchema = z.object({
  params: z.object({
    userId: z.uuid()
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'BANNED']),
    reason: z.string().min(5, "Reason for status change is required").optional()
  })
}); 