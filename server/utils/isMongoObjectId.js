const mongoose = require('mongoose');

/** True only for 24-char hex strings that round-trip as ObjectId (not UUIDs). */
function isMongoObjectIdString(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!mongoose.Types.ObjectId.isValid(s)) return false;
  return String(new mongoose.Types.ObjectId(s)) === s;
}

module.exports = { isMongoObjectIdString };
