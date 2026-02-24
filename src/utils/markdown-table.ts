/**
 * Markdown table parsing and box-drawing rendering utilities.
 * 
 * Converts markdown tables to properly-aligned Unicode box-drawing tables.
 * Also handles bold text formatting.
 */

import chalk from 'chalk';

/**
 * Strip ANSI escape codes from a string.
 */
function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*[mGKHJ]/g, '')
    .replace(/\x1b\(B/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '');
}

/**
 * Calculate the visible width of a string, handling ANSI codes and CJK double-width characters.
 */
function visibleWidth(str: string): number {
  const clean = stripAnsi(str);
  let width = 0;
  for (const char of clean) {
    const code = char.codePointAt(0)!;
    if (
      (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
      (code >= 0x2e80 && code <= 0x303e) || // CJK Radicals, Kangxi, CJK Symbols
      (code >= 0x3040 && code <= 0x33bf) || // Hiragana, Katakana, Bopomofo
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
      (code >= 0x4e00 && code <= 0xa4cf) || // CJK Unified Ideographs, Yi
      (code >= 0xa960 && code <= 0xa97f) || // Hangul Jamo Extended-A
      (code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
      (code >= 0xd7b0 && code <= 0xd7ff) || // Hangul Jamo Extended-B
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
      (code >= 0xfe30 && code <= 0xfe6f) || // CJK Compatibility Forms
      (code >= 0xff01 && code <= 0xff60) || // Fullwidth Forms
      (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth Signs
      (code >= 0x20000 && code <= 0x2fa1f) // CJK Extensions B-F
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Pad a string to a target visible width.
 */
function padToVisibleWidth(str: string, targetWidth: number, rightAlign: boolean): string {
  const padSize = Math.max(0, targetWidth - visibleWidth(str));
  return rightAlign ? ' '.repeat(padSize) + str : str + ' '.repeat(padSize);
}

/**
 * Apply bold styling to **text** markers within a cell.
 */
function applyBold(str: string): string {
  return str.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text));
}

// Box-drawing characters
const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  topT: '┬',
  bottomT: '┴',
  leftT: '├',
  rightT: '┤',
  cross: '┼',
};

/**
 * Check if a string looks like a number (for right-alignment).
 */
function isNumeric(value: string): boolean {
  const trimmed = value.trim();
  // Match numbers with optional $, %, B/M/K suffixes
  return /^[$]?[-+]?[\d,]+\.?\d*[%BMK]?$/.test(trimmed);
}

/**
 * Parse a markdown table into headers and rows.
 */
export function parseMarkdownTable(tableText: string): { headers: string[]; rows: string[][] } | null {
  const lines = tableText.trim().split('\n').map(line => line.trim());
  
  if (lines.length < 2) return null;
  
  // Parse header line
  const headerLine = lines[0];
  if (!headerLine.includes('|')) return null;
  
  const headers = headerLine
    .split('|')
    .map(cell => cell.trim())
    .filter((_, i, arr) => i > 0 && i < arr.length - 1 || arr.length === 1);
  
  // Handle edge case where there's no leading/trailing pipe
  if (headers.length === 0) {
    const rawHeaders = headerLine.split('|').map(cell => cell.trim());
    if (rawHeaders.length > 0) {
      headers.push(...rawHeaders);
    }
  }
  
  if (headers.length === 0) return null;
  
  // Check for separator line (---|---|---)
  const separatorLine = lines[1];
  if (!separatorLine || !/^[\s|:-]+$/.test(separatorLine)) return null;
  
  // Parse data rows
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) continue;
    
    const cells = line
      .split('|')
      .map(cell => cell.trim());
    
    // Remove empty first/last cells from pipes at start/end
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  
  return { headers, rows };
}

/**
 * Render a parsed table as a Unicode box-drawing table.
 */
export function renderBoxTable(headers: string[], rows: string[][]): string {
  // Apply bold styling first so width calculations use final visible widths
  const styledHeaders = headers.map(applyBold);
  const styledRows = rows.map(row => row.map(applyBold));

  // Calculate column widths using visible width (handles ANSI codes + CJK)
  const colWidths: number[] = styledHeaders.map(h => visibleWidth(h));

  for (const row of styledRows) {
    for (let i = 0; i < row.length; i++) {
      if (i < colWidths.length) {
        colWidths[i] = Math.max(colWidths[i], visibleWidth(row[i]));
      }
    }
  }

  // Determine alignment for each column (right for numeric, left for text)
  const alignRight: boolean[] = headers.map((_, colIndex) => {
    // Check if most values in this column are numeric (use original text, not styled)
    let numericCount = 0;
    for (const row of rows) {
      if (row[colIndex] && isNumeric(row[colIndex])) {
        numericCount++;
      }
    }
    return numericCount > rows.length / 2;
  });

  // Build the table
  const lines: string[] = [];

  // Top border
  const topBorder = BOX.topLeft +
    colWidths.map(w => BOX.horizontal.repeat(w + 2)).join(BOX.topT) +
    BOX.topRight;
  lines.push(topBorder);

  // Header row
  const headerRow = BOX.vertical +
    styledHeaders.map((h, i) => ` ${padToVisibleWidth(h, colWidths[i], false)} `).join(BOX.vertical) +
    BOX.vertical;
  lines.push(headerRow);

  // Header separator
  const headerSep = BOX.leftT +
    colWidths.map(w => BOX.horizontal.repeat(w + 2)).join(BOX.cross) +
    BOX.rightT;
  lines.push(headerSep);

  // Data rows
  for (const row of styledRows) {
    const dataRow = BOX.vertical +
      colWidths.map((w, i) => {
        const value = row[i] || '';
        return ` ${padToVisibleWidth(value, w, alignRight[i])} `;
      }).join(BOX.vertical) +
      BOX.vertical;
    lines.push(dataRow);
  }

  // Bottom border
  const bottomBorder = BOX.bottomLeft +
    colWidths.map(w => BOX.horizontal.repeat(w + 2)).join(BOX.bottomT) +
    BOX.bottomRight;
  lines.push(bottomBorder);

  return lines.join('\n');
}

/**
 * Find and transform all markdown tables in content to box-drawing tables.
 */
export function transformMarkdownTables(content: string): string {
  // Normalize line endings: convert \r\n to \n, then trim trailing whitespace from each line
  const normalized = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
  
  // Regex to match markdown tables:
  // - Starts with a line containing pipes
  // - Followed by a separator line (---|---|---)
  // - Followed by zero or more data rows with pipes
  // IMPORTANT: Use [ \t] instead of \s in separator to avoid matching newlines
  const tableRegex = /^(\|[^\n]+\|\n\|[-:| \t]+\|(?:\n\|[^\n]+\|)*)/gm;
  
  // Also match tables without leading/trailing pipes on each line
  const tableRegex2 = /^([^\n|]*\|[^\n]+\n[-:| \t]+(?:\n[^\n|]*\|[^\n]+)*)/gm;
  
  let result = normalized;
  
  // Process tables with pipes at start/end
  result = result.replace(tableRegex, (match) => {
    const parsed = parseMarkdownTable(match);
    if (parsed && parsed.headers.length > 0 && parsed.rows.length > 0) {
      return renderBoxTable(parsed.headers, parsed.rows);
    }
    return match;
  });
  
  // Process tables that might not have leading pipes
  result = result.replace(tableRegex2, (match) => {
    // Skip if already transformed (contains box-drawing chars)
    if (match.includes(BOX.topLeft)) return match;
    
    const parsed = parseMarkdownTable(match);
    if (parsed && parsed.headers.length > 0 && parsed.rows.length > 0) {
      return renderBoxTable(parsed.headers, parsed.rows);
    }
    return match;
  });
  
  return result;
}

/**
 * Transform markdown bold (**text**) to ANSI bold.
 */
export function transformBold(content: string): string {
  return content.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text));
}

/**
 * Apply all pre-render formatting to response content.
 * - Converts markdown tables to unicode box-drawing tables
 * - Converts **bold** to ANSI bold
 */
export function formatResponse(content: string): string {
  let result = content;
  result = transformMarkdownTables(result);
  result = transformBold(result);
  // Collapse runs of 3+ consecutive newlines to exactly 2 (preserve paragraph breaks).
  result = result.replace(/\n{3,}/g, '\n\n');
  return result;
}
