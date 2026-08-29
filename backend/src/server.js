const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { connectDb } = require("./config/db");
const { resumeAllLiveSyncs } = require("./services/liveSyncManager");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const eventRoutes = require("./routes/events");
const ticketRoutes = require("./routes/tickets");
const gateRoutes = require("./routes/gates");
const scanRoutes = require("./routes/scan");
const dataSourceRoutes = require("./routes/dataSources");
const auditLogRoutes = require("./routes/auditLogs");
const analyticsRoutes = require("./routes/analytics");

const app = express();

// nginx sits in front of this app in production and adds X-Forwarded-For —
// without this, express-rate-limit throws on that header since Express
// doesn't trust proxy headers by default (security default, since a
// direct client could otherwise spoof this header to bypass rate limits).
// "1" means trust exactly one hop (nginx) — correct for this setup.
app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5544",
  "https://passscan.eitfaridabad.co.in",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // no origin (e.g. curl/Postman/server-to-server) — allow
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// general API rate limit — specific stricter limits (e.g. login) are
// applied per-route on top of this
app.use(
  "/api",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 300 })
);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/events/:eventId", gateRoutes);
app.use("/api/events/:eventId", scanRoutes);
app.use("/api/events/:eventId", dataSourceRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("/api/health", (req, res) => res.json({ success: true, data: { status: "ok" } }));

// consistent error shape — never leak stack traces to clients
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.publicMessage || "Something went wrong",
    code: err.code || "INTERNAL_ERROR",
  });
});

const PORT = process.env.PORT || 3012;

connectDb()
  .then(async () => {
    await resumeAllLiveSyncs().catch((err) => console.error("[server] resumeAllLiveSyncs failed:", err.message));
    app.listen(PORT, () => console.log(`[server] listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("[server] failed to connect to MongoDB:", err.message);
    process.exit(1);
  });