require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const db = require("./database/db");
// register models before sync
require("./database/models/CheckResult");
require("./database/models/User");
require("./database/models/Target");
const apiRoutes = require("./routes/api");
const authRoutes = require("./routes/auth");
const targetRoutes = require("./routes/targets");
const { requireAuth } = require("./middleware/auth");
const importTargetsIfEmpty = require("./config/importTargets");
const { startScheduler } = require("./scheduler");

const origins = (process.env.CLIENT_ORIGIN || "*")
  .split(",")
  .map((o) => o.trim());

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: origins },
});

// make the Socket.IO instance reachable from routes (req.app.get("io"))
app.set("io", io);

app.use(cors({ origin: origins }));
app.use(express.json());

app.get("/", (req, res) => res.send("Monitor Running"));

// public: login
app.use("/api/auth", authRoutes);
// protected: managing targets + viewing monitoring data require a valid token
app.use("/api/targets", targetRoutes);
app.use("/api", requireAuth, apiRoutes);

io.on("connection", (socket) => {
  console.log("Dashboard connected:", socket.id);
  socket.on("disconnect", () => console.log("Dashboard disconnected:", socket.id));
});

const PORT = Number(process.env.PORT) || 5000;

async function bootstrap() {
  try {
    await db.authenticate();
    await db.sync({ alter: true }); // create tables / add new columns
    console.log("Database connected & synced");
    await importTargetsIfEmpty(); // seed targets from targets.json on first boot
  } catch (e) {
    console.error("Database error:", e.message);
    console.error("Server will run, but persistence/REST history is unavailable.");
  }

  startScheduler(io);

  server.listen(PORT, () => console.log(`Monitor server started on :${PORT}`));
}

bootstrap();
