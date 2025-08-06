const asyncHandler = (fn) => // Removed type annotation
  (req, res, next) => { // Removed type annotations
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export { asyncHandler };