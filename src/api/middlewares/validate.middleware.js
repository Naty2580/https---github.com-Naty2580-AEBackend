export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      const validData = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // ✅ Safe overrides
      if (validData.body) req.body = validData.body;
      if (validData.params) req.params = validData.params;

      console.log("Validation successful. Validated data:", validData);

      // ⚠️ FIX: redefine query instead of assigning
      if (validData.query) {
        Object.defineProperty(req, 'query', {
          value: validData.query,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }

      return next();
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Data Validation Failed here',
          errors: error
        });
      }

      return next(error);
    }
  };
};