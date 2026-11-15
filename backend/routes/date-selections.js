const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const DateSelection = require("../models/date-selection");
const checkAuth = require('../middleware/ribeiro-auth');

// Allow for small clock differences between the browser and this server
const CLOCK_SKEW_MS = 60 * 1000;
const EDITABLE_FIELDS = ['selectedDate', 'selectedTime', 'timeZone', 'scheduledFor', 'service', 'note'];

router.use(checkAuth);

const pickEditableFields = (body) =>
  Object.fromEntries(EDITABLE_FIELDS.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));

const validateScheduledFor = (value) => {
  const scheduledFor = new Date(value);
  if (Number.isNaN(scheduledFor.getTime())) {
    return "scheduledFor must be a valid ISO date-time";
  }
  if (scheduledFor.getTime() < Date.now() - CLOCK_SKEW_MS) {
    return "The selected date and time must be in the future";
  }
  return null;
};

const sendValidationOrServerError = (res, error) => {
  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: "Invalid date selection", error: error.message });
  }
  res.status(500).json({ message: error.message });
};

// GET THE SIGNED-IN USER'S DATE SELECTIONS
router.get("/", async (req, res, next) => {
  try {
    const dateSelections = await DateSelection.find({ user: req.userData.userId }).sort({ scheduledFor: 1 });
    res.status(200).json({
      message: "Date selections fetched successfully",
      dateSelections,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// CREATE A DATE SELECTION
router.post("/", async (req, res, next) => {
  const scheduledForError = validateScheduledFor(req.body.scheduledFor);
  if (scheduledForError) {
    return res.status(400).json({ message: scheduledForError });
  }

  try {
    const dateSelection = new DateSelection({
      ...pickEditableFields(req.body),
      user: req.userData.userId,
    });
    await dateSelection.save();
    res.status(201).json({
      message: "Date selection saved",
      dateSelection,
    });
  } catch (error) {
    sendValidationOrServerError(res, error);
  }
});

// UPDATE ONE OF THE SIGNED-IN USER'S DATE SELECTIONS
router.put("/:id", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Date selection not found" });
  }
  if (req.body.scheduledFor !== undefined) {
    const scheduledForError = validateScheduledFor(req.body.scheduledFor);
    if (scheduledForError) {
      return res.status(400).json({ message: scheduledForError });
    }
  }

  try {
    const dateSelection = await DateSelection.findOneAndUpdate(
      { _id: req.params.id, user: req.userData.userId },
      pickEditableFields(req.body),
      { new: true, runValidators: true }
    );
    if (!dateSelection) {
      return res.status(404).json({ message: "Date selection not found" });
    }
    res.status(200).json({
      message: "Date selection updated",
      dateSelection,
    });
  } catch (error) {
    sendValidationOrServerError(res, error);
  }
});

// DELETE ONE OF THE SIGNED-IN USER'S DATE SELECTIONS
router.delete("/:id", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Date selection not found" });
  }

  try {
    const dateSelection = await DateSelection.findOneAndDelete({ _id: req.params.id, user: req.userData.userId });
    if (!dateSelection) {
      return res.status(404).json({ message: "Date selection not found" });
    }
    res.status(200).json({ message: "Date selection deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
