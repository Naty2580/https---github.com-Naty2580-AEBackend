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
    restaurantId: z.uuid("Invalid restaurant ID"),
    deliveryLat: z.number().min(-90).max(90, "Valid delivery latitude required").optional(),
    deliveryLng: z.number().min(-180).max(180, "Valid delivery longitude required").optional(),
    items: z.array(
      z.object({
        menuId: z.uuid("Invalid menu item ID"),
        quantity: z.number().int().positive("Quantity must be at least 1"),
        expectedUnitPrice: z.number().positive("Expected unit price is required")
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
    roleAs: z.enum(['CUSTOMER', 'DELIVERER', 'VENDOR', 'ADMIN']).default('ADMIN'),
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
    status: z.enum(['VENDOR_BEING_PREPARED', 'VENDOR_READY_FOR_PICKUP']),
    estimatedPrepTimeMins: z.number().int().min(1).max(120).optional()
  })
});

export const updateDelivererStateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['PICKED_UP', 'EN_ROUTE', 'ARRIVED', 'DELIVERED']),
     currentLat: z.number().min(-90).max(90, "Valid latitude required"),
    currentLng: z.number().min(-180).max(180, "Valid longitude required")
  })
  });
  
export const submitCustomerReviewSchema = z.object({ 
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    restaurantRating: z.number().int().min(1).max(5),
    delivererRating: z.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(500).optional()
  })
});

export const submitDelivererReviewSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    customerRating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(500).optional()
  })
});

export const completeOrderSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    otpCode: z.string().length(6, "OTP code must be 6 digits")
  })
});

export const reportUnfulfillableSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    reason: z.enum([
      'RESTAURANT_CLOSED', 
      'OUT_OF_STOCK', 
      'VENDOR_REFUSED', 
      'CUSTOMER_UNREACHABLE',
        'PRICE_MISMATCH' 
    ]),
    details: z.string().trim().max(255).optional()
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

export const quoteSchema = checkoutSchema;

export const createReviewSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    restaurantRating: z.number().int().min(1).max(5),
    delivererRating: z.number().int().min(1).max(5).optional(), // Optional if order was cancelled/not delivered
    comment: z.string().trim().max(500).optional()
  })
});