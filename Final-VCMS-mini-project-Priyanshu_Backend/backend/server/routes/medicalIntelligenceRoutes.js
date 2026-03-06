const express = require('express');
const router = express.Router();
const medicalIntelligenceService = require('../services/medicalIntelligenceService');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/medical-intelligence/prescription/:id/analyze
 * @desc    Generate medical intelligence report for a prescription
 * @access  Private
 */
router.post('/prescription/:id/analyze', auth, async (req, res) => {
  try {
    const { language = 'English' } = req.body;
    const prescriptionId = req.params.id;

    const report = await medicalIntelligenceService.generateReport(prescriptionId, language);

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Medical Intelligence Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate medical intelligence report',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/medical-intelligence/prescription/:id/report
 * @desc    Get existing medical intelligence report
 * @access  Private
 */
router.get('/prescription/:id/report', auth, async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const report = await medicalIntelligenceService.generateReport(prescriptionId);

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Medical Intelligence Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medical intelligence report',
      error: error.message
    });
  }
});

module.exports = router;
