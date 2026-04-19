/**
 * Cached Graph Model
 *
 * Stores the fully computed & enriched supply chain graph so
 * subsequent requests for the same company return instantly
 * without re-running LLM inference, deduplication, and OFAC scoring.
 */
const mongoose = require('mongoose');

const cachedGraphSchema = new mongoose.Schema({
    companyName: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
        lowercase: true // Normalised for case-insensitive exact matching
    },
    graphData: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('CachedGraph', cachedGraphSchema);
