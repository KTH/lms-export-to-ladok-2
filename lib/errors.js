const log = require("skog").default;
/* eslint max-classes-per-file: */

/**
 * Common ancestor of all operational errors allowing
 * for more catch all checks.
 */
class OperationalError extends Error {
  constructor(name, statusCode, type, message, details, err) {
    super(message);
    this.name = name;
    this.statusCode = statusCode;
    this.type = type;
    this.details = details;
    this.err = err;
  }
}

/**
 * Error for recoverable programmer errors. This tells the consuming
 * code that it shouldn't crash the application.
 */
class RecoverableError extends Error {
  constructor({ message = "We encountered an error in our code.", err }) {
    super(message);
    this.name = "RecoverableError";
    this.err = err;
  }
}

/**
 * AuthError should be handled by the frontend
 * api client.
 */
class AuthError extends OperationalError {
  constructor({ type, message, details, err }) {
    super("AuthError", 401, type, message, details, err);
  }
}

/**
 * All errors of type EndpointError must be
 * handled by the frontend code that calls the
 * actual endpoint.
 */
class EndpointError extends OperationalError {
  // Errors that must be handled by frontend
  constructor({ type, statusCode, message, details, err }) {
    super("EndpointError", statusCode, type, message, details, err);
  }
}

/**
 * All errors of type "LadokApiError" are known problems that happened when
 * calling out external api
 */
class LadokApiError extends OperationalError {
  constructor({ type, message, details, err }) {
    super("LadokApiError", 503, type, message, details, err);
  }
}

/**
 * All errors of type "CanvasApiError" are known problems that happened when
 * calling out external api
 */
class CanvasApiError extends OperationalError {
  constructor({ type, message, details, err }) {
    super("CanvasApiError", 503, type, message, details, err);
  }
}

/**
 * All errors of type "MongoDbError" are known problems that happened when
 * calling out external api
 */
class MongoDbError extends OperationalError {
  constructor({ type, message, details, err }) {
    super("MongoDbError", 503, type, message, details, err);
  }
}

function isOperationalOrRecoverableError(err) {
  return err instanceof OperationalError || err instanceof RecoverableError;
}

// Find a wrapped programmer error
function getOrigProgrammerError(error) {
  const { err } = error;
  let result;
  if (isOperationalOrRecoverableError(err)) {
    // .err is an OperationalError so need to check if
    // that in turn constains a wrapped error
    result = getOrigProgrammerError(err);
  } else if (err instanceof Error) {
    result = err;
  }
  return result;
}

// Find the innermost wrapped operational or recoverable error
function getMostSignificantError(error) {
  const { err } = error;
  if (isOperationalOrRecoverableError(err)) {
    // If we have wrapped an Operational or Recoverable error
    // that is the cause and what should be logged
    return getMostSignificantError(err);
  }

  return error;
}

function _formatErrorMsg(name, type, message) {
  return `(${name}${type ? "/" + type : ""}) ${message}`;
}

function errorHandler(err, req, res, next) {
  if (err instanceof AuthError) {
    // Simple auth errors
    log.warn(err);
    // Add error details if provided for debugging
    if (err.details) log.debug(err.details);
  } else if (err instanceof EndpointError) {
    /**
     * An EndpointError can be caused in four ways:
     * 1. Thrown by endpoint handler but there was no error in the code
     * 2. Thrown by endpoint handler due to an error in the code
     * 3. An [Name]ApiError was caught which wasn't caused by an error in the code
     * 4. An [Name]ApiError was caught which in turn was caused by an error in the code
     *
     * Alternative 2 & 4 will have a wrapped programmer error.
     */
    // Since EndpointErrors can wrap other errors we want to make sure we log the most significant error
    // and the underlying programmer error if one exists
    const logErr = getMostSignificantError(err);
    const progErr = getOrigProgrammerError(err);

    if (progErr === undefined) {
      // If the EndpointError wasn't caused by a programmer error we only need to inform about it.
      log.info(logErr);
    } else {
      // If it was a programmer error it needs to be logged and fixed.
      log.error(
        progErr, // this provides a stack trace for the original error that needs to be fixed
        _formatErrorMsg(logErr.name, logErr.type, logErr.message)
      );
    }
    // Add error details if provided for debugging.
    if (logErr.details) log.debug(logErr.details);
  } else if (isOperationalOrRecoverableError(err)) {
    // These errors should always be wrapped in EndpointError so we log the
    // outer most error to know what we have missed in our endpoint code
    log.warn(
      "The following error should be wrapped in an EndpointError for consistency:"
    );

    log.error(
      getOrigProgrammerError(err), // this provides a stack trace for the original error that needs to be fixed
      _formatErrorMsg(err.name, err.type, err.message)
    );
    // Add error details if provided for debugging
    if (err.details) log.debug(err.details);
  } else {
    // All other passed errors should always be logged as error
    log.error(err);
  }

  if (res.headersSent) {
    return next(err);
  }

  const error = {
    type: err.type || "error",
    message:
      err.message || "An unknown error occured. Please contact IT-support.",
    statusCode: err.statusCode,
  };

  // NOTE: react-hooks appears to add the response object body to a prop error so
  // we need to flatten the error object one level to avoid nested error.error
  return res.status(err.statusCode !== undefined ? err.statusCode : 500).send({
    ...error,
  });
}

function ladokGenericErrorHandler(err) {
  Error.captureStackTrace(err, ladokGenericErrorHandler);
  switch (err.body && err.body.Felgrupp) {
    case "commons.fel.grupp.felaktig_status": // status på data
    case "commons.fel.grupp.domanregel": // användarrättigheter
    case "commons.fel.grupp.felaktigt_varde": // examinationsdatum före studiestart
      throw new LadokApiError({
        type: "rule_error",
        message: err.body.Meddelande,
        err, // Pass the original error
      });
    case "commons.fel.grupp.auktorisering":
      throw new LadokApiError({
        type: "auth_error",
        message: `We got auth error when trying to access Ladok (${
          err.body && err.body.Meddelande
        })`,
        err, // Pass the original error
      });
    default:
      throw new LadokApiError({
        type: "unhandled_error",
        message: "We encountered an error when trying to access Ladok",
        err, // Pass the original error
      });
  }
}

function canvasGenericErrorHandler(err) {
  Error.captureStackTrace(err, canvasGenericErrorHandler);
  const error = new CanvasApiError({
    type: "unhandled_error",
    message: "We encountered an error when trying to access Canvas",
    err, // Pass the original error
  });
  throw error;
}

function mongodbGenericErrorHandler(err) {
  Error.captureStackTrace(err, mongodbGenericErrorHandler);
  const error = new MongoDbError({
    type: "unhandled_error",
    message: "We encountered an error when trying to access MongoDb",
    err, // Pass the original error
  });
  throw error;
}

module.exports = {
  errorHandler,
  ladokGenericErrorHandler,
  canvasGenericErrorHandler,
  mongodbGenericErrorHandler,
  EndpointError,
  OperationalError,
  RecoverableError,
  LadokApiError,
  CanvasApiError,
  MongoDbError,
};
