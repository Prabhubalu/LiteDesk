const Task = require('../models/Task');
const User = require('../models/User');

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private
const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      relatedTo,
      projectId,
      assignedTo,
      status,
      priority,
      dueDate,
      startDate,
      estimatedHours,
      subtasks,
      tags,
      reminderDate
    } = req.body;

    // Validate assignedTo user exists and belongs to org
    if (assignedTo) {
      const assignee = await User.findOne({
        _id: assignedTo,
        organizationId: req.user.organizationId
      });
      
      if (!assignee) {
        return res.status(404).json({
          success: false,
          message: 'Assigned user not found in your organization'
        });
      }
    }

    const task = await Task.create({
      organizationId: req.user.organizationId,
      title,
      description,
      relatedTo,
      projectId,
      assignedTo: assignedTo || req.user._id,
      assignedBy: req.user._id,
      status: status || 'todo',
      priority: priority || 'medium',
      dueDate,
      startDate,
      estimatedHours,
      subtasks,
      tags,
      reminderDate,
      createdBy: req.user._id
    });

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('assignedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      data: populatedTask
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating task',
      error: error.message
    });
  }
};

// @desc    Get all tasks (with filters)
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res) => {
  try {
    const {
      status,
      priority,
      assignedTo,
      projectId,
      dueDate,
      overdue,
      search,
      page = 1,
      limit = 20,
      sortBy = '-dueDate'
    } = req.query;

    // Build query
    const query = { organizationId: req.user.organizationId };

    // Filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) {
      query.assignedTo = assignedTo === 'me' ? req.user._id : assignedTo;
    }
    if (projectId) query.projectId = projectId;
    if (dueDate) {
      const date = new Date(dueDate);
      query.dueDate = {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lte: new Date(date.setHours(23, 59, 59, 999))
      };
    }
    if (overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      query.status = { $nin: ['completed', 'cancelled'] };
    }

    // Search
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Execute query
    const tasks = await Task.find(query)
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('assignedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .sort(sortBy)
      .limit(parseInt(limit))
      .skip(skip);

    // Get total count
    const total = await Task.countDocuments(query);

    res.status(200).json({
      success: true,
      data: tasks,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalTasks: total,
        tasksPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tasks',
      error: error.message
    });
  }
};

// @desc    Get single task by ID
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    })
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('assignedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('subtasks.completedBy', 'firstName lastName');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching task',
      error: error.message
    });
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res) => {
  try {
    let task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Validate assignedTo if being updated
    if (req.body.assignedTo && req.body.assignedTo !== task.assignedTo.toString()) {
      const assignee = await User.findOne({
        _id: req.body.assignedTo,
        organizationId: req.user.organizationId
      });
      
      if (!assignee) {
        return res.status(404).json({
          success: false,
          message: 'Assigned user not found in your organization'
        });
      }
    }

    // Update fields
    const allowedUpdates = [
      'title', 'description', 'relatedTo', 'projectId', 'assignedTo',
      'status', 'priority', 'dueDate', 'startDate', 'completedDate',
      'estimatedHours', 'actualHours', 'subtasks', 'tags', 'reminderDate'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('assignedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating task',
      error: error.message
    });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await task.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting task',
      error: error.message
    });
  }
};

// @desc    Update task status (quick action)
// @route   PATCH /api/tasks/:id/status
// @access  Private
const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['todo', 'in_progress', 'waiting', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    task.status = status;
    if (status === 'completed' && !task.completedDate) {
      task.completedDate = new Date();
    } else if (status !== 'completed') {
      task.completedDate = null;
    }

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName email avatar');

    res.status(200).json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating task status',
      error: error.message
    });
  }
};

// @desc    Toggle subtask completion
// @route   PATCH /api/tasks/:id/subtasks/:subtaskId
// @access  Private
const toggleSubtask = async (req, res) => {
  try {
    const { id, subtaskId } = req.params;
    const { completed } = req.body;

    const task = await Task.findOne({
      _id: id,
      organizationId: req.user.organizationId
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const subtask = task.subtasks.id(subtaskId);
    if (!subtask) {
      return res.status(404).json({
        success: false,
        message: 'Subtask not found'
      });
    }

    subtask.completed = completed;
    if (completed) {
      subtask.completedAt = new Date();
      subtask.completedBy = req.user._id;
    } else {
      subtask.completedAt = null;
      subtask.completedBy = null;
    }

    await task.save();

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Toggle subtask error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating subtask',
      error: error.message
    });
  }
};

// @desc    Get task statistics
// @route   GET /api/tasks/stats/summary
// @access  Private
const getTaskStats = async (req, res) => {
  try {
    const { assignedTo } = req.query;
    const query = { organizationId: req.user.organizationId };

    if (assignedTo) {
      query.assignedTo = assignedTo === 'me' ? req.user._id : assignedTo;
    }

    // Get counts by status
    const statusCounts = await Task.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get counts by priority
    const priorityCounts = await Task.aggregate([
      { $match: query },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    // Get overdue count
    const overdueCount = await Task.countDocuments({
      ...query,
      dueDate: { $lt: new Date() },
      status: { $nin: ['completed', 'cancelled'] }
    });

    // Get due today count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueTodayCount = await Task.countDocuments({
      ...query,
      dueDate: { $gte: today, $lt: tomorrow },
      status: { $nin: ['completed', 'cancelled'] }
    });

    // Format response
    const stats = {
      byStatus: {},
      byPriority: {},
      overdue: overdueCount,
      dueToday: dueTodayCount,
      total: await Task.countDocuments(query)
    };

    statusCounts.forEach(item => {
      stats.byStatus[item._id] = item.count;
    });

    priorityCounts.forEach(item => {
      stats.byPriority[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching task statistics',
      error: error.message
    });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  updateTaskStatus,
  toggleSubtask,
  getTaskStats
};

