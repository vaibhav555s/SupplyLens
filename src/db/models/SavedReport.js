const mongoose = require('mongoose');

const savedReportSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    companyName: { type: String, required: true, trim: true },
    pdfBase64: { type: String, required: true },
}, { timestamps: true });

// One report per user per company (upsert on save)
savedReportSchema.index({ userId: 1, companyName: 1 }, { unique: true });

module.exports = mongoose.model('SavedReport', savedReportSchema);
