const Contact = require("../models/Contact");
const User = require("../models/User");
const Notification = require("../models/Notification");
const socketHandler = require("../utils/socketHandler");

// Submit contact form
const submitContact = async (req, res) => {
  try {
    const { problemType, subject, description, priority } = req.body;
    const user = req.user;

    const normalizedSubject = (subject || "").trim();
    const normalizedDescription = (description || "").trim();

    // Validate
    if (!problemType || !normalizedSubject || !normalizedDescription) {
      return res.status(400).json({ 
        message: "Problem type, subject, and description are required" 
      });
    }

    // Create contact record
    const contact = await Contact.create({
      userId: user._id,
      userName: user.name || "Unknown User",
      userEmail: user.email || "no-email@example.com",
      userPhone: user.phone || "N/A",
      userRole: user.role,
      problemType,
      subject: normalizedSubject,
      description: normalizedDescription,
      priority: priority || "medium",
    });

    // Notify admins about new contact issue
    try {
      const admins = await User.find({ role: "admin", isDeleted: { $ne: true } }).select("_id").lean();
      if (admins.length > 0) {
        const notificationMessage = `New contact from ${contact.userName} (${contact.userRole}) - ${contact.subject}`;
        const payload = admins.map((adminUser) => ({
          userId: adminUser._id,
          title: "New Contact Request",
          message: notificationMessage,
          type: "contact",
          from: user._id,
          link: "/admin/contacts",
          priority: ["high", "urgent"].includes(String(contact.priority || "").toLowerCase()) ? "high" : "normal",
          data: {
            contactId: contact._id,
            problemType: contact.problemType,
            contactPriority: contact.priority,
          },
        }));

        const createdNotifications = await Notification.insertMany(payload, { ordered: false });
        createdNotifications.forEach((notif) => {
          socketHandler.emitToUser(String(notif.userId), "notification", notif.toObject ? notif.toObject() : notif);
        });
      }
    } catch (notifyError) {
      // Notification error handled
    }

    res.status(201).json({
      success: true,
      message: "Your contact request has been submitted. Our team will review it soon.",
      contact,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get user's own contacts
const getUserContacts = async (req, res) => {
  try {
    const contacts = await Contact.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      contacts,
      count: contacts.length,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all contacts (admin only)
const getAllContacts = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: admin only" });
    }

    const { status, priority, userRole, problemType } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (userRole) filter.userRole = userRole;
    if (problemType) filter.problemType = problemType;

    const contacts = await Contact.find(filter)
      .populate("userId", "name email phone")
      .populate("resolvedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const emailSet = new Set();
    contacts.forEach((c) => {
      const populatedUser = c.userId && typeof c.userId === "object" ? c.userId : null;
      const email = String(c.userEmail || c.email || populatedUser?.email || "").trim().toLowerCase();
      if (email) emailSet.add(email);
    });

    const matchedUsers = emailSet.size
      ? await User.find({ email: { $in: Array.from(emailSet) } }).select("email role").lean()
      : [];
    const roleByEmail = new Map(
      matchedUsers.map((u) => [String(u.email || "").toLowerCase(), String(u.role || "").toLowerCase()])
    );

    const inferProblemType = (value = "", subject = "") => {
      const normalized = String(value || "").toLowerCase().trim();
      const allowed = [
        "technical-issue",
        "payment-issue",
        "account-issue",
        "appointment-issue",
        "medical-concern",
        "feedback",
        "other",
      ];
      if (allowed.includes(normalized)) return normalized;

      const text = `${normalized} ${String(subject || "").toLowerCase()}`;
      if (text.includes("payment")) return "payment-issue";
      if (text.includes("appointment") || text.includes("booking")) return "appointment-issue";
      if (text.includes("prescription") || text.includes("medical")) return "medical-concern";
      if (text.includes("account") || text.includes("login") || text.includes("otp")) return "account-issue";
      if (text.includes("feedback") || text.includes("experience") || text.includes("feature")) return "feedback";
      if (text.includes("bug") || text.includes("error") || text.includes("technical") || text.includes("download")) return "technical-issue";
      return "other";
    };

    const normalizedContacts = contacts.map((c) => {
      const populatedUser = c.userId && typeof c.userId === "object" ? c.userId : null;
      const inferredType = inferProblemType(c.problemType || c.type, c.subject);
      const email = String(c.userEmail || c.email || populatedUser?.email || "").trim().toLowerCase();
      const inferredRole = roleByEmail.get(email);

      return {
        ...c,
        userName: c.userName || c.name || populatedUser?.name || "Unknown User",
        userEmail: c.userEmail || c.email || populatedUser?.email || "N/A",
        userPhone: c.userPhone || c.phone || populatedUser?.phone || "N/A",
        userRole: String(c.userRole || populatedUser?.role || inferredRole || "user").toLowerCase(),
        problemType: inferredType,
        description: c.description || c.message || "",
        priority: String(c.priority || "medium").toLowerCase(),
        status: String(c.status || "open").toLowerCase(),
      };
    });

    res.json({
      success: true,
      contacts: normalizedContacts,
      count: normalizedContacts.length,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get single contact
const getContactById = async (req, res) => {
  try {
    const { contactId } = req.params;

    const contact = await Contact.findById(contactId)
      .populate("userId", "name email phone role")
      .populate("resolvedBy", "name email");

    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    // Check authorization (user or admin)
    const contactOwnerId = contact.userId?._id?.toString?.() || contact.userId?.toString?.();
    if (req.user.role !== "admin" && (!contactOwnerId || req.user._id.toString() !== contactOwnerId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const raw = contact.toObject();
    const populatedUser = raw.userId && typeof raw.userId === "object" ? raw.userId : null;

    const inferProblemType = (value = "", subject = "") => {
      const normalized = String(value || "").toLowerCase().trim();
      const allowed = [
        "technical-issue",
        "payment-issue",
        "account-issue",
        "appointment-issue",
        "medical-concern",
        "feedback",
        "other",
      ];
      if (allowed.includes(normalized)) return normalized;

      const text = `${normalized} ${String(subject || "").toLowerCase()}`;
      if (text.includes("payment")) return "payment-issue";
      if (text.includes("appointment") || text.includes("booking")) return "appointment-issue";
      if (text.includes("prescription") || text.includes("medical")) return "medical-concern";
      if (text.includes("account") || text.includes("login") || text.includes("otp")) return "account-issue";
      if (text.includes("feedback") || text.includes("experience") || text.includes("feature")) return "feedback";
      if (text.includes("bug") || text.includes("error") || text.includes("technical") || text.includes("download")) return "technical-issue";
      return "other";
    };

    const isPlaceholder = (v = "") => {
      const normalized = String(v || "").trim().toLowerCase();
      return ["", "unknown user", "n/a", "na", "none", "null", "undefined", "user", "other"].includes(normalized);
    };

    const emailCandidate = String(raw.userEmail || raw.email || populatedUser?.email || "").trim().toLowerCase();
    const matchedUser = emailCandidate
      ? await User.findOne({ email: emailCandidate }).select("name email phone role").lean()
      : null;

    const inferredType = inferProblemType(raw.problemType || raw.type, raw.subject);

    const normalizedContact = {
      ...raw,
      userName: !isPlaceholder(raw.userName)
        ? raw.userName
        : (!isPlaceholder(raw.name)
          ? raw.name
          : (!isPlaceholder(populatedUser?.name)
            ? populatedUser?.name
            : (!isPlaceholder(matchedUser?.name) ? matchedUser?.name : "Unknown User"))),
      userEmail: !isPlaceholder(raw.userEmail)
        ? raw.userEmail
        : (!isPlaceholder(raw.email)
          ? raw.email
          : (!isPlaceholder(populatedUser?.email)
            ? populatedUser?.email
            : (!isPlaceholder(matchedUser?.email) ? matchedUser?.email : "N/A"))),
      userPhone: !isPlaceholder(raw.userPhone)
        ? raw.userPhone
        : (!isPlaceholder(raw.phone)
          ? raw.phone
          : (!isPlaceholder(populatedUser?.phone)
            ? populatedUser?.phone
            : (!isPlaceholder(matchedUser?.phone) ? matchedUser?.phone : "N/A"))),
      userRole: String(raw.userRole || populatedUser?.role || matchedUser?.role || "user").toLowerCase(),
      problemType: inferredType,
      description: raw.description || raw.message || "",
      priority: String(raw.priority || "medium").toLowerCase(),
      status: String(raw.status || "open").toLowerCase(),
      progressStage: String(raw.progressStage || "open").toLowerCase(),
    };

    res.json({
      success: true,
      contact: normalizedContact,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update contact status (admin only)
const updateContactStatus = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: admin only" });
    }

    const { contactId } = req.params;
    const { status, progressStage, adminNotes, adminReply } = req.body;

    const isMeaningfulText = (value = "") => {
      const normalized = String(value || "").trim().toLowerCase();
      if (!normalized) return false;
      return !["no", "n/a", "na", "none", "null", "undefined", "-"].includes(normalized);
    };

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const normalizedStatus = String(status).toLowerCase();
    if (["resolved", "closed"].includes(normalizedStatus) && !isMeaningfulText(adminReply)) {
      return res.status(400).json({
        message: "Meaningful admin reply is required before marking contact as resolved/closed",
      });
    }

    const existingContact = await Contact.findById(contactId).lean();
    if (!existingContact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    const updatePayload = {
      status,
      updatedAt: new Date(),
    };

    if (progressStage !== undefined) updatePayload.progressStage = progressStage;
    if (adminNotes !== undefined) updatePayload.adminNotes = adminNotes;

    // If admin reply is provided, update it
    if (adminReply) {
      updatePayload.adminReply = adminReply;
      updatePayload.repliedAt = new Date();
      updatePayload.repliedBy = req.user._id;
    }

    if (status === "resolved" || status === "closed") {
      updatePayload.resolvedAt = new Date();
      updatePayload.resolvedBy = req.user._id;
    }

    // Use updateOne with runValidators disabled to support legacy contact records
    // that were created using older schema fields.
    await Contact.updateOne({ _id: contactId }, { $set: updatePayload }, { runValidators: false });

    const contact = await Contact.findById(contactId).populate("repliedBy", "name email");

    try {
      const stageLabel = contact.progressStage || contact.status;
      if (contact.userId) {
        const notif = await Notification.create({
          userId: contact.userId,
          title: "Contact Request Updated",
          message: `Your request \"${contact.subject}\" is now in stage: ${stageLabel}`,
          type: "system",
          from: req.user._id,
          link: "/contact-us",
          data: {
            contactId: contact._id,
            status: contact.status,
            progressStage: contact.progressStage,
          },
        });
        socketHandler.emitToUser(String(contact.userId), "notification", notif);
        socketHandler.emitToUser(String(contact.userId), "contact:stage-updated", {
          contactId: String(contact._id),
          status: contact.status,
          progressStage: contact.progressStage,
        });
      }
    } catch (notifyError) {
      // Notification error handled
    }

    res.json({
      success: true,
      message: "Contact status and reply updated successfully",
      contact,
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get contact stats (admin)
const getContactStats = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: admin only" });
    }

    const stats = await Contact.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          open: [
            { $match: { status: "open" } },
            { $count: "count" },
          ],
          inProgress: [
            { $match: { status: "in-progress" } },
            { $count: "count" },
          ],
          resolved: [
            { $match: { status: "resolved" } },
            { $count: "count" },
          ],
          closed: [
            { $match: { status: "closed" } },
            { $count: "count" },
          ],
          urgent: [
            { $match: { priority: "urgent" } },
            { $count: "count" },
          ],
          byType: [
            {
              $group: {
                _id: "$problemType",
                count: { $sum: 1 },
              },
            },
          ],
          byRole: [
            {
              $group: {
                _id: "$userRole",
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    res.json({
      success: true,
      stats: stats[0],
    });
  } catch (error) {
    // Error handled
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  submitContact,
  getUserContacts,
  getAllContacts,
  getContactById,
  updateContactStatus,
  getContactStats,
};
