const metricsCollector = require('../services/monitoring/metricsCollector');

// @desc    Get aggregated metrics across all instances
// @route   GET /api/metrics/aggregated
// @access  Private (Owner/Admin only)
const getAggregatedMetrics = async (req, res) => {
    try {
        const metrics = await metricsCollector.getAggregatedMetrics();

        res.status(200).json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Get aggregated metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching aggregated metrics',
            error: error.message
        });
    }
};

// @desc    Trigger metrics collection for a specific instance
// @route   POST /api/metrics/collect/:id
// @access  Private (Owner/Admin only)
const collectInstanceMetrics = async (req, res) => {
    try {
        const result = await metricsCollector.collectMetricsById(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Metrics collected successfully',
            data: result
        });
    } catch (error) {
        console.error('Collect instance metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error collecting instance metrics',
            error: error.message
        });
    }
};

// @desc    Trigger metrics collection for all instances
// @route   POST /api/metrics/collect-all
// @access  Private (Owner only)
const collectAllMetrics = async (req, res) => {
    try {
        // Trigger collection (don't wait for completion)
        metricsCollector.collectAllMetrics();

        res.status(202).json({
            success: true,
            message: 'Metrics collection initiated'
        });
    } catch (error) {
        console.error('Collect all metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error initiating metrics collection',
            error: error.message
        });
    }
};

module.exports = {
    getAggregatedMetrics,
    collectInstanceMetrics,
    collectAllMetrics
};

