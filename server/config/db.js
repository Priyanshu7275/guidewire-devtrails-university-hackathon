/*
 * config/db.js
 * -----------------------------------------------------------------------
 * MongoDB connection setup using Mongoose.
 *
 * Mongoose is an ODM (Object-Document Mapper) library for MongoDB. It
 * lets us define schemas (like table definitions in SQL) and then work
 * with "models" that map to MongoDB collections.
 *
 * This module exports a single async function `connectDB`. We call it
 * once from server.js during app startup. If the connection fails, we
 * log the error and exit the process -- there is no point running the
 * API server if we have no database.
 *
 * Usage:
 *   const connectDB = require('./config/db');
 *   await connectDB();
 * -----------------------------------------------------------------------
 */

const mongoose = require('mongoose');
const { MONGODB_URI } = require('./keys');

/**
 * connectDB
 * Establishes a connection to MongoDB using the URI from environment
 * variables. Logs success or failure to the console.
 *
 * @returns {Promise<void>}
 */
async function connectDB() {
  try {
    // mongoose.connect returns a promise. We await it so that any error
    // is caught by the catch block below.
    const conn = await mongoose.connect(MONGODB_URI, {
      // These options suppress deprecation warnings from the MongoDB
      // Node driver. They are recommended for Mongoose 6+.
      // (In Mongoose 8 they are the defaults, but being explicit is fine.)
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    // Log the specific error message so we know exactly what went wrong
    // (e.g. wrong URI, MongoDB not running, network issue).
    console.error(`MongoDB connection error: ${err.message}`);

    // Exit the Node process with code 1 (non-zero = failure).
    // This causes the OS / process manager (PM2, Docker) to restart the
    // service, which is the correct behaviour when the DB is temporarily
    // unavailable.
    process.exit(1);
  }
}

module.exports = connectDB;
