/**
 * A tiny dependency-free CSV parser. Handles quoted fields, commas and
 * newlines inside quotes, escaped double-quotes (""), and CRLF/LF line
 * endings. Returns an array of objects keyed by the header row.
 *
 * Kept deliberately small and pure so it can be unit-tested on its own and so
 * the platform takes on no parsing dependency.
 */
export function parseCsv(text) {
  const rows = [];
  let field = '';
  let record = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endField = () => {
    record.push(field);
    field = '';
  };
  const endRecord = () => {
    endField();
    // Skip fully-blank lines.
    if (record.length === 1 && record[0].trim() === '') {
      record = [];
      return;
    }
    rows.push(record);
    record = [];
  };

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      endField();
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      endRecord();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  // Flush the final record if the file didn't end with a newline.
  if (field !== '' || record.length) endRecord();

  if (!rows.length) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? '').trim();
    });
    return obj;
  });
}

export default parseCsv;
