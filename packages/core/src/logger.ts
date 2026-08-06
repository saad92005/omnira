import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import pino, { type Logger as PinoLogger } from "pino";

export interface Logger {
  trace(obj: Record<string, unknown> | string, msg?: string): void;
  debug(obj: Record<string, unknown> | string, msg?: string): void;
  info(obj: Record<string, unknown> | string, msg?: string): void;
  warn(obj: Record<string, unknown> | string, msg?: string): void;
  error(obj: Record<string, unknown> | string, msg?: string): void;
}

interface RequestContext {
  correlationId: string;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

/** Reads the correlation ID of the current async context, if any. */
export function getCorrelationId(): string | undefined {
  return requestContext.getStore()?.correlationId;
}

/**
 * Runs `fn` with a correlation ID bound to the current async context. Every
 * log line emitted (directly or by anything `fn` calls) during that run
 * carries the same ID, satisfying the "correlation IDs across agent -> tool
 * -> result chains" requirement (master prompt §4.6).
 */
export function withCorrelationId<T>(fn: () => T, correlationId: string = randomUUID()): T {
  return requestContext.run({ correlationId }, fn);
}

function withCorrelation(fields: Record<string, unknown> | string): Record<string, unknown> {
  const base = typeof fields === "string" ? { msg: fields } : fields;
  const correlationId = getCorrelationId();
  return correlationId ? { ...base, correlationId } : base;
}

/**
 * Wraps a pino logger so every call automatically picks up the current
 * correlation ID without every call site having to thread it through.
 */
function createLogger(pinoInstance: PinoLogger): Logger {
  return {
    trace: (obj, msg) =>
      typeof obj === "string" ? pinoInstance.trace(withCorrelation(obj)) : pinoInstance.trace(withCorrelation(obj), msg),
    debug: (obj, msg) =>
      typeof obj === "string" ? pinoInstance.debug(withCorrelation(obj)) : pinoInstance.debug(withCorrelation(obj), msg),
    info: (obj, msg) =>
      typeof obj === "string" ? pinoInstance.info(withCorrelation(obj)) : pinoInstance.info(withCorrelation(obj), msg),
    warn: (obj, msg) =>
      typeof obj === "string" ? pinoInstance.warn(withCorrelation(obj)) : pinoInstance.warn(withCorrelation(obj), msg),
    error: (obj, msg) =>
      typeof obj === "string" ? pinoInstance.error(withCorrelation(obj)) : pinoInstance.error(withCorrelation(obj), msg),
  };
}

export interface LoggerOptions {
  level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  name: string;
  /** Redact these paths from every log line (e.g. ["req.headers.authorization"]). No PII in plaintext logs. */
  redact?: string[];
}

export function createRootLogger(options: LoggerOptions): Logger {
  const pinoInstance = pino({
    name: options.name,
    level: options.level,
    redact: options.redact ?? [],
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
  return createLogger(pinoInstance);
}
