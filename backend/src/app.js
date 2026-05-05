import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.js";
import loanRoutes from "./routes/loan.js";
import analyticsRoutes from "./routes/analytics.js";

dotenv.config();

const app = express();

// Security headers
app.use(helmet());

// CORS — restrict to known origins in production
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// Rate limiting — auth endpoints get stricter limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again after 15 minutes" },
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,                 // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", loanRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;
const DEFAULT_DB = process.env.MONGO_DB_NAME || "lendingRiskDB";
const RAW_MONGO_URI = process.env.MONGO_URI || `mongodb://localhost:27017/${DEFAULT_DB}`;

function normalizeMongoUri(uri) {
  try {
    // If the URI already includes a db name, keep it.
    // If not (pathname is "/" or empty), append the default db name.
    const u = new URL(uri);
    const isMongoSrv = u.protocol === "mongodb+srv:" || u.protocol === "mongodb:";
    if (!isMongoSrv) return uri;
    if (!u.pathname || u.pathname === "/") {
      u.pathname = `/${DEFAULT_DB}`;
      return u.toString();
    }
    return uri;
  } catch {
    // If it's not a WHATWG URL (rare), fall back to raw value.
    return uri;
  }
}

const MONGO_URI = normalizeMongoUri(RAW_MONGO_URI);

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

export default app;