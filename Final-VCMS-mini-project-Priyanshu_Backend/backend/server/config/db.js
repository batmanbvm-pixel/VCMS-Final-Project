const mongoose = require("mongoose");

const connectDB = async (retries = 5) => {
  try {
    const mongoUri = process.env.MONGO_URI || 
                     process.env.MONGODB_URI || 
                     "mongodb://localhost:27017/vcms";
    
    if (!mongoUri) {
      throw new Error("MONGODB_URI or MONGO_URI environment variable is not set");
    }
    
    // Optimized connection options for MongoDB Atlas (Windows DNS fix)
    const connectionOptions = {
      serverSelectionTimeoutMS: 30000,     // 30 seconds (increased for Windows DNS)
      socketTimeoutMS: 75000,               // 75 seconds for socket operations
      connectTimeoutMS: 30000,              // 30 seconds for initial connection (increased)
      family: 4,                            // Use IPv4 (fixes some connection issues)
      maxPoolSize: 10,                      // Max connection pool size
      minPoolSize: 2,                       // Min connection pool size
      retryWrites: true,                    // Enable automatic retries
      w: "majority",                        // Write concern
      maxIdleTimeMS: 45000,                 // Close idle connections after 45 seconds
      waitQueueTimeoutMS: 10000,            // Wait up to 10 seconds for a connection
      heartbeatFrequencyMS: 10000,          // Check connection health every 10 seconds
      // Windows DNS fix: Add these options to help with SRV resolution
      serverApi: null,                      // Disable strict server API
      ssl: true,                            // Ensure SSL is enabled
      tls: true,                            // Enable TLS
      tlsAllowInvalidCertificates: false,   // Keep certificates valid
      tlsAllowInvalidHostnames: false,      // Keep hostnames valid
    };
    
    await mongoose.connect(mongoUri, connectionOptions);
    
    // Connection event handlers
    mongoose.connection.on("disconnected", () => {
      // Disconnection handled
    });
    
    mongoose.connection.on("error", (err) => {
      // Connection error handled
    });
    
    mongoose.connection.on("reconnected", () => {
      // Reconnection handled
    });
    
    return mongoose.connection;
  } catch (error) {
    // Database connection error handled
    
    if (retries > 0) {
      // Retry scheduled
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retry
      return connectDB(retries - 1);
    } else {
      // Retries exhausted
      process.exit(1);
    }
  }
};

module.exports = connectDB;
