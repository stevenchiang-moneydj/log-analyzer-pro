import React, { useState, useCallback, useEffect } from 'react';
import { 
  CategorizedLogs, 
  LogFileEntry, 
  SelectedLogIdentifier, 
  LogStatistics, 
  ActiveLogFilter, 
  MemoryUsageDataPoint, 
  GdiUsageDataPoint, 
  CpuUsageDataPoint,
  SystemInfoSnapshot,
  ValueWithTimestamp,
  MonitorInfo,
  PermissionSnapshot, 
  PermissionSet,
  IndicatorCreationInfo,
  IndicatorStartEvent
} from './types';
import FileUploadButton from './components/FileUploadButton';
import Sidebar from './components/Sidebar';
import LogViewer from './components/LogViewer';

const LINES_PER_CHUNK_DISPLAY = 500; // Number of lines to display per chunk
const LOG_TIMESTAMP_REGEX = new RegExp("^\\S+\\s+\\d+\\s+(\\d{2}:\\d{2}:\\d{2}\\.\\d{3})"); // Matches HH:MM:SS.mmm

const LOG_MODULE_DA = 'DA';
const LOG_MODULE_XSINDICATORSVCCLIENT = 'XSINDICATORSVCCLIENT';

const extractTimestampFromLogLine = (line: string): string | null => {
  const match = line.match(LOG_TIMESTAMP_REGEX);
  return match ? match[1] : null;
};

const timeToSeconds = (timeStr: string): number => {
  if (!timeStr || !/^\d{2}:\d{2}:\d{2}\.\d{3}$/.test(timeStr)) {
      return 0; 
  }
  const parts = timeStr.split(/[:.]/);
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]) + parseInt(parts[3]) / 1000;
};


const parseAndCountLogEvents = (lines: string[]): LogStatistics => {
  let errorCount = 0;
  let warnCount = 0;
  const errorRegex = /\berror\b/i;
  const warnRegex = /\bwarn(?:ing)?\b/i; 

  lines.forEach(line => {
    if (errorRegex.test(line)) errorCount++;
    if (warnRegex.test(line)) warnCount++;
  });
  return { errorCount, warnCount };
};

const parseMemoryUsage = (lines: string[]): MemoryUsageDataPoint[] => {
  const memoryData: MemoryUsageDataPoint[] = [];
  const memoryRegex = /(\d{2}:\d{2}:\d{2}\.\d{3}).*XQ Used Mem:\s*(\d+)\s*MB/i;

  lines.forEach(line => {
    if (line.includes("XQ Used Mem:")) { 
      const match = line.match(memoryRegex);
      if (match && match[1] && match[2]) {
        const timestamp = match[1];
        const memoryMB = parseInt(match[2], 10);
        if (!isNaN(memoryMB)) {
          memoryData.push({ timestamp, memoryMB, originalLogTime: timestamp });
        }
      }
    }
  });
  return memoryData;
};

const parseGdiUsage = (lines: string[]): GdiUsageDataPoint[] => {
  const gdiData: GdiUsageDataPoint[] = [];
  const gdiRegex = /(\d{2}:\d{2}:\d{2}\.\d{3}).*XQ Used GDI:\s*(\d+)/i;

  lines.forEach(line => {
    if (line.includes("XQ Used GDI:")) {
      const match = line.match(gdiRegex);
      if (match && match[1] && match[2]) {
        const timestamp = match[1];
        const gdiCount = parseInt(match[2], 10);
        if (!isNaN(gdiCount)) {
          gdiData.push({ timestamp, gdiCount, originalLogTime: timestamp });
        }
      }
    }
  });
  return gdiData;
};

const parseCpuUsage = (lines: string[]): CpuUsageDataPoint[] => {
  const cpuData: CpuUsageDataPoint[] = [];
  const cpuRegex = /(\d{2}:\d{2}:\d{2}\.\d{3}).*CPU usage\((\d{1,3}(?:\.\d+)?%)\s*,\s*(\d{1,3}(?:\.\d+)?%)\).*DelayMS=(\d+)/i;

  lines.forEach(line => {
    if (line.includes("CPU usage(") && line.includes("DelayMS=")) {
      const match = line.match(cpuRegex);
      if (match && match[1] && match[2] && match[3] && match[4]) {
        const timestamp = match[1];
        const mainCpuPercent = parseFloat(match[2].replace('%', ''));
        const totalCpuPercent = parseFloat(match[3].replace('%', ''));
        const delayMs = parseInt(match[4], 10);

        if (!isNaN(mainCpuPercent) && !isNaN(totalCpuPercent) && !isNaN(delayMs)) {
          cpuData.push({
            timestamp,
            mainCpuPercent,
            totalCpuPercent,
            delayMs,
            originalLogTime: timestamp,
          });
        }
      }
    }
  });
  return cpuData;
};

const parseSystemInfoForDA = (logLinesWithTimestamps: { line: string, timestamp: string | null, originalIndex: number }[]): SystemInfoSnapshot[] => {
  const snapshots: SystemInfoSnapshot[] = [];
  const linesWithValidTimestamps = logLinesWithTimestamps.filter(item => item.timestamp !== null) as { line: string, timestamp: string, originalIndex: number }[];

  const apVersionRegex = /AP Version:\s*\[([^\]]+)\]/;
  const cpuRegex = /CPU:\s*(.+)/;
  const memRegex = /Total Physical Mem:\s*(\S+)/; 
  const osRegex = /OS Version:\s*(.+)/;
  const dpiRegex = /DPI X:(\d+), Y:(\d+)/;
  const monitorRegex = /Monitor(\d+)\s*:\s*(monitor\([^)]+\)(?:,\s*work\([^)]+\))?)/;
  const monitorResolutionRegex = /monitor\([^,]+,[^,]+,\s*(\d+),\s*(\d+)\)/;
  const serverGroupNameRegex = /ServerGroupName:\s*([^;]+)/i;

  const collectedDatacenterConnections: ValueWithTimestamp<string>[] = [];
  linesWithValidTimestamps.forEach(item => {
      const sgMatch = item.line.match(serverGroupNameRegex);
      if (sgMatch && sgMatch[1]) {
        const datacenterName = sgMatch[1].trim();
        if (datacenterName && datacenterName.toLowerCase() !== "no data") {
          collectedDatacenterConnections.push({ value: datacenterName, timestamp: item.timestamp });
        }
      }
  });

  const anchorIndices = linesWithValidTimestamps
    .map((item, index) => (apVersionRegex.test(item.line) ? index : -1))
    .filter(index => index !== -1);

  if (anchorIndices.length === 0 && linesWithValidTimestamps.length > 0) {
    let tempAnchorTimestamp: string | null = null;
    for(const item of linesWithValidTimestamps) {
        if (cpuRegex.test(item.line) || memRegex.test(item.line) || osRegex.test(item.line) || dpiRegex.test(item.line) || monitorRegex.test(item.line)) {
            tempAnchorTimestamp = item.timestamp; 
            break;
        }
    }
    if(tempAnchorTimestamp) { 
        anchorIndices.push(linesWithValidTimestamps.findIndex(item => item.timestamp === tempAnchorTimestamp && (cpuRegex.test(item.line) || memRegex.test(item.line) || osRegex.test(item.line) || dpiRegex.test(item.line) || monitorRegex.test(item.line)))); 
    }
  }

  anchorIndices.forEach(anchorIndexInFilteredArray => {
    const anchorLineData = linesWithValidTimestamps[anchorIndexInFilteredArray];
    const currentSnapshot: SystemInfoSnapshot = {
      anchorTimestamp: anchorLineData.timestamp, 
      monitors: { value: [], timestamp: "" },
      allDatacenterConnections: collectedDatacenterConnections
    };

    const apMatch = anchorLineData.line.match(apVersionRegex);
    if (apMatch) {
      currentSnapshot.apVersion = { value: apMatch[1], timestamp: anchorLineData.timestamp };
    } else if (anchorIndices.length === 1 && linesWithValidTimestamps.length > 0) {
        // If there's only one "anchor" (which might not even be AP version if none was found initially),
        // scan entire log for the latest AP version. This handles cases where AP version is logged late.
        for (let i = linesWithValidTimestamps.length - 1; i >= 0; i--) {
            const lineData = linesWithValidTimestamps[i];
            const potentialApMatch = lineData.line.match(apVersionRegex);
            if (potentialApMatch) {
                currentSnapshot.apVersion = { value: potentialApMatch[1], timestamp: lineData.timestamp };
                break;
            }
        }
    }

    const windowStartIndex = Math.max(0, anchorIndexInFilteredArray - 50);
    const windowLines = linesWithValidTimestamps.slice(windowStartIndex, anchorIndexInFilteredArray + 1);
    
    const foundMonitors: MonitorInfo[] = [];
    let monitorsTimestamp: string | null = null;

    windowLines.forEach(item => {
      const cpuMatch = item.line.match(cpuRegex);
      if (cpuMatch && (!currentSnapshot.cpuModel || timeToSeconds(item.timestamp) >= timeToSeconds(currentSnapshot.cpuModel.timestamp))) {
        currentSnapshot.cpuModel = { value: cpuMatch[1].trim(), timestamp: item.timestamp };
      }

      const memMatch = item.line.match(memRegex);
      if (memMatch && (!currentSnapshot.totalMemory || timeToSeconds(item.timestamp) >= timeToSeconds(currentSnapshot.totalMemory.timestamp))) {
        currentSnapshot.totalMemory = { value: memMatch[1].trim(), timestamp: item.timestamp };
      }

      const osMatch = item.line.match(osRegex);
      if (osMatch && (!currentSnapshot.osVersion || timeToSeconds(item.timestamp) >= timeToSeconds(currentSnapshot.osVersion.timestamp))) {
        currentSnapshot.osVersion = { value: osMatch[1].trim(), timestamp: item.timestamp };
      }

      const dpiMatch = item.line.match(dpiRegex);
      if (dpiMatch && (!currentSnapshot.dpi || timeToSeconds(item.timestamp) >= timeToSeconds(currentSnapshot.dpi.timestamp))) {
        currentSnapshot.dpi = { value: `X:${dpiMatch[1]}, Y:${dpiMatch[2]}`, timestamp: item.timestamp };
      }
      
      const monitorMatch = item.line.match(monitorRegex);
      if (monitorMatch) {
        const monitorId = monitorMatch[1];
        const monitorDetails = monitorMatch[2];
        let resolution = "N/A";
        const resMatch = monitorDetails.match(monitorResolutionRegex);
        if (resMatch) {
            resolution = `${resMatch[1]}x${resMatch[2]}`;
        }

        const existingMonitorIndex = foundMonitors.findIndex(m => m.id === monitorId);
        if (existingMonitorIndex === -1) {
            foundMonitors.push({ id: `Monitor${monitorId}`, resolution, details: monitorDetails });
        } else {
             // Update existing monitor if found within the same window (e.g., if log repeats it)
             foundMonitors[existingMonitorIndex] = { id: `Monitor${monitorId}`, resolution, details: monitorDetails };
        }
        if (!monitorsTimestamp || timeToSeconds(item.timestamp) > timeToSeconds(monitorsTimestamp)) {
            monitorsTimestamp = item.timestamp;
        }
      }
    });

    if (foundMonitors.length > 0) {
        foundMonitors.sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric: true}));
        currentSnapshot.monitors = { value: foundMonitors, timestamp: monitorsTimestamp || currentSnapshot.anchorTimestamp };
    } else {
        delete currentSnapshot.monitors; // Remove if no monitors found for this snapshot
    }
    
    // Ensure snapshot has at least one piece of information other than allDatacenterConnections or a non-empty monitors array.
    const hasData = currentSnapshot.apVersion || currentSnapshot.cpuModel || currentSnapshot.totalMemory || currentSnapshot.osVersion || currentSnapshot.dpi || (currentSnapshot.monitors && currentSnapshot.monitors.value.length > 0) ;
    if (hasData) {
        snapshots.push(currentSnapshot);
    }
  });
  
  // If no snapshots were created based on AP Version or other heuristics,
  // but we did find datacenter connections, create a minimal snapshot for them.
  if (snapshots.length === 0 && collectedDatacenterConnections.length > 0) {
    snapshots.push({
      anchorTimestamp: collectedDatacenterConnections[0].timestamp, // Use first DC connection as anchor
      allDatacenterConnections: collectedDatacenterConnections,
    });
  }
  
  return snapshots;
};

const parsePermissions = (
  linesWithTimestamps: { line: string; timestamp: string | null; originalIndex: number }[]
): PermissionSnapshot[] => {
  const snapshots: PermissionSnapshot[] = [];
  let currentSnapshotInternal: {
    timestamp: string;
    permissions: Partial<PermissionSet>;
    featureOriginalIndex: number;
  } | null = null;

  const featuresRegex = /Features:\s*(.*)/; 
  const xsAuthRegex = /XSAuth:\s*(.*)/;
  const xsPresetRegex = /XSPreset:\s*(.*)/;

  const MAX_LINES_APART_PERMISSIONS = 10;
  const MAX_TIME_APART_PERMISSIONS_MS = 2000;

  const finalizeAndPushSnapshot = () => {
    if (currentSnapshotInternal) {
      const perms = currentSnapshotInternal.permissions;
      if (perms.features && perms.features.trim() &&
          perms.xsAuth && perms.xsAuth.trim() &&
          perms.xsPreset && perms.xsPreset.trim()) {
        snapshots.push({
          timestamp: currentSnapshotInternal.timestamp,
          permissions: perms as PermissionSet, 
        });
      }
      currentSnapshotInternal = null;
    }
  };

  for (let i = 0; i < linesWithTimestamps.length; i++) {
    const item = linesWithTimestamps[i];
    if (!item.timestamp) continue;

    const featuresMatch = item.line.match(featuresRegex);
    if (featuresMatch) {
      finalizeAndPushSnapshot(); 

      const featuresValue = featuresMatch[1]?.trim();
      if (featuresValue) { 
        currentSnapshotInternal = {
          timestamp: item.timestamp,
          permissions: { features: featuresValue },
          featureOriginalIndex: item.originalIndex,
        };
      }
      continue; 
    }

    if (currentSnapshotInternal) {
      const timeDiffMs = Math.abs(timeToSeconds(item.timestamp) - timeToSeconds(currentSnapshotInternal.timestamp)) * 1000;
      const lineDiff = item.originalIndex - currentSnapshotInternal.featureOriginalIndex;

      let isOutsideWindow = false;
      if (lineDiff >= MAX_LINES_APART_PERMISSIONS || timeDiffMs > MAX_TIME_APART_PERMISSIONS_MS) {
        isOutsideWindow = true;
      }

      if (isOutsideWindow) {
        finalizeAndPushSnapshot(); 
      } else { 
        const xsAuthMatch = item.line.match(xsAuthRegex);
        if (xsAuthMatch && currentSnapshotInternal.permissions.xsAuth === undefined) {
          currentSnapshotInternal.permissions.xsAuth = xsAuthMatch[1]?.trim() ?? "";
          continue; 
        }

        const xsPresetMatch = item.line.match(xsPresetRegex);
        if (xsPresetMatch && currentSnapshotInternal.permissions.xsPreset === undefined) {
          currentSnapshotInternal.permissions.xsPreset = xsPresetMatch[1]?.trim() ?? "";
          continue; 
        }
      }
    }
  }

  finalizeAndPushSnapshot(); 

  return snapshots;
};

const parseXSIndicatorSvcClientLog = (
  linesWithTimestamps: { line: string; timestamp: string | null; originalIndex: number }[]
): IndicatorStartEvent[] => {
  const createdIndicators: Record<string, IndicatorCreationInfo> = {};
  const startedEvents: IndicatorStartEvent[] = [];

  const createIndicatorRegex = /CreateIndicator IndicatorID:([^,]+), Name:([^,]+), MainSymbolID:([^,]+), Freq:(\S+)/;
  const startIndicatorRegex = /StartXSIndicator IndicatorID:([^,]+), TotalBar:([^,]+), FirstBarDate:([^,]+), TDayCount:([^,]+), AlignType:([^,]+), AlignMode:([^,]+), Sync:([^,]+), AddFakeBar:([^,]+), AutoCloseK:(\S+)/;

  for (const item of linesWithTimestamps) {
    if (!item.timestamp) continue;

    const createMatch = item.line.match(createIndicatorRegex);
    if (createMatch) {
      const [, id, name, mainSymbolId, freq] = createMatch;
      createdIndicators[id] = {
        id,
        name: name.trim(),
        mainSymbolId: mainSymbolId.trim(),
        freq: freq.trim(),
        creationTimestamp: item.timestamp,
      };
      continue; 
    }

    const startMatch = item.line.match(startIndicatorRegex);
    if (startMatch) {
      const [, indicatorId, totalBar, firstBarDate, tDayCount, alignType, alignMode, sync, addFakeBar, autoCloseK] = startMatch;
      const creationInfo = createdIndicators[indicatorId];

      startedEvents.push({
        startTimestamp: item.timestamp,
        indicatorId: indicatorId.trim(),
        name: creationInfo?.name,
        mainSymbolId: creationInfo?.mainSymbolId,
        freq: creationInfo?.freq,
        totalBar: totalBar.trim(),
        firstBarDate: firstBarDate.trim(),
        tDayCount: tDayCount.trim(),
        alignType: alignType.trim(),
        alignMode: alignMode.trim(),
        sync: sync.trim(),
        addFakeBar: addFakeBar.trim(),
        autoCloseK: autoCloseK.trim(),
      });
    }
  }
  return startedEvents;
};


const parseStartTimestamps = (lines: string[]): string[] => {
  // 解析啟動時間，log 格式：GetUserDefaultUILanguage(1028) OK.
  const regex = /(\d{2}:\d{2}:\d{2}\.\d{3}).*GetUserDefaultUILanguage\(1028\) OK\./i;
  return lines
    .map(line => {
      const match = line.match(regex);
      return match ? match[1] : null;
    })
    .filter((t): t is string => !!t);
};

const App: React.FC = () => {
  const [categorizedLogs, setCategorizedLogs] = useState<CategorizedLogs>({});
  const [selectedLogKey, setSelectedLogKey] = useState<SelectedLogIdentifier | null>(null);
  
  const [currentLogFullFile, setCurrentLogFullFile] = useState<File | null>(null);
  const [displayedLogContent, setDisplayedLogContent] = useState<string>('');
  const [allLoadedLogLines, setAllLoadedLogLines] = useState<string[]>([]);
  const [filteredAndLoadedLines, setFilteredAndLoadedLines] = useState<string[]>([]);
  const [currentDisplayEndIndex, setCurrentDisplayEndIndex] = useState<number>(0);
  const [hasMoreLogContent, setHasMoreLogContent] = useState<boolean>(false);

  const [logStatistics, setLogStatistics] = useState<LogStatistics>({ errorCount: 0, warnCount: 0 });
  const [activeFilter, setActiveFilter] = useState<ActiveLogFilter>(null);

  const [isProcessingFiles, setIsProcessingFiles] = useState<boolean>(false);
  const [isLogLoading, setIsLogLoading] = useState<boolean>(false);
  const [isLogLoadingMore, setIsLogLoadingMore] = useState<boolean>(false);

  const [memoryUsageData, setMemoryUsageData] = useState<MemoryUsageDataPoint[]>([]);
  const [isAnalyzingMemory, setIsAnalyzingMemory] = useState<boolean>(false);
  const [gdiUsageData, setGdiUsageData] = useState<GdiUsageDataPoint[]>([]);
  const [isAnalyzingGdi, setIsAnalyzingGdi] = useState<boolean>(false);
  const [cpuUsageData, setCpuUsageData] = useState<CpuUsageDataPoint[]>([]);
  const [isAnalyzingCpu, setIsAnalyzingCpu] = useState<boolean>(false);
  const [systemInfoSnapshots, setSystemInfoSnapshots] = useState<SystemInfoSnapshot[]>([]);
  const [isProcessingSystemInfo, setIsProcessingSystemInfo] = useState<boolean>(false);
  const [permissionSnapshots, setPermissionSnapshots] = useState<PermissionSnapshot[]>([]); 
  const [isProcessingPermissions, setIsProcessingPermissions] = useState<boolean>(false); 
  const [indicatorStartEvents, setIndicatorStartEvents] = useState<IndicatorStartEvent[]>([]);
  const [isProcessingIndicators, setIsProcessingIndicators] = useState<boolean>(false);
  const [startTimestamps, setStartTimestamps] = useState<string[]>([]);


  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetLogViewState = useCallback(() => {
    setDisplayedLogContent('');
    setHasMoreLogContent(false);
    setCurrentLogFullFile(null); // Ensure current file is cleared
    setAllLoadedLogLines([]);
    setFilteredAndLoadedLines([]);
    setLogStatistics({ errorCount: 0, warnCount: 0 });
    setIsLogLoading(false);
    setIsLogLoadingMore(false);
    setErrorMessage(null);
    setCurrentDisplayEndIndex(0);
    setMemoryUsageData([]);
    setIsAnalyzingMemory(false);
    setGdiUsageData([]);
    setIsAnalyzingGdi(false);
    setCpuUsageData([]);
    setIsAnalyzingCpu(false);
    setSystemInfoSnapshots([]);
    setIsProcessingSystemInfo(false);
    setPermissionSnapshots([]); 
    setIsProcessingPermissions(false);
    setIndicatorStartEvents([]);
    setIsProcessingIndicators(false);
    setStartTimestamps([]);
    // Note: selectedLogKey is handled separately where resetLogViewState is called
  }, []);


  const displayLogChunk = useCallback((
    sourceLinesToUse: string[], 
    filterToApplyToSource: ActiveLogFilter, 
    isCompletelyNewDisplay: boolean
  ) => {
    if (!isCompletelyNewDisplay) {
      setIsLogLoadingMore(true);
    }

    let linesForCurrentOperation: string[];
    let startIndexForCurrentOperation: number;

    if (isCompletelyNewDisplay) {
      if (filterToApplyToSource === 'error') {
        linesForCurrentOperation = sourceLinesToUse.filter(line => /\berror\b/i.test(line));
      } else if (filterToApplyToSource === 'warn') {
        linesForCurrentOperation = sourceLinesToUse.filter(line => /\bwarn(?:ing)?\b/i.test(line));
      } else {
        linesForCurrentOperation = [...sourceLinesToUse];
      }
      setFilteredAndLoadedLines(linesForCurrentOperation); 
      startIndexForCurrentOperation = 0;
    } else {
      linesForCurrentOperation = filteredAndLoadedLines; // Use existing filtered lines for "load more"
      startIndexForCurrentOperation = currentDisplayEndIndex;
    }
    
    const endIndexForCurrentOperation = Math.min(startIndexForCurrentOperation + LINES_PER_CHUNK_DISPLAY, linesForCurrentOperation.length);
    const chunkTextArray = linesForCurrentOperation.slice(startIndexForCurrentOperation, endIndexForCurrentOperation);
    
    if (isCompletelyNewDisplay) {
      setDisplayedLogContent(chunkTextArray.join('\n'));
    } else {
      setDisplayedLogContent(prev => (prev ? prev + '\n' : '') + chunkTextArray.join('\n'));
    }
    
    setCurrentDisplayEndIndex(endIndexForCurrentOperation);
    setHasMoreLogContent(endIndexForCurrentOperation < linesForCurrentOperation.length);
    
    if (!isCompletelyNewDisplay) {
      setTimeout(() => setIsLogLoadingMore(false), 0); // Ensure state update propagate before clearing
    }
  }, [filteredAndLoadedLines, currentDisplayEndIndex]);


  const initiateFullLogLoad = useCallback(async (fileToLoad: File, moduleName: string | null) => {
    if (!fileToLoad) return;

    setIsLogLoading(true);
    setDisplayedLogContent('');
    setAllLoadedLogLines([]);
    setFilteredAndLoadedLines([]); // Reset here
    setLogStatistics({ errorCount: 0, warnCount: 0 });
    setCurrentDisplayEndIndex(0);
    setHasMoreLogContent(false);
    setErrorMessage(null);
    
    setMemoryUsageData([]); 
    setIsAnalyzingMemory(false);
    setGdiUsageData([]);
    setIsAnalyzingGdi(false);
    setCpuUsageData([]);
    setIsAnalyzingCpu(false);
    setSystemInfoSnapshots([]);
    setIsProcessingSystemInfo(false);
    setPermissionSnapshots([]); 
    setIsProcessingPermissions(false);
    setIndicatorStartEvents([]);
    setIsProcessingIndicators(false);
    setStartTimestamps([]);


    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fullText = e.target?.result as string;
        if (typeof fullText !== 'string') {
            setErrorMessage(`Error reading file ${fileToLoad.name}: content is not text.`);
            setIsLogLoading(false);
            return;
        }
        const lines = fullText.split('\n');
        setAllLoadedLogLines(lines); // Set all lines first

        const stats = parseAndCountLogEvents(lines);
        setLogStatistics(stats);

        const linesWithTimestamps = lines.map((line, index) => ({
          line,
          timestamp: extractTimestampFromLogLine(line),
          originalIndex: index,
        }));
        
        let analysisTasksPending = 0;
        const completeAnalysisTask = () => {
          analysisTasksPending--;
          if (analysisTasksPending === 0) {
            // Now that all lines are set, and initial analysis is done, display first chunk
            // displayLogChunk will use allLoadedLogLines and activeFilter to set filteredAndLoadedLines
             if (!isLogLoadingMore) { // Check isLogLoadingMore to avoid race condition if user scrolls fast
                 displayLogChunk(lines, activeFilter, true);
             }
            setIsLogLoading(false); // All initial processing done
          }
        };
        
        analysisTasksPending++; // For the initial stats and line processing (which includes setting filtered lines via displayLogChunk)

        if (moduleName === LOG_MODULE_DA) {
          analysisTasksPending++;
          setIsAnalyzingMemory(true);
          setTimeout(() => {
            const memData = parseMemoryUsage(lines);
            setMemoryUsageData(memData);
            setIsAnalyzingMemory(false);
            completeAnalysisTask();
          }, 0);

          analysisTasksPending++;
          setIsAnalyzingGdi(true);
          setTimeout(() => {
            const gdiDataResult = parseGdiUsage(lines);
            setGdiUsageData(gdiDataResult);
            setIsAnalyzingGdi(false);
            completeAnalysisTask();
          }, 0);

          analysisTasksPending++;
          setIsProcessingSystemInfo(true);
          setTimeout(() => {
            const systemInfo = parseSystemInfoForDA(linesWithTimestamps);
            setSystemInfoSnapshots(systemInfo);
            setIsProcessingSystemInfo(false);
            completeAnalysisTask();
          },0);

          analysisTasksPending++; 
          setIsProcessingPermissions(true);
          setTimeout(() => {
            const permissions = parsePermissions(linesWithTimestamps);
            setPermissionSnapshots(permissions);
            setIsProcessingPermissions(false);
            completeAnalysisTask();
          }, 0);

          // Parse and set start timestamps for DA logs
          setStartTimestamps(parseStartTimestamps(lines));
        }

        if (moduleName === LOG_MODULE_XSINDICATORSVCCLIENT) {
            analysisTasksPending++;
            setIsProcessingIndicators(true);
            setTimeout(() => {
                const indicatorEvents = parseXSIndicatorSvcClientLog(linesWithTimestamps);
                setIndicatorStartEvents(indicatorEvents);
                setIsProcessingIndicators(false);
                completeAnalysisTask();
            }, 0);
        }
        
        analysisTasksPending++;
        setIsAnalyzingCpu(true); // CPU data might be relevant for any log type
        setTimeout(() => {
          const cpuDataResult = parseCpuUsage(lines);
          setCpuUsageData(cpuDataResult);
          setIsAnalyzingCpu(false);
          completeAnalysisTask();
        }, 0);

        completeAnalysisTask(); // Complete the initial task for stats/line processing
      };
      reader.onerror = () => {
        console.error(`Error reading file ${fileToLoad.name}:`, reader.error);
        setErrorMessage(`Error reading file ${fileToLoad.name}. Check console for details.`);
        setIsLogLoading(false); 
        setIsAnalyzingMemory(false);
        setIsAnalyzingGdi(false);
        setIsAnalyzingCpu(false);
        setIsProcessingSystemInfo(false);
        setIsProcessingPermissions(false);
        setIsProcessingIndicators(false);
      };
      reader.readAsText(fileToLoad, 'big5');
    } catch (error) {
      console.error("Error initiating full log load:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to initiate log loading.");
      setIsLogLoading(false);
      setIsAnalyzingMemory(false);
      setIsAnalyzingGdi(false);
      setIsAnalyzingCpu(false);
      setIsProcessingSystemInfo(false);
      setIsProcessingPermissions(false);
      setIsProcessingIndicators(false);
    }
  }, [displayLogChunk, activeFilter, isLogLoadingMore]);


  const handleSelectLog = useCallback((identifier: SelectedLogIdentifier) => {
    setActiveFilter(null); 
    setSelectedLogKey(identifier);
    
    const logEntry = categorizedLogs[identifier.moduleName]?.[identifier.date];
    if (logEntry) {
      setCurrentLogFullFile(logEntry.file); 
      // No need to reset filteredAndLoadedLines here, initiateFullLogLoad will handle it
    } else {
      resetLogViewState(); // Reset view if log not found (e.g. after closing it)
      setSelectedLogKey(null); 
      setErrorMessage("Selected log not found after selection attempt.");
    }
  }, [categorizedLogs, resetLogViewState]);


  const handleCloseLog = useCallback((identifier: SelectedLogIdentifier) => {
    setCategorizedLogs(prevLogs => {
      const newLogs = { ...prevLogs };
      if (newLogs[identifier.moduleName]) {
        delete newLogs[identifier.moduleName][identifier.date];
        if (Object.keys(newLogs[identifier.moduleName]).length === 0) {
          delete newLogs[identifier.moduleName];
        }
      }
      return newLogs;
    });

    if (selectedLogKey?.moduleName === identifier.moduleName && selectedLogKey?.date === identifier.date) {
      resetLogViewState();
      setSelectedLogKey(null); 
    }
  }, [selectedLogKey, resetLogViewState]);


  useEffect(() => {
    if (currentLogFullFile && selectedLogKey) {
        setDisplayedLogContent(''); // Clear previous display
        setAllLoadedLogLines([]);   // Clear previous all lines
        setFilteredAndLoadedLines([]); // Clear previous filtered lines
        setCurrentDisplayEndIndex(0);
        setHasMoreLogContent(false);
        
        initiateFullLogLoad(currentLogFullFile, selectedLogKey.moduleName);
    } else if (!selectedLogKey) { 
        resetLogViewState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLogFullFile, selectedLogKey]); // initiateFullLogLoad is not added to prevent re-triggering on its own changes

  const handleLoadMoreLogContent = useCallback(() => {
    if (currentLogFullFile && hasMoreLogContent && !isLogLoading && !isLogLoadingMore) {
      // displayLogChunk uses `filteredAndLoadedLines` which is already set correctly
      displayLogChunk(allLoadedLogLines, activeFilter, false); 
    }
  }, [currentLogFullFile, hasMoreLogContent, isLogLoading, isLogLoadingMore, displayLogChunk, allLoadedLogLines, activeFilter]);

  const handleApplyFilter = useCallback((newFilter: ActiveLogFilter) => {
    setActiveFilter(newFilter);
    if (allLoadedLogLines.length > 0) {
        setDisplayedLogContent(''); // Clear current display
        setCurrentDisplayEndIndex(0); // Reset display index
        setHasMoreLogContent(false); // Reset hasMore
        // displayLogChunk will re-calculate filteredAndLoadedLines based on newFilter and allLoadedLogLines
        displayLogChunk(allLoadedLogLines, newFilter, true);
    } else {
        setDisplayedLogContent('');
        setFilteredAndLoadedLines([]); // Ensure filtered lines are reset if no base lines
        setCurrentDisplayEndIndex(0);
        setHasMoreLogContent(false);
    }
  }, [allLoadedLogLines, displayLogChunk]);

  const processFiles = async (files: FileList) => {
    setIsProcessingFiles(true);
    setErrorMessage(null);
    const newCategorizedLogs: CategorizedLogs = { ...categorizedLogs };
    let filesProcessed = 0;

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.log')) {
        setErrorMessage(prev => (prev ? prev + '; ' : '') + `Skipped non .log file: ${file.name}`);
        continue;
      }

      const match = file.name.match(/^([A-Za-z0-9_-]+)(\d{8})\.log$/i);
      if (!match) {
        setErrorMessage(prev => (prev ? prev + '; ' : '') + `Skipped file with invalid name format: ${file.name}`);
        continue;
      }

      const [, moduleName, date] = match;
      const upperModuleName = moduleName.toUpperCase();

      if (!newCategorizedLogs[upperModuleName]) {
        newCategorizedLogs[upperModuleName] = {};
      }

      const logEntry: LogFileEntry = {
        file,
        name: file.name,
        moduleName: upperModuleName,
        date,
        id: `${upperModuleName}-${date}`
      };
      
      newCategorizedLogs[upperModuleName][date] = logEntry;
      filesProcessed++;
    }
    
    if (filesProcessed > 0) {
        // Sort modules and dates within modules
        const sortedModules: CategorizedLogs = {};
        Object.keys(newCategorizedLogs).sort().forEach(modKey => {
            sortedModules[modKey] = {};
            Object.keys(newCategorizedLogs[modKey]).sort((a,b) => b.localeCompare(a)).forEach(dateKey => { // Sort dates descending
                sortedModules[modKey][dateKey] = newCategorizedLogs[modKey][dateKey];
            });
        });
        setCategorizedLogs(sortedModules);
    }
    setIsProcessingFiles(false);
  };

  const selectedLogEntry = selectedLogKey ? categorizedLogs[selectedLogKey.moduleName]?.[selectedLogKey.date] : null;
  // Prepare the full text for the current filter to pass to LogViewer for searching
  const fullTextForCurrentFilter = filteredAndLoadedLines.join('\n');


  return (
    <div className="flex h-screen font-sans">
      <aside className="w-1/3 lg:w-1/4 h-full bg-gray-800 text-white flex flex-col shadow-lg">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold text-center">Log Analyzer Pro</h1>
        </div>
        <div className="p-4">
          <FileUploadButton onFilesSelected={processFiles} isProcessing={isProcessingFiles} />
        </div>
        {errorMessage && (
          <div className="p-3 mx-4 mb-2 bg-red-700 text-white text-xs rounded break-words max-h-24 overflow-y-auto">
            <p className="font-semibold">Error(s):</p>
            {errorMessage.split(';').map((msg, idx) => <p key={idx}>{msg.trim()}</p>)}
          </div>
        )}
        <div className="flex-grow overflow-y-auto p-2 custom-scrollbar">
          <Sidebar 
            categorizedLogs={categorizedLogs}
            selectedLogId={selectedLogKey ? `${selectedLogKey.moduleName}-${selectedLogKey.date}` : null}
            onSelectLog={handleSelectLog}
            onCloseLog={handleCloseLog}
          />
        </div>
      </aside>

      <main className="w-2/3 lg:w-3/4 h-full bg-gray-900">
        <LogViewer
          logName={selectedLogEntry?.name || null}
          logDate={selectedLogEntry?.date || null}
          moduleName={selectedLogEntry?.moduleName || null}
          content={displayedLogContent}
          fullFilteredText={fullTextForCurrentFilter} // Pass the full filtered text
          isLoading={isLogLoading}
          isLoadingMore={isLogLoadingMore}
          onLoadMore={handleLoadMoreLogContent}
          hasMore={hasMoreLogContent}
          logStatistics={logStatistics}
          activeFilter={activeFilter}
          onApplyFilter={handleApplyFilter}
          memoryUsageData={memoryUsageData}
          isAnalyzingMemory={isAnalyzingMemory}
          gdiUsageData={gdiUsageData}
          isAnalyzingGdi={isAnalyzingGdi}
          cpuUsageData={cpuUsageData}
          isAnalyzingCpu={isAnalyzingCpu}
          systemInfoSnapshots={systemInfoSnapshots}
          isProcessingSystemInfo={isProcessingSystemInfo}
          permissionSnapshots={permissionSnapshots} 
          isProcessingPermissions={isProcessingPermissions}
          indicatorStartEvents={indicatorStartEvents}
          isProcessingIndicators={isProcessingIndicators}
          startTimestamps={startTimestamps}
        />
      </main>
    </div>
  );
};

export default App;
