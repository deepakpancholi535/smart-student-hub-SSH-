export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function notFoundHandler(req, res, next) {
  next(new HttpError(404, 'The requested resource was not found.'));
}

export function errorHandler(error, req, res, _next) {
  console.error('Unhandled request error:', {
    method: req.method,
    path: req.originalUrl,
    message: error.message,
    stack: error.stack,
  });
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'The request body contains invalid JSON.' });
  }
  if (error.name === 'ZodError') {
    return res.status(400).json({ message: error.issues[0]?.message || 'Please check the submitted information.' });
  }
  if (error.name === 'MulterError') {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Files must be 5 MB or smaller.' : 'The uploaded file could not be accepted.';
    return res.status(400).json({ message });
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: 'Please check the submitted information.' });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'That account or portfolio URL is already in use.' });
  }
  if (error.status) return res.status(error.status).json({ message: error.message });
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
}
