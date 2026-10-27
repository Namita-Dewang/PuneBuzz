// An expected, client-facing failure. errorHandler turns it into
// { error: { code, message, details? } } with the given HTTP status.
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

module.exports = AppError;
