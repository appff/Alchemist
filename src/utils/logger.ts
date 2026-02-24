import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: unknown;
}

type LogSubscriber = (logs: LogEntry[]) => void;

const LOG_DIR = join(homedir(), '.dexter');
const LOG_FILE = join(LOG_DIR, 'debug.log');

class DebugLogger {
  private logs: LogEntry[] = [];
  private subscribers: Set<LogSubscriber> = new Set();
  private maxLogs = 50;

  private emit() {
    this.subscribers.forEach(fn => fn([...this.logs]));
  }

  private add(level: LogLevel, message: string, data?: unknown) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      level,
      message,
      timestamp: new Date(),
      data,
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    this.emit();

    // Also write to file for external debugging
    try {
      if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
      const ts = entry.timestamp.toISOString();
      const line = data
        ? `${ts} [${level.toUpperCase()}] ${message} ${JSON.stringify(data)}\n`
        : `${ts} [${level.toUpperCase()}] ${message}\n`;
      appendFileSync(LOG_FILE, line);
    } catch { /* ignore file write errors */ }
  }

  debug(message: string, data?: unknown) {
    this.add('debug', message, data);
  }

  info(message: string, data?: unknown) {
    this.add('info', message, data);
  }

  warn(message: string, data?: unknown) {
    this.add('warn', message, data);
  }

  error(message: string, data?: unknown) {
    this.add('error', message, data);
  }

  subscribe(fn: LogSubscriber): () => void {
    this.subscribers.add(fn);
    fn([...this.logs]); // Send current logs immediately
    return () => this.subscribers.delete(fn);
  }

  clear() {
    this.logs = [];
    this.emit();
  }
}

// Singleton instance
export const logger = new DebugLogger();
export type { LogEntry, LogLevel };
