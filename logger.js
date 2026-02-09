// backend/logger.js
const { createLogger, transports, format } = require("winston");

const logger = createLogger({
  level: "error",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.json()
  ),
  transports: [
    new transports.File({ filename: "logs/error.log" }),
    new transports.Console()
  ],
});

module.exports = logger;
