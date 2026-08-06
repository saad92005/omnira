import awsLambdaFastify from "@fastify/aws-lambda";
import { createRootLogger, loadConfig } from "@omnira/core";
import { createDbClient } from "../../src/db.js";
import { buildServer } from "../../src/http/build-server.js";

/**
 * Netlify Functions entry point — wraps the same Fastify app used by the
 * persistent-server deployment (apps/api/src/index.ts) in an AWS
 * Lambda-compatible handler. Module-scope initialization (config, db
 * client, the built app) runs once per cold start and is reused across
 * warm invocations of the same function container, same as any Lambda.
 *
 * Classic `exports.handler`-style (via awsLambdaFastify) rather than
 * Netlify's newer Fetch-Request-based function signature, specifically so
 * @fastify/aws-lambda's proxy-event adapter applies — Netlify auto-detects
 * this style from the export shape, no extra config needed.
 */
const config = loadConfig();
const logger = createRootLogger({ level: config.LOG_LEVEL, name: "omnira-api" });
const db = createDbClient(config.DATABASE_URL);
const app = buildServer({ config, logger, db });

export const handler = awsLambdaFastify(app);
