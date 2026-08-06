export type { ErrorEnvelope } from "./errors.js";
export {
  OmniraError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UpstreamError,
  InternalError,
  toOmniraError,
} from "./errors.js";

export type { AppConfig } from "./config.js";
export { ConfigError, loadConfig } from "./config.js";

export type { Logger, LoggerOptions } from "./logger.js";
export { createRootLogger, withCorrelationId, getCorrelationId } from "./logger.js";

export type { PermissionGrant } from "./permissions.js";
export { Capability, CAPABILITY_DESCRIPTIONS, RiskTier, isGrantActive } from "./permissions.js";
