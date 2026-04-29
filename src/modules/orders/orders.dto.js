import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    restaurantId: z.string().uuid(),
    items: z.array(z.object({
      menuId: z.string().uuid(),
      quantity: z.number().int().positive(),
      expectedUnitPrice: z.number().positive("Expected unit price is required") 
      
    })).min(1, "Cart cannot be empty").max(20, "Maximum of 20 items per order"),
    tip: z.number().nonnegative().default(0)
  })
});


export const checkoutSchema = z.object({
  body: z.object({
    restaurantId: z.string().uuid("Invalid restaurant ID"),
    deliveryLat: z.number().min(-90).max(90, "Valid delivery latitude required"),
    deliveryLng: z.number().min(-180).max(180, "Valid delivery longitude required"),
    items: z.array(
      z.object({
        menuId: z.string().uuid("Invalid menu item ID"),
        quantity: z.number().int().positive("Quantity must be at least 1")
      })
    ).min(1, "Cart cannot be empty"),
    tip: z.number().nonnegative().default(0.00)
  })
}); 

export const orderQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    status: z.enum([
      'CREATED', 'AWAITING_ACCEPT', 'ASSIGNED', 'AWAITING_PAYMENT', 
      'PAYMENT_RECEIVED', 'VENDOR_BEING_PREPARED', 'VENDOR_FINISHED', 
      'VENDOR_READY_FOR_PICKUP', 'PICKED_UP', 'EN_ROUTE', 'ARRIVED', 
      'RECEIVED', 'DELIVERED', 'COMPLETED', 'DISPUTED', 'CANCELLED', 
      'NO_DELIVERER_FOUND'
    ]).optional(),
    roleAs: z.enum(['CUSTOMER', 'DELIVERER', 'VENDOR', 'ADMIN']).default('CUSTOMER'),
    restaurantId: z.string().uuid().optional()
  })
});

export const cancelOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
   body: z.object({
    reason: z.string().trim().min(5, "A reason must be provided for cancellation").optional()
  })
});

export const updateVendorStateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['VENDOR_BEING_PREPARED', 'VENDOR_READY_FOR_PICKUP'])
  })
});

export const updateDelivererStateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'DELIVERED'])
  })
});

export const completeOrderSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    otpCode: z.string().length(6, "OTP code must be 6 digits")
  })
});

export const dropOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    reason: z.string().trim().min(5, "A reason must be provided for dropping an assigned order.")
  })
});

export const raiseDisputeSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    reason: z.string().trim().min(10, "A detailed reason must be provided to raise a dispute.")
  })
});