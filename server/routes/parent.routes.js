const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/parent.controller');

router.get('/reference', ctrl.getReferenceData);
router.get('/search', ctrl.search);
router.get('/recommend', ctrl.recommend);

module.exports = router;
