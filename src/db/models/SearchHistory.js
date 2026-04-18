/**
 * SearchHistory Model — Mongoose schema for saved dashboard searches.
 */
const mongoose = require('mongoose');

const tier1SupplierSchema = new mongoose.Schema({
    label: String,
    country: String,
    type: String,
    risk_score: Number,
}, { _id: false });

const searchHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyName: { type: String, required: true, index: true },
    country: { type: String, default: 'US' },
    flag: { type: String, default: '🏢' },
    hsnCodes: [String],
    tier1Suppliers: [tier1SupplierSchema],
    tier1Count: { type: Number, default: 0 },
    totalNodes: { type: Number, default: 0 },
    maxTier: { type: Number, default: 0 },
    riskFlags: {
        sanctions: { type: Number, default: 0 },
        highRisk: { type: Number, default: 0 },
        clear: { type: Number, default: 0 },
    },
    concentrationRisk: {
        country: String,
        percentage: Number,
    },
}, {
    timestamps: true, // adds createdAt + updatedAt
});

// Index for sorting by most recent
searchHistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('SearchHistory', searchHistorySchema);
