const express = require('express');
const router = express.Router();
const dataService = require('../services/dataService');
const contextService = require('../services/contextService');

/**
 * GET /api/city/zones
 * Returns list of zones
 */
router.get('/zones', async (req, res) => {
  try {
    const zones = await dataService.getZones();
    res.json({ success: true, data: zones });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/city/timeranges
 * Returns supported time range options
 */
router.get('/timeranges', async (req, res) => {
  try {
    const ranges = await dataService.getTimeRanges();
    res.json({ success: true, data: ranges });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/city/overview
 * Combined overview of all 4 modules
 * Query params: ?zone=...&timeRange=...
 */
router.get('/overview', async (req, res) => {
  try {
    const { zone, timeRange } = req.query;
    const overview = await dataService.getOverview(zone, timeRange);
    res.json({ success: true, data: overview });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/city/traffic
 * Query params: ?zone=...&timeRange=...
 */
router.get('/traffic', async (req, res) => {
  try {
    const { zone, timeRange } = req.query;
    const traffic = await dataService.getModuleData('traffic', zone, timeRange);
    res.json({ success: true, data: traffic });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/city/electricity
 * Query params: ?zone=...&timeRange=...
 */
router.get('/electricity', async (req, res) => {
  try {
    const { zone, timeRange } = req.query;
    const electricity = await dataService.getModuleData('electricity', zone, timeRange);
    res.json({ success: true, data: electricity });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/city/pollution
 * Query params: ?zone=...&timeRange=...
 */
router.get('/pollution', async (req, res) => {
  try {
    const { zone, timeRange } = req.query;
    const pollution = await dataService.getModuleData('pollution', zone, timeRange);
    res.json({ success: true, data: pollution });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/city/water
 * Query params: ?zone=...&timeRange=...
 */
router.get('/water', async (req, res) => {
  try {
    const { zone, timeRange } = req.query;
    const water = await dataService.getModuleData('water', zone, timeRange);
    res.json({ success: true, data: water });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/city/alerts
 * Query params: ?zone=...&module=...
 */
router.get('/alerts', async (req, res) => {
  try {
    const { zone, module: moduleName } = req.query;
    const alerts = await dataService.getAlerts(zone, moduleName);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/city/context
 * Returns current structured dashboard context for AI assistant or diagnostics
 * Query params: ?view=...&zone=...&timeRange=...
 */
router.get('/context', async (req, res) => {
  try {
    const { view, zone, timeRange } = req.query;
    const context = await contextService.getDashboardContext(view, zone, timeRange);
    res.json({ success: true, data: context });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
