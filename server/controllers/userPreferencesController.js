const UserPreferences = require('../models/UserPreferences');

// --- Save widget layout for a record ---
exports.saveWidgetLayout = async (req, res) => {
    try {
        const { recordType, recordId, widgets } = req.body;
        const { organizationId, _id: userId } = req.user;

        if (!recordType || !recordId || !Array.isArray(widgets)) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: recordType, recordId, widgets'
            });
        }

        // Find or create user preferences
        let preferences = await UserPreferences.findOne({
            organizationId,
            userId
        });

        if (!preferences) {
            preferences = await UserPreferences.create({
                organizationId,
                userId,
                widgetLayouts: new Map()
            });
        }

        // Update widget layout for this specific record
        // Update widget layout for this specific record
        const layoutKey = `${recordType}-${recordId}`;
        
        // Convert to Map format if needed
        if (!preferences.widgetLayouts) {
            preferences.widgetLayouts = new Map();
        }
        
        preferences.widgetLayouts.set(layoutKey, { widgets });

        await preferences.save();

        res.json({
            success: true,
            message: 'Widget layout saved successfully',
            data: { layoutKey, widgets }
        });
    } catch (error) {
        console.error('Save widget layout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error saving widget layout'
        });
    }
};

// --- Get widget layout for a record ---
exports.getWidgetLayout = async (req, res) => {
    try {
        const { recordType, recordId } = req.query;
        const { organizationId, _id: userId } = req.user;

        if (!recordType || !recordId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: recordType, recordId'
            });
        }

        const preferences = await UserPreferences.findOne({
            organizationId,
            userId
        });

        if (!preferences) {
            return res.json({
                success: true,
                data: null
            });
        }

        const layoutKey = `${recordType}-${recordId}`;
        const layout = preferences.widgetLayouts.get(layoutKey);

        res.json({
            success: true,
            data: layout ? layout.widgets : null
        });
    } catch (error) {
        console.error('Get widget layout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching widget layout'
        });
    }
};

// --- Save metrics config for a module (recordType) ---
exports.saveMetricsConfig = async (req, res) => {
    try {
        const { recordType, metrics } = req.body;
        const { organizationId, _id: userId } = req.user;

        if (!recordType || !Array.isArray(metrics)) {
            return res.status(400).json({ success: false, message: 'Missing required fields: recordType, metrics' });
        }

        let preferences = await UserPreferences.findOne({ organizationId, userId });
        if (!preferences) {
            preferences = await UserPreferences.create({ organizationId, userId, widgetLayouts: new Map(), metricsConfigs: new Map() });
        }

        if (!preferences.metricsConfigs) preferences.metricsConfigs = new Map();
        preferences.metricsConfigs.set(recordType, metrics);

        await preferences.save();
        res.json({ success: true, message: 'Metrics config saved successfully' });
    } catch (error) {
        console.error('Save metrics config error:', error);
        res.status(500).json({ success: false, message: 'Server error saving metrics config' });
    }
};

// --- Get metrics config for a module (recordType) ---
exports.getMetricsConfig = async (req, res) => {
    try {
        const { recordType } = req.query;
        const { organizationId, _id: userId } = req.user;

        if (!recordType) {
            return res.status(400).json({ success: false, message: 'Missing required field: recordType' });
        }

        const preferences = await UserPreferences.findOne({ organizationId, userId });
        if (!preferences || !preferences.metricsConfigs) {
            return res.json({ success: true, data: null });
        }

        const cfg = preferences.metricsConfigs.get(recordType) || null;
        res.json({ success: true, data: cfg });
    } catch (error) {
        console.error('Get metrics config error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching metrics config' });
    }
};

