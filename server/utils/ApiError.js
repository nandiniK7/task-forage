/** An error that is safe to show to API clients. `errors` carries per-field messages for forms. */
export default class ApiError extends Error {
  constructor(status, message, { errors, code } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.code = code;
  }

  static badRequest(message, options) { return new ApiError(400, message, options); }
  static unauthorized(message = "Authentication required.", options) { return new ApiError(401, message, options); }
  static forbidden(message = "You do not have permission to do that.") { return new ApiError(403, message); }
  static notFound(message = "Resource not found.") { return new ApiError(404, message); }
  static conflict(message) { return new ApiError(409, message); }
}
