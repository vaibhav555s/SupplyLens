/**
 * MongoDB Connection — Mongoose singleton.
 * Connects to MongoDB Atlas on server startup.
 */
const mongoose = require('mongoose');
const config = require('../config');

let isConnected = false;

async function connectDB() {
    if (isConnected) return;

    const uri = config.mongodbUri;
    if (!uri) {
        console.warn('[MongoDB] No MONGODB_URI set — dashboard persistence disabled');
        return;
    }

    try {
        await mongoose.connect(uri, {
            dbName: 'scxray',
        });
        isConnected = true;
        console.log('[MongoDB] ✓ Connected to Atlas');
    } catch (err) {
        console.error('[MongoDB] Connection failed:', err.message);
    }
}

function isDBConnected() {
    return isConnected;
}

module.exports = { connectDB, isDBConnected };
