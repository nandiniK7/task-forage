import mongoose from "mongoose";
import env from "./env.js";

const connectDB = async (uri = env.mongoUri, dbName = env.mongoDbName) => {
  mongoose.connection.on("error", (error) => console.error("MongoDB error:", error.message));
  mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));

  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
  console.log("MongoDB connected");
  return mongoose.connection;
};

export default connectDB;
