const mongoose = require('mongoose');

const RoadmapStageSchema = new mongoose.Schema({
  sport: { type: String, required: true },
  stage: { type: String, required: true }, // Foundation / District / State-SAI / Academic Off-ramp
  order: Number,
  description: String,
  estCostMin: Number,
  estCostMax: Number
});

module.exports = mongoose.model('RoadmapStage', RoadmapStageSchema);
