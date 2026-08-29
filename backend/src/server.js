require("dotenv").config();
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

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5544",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

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
