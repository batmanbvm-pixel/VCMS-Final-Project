const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser"); // ✅ NEW: For httpOnly cookie support
const connectDB = require("./config/db");
const Appointment = require("./models/Appointment");
const User = require("./models/User");
const Notification = require("./models/Notification");
const { sendSystemEmail } = require("./utils/emailOtp");

// Security middleware
const {
  helmetMiddleware,
  corsMiddleware,
  securityHeaders,
  requestSizeLimiter,
  parameterPollutionProtection,
} = require("./middleware/securityConfig");

const {
  sanitizeInput,
  sanitizeXSS,
} = require("./middleware/inputSanitizer");

const SecurityService = require("./middleware/securityService");

const {
  globalLimiter,
  authLimiter,
  registerLimiter,
  criticalOperationLimiter,
} = require("./middleware/advancedRateLimiter");

const {
  trackAuthAttempt,
  trackDataModification,
  trackUnauthorizedAccess,
  trackDataAccess,
} = require("./middleware/auditLogger");

dotenv.config({ path: path.join(__dirname, ".env") });

// NOTE: DB connection is awaited inside main() below — do NOT call connectDB() here

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 5000;
const PORT_RETRY_LIMIT = Number(process.env.PORT_RETRY_LIMIT) || 5;

/* =========================================================
   ✅ SECURITY + CORS SETUP
========================================================= */

// 1️⃣ Helmet
app.use(helmetMiddleware);

// 2️⃣ CORS (IMPORTANT FIX)
app.use(corsMiddleware);
app.options("*", corsMiddleware); // Fix preflight

// 3️⃣ Custom Security Headers
app.use(securityHeaders);

// 4️⃣ Request size limit
app.use(requestSizeLimiter("10mb"));

// 5️⃣ Parameter pollution protection
app.use(parameterPollutionProtection);

// 6️⃣ Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ NEW: 6️⃣A Cookie parsing (for httpOnly refresh tokens)
app.use(cookieParser());

// 7️⃣ Input sanitization
app.use(sanitizeInput);
app.use(sanitizeXSS);

// 8️⃣ Global rate limiting
app.use(globalLimiter);

// 9️⃣ Audit logging (simplified for college project)
app.use(trackAuthAttempt);
app.use(trackDataModification);
app.use(trackUnauthorizedAccess);
app.use(trackDataAccess);

// Enforcement middleware: CSRF validation, payload scanning
app.use(SecurityService.enforcementMiddleware);

/* =========================================================
   ✅ ROUTES
========================================================= */

const authRoutes = require("./routes/authRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const medicalHistoryRoutes = require("./routes/medicalHistoryRoutes");
const videoRoutes = require("./routes/videoRoutes");
const chatRoutes = require("./routes/chatRoutes");
const securityRoutes = require("./routes/securityRoutes");
const consultationRoutes = require("./routes/consultationRoutes"); // ✅ NEW: Consultation form routes
const contactRoutes = require("./routes/contactRoutes"); // ✅ NEW: Contact form routes
const publicRoutes = require("./routes/publicRoutes"); // ✅ NEW: Public/guest routes
const aiRoutes = require("./routes/aiRoutes"); // ✅ NEW: AI/OCR routes
const medicalIntelligenceRoutes = require("./routes/medicalIntelligenceRoutes"); // ✅ NEW: Medical Intelligence routes

// Auth rate limiting
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", registerLimiter);

// 🔥 Routes (CSRF removed for college project - using JWT only)
app.use("/api/public", publicRoutes); // ✅ NEW: Public routes (no auth required)
app.use("/api/auth", authRoutes);  // No CSRF for auth routes
app.use("/api/appointments", appointmentRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/medical-history", medicalHistoryRoutes);
app.use("/api/consultations", consultationRoutes); // ✅ NEW: Consultation form routes
app.use("/api/notifications", notificationRoutes);
app.use("/api/video", videoRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/contact", contactRoutes); // ✅ NEW: Contact routes
app.use("/api/security", securityRoutes);
app.use("/api/ai", aiRoutes); // ✅ NEW: AI/OCR routes
app.use("/api/medical-intelligence", medicalIntelligenceRoutes); // ✅ NEW: Medical Intelligence routes

/* =========================================================
   ✅ HEALTH + ROOT
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    csrfToken: res.locals.csrfToken,
  });
});

app.get("/", (req, res) => {
  res.send("🔐 Secure VCMS Backend Running...");
});

/* =========================================================
   ✅ SOCKET.IO SETUP (FIXED CORS)
========================================================= */

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (
        !origin ||
        /^https?:\/\/localhost:\d+$/.test(origin) ||
        /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin)
      ) {
        callback(null, true);
      } else if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const socketHandler = require("./utils/socketHandler");
socketHandler.init(io);

const onlineUsers = new Map();
socketHandler.setOnlineUsersMap(onlineUsers);
const waitingAlertThrottle = new Map();

io.on("connection", (socket) => {

  // ✅ NEW: User connected - register socket and update online status
  socket.on("user-connected", (data) => {
    const userId = data.userId || data;
    onlineUsers.set(userId, socket.id);
    socketHandler.registerSocket(socket.id, userId);

    // Emit user online to everyone
    io.emit("user-online", {
      userId,
      socketId: socket.id,
      connectedAt: new Date().toISOString(),
    });
  });

  // ✅ NEW: User reconnected - restore session and deliver queued events
  socket.on("user-reconnected", (data) => {
    const userId = data.userId || data;
    const previousRooms = data.previousRooms || [];

    // Update socket mapping
    onlineUsers.set(userId, socket.id);
    socketHandler.registerSocket(socket.id, userId);

    // Rejoin previous rooms
    previousRooms.forEach((roomId) => {
      socket.join(roomId);
      socketHandler.addUserToRoom(userId, roomId);

      // Notify others in room that user rejoined
      io.to(roomId).emit("user-rejoined-room", {
        userId,
        roomId,
        timestamp: new Date().toISOString(),
      });
    });

    // Deliver queued events
    socketHandler.deliverQueuedEvents(userId, socket.id);

    // Send session info to client
    const sessionInfo = socketHandler.getUserSessionInfo(userId);
    socket.emit("session-restored", {
      rooms: previousRooms,
      queuedEventsCount: sessionInfo?.queuedEventsCount || 0,
      timestamp: new Date().toISOString(),
    });
  });

  // ✅ ENHANCED: Join room with session tracking
  socket.on("join-room", (data) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    const userId = data.userId;

    socket.join(roomId);

    if (userId) {
      socketHandler.addUserToRoom(userId, roomId);
    }

    // Notify room that user joined
    io.to(roomId).emit("user-joined-room", {
      userId,
      roomId,
      timestamp: new Date().toISOString(),
    });
  });

  // ✅ ENHANCED: Leave room with cleanup
  socket.on("leave-room", (data) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    const userId = data.userId;

    socket.leave(roomId);

    if (userId) {
      socketHandler.removeUserFromRoom(userId, roomId);
    }

    // Notify room that user left
    io.to(roomId).emit("user-left-room", {
      userId,
      roomId,
      timestamp: new Date().toISOString(),
    });
  });

  // ✅ NEW: Store session data for persistence
  socket.on("store-session-data", (data) => {
    const { userId, key, value } = data;
    if (userId && key) {
      socketHandler.setSessionData(userId, key, value);
    }
  });

  // ✅ NEW: Get session data
  socket.on("get-session-info", (userId, callback) => {
    const sessionInfo = socketHandler.getUserSessionInfo(userId);
    if (callback) {
      callback(sessionInfo);
    }
  });

  // ✅ ENHANCED: Video consultation events
  socket.on("video:offer", (data) => {
    const { to, offer, roomId, appointmentId } = data;
    const userId = onlineUsers.get(socket.id);
    socketHandler.emitToUser(to, "video:offer", {
      offer,
      from: userId || socket.id,
      roomId,
      appointmentId,
    }, onlineUsers);
  });

  socket.on("video:answer", (data) => {
    const { to, answer, roomId, appointmentId } = data;
    const userId = onlineUsers.get(socket.id);
    socketHandler.emitToUser(to, "video:answer", {
      answer,
      from: userId || socket.id,
      roomId,
      appointmentId,
    }, onlineUsers);
  });

  socket.on("video:ice-candidate", (data) => {
    const { to, candidate, roomId, appointmentId } = data;
    const userId = onlineUsers.get(socket.id);
    socketHandler.emitToUser(to, "video:ice-candidate", {
      candidate,
      from: userId || socket.id,
      roomId,
      appointmentId,
    }, onlineUsers);
  });

  socket.on("video:end-call", (data) => {
    const { to, roomId, appointmentId } = data;
    const userId = onlineUsers.get(socket.id);
    socketHandler.emitToUser(to, "video:end-call", {
      from: userId || socket.id,
      roomId,
      appointmentId,
    }, onlineUsers);
  });

  // Signal from patient that they are ready — triggers doctor to create WebRTC offer
  socket.on("video:user-ready", (data) => {
    const { to, appointmentId } = data;
    const userId = onlineUsers.get(socket.id);
    socketHandler.emitToUser(to, "video:user-ready", {
      from: userId || socket.id,
      appointmentId,
    }, onlineUsers);
  });

  // Presence signal for dashboard/video waiting indicators
  socket.on("video:waiting-status", async (data) => {
    const { to, appointmentId, waiting, role } = data || {};
    // socketUserMap (socketId → userId) gives the correct sender identity;
    // onlineUsers is userId → socketId so cannot be used with socket.id as key.
    const userId = socketHandler.getUserIdBySocket(socket.id) || socket.handshake.auth?.userId;

    if (!to || !appointmentId) return;

    const fromUserId = String(userId || "");
    let fromUser = null;
    let toUser = null;
    let appointment = null;

    try {
      [fromUser, toUser, appointment] = await Promise.all([
        fromUserId ? User.findById(fromUserId).select("name email role") : null,
        User.findById(to).select("name email role"),
        Appointment.findById(appointmentId).select("status patientId doctorId date time"),
      ]);

      // Keep appointment flow synchronized: when either side joins from confirmed state,
      // mark as in-progress and notify both dashboards.
      if (waiting && appointment && appointment.status === "confirmed") {
        appointment.status = "in-progress";
        await appointment.save();
        socketHandler.emitAppointmentStatusChanged(
          appointment._id,
          appointment.patientId,
          appointment.doctorId,
          "in-progress"
        );
      }
    } catch (_) {
      // Enrichment failure should not block socket relay
    }

    socketHandler.emitToUser(to, "video:waiting-status", {
      from: userId || socket.id,
      fromName: fromUser?.name || "",
      appointmentId,
      waiting: !!waiting,
      role,
    }, onlineUsers);

    // Notify + email only when user starts waiting (avoid spam on false state)
    if (!waiting || !fromUser || !toUser || !appointment) return;

    const throttleKey = `${appointmentId}:${fromUserId}->${String(to)}`;
    const now = Date.now();
    const lastSentAt = waitingAlertThrottle.get(throttleKey) || 0;
    if (now - lastSentAt < 90 * 1000) return;
    waitingAlertThrottle.set(throttleKey, now);

    const isDoctorWaiting = String(role || "").toLowerCase() === "doctor";
    const fromName = String(fromUser.name || (isDoctorWaiting ? "Doctor" : "Patient"));
    const toName = String(toUser.name || "User");
    const doctorDisplay = `Dr. ${fromName.replace(/^dr\.?\s*/i, "").trim()}`;
    const frontendBase = String(process.env.FRONTEND_URL || "http://localhost:8080").replace(/\/$/, "");
    const joinLink = `${frontendBase}/video/${appointmentId}`;
    const aptDate = appointment?.date ? new Date(appointment.date).toLocaleDateString("en-IN") : "Today";
    const aptTime = appointment?.time || "Scheduled time";

    const title = isDoctorWaiting
      ? "Doctor is waiting - Join now"
      : "Patient joined - Please join now";

    const message = isDoctorWaiting
      ? `${doctorDisplay}'s appointment is in progress. Please join now.`
      : `Patient ${fromName} joined. Please join now.`;

    try {
      const notif = await Notification.create({
        userId: toUser._id,
        title,
        message,
        type: "appointment",
        from: fromUser._id,
        link: `/video/${appointmentId}`,
        priority: "high",
        data: {
          appointmentId,
          waiting: true,
          role,
          fromName,
        },
      });
      socketHandler.emitToUser(String(toUser._id), "notification", notif, onlineUsers);
    } catch (_) {
      // Notification creation failure should not block flow
    }

    try {
      await sendSystemEmail({
        to: toUser.email,
        subject: `MediConnect: ${title}`,
        text: `${message}\n\nAppointment: ${aptDate} ${aptTime}\nJoin now: ${joinLink}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border:1px solid #a7f3d0; border-radius: 10px; overflow:hidden;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 20px;">
              <h2 style="margin:0; font-size:18px;">${title}</h2>
            </div>
            <div style="padding: 18px 20px; background:#ecfdf5;">
              <p style="margin:0 0 10px; color:#065f46; font-size:15px;"><strong>Hello ${toName},</strong></p>
              <p style="margin:0 0 12px; color:#047857; font-size:14px;">${message}</p>
              <p style="margin:0 0 16px; color:#065f46; font-size:13px;">Appointment: <strong>${aptDate}</strong> at <strong>${aptTime}</strong></p>
              <a href="${joinLink}" style="display:inline-block; background:#059669; color:white; text-decoration:none; padding:10px 14px; border-radius:8px; font-weight:700;">Join Video Consultation</a>
              <p style="margin:12px 0 0; color:#065f46; font-size:12px;">If button does not open, copy this link in browser:</p>
              <p style="margin:4px 0 0; color:#047857; font-size:12px; word-break: break-all;">${joinLink}</p>
            </div>
          </div>
        `,
      });
    } catch (_) {
      // Email failure should not block real-time flow
    }
  });

  // ✅ NEW: Consultation completion event
  socket.on("consultation:completed", (data) => {
    const { appointmentId, completedBy, targetUserId } = data;
    socketHandler.emitToUser(targetUserId, "consultation:completed", {
      appointmentId,
      completedBy,
      timestamp: new Date().toISOString(),
    });
  });

  // ✅ ENHANCED: Chat events
  socket.on("chat:message", (data) => {
    const { to, message, roomId } = data;
    socketHandler.emitToUser(to, "chat:message", {
      message,
      from: socket.id,
      roomId,
      timestamp: new Date().toISOString(),
    });
  });

  // ✅ NEW: Real-time appointment status changes
  socket.on("appointment:status-changed", (data) => {
    const { appointmentId, patientId, doctorId, status } = data;
    socketHandler.emitAppointmentStatusChanged(
      appointmentId,
      patientId,
      doctorId,
      status
    );
  });

  // ✅ NEW: Real-time prescription issued
  socket.on("prescription:issued", (data) => {
    const { prescriptionId, patientId, doctorId } = data;
    socketHandler.emitPrescriptionIssued(prescriptionId, patientId, doctorId);
  });

  // ✅ NEW: Doctor approval changed
  socket.on("doctor:approved", (data) => {
    const { doctorId, doctor } = data;
    socketHandler.emitDoctorApproved(doctorId, doctor);
  });

  // ✅ NEW: Doctor rejected
  socket.on("doctor:rejected", (data) => {
    const { doctorId, reason } = data;
    socketHandler.emitDoctorRejected(doctorId, reason);
  });

  // ✅ NEW: Broadcast admin event
  socket.on("admin:broadcast", (data) => {
    const { event, payload } = data;
    socketHandler.emitToAllAdmins(event, payload);
  });

  // ✅ NEW: Disconnect handler with session cleanup
  socket.on("disconnect", () => {
    let disconnectedUserId = null;

    // Find and remove user from online map
    for (const [userId, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(userId);
        socketHandler.unregisterSocket(socket.id);
        disconnectedUserId = userId;

        // Emit user offline event
        io.emit("user-offline", {
          userId,
          disconnectedAt: new Date().toISOString(),
        });

        break;
      }
    }
  });

  // ✅ NEW: Handle errors
  socket.on("error", (error) => {
    // Socket error handled
  });
});

/* =========================================================
   ✅ ERROR HANDLER
========================================================= */

const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

/* =========================================================
   ✅ START SERVER
========================================================= */

// ── startup helpers ────────────────────────────────────────────────────────

let currentPort = PORT;
let remainingPortRetries = PORT_RETRY_LIMIT;

const doListen = (port) =>
  new Promise((resolve, reject) => {
    currentPort = port;

    const onError = (error) => {
      server.removeListener("error", onError);
      if (error.code === "EADDRINUSE") {
        if (remainingPortRetries <= 0) {
          return reject(
            new Error(
              `Port ${port} is already in use and all retries exhausted. Free port ${PORT} and restart.`
            )
          );
        }
        const nextPort = port + 1;
        remainingPortRetries -= 1;
        // Port retry handled
        setTimeout(() => doListen(nextPort).then(resolve).catch(reject), 300);
      } else {
        reject(error);
      }
    };

    server.once("error", onError);
    server.listen(port, () => {
      server.removeListener("error", onError);
      resolve(port);
    });
  });

// ── main ────────────────────────────────────────────────────────────────────
// Connect to DB FIRST, then open HTTP — this prevents 500 errors during DB warmup

const main = async () => {
  try {
    console.log("🚀 Starting VCMS Server...");
    await connectDB();
    const actualPort = await doListen(PORT);
    console.log(`✅ Server running on port ${actualPort}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  } catch (err) {
    console.error("💥 Server startup failed:", err.message);
    process.exit(1);
  }
};

main();
