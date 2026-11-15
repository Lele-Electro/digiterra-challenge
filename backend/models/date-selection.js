const mongoose = require('mongoose');

const dateSelectionSchema = mongoose.Schema({
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'RibeiroUser', required: true, index: true},
    // What the user picked, exactly as shown in their own time zone
    selectedDate: {type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/},
    selectedTime: {type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/},
    timeZone: {type: String, required: false},
    // The same moment as an absolute instant, for sorting and querying
    scheduledFor: {type: Date, required: true},
    service: {type: String, enum: ['lift-club', 'referral-business', 'general'], default: 'general'},
    note: {type: String, required: false, trim: true, maxlength: 500},
}, { timestamps: true });

module.exports = mongoose.model('DateSelection', dateSelectionSchema);
