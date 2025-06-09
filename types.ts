export interface LogFileEntry {
  file: File;
  name: string; // e.g., DA20250605.log
  moduleName: string; // e.g., DA
  date: string; // e.g., 20250605
  id: string; // moduleName + date for unique key
}

export interface CategorizedLogs {
  [moduleName: string]: {
    [date: string]: LogFileEntry;
  };
}

export interface SelectedLogIdentifier {
  moduleName:string;
  date: string;
}

export interface LogStatistics {
  errorCount: number;
  warnCount: number;
}

export type ActiveLogFilter = 'error' | 'warn' | null;

export interface MemoryUsageDataPoint {
  timestamp: string; // e.g., "09:07:04.965"
  memoryMB: number; // e.g., 283
  originalLogTime: string; // To keep the full timestamp for display if needed
}

export interface GdiUsageDataPoint {
  timestamp: string; // e.g., "09:07:04.965"
  gdiCount: number; // e.g., 44
  originalLogTime: string;
}

export interface CpuUsageDataPoint {
  timestamp: string; // e.g., "09:07:15.965"
  mainCpuPercent: number; // e.g., 0.0
  totalCpuPercent: number; // e.g., 8.4
  delayMs: number; // e.g., 420
  originalLogTime: string;
}

// Types for System Information Tab
export interface MonitorInfo {
  id: string; // e.g., "Monitor0" or "0"
  resolution: string; // e.g., "1920x1080"
  details: string; // e.g., "monitor(0, 0, 1920, 1080), work(0, 0, 1920, 1020)"
}

export interface ValueWithTimestamp<T> {
  value: T;
  timestamp: string; // Original log timestamp for this specific value
}

export interface SystemInfoSnapshot {
  // Timestamp of the AP Version line that anchored this snapshot, or the first found item.
  anchorTimestamp: string; 
  cpuModel?: ValueWithTimestamp<string>;
  totalMemory?: ValueWithTimestamp<string>;
  osVersion?: ValueWithTimestamp<string>;
  dpi?: ValueWithTimestamp<string>;
  monitors?: ValueWithTimestamp<MonitorInfo[]>;
  apVersion?: ValueWithTimestamp<string>;
  allDatacenterConnections?: ValueWithTimestamp<string>[]; 
}

// Types for Permissions Information Tab
export interface PermissionSet {
  features?: string;
  xsAuth?: string;
  xsPreset?: string;
}

export interface PermissionSnapshot {
  timestamp: string; // Timestamp of the primary log line (e.g., Features) that anchors this set
  permissions: PermissionSet;
}

// Types for XSIndicatorSvcClient Analysis
export interface IndicatorCreationInfo {
  id: string;
  name: string;
  mainSymbolId: string;
  freq: string;
  creationTimestamp: string;
}

export interface IndicatorStartEvent {
  startTimestamp: string; // Timestamp of the StartXSIndicator log line
  indicatorId: string;
  name?: string;
  mainSymbolId?: string;
  freq?: string;
  totalBar: string;
  firstBarDate: string;
  tDayCount: string;
  alignType: string;
  alignMode: string;
  sync: string;
  addFakeBar: string;
  autoCloseK: string;
}
