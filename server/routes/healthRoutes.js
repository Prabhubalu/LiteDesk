const express = require('express');
const router = express.Router();

/**
 * Master Control Plane Health Check Endpoint
 * This is for checking the health of the master server itself
 */
router.get('/', (req, res) => {
    const mongoose = require('mongoose');
    
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'LiteDesk Master Control Plane',
        uptime: process.uptime(),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            unit: 'MB'
        },
        database: {
            connected: mongoose.connection.readyState === 1,
            state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState]
        }
    };

    const statusCode = health.database.connected ? 200 : 503;
    res.status(statusCode).json(health);
});

/**
 * Detailed System Status
 */
router.get('/status', async (req, res) => {
    const mongoose = require('mongoose');
    const InstanceRegistry = require('../models/InstanceRegistry');

    try {
        // Get instance statistics
        const stats = await InstanceRegistry.aggregate([
            {
                $group: {
                    _id: null,
                    totalInstances: { $sum: 1 },
                    activeInstances: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    healthyInstances: {
                        $sum: { $cond: [{ $eq: ['$healthStatus', 'healthy'] }, 1, 0] }
                    },
                    degradedInstances: {
                        $sum: { $cond: [{ $eq: ['$healthStatus', 'degraded'] }, 1, 0] }
                    },
                    unhealthyInstances: {
                        $sum: { $cond: [{ $eq: ['$healthStatus', 'unhealthy'] }, 1, 0] }
                    }
                }
            }
        ]);

        const status = {
            service: 'LiteDesk Master Control Plane',
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date().toISOString(),
            uptime: {
                seconds: Math.floor(process.uptime()),
                readable: formatUptime(process.uptime())
            },
            memory: {
                heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
                unit: 'MB'
            },
            database: {
                connected: mongoose.connection.readyState === 1,
                state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
                host: mongoose.connection.host,
                name: mongoose.connection.name
            },
            instances: stats[0] || {
                totalInstances: 0,
                activeInstances: 0,
                healthyInstances: 0,
                degradedInstances: 0,
                unhealthyInstances: 0
            }
        };

        res.status(200).json(status);
    } catch (error) {
        console.error('Status endpoint error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

/**
 * Helper function to format uptime
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
}

module.exports = router;

