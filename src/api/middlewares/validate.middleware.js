export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      // 1. We execute the parse and OVERWRITE the request objects.
      // This guarantees that the controller only receives perfectly sanitized data.
      // If the parse fails, it immediately jumps to the catch block.
      const validData = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // 2. Re-assign the sanitized data back to the request
      if (validData.body) req.body = validData.body;
      if (validData.query) req.query = validData.query;
      if (validData.params) req.params = validData.params;

      // 3. ONLY call next() if parsing completely succeeded
      return next();
      
    } catch (error) {
      // 4. Handle Zod Errors without relying on 'instanceof' which can fail in ESM
      if (error.name === 'ZodError') {
        // Send the response AND RETURN to kill the execution thread immediately
        return res.status(400).json({
          success: false,
          message: 'Data Validation Failed',
          errors: error.errors
        });
      }
      
      // 5. If it's a different kind of error (e.g., memory crash), pass it to the global handler
      return next(error);
    }
  };
};