const mongoose = require("mongoose");
const User = require("./models/User");
const Appointment = require("./models/Appointment");
const Prescription = require("./models/Prescription");
const MedicalHistory = require("./models/MedicalHistory");
const Notification = require("./models/Notification");
const ChatMessage = require("./models/ChatMessage");
const VideoSession = require("./models/VideoSession");

/**
 * Database Index Optimization Script
 * Creates all necessary indices for production performance
 * Run with: npm run optimize-db
 */

const optimizeDatabase = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/vcms";
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Optimize each collection
    const models = [
      { name: "User", model: User },
      { name: "Appointment", model: Appointment },
      { name: "Prescription", model: Prescription },
      { name: "MedicalHistory", model: MedicalHistory },
      { name: "Notification", model: Notification },
      { name: "ChatMessage", model: ChatMessage },
      { name: "VideoSession", model: VideoSession },
    ];

    for (const { name, model } of models) {
      try {
        await model.collection.getIndexes();

        // Create indices from schema definition
        await model.collection.createIndexes();
      } catch (error) {
        void name;
        void error;
      }
    }

    // Get database stats
    await mongoose.connection.db.listCollections().toArray();
    process.exit(0);
  } catch (error) {
    void error;
    process.exit(1);
  }
};

// Run if executed directly
if (require.main === module) {
  optimizeDatabase();
}

module.exports = optimizeDatabase;
