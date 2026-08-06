import { createRootLogger, loadConfig } from "@omnira/core";
import { createDbClient } from "./db.js";
import { buildServer } from "./http/build-server.js";

const config = loadConfig();
const logger = createRootLogger({ level: config.LOG_LEVEL, name: "omnira-api" });
const db = createDbClient(config.DATABASE_URL);

const app = buildServer({ config, logger, db });

app
  .listen({ port: config.API_PORT, host: "0.0.0.0" })
  .then(() => logger.info(`Listening on port ${config.API_PORT}`))
  .catch((err: unknown) => {
    logger.error({ err }, "Failed to start server");
    process.exitCode = 1;
  });
