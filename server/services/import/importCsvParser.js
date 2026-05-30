/**
 * Shared CSV line parser — used for in-memory, staged, and streaming import reads.
 */

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseHeaderLine(line) {
  return parseCsvLine(line).map((header) => header.replace(/^"|"$/g, '').trim());
}

function rowObjectFromLine(line, headers) {
  const values = parseCsvLine(line);
  const row = {};
  headers.forEach((header, index) => {
    row[header] = values[index] || '';
  });
  return row;
}

function parseCSV(csvText) {
  const lines = String(csvText || '').split('\n').filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseHeaderLine(lines[0]);
  const rows = lines.slice(1).map((line) => rowObjectFromLine(line, headers));
  return { headers, rows };
}

module.exports = {
  parseCSV,
  parseCsvLine,
  parseHeaderLine,
  rowObjectFromLine,
};
