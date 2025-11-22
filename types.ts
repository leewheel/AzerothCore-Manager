export enum ServiceStatus {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR'
}

export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source: 'SYSTEM' | 'MYSQL' | 'AUTH' | 'WORLD';
}

export interface ServerMetrics {
  time: string;
  authRam: number; // in MB
  worldRam: number; // in MB
  cpuUsage: number; // percentage
}

export interface AccountFormData {
  username: string;
  password: string;
  gmLevel: number;
  expansion: number;
}
