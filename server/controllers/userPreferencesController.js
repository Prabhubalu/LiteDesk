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

