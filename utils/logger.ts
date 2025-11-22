import { LogEntry, LogLevel } from '../types';

export const createLog = (
  message: string, 
  level: LogLevel = LogLevel.INFO, 
  source: 'SYSTEM' | 'MYSQL' | 'AUTH' | 'WORLD' = 'SYSTEM'
): LogEntry => {
  return {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    level,
    message,
    source
  };
};