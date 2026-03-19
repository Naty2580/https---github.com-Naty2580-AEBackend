// import {  ZodError } from 'zod';

// /**
//  * Higher-order middleware function for request validation using Zod.
//  * 
//  * @param {Object} schemas - An object containing optional Zod schemas for body, query, and params.
//  * @param {AnyZodObject} [schemas.body] - Zod schema for req.body
//  * @param {AnyZodObject} [schemas.query] - Zod schema for req.query
//  * @param {AnyZodObject} [schemas.params] - Zod schema for req.params
//  * @returns {Function} Express middleware function
//  */ 
// export const validate = (schemas) => {
//   return async (req, res, next) => {
//     try {
//       // We validate only what is provided in the schema definitions
//       if (schemas.params) {
//         req.params = await schemas.params.parseAsync(req.params);
//       }
      
//       if (schemas.query) {
//         req.query = await schemas.query.parseAsync(req.query);
//       }
      
//       if (schemas.body) {
//         req.body = await schemas.body.parseAsync(req.body);
//       }

//       // If all validations pass, proceed to the controller
//       next();
//     } catch (error) {
//       // If it's a Zod validation error, pass it directly to the global error handler
//       // The global handler already knows how to format ZodError issues.
//       if (error instanceof ZodError) {
//         return next(error);
//       }
      
//       // If an unexpected error occurs during validation, pass it down
//       next(error);
//     }
//   };
// };

import { ZodError } from 'zod';

export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // Execute the schema parse directly against the req object
      // This enforces Zod to check req.body, req.query, req.params simultaneously
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Data Validation Failed',
          errors: error.errors
        });
      }
      next(error);
    }
  };
};