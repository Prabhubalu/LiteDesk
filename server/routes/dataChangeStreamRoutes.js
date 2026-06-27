const express = require('express');
const { streamDataChanges } = require('../controllers/dataChangeStreamController');

const router = express.Router();

router.get('/stream', streamDataChanges);

module.exports = router;
