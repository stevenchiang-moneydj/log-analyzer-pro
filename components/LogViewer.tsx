import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { JSX } from 'react';
import { SpinnerIcon } from './icons';
import { 
    LogStatistics, 
    ActiveLogFilter, 
    MemoryUsageDataPoint, 
    GdiUsageDataPoint, 
    CpuUsageDataPoint, 
    SystemInfoSnapshot,
    PermissionSnapshot,
    IndicatorStartEvent
} from '../types';
import MemoryUsageChart from './MemoryUsageChart'; 
import GdiUsageChart from './GdiUsageChart';
import CpuUsageChart from './CpuUsageChart';
import SystemInfoTab from './SystemInfoTab';
import PermissionsTab from './PermissionsTab';
import XSIndicatorSvcClientTab from './XSIndicatorSvcClientTab';

interface LogViewerProps {
  logName: string | null;
  logDate: string | null; // Added to pass to XSIndicatorSvcClientTab
  moduleName: string | null; 
  content: string; // The currently rendered (cumulative) chunk of log lines
  fullFilteredText: string; // The complete text of all lines matching the current filter
  isLoading: boolean; 
  isLoadingMore: boolean; 
  onLoadMore: () => void;
  hasMore: boolean;
  logStatistics: LogStatistics;
  activeFilter: ActiveLogFilter;
  onApplyFilter: (filter: ActiveLogFilter) => void;
  memoryUsageData: MemoryUsageDataPoint[];
  isAnalyzingMemory: boolean;
  gdiUsageData: GdiUsageDataPoint[];
  isAnalyzingGdi: boolean;
  cpuUsageData: CpuUsageDataPoint[];
  isAnalyzingCpu: boolean;
  systemInfoSnapshots: SystemInfoSnapshot[];
  isProcessingSystemInfo: boolean;
  permissionSnapshots: PermissionSnapshot[];
  isProcessingPermissions: boolean;
  indicatorStartEvents: IndicatorStartEvent[];
  isProcessingIndicators: boolean;
  startTimestamps?: string[];
}

type ViewMode = 'content' | 'resourceChart' | 'systemInfo' | 'permissionsInfo' | 'xsIndicatorInfo';

// Helper type for tab definitions including the condition
type TabDefinition = {
  mode: ViewMode;
  label: string;
  condition: boolean;
};

const LOG_MODULE_DA = 'DA';
const LOG_MODULE_XSINDICATORSVCCLIENT = 'XSINDICATORSVCCLIENT';


const LogViewer: React.FC<LogViewerProps> = ({ 
  logName, 
  logDate,
  moduleName,
  content, 
  fullFilteredText,
  isLoading, 
  isLoadingMore, 
  onLoadMore, 
  hasMore,
  logStatistics,
  activeFilter,
  onApplyFilter,
  memoryUsageData,
  isAnalyzingMemory,
  gdiUsageData,
  isAnalyzingGdi,
  cpuUsageData,
  isAnalyzingCpu,
  systemInfoSnapshots,
  isProcessingSystemInfo,
  permissionSnapshots,
  isProcessingPermissions,
  indicatorStartEvents,
  isProcessingIndicators,
  startTimestamps = [],
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const prevLogNameRef = useRef<string | null>(null);
  const prevActiveFilterRef = useRef<ActiveLogFilter | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<ViewMode>('content');

  // Search state
  const [searchTermInput, setSearchTermInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  // searchMatches stores lineIndex global to fullFilteredText
  const [searchMatches, setSearchMatches] = useState<{ lineIndex: number; matchElementId: string }[]>([]);
  const [currentMatchHighlightedIndex, setCurrentMatchHighlightedIndex] = useState<number>(-1);

  const hasMemoryOrGdiData = memoryUsageData.length > 0 || gdiUsageData.length > 0;
  const hasCpuData = cpuUsageData.length > 0;
  
  const showResourceChartTab = (moduleName === LOG_MODULE_DA && hasMemoryOrGdiData) || hasCpuData;
  const showSystemInfoTab = moduleName === LOG_MODULE_DA;
  const showPermissionsTab = moduleName === LOG_MODULE_DA;
  const showXSIndicatorTab = moduleName === LOG_MODULE_XSINDICATORSVCCLIENT;


  // Effect for when the log file itself changes, to set the default view mode
  useEffect(() => {
    if (logName !== prevLogNameRef.current) { 
      if (moduleName === LOG_MODULE_XSINDICATORSVCCLIENT && showXSIndicatorTab) {
        setActiveViewMode('xsIndicatorInfo');
      } else if (moduleName === LOG_MODULE_DA && showSystemInfoTab) { 
        setActiveViewMode('systemInfo');
      } else {
        setActiveViewMode('content'); 
      }
      setSearchTermInput(''); 
      setActiveSearchQuery('');
      prevLogNameRef.current = logName; 
    }
  }, [logName, moduleName, showSystemInfoTab, showXSIndicatorTab]);

  // Effect for ensuring the current activeViewMode is valid if its corresponding tab becomes hidden
  useEffect(() => {
    if (activeViewMode === 'resourceChart' && !showResourceChartTab) {
        setActiveViewMode('content');
    } else if (activeViewMode === 'systemInfo' && !showSystemInfoTab) {
        setActiveViewMode('content');
    } else if (activeViewMode === 'permissionsInfo' && !showPermissionsTab) {
        setActiveViewMode('content');
    } else if (activeViewMode === 'xsIndicatorInfo' && !showXSIndicatorTab) {
        setActiveViewMode('content');
    }
  }, [activeViewMode, showResourceChartTab, showSystemInfoTab, showPermissionsTab, showXSIndicatorTab]);


  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      if (viewerRef.current && activeViewMode === 'content') {
        const { scrollTop, scrollHeight, clientHeight } = viewerRef.current;
        // Allow some tolerance for triggering load more, e.g., 200px from bottom
        if (scrollHeight - scrollTop - clientHeight < 200 && hasMore && !isLoadingMore && !isLoading) {
          onLoadMore();
        }
      }
    }, 100);
  }, [hasMore, isLoadingMore, isLoading, onLoadMore, activeViewMode]);

  useEffect(() => {
    const currentViewerRef = viewerRef.current;
    if (currentViewerRef && activeViewMode === 'content') {
      currentViewerRef.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (currentViewerRef) {
        currentViewerRef.removeEventListener('scroll', handleScroll);
      }
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScroll, activeViewMode]);

  useEffect(() => {
    if (viewerRef.current && activeViewMode === 'content' &&
        ((activeFilter !== prevActiveFilterRef.current) ||
         (activeSearchQuery && searchMatches.length === 0) 
        ) && 
        currentMatchHighlightedIndex === -1 
       ) {
      viewerRef.current.scrollTop = 0;
    }
    if (activeFilter !== prevActiveFilterRef.current) {
        setSearchTermInput('');
        setActiveSearchQuery(''); 
    }
    prevActiveFilterRef.current = activeFilter;
  }, [logName, activeFilter, activeViewMode, activeSearchQuery, currentMatchHighlightedIndex, searchMatches.length]);


  // Search Logic: Operates on fullFilteredText
  useEffect(() => {
    const textToSearch = fullFilteredText;
    if (!activeSearchQuery || !textToSearch) {
        setSearchMatches([]);
        setCurrentMatchHighlightedIndex(-1);
        return;
    }

    const query = activeSearchQuery.toLowerCase();
    const linesForSearching = textToSearch.split('\n');
    const newMatches: { lineIndex: number; matchElementId: string }[] = [];

    linesForSearching.forEach((line, lineIdx) => { 
        const lowerLine = line.toLowerCase();
        let lastIndex = 0;
        let matchCountInLine = 0;
        let matchIndex = lowerLine.indexOf(query, lastIndex);

        while (matchIndex !== -1) {
            const matchId = `match-${lineIdx}-${matchCountInLine}`; 
            newMatches.push({ lineIndex: lineIdx, matchElementId: matchId });
            lastIndex = matchIndex + query.length;
            matchCountInLine++;
            matchIndex = lowerLine.indexOf(query, lastIndex);
        }
    });
    setSearchMatches(newMatches);
    setCurrentMatchHighlightedIndex(newMatches.length > 0 ? 0 : -1);
  }, [fullFilteredText, activeSearchQuery]);

  // Scroll to highlighted match if it's within the currently rendered 'content'
 useEffect(() => {
    if (currentMatchHighlightedIndex !== -1 && searchMatches.length > 0 && activeViewMode === 'content') {
        const matchInfo = searchMatches[currentMatchHighlightedIndex];
        if (matchInfo) {
            const currentlyRenderedLineCount = content ? content.split('\n').length : 0;
            if (matchInfo.lineIndex < currentlyRenderedLineCount) {
                const element = document.getElementById(matchInfo.matchElementId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }
 }, [currentMatchHighlightedIndex, searchMatches, activeViewMode, content]);


  const handleSearch = () => {
    if (isLoading || !searchTermInput.trim()) return;
    setActiveSearchQuery(searchTermInput.trim());
    if (viewerRef.current && currentMatchHighlightedIndex === -1 && activeViewMode === 'content') {
      viewerRef.current.scrollTop = 0;
    }
  };

  const handleClearSearch = () => {
    if (isLoading) return;
    setSearchTermInput('');
    setActiveSearchQuery('');
     if (viewerRef.current && activeViewMode === 'content') { 
      viewerRef.current.scrollTop = 0;
    }
  };

  const handleNextMatch = () => {
    if (isLoading || searchMatches.length <= 1) return;
    setCurrentMatchHighlightedIndex(prev => (prev + 1) % searchMatches.length);
  };

  const handlePreviousMatch = () => {
    if (isLoading || searchMatches.length <= 1) return;
    setCurrentMatchHighlightedIndex(prev => (prev - 1 + searchMatches.length) % searchMatches.length);
  };

  const displayedRenderedLogLines = useMemo(() => {
    if (!content) return null;

    if (!activeSearchQuery) {
        return content.split('\n').map((line, index) => <div key={`line-${index}`} className="whitespace-pre-wrap break-all">{line}</div>);
    }

    const query = activeSearchQuery.toLowerCase();
    const linesOfContent = content.split('\n'); 

    return linesOfContent.map((line, lineIdxInContent) => { 
        const lineParts: (string | JSX.Element)[] = [];
        let currentIndex = 0;
        const lowerCaseLine = line.toLowerCase();
        
        let matchFoundAt = lowerCaseLine.indexOf(query, currentIndex);
        let matchCounterInLine = 0;

        while (matchFoundAt !== -1) {
            lineParts.push(line.substring(currentIndex, matchFoundAt));
            const matchedText = line.substring(matchFoundAt, matchFoundAt + query.length);
            const matchId = `match-${lineIdxInContent}-${matchCounterInLine}`; 
            
            lineParts.push(
                <mark
                    key={matchId}
                    id={matchId}
                    className={
                        searchMatches.length > 0 &&
                        currentMatchHighlightedIndex !== -1 &&
                        searchMatches[currentMatchHighlightedIndex]?.matchElementId === matchId
                        ? 'bg-yellow-500 text-black rounded px-0.5' 
                        : 'bg-yellow-300 text-black rounded px-0.5' 
                    }
                >
                    {matchedText}
                </mark>
            );
            currentIndex = matchFoundAt + query.length;
            matchCounterInLine++;
            matchFoundAt = lowerCaseLine.indexOf(query, currentIndex);
        }
        lineParts.push(line.substring(currentIndex));
        
        return <div key={`line-${lineIdxInContent}`} className="whitespace-pre-wrap break-all">{lineParts.length > 0 ? lineParts : line}</div>;
    });
  }, [content, activeSearchQuery, searchMatches, currentMatchHighlightedIndex]);


  const getFilterButtonClass = (filterType: ActiveLogFilter) => {
    const baseClass = "px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    if (activeFilter === filterType) {
      return `${baseClass} bg-blue-600 text-white`;
    }
    return `${baseClass} bg-gray-600 hover:bg-gray-500 text-gray-200`;
  };
  
  const searchButtonBaseClass = "px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const searchButtonPrimaryClass = `${searchButtonBaseClass} bg-indigo-600 hover:bg-indigo-700 text-white`;
  const searchButtonSecondaryClass = `${searchButtonBaseClass} bg-gray-600 hover:bg-gray-500 text-gray-200`;


  const renderContent = () => {
    if (isLoading && content.length === 0 && !logName) { 
         return (
             <div className="flex items-center justify-center h-full bg-gray-800 text-gray-300 p-4">
                 <SpinnerIcon className="w-10 h-10" />
                 <span className="ml-3 text-lg">Loading...</span>
             </div>
         );
    }
    
    if (isLoading && logName && (activeViewMode === 'content' && content.length === 0) ) { 
      return (
        <div className="flex items-center justify-center h-full bg-gray-800 text-gray-300 p-4">
          <SpinnerIcon className="w-10 h-10" />
          <span className="ml-3 text-lg text-center">Analyzing log and calculating statistics... <br/> This may take a moment for large files.</span>
        </div>
      );
    }
    
    if (!logName && !isLoading) { 
      return (
        <div className="flex items-center justify-center h-full bg-gray-800 text-gray-400 p-8">
          <p className="text-lg text-center">
            Select a log file from the sidebar to view its content.
            <br />
            If no files are listed, please upload .log files using the button in the sidebar.
          </p>
        </div>
      );
    }

    if (activeViewMode === 'content') {
      const noContentDueToFilter = activeFilter && fullFilteredText.length === 0 && logName;
      const isEmptyLog = fullFilteredText.length === 0 && !activeFilter && logName && !isLoadingMore && !isLoading;
      
      return (
        <div className="flex flex-col flex-grow overflow-hidden">
          {logName && (
            <div className="p-3 bg-gray-750 border-b border-gray-600">
              {/* Search UI */}
              <div className="mb-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={searchTermInput}
                    onChange={(e) => setSearchTermInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search log content..."
                    className="flex-grow bg-gray-700 text-gray-200 border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                    disabled={isLoading}
                    aria-label="Search log content"
                  />
                  <button
                    onClick={handleSearch}
                    className={searchButtonPrimaryClass}
                    disabled={isLoading || !searchTermInput.trim()}
                    aria-label="Initiate search"
                  >
                    Search
                  </button>
                  <button
                    onClick={handleClearSearch}
                    className={searchButtonSecondaryClass}
                    disabled={isLoading || !activeSearchQuery}
                    aria-label="Clear search"
                  >
                    Clear
                  </button>
                </div>
                {activeSearchQuery && !isLoading && (
                  <div className="flex items-center space-x-2 mt-2 text-sm text-gray-300" aria-live="polite">
                    {searchMatches.length > 0 ? (
                      <>
                        <span>{currentMatchHighlightedIndex + 1} of {searchMatches.length} matches for "{activeSearchQuery}"</span>
                        <button
                          onClick={handlePreviousMatch}
                          disabled={searchMatches.length <= 1}
                          className={searchButtonSecondaryClass}
                          aria-label="Previous match"
                        >
                          Previous
                        </button>
                        <button
                          onClick={handleNextMatch}
                          disabled={searchMatches.length <= 1}
                          className={searchButtonSecondaryClass}
                          aria-label="Next match"
                        >
                          Next
                        </button>
                      </>
                    ) : (
                      <span>No matches found for "{activeSearchQuery}"</span>
                    )}
                  </div>
                )}
              </div>
              {/* Filter Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onApplyFilter(null)}
                  className={getFilterButtonClass(null)}
                  aria-pressed={activeFilter === null}
                  disabled={isLoading}
                >
                  All Logs
                </button>
                <button
                  onClick={() => onApplyFilter('error')}
                  className={getFilterButtonClass('error')}
                  aria-pressed={activeFilter === 'error'}
                  disabled={isLoading || (logStatistics.errorCount === 0 && activeFilter !== 'error')}
                >
                  Errors ({logStatistics.errorCount})
                </button>
                <button
                  onClick={() => onApplyFilter('warn')}
                  className={getFilterButtonClass('warn')}
                  aria-pressed={activeFilter === 'warn'}
                  disabled={isLoading || (logStatistics.warnCount === 0 && activeFilter !== 'warn')}
                >
                  Warnings ({logStatistics.warnCount})
                </button>
              </div>
            </div>
          )}
          <div 
            ref={viewerRef} 
            className="flex-grow p-4 overflow-auto bg-gray-900 text-sm text-gray-200 font-mono relative"
            aria-live="polite"
            aria-busy={isLoading || isLoadingMore}
          >
            {logName && content.length > 0 && displayedRenderedLogLines}
            
            {noContentDueToFilter && !isLoading && !activeSearchQuery && (
              <div className="text-center py-4 text-gray-500">
                No log entries match the current filter: "{activeFilter}".
              </div>
            )}
             {isEmptyLog && !isLoading && !activeSearchQuery && (
              <div className="text-center py-4 text-gray-500">
                This log file appears to be empty.
              </div>
            )}


            {isLoadingMore && (
              <div className="sticky bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white px-4 py-2 rounded-md shadow-lg flex items-center z-10" role="status">
                <SpinnerIcon className="w-4 h-4 mr-2" />
                Loading more...
              </div>
            )}
            {!hasMore && content.length > 0 && !isLoadingMore && logName && !isLoading && (
              <div className="text-center py-4 text-gray-500">End of log{activeFilter ? ` (filtered content)` : ''}{activeSearchQuery ? ` (search active)` : ''}.</div>
            )}
            {activeSearchQuery && searchMatches.length > 0 && content.length > 0 && !displayedRenderedLogLines?.some(el => el?.props?.children?.some((c: any) => c?.type === 'mark')) && !isLoading && (
                 <div className="text-center py-4 text-gray-400">
                    Search matches found. Scroll down to view them or use Next/Previous.
                 </div>
            )}
          </div>
        </div>
      );
    }

    if (activeViewMode === 'resourceChart') {
      const memoryChartIsLoading = isAnalyzingMemory || (isLoading && memoryUsageData.length === 0);
      const gdiChartIsLoading = isAnalyzingGdi || (isLoading && gdiUsageData.length === 0);
      const cpuChartIsLoading = isAnalyzingCpu || (isLoading && cpuUsageData.length === 0);
      
      const showDACharts = moduleName === LOG_MODULE_DA && hasMemoryOrGdiData;

      if (!showDACharts && !hasCpuData) {
         return <div className="p-4 text-gray-400">No applicable resource data found for this log in '資源使用狀況' analysis.</div>;
      }

      return (
        <div className="flex-grow p-4 overflow-auto bg-gray-900 space-y-8">
          {showDACharts && (
            <>
              {memoryUsageData.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-200 mb-3">Memory Usage Over Time (DA Logs)</h3>
                  <MemoryUsageChart data={memoryUsageData} isLoading={memoryChartIsLoading} startTimestamps={startTimestamps} />
                </div>
              )}
              {gdiUsageData.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-200 mb-3">GDI Usage Over Time (DA Logs)</h3>
                  <GdiUsageChart data={gdiUsageData} isLoading={gdiChartIsLoading} startTimestamps={startTimestamps} />
                </div>
              )}
            </>
          )}
          {hasCpuData && (
             <div>
                <h3 className="text-lg font-semibold text-gray-200 mb-3">CPU Usage & DelayMS Over Time</h3>
                <CpuUsageChart data={cpuUsageData} isLoading={cpuChartIsLoading} startTimestamps={startTimestamps} />
              </div>
          )}
           {(isLoading && (!hasMemoryOrGdiData && !hasCpuData)) && (isAnalyzingMemory || isAnalyzingGdi || isAnalyzingCpu) && (
             <div className="flex items-center justify-center h-64 text-gray-300">
                <SpinnerIcon className="w-8 h-8 mr-2" />
                <span>Loading resource data...</span>
              </div>
           )}
        </div>
      );
    }

    if (activeViewMode === 'systemInfo') {
        if (!showSystemInfoTab) { 
            return <div className="p-4 text-gray-400">System Information is only available for DA logs.</div>;
        }
        return (
            <SystemInfoTab 
                snapshots={systemInfoSnapshots} 
                isLoading={isProcessingSystemInfo || (isLoading && systemInfoSnapshots.length === 0)} 
            />
        );
    }

    if (activeViewMode === 'permissionsInfo') {
        if (!showPermissionsTab) { 
             return <div className="p-4 text-gray-400">Permissions Information is only available for DA logs.</div>;
        }
        return (
            <PermissionsTab
                snapshots={permissionSnapshots}
                isLoading={isProcessingPermissions || (isLoading && permissionSnapshots.length === 0)}
            />
        );
    }

    if (activeViewMode === 'xsIndicatorInfo') {
        if (!showXSIndicatorTab) {
            return <div className="p-4 text-gray-400">Indicator Analysis is only available for XSIndicatorSvcClient logs.</div>;
        }
        return (
            <XSIndicatorSvcClientTab
                indicatorStartEvents={indicatorStartEvents}
                isLoading={isProcessingIndicators || (isLoading && indicatorStartEvents.length === 0)}
                logDate={logDate} 
            />
        );
    }
    return null;
  };
  
  const getTabClass = (mode: ViewMode) => {
    const baseClass = "px-4 py-2 text-sm font-medium rounded-t-md focus:outline-none transition-colors whitespace-nowrap";
    if (activeViewMode === mode) {
      return `${baseClass} bg-gray-700 text-white`;
    }
    return `${baseClass} text-gray-400 hover:bg-gray-600 hover:text-gray-200`;
  };
  
  if (isLoading && !logName) { 
      return (
        <div className="h-full flex flex-col bg-gray-800">
           <div className="p-3 bg-gray-700 border-b border-gray-600">
             <h2 className="text-lg font-semibold text-white truncate">Log Viewer</h2>
           </div>
           <div className="flex items-center justify-center flex-grow bg-gray-800 text-gray-300 p-4">
             <SpinnerIcon className="w-10 h-10" />
             <span className="ml-3 text-lg">Loading initial data...</span>
           </div>
        </div>
      );
  }
  
  if (!logName && !isLoading) { 
    return (
      <div className="h-full flex flex-col bg-gray-800">
        <div className="p-3 bg-gray-700 border-b border-gray-600">
          <h2 className="text-lg font-semibold text-white truncate">No Log Selected</h2>
        </div>
        <div className="flex items-center justify-center flex-grow bg-gray-800 text-gray-400 p-8">
          <p className="text-lg text-center">
            Select a log file from the sidebar to view its content.
            <br />
            If no files are listed, please upload .log files.
          </p>
        </div>
      </div>
    );
  }
  
  const daTabDefinitions: TabDefinition[] = [
    { mode: 'systemInfo', label: '基本資訊', condition: showSystemInfoTab },
    { mode: 'permissionsInfo', label: '權限資訊', condition: showPermissionsTab },
    { mode: 'resourceChart', label: '資源使用狀況', condition: showResourceChartTab },
    { mode: 'content', label: 'Log Content', condition: true },
  ];

  const xsIndicatorTabDefinitions: TabDefinition[] = [
    { mode: 'xsIndicatorInfo', label: '指標分析', condition: showXSIndicatorTab },
    { mode: 'content', label: 'Log Content', condition: true },
    { mode: 'resourceChart', label: '資源使用狀況', condition: showResourceChartTab },
  ];
  
  let currentTabs: { mode: ViewMode, label: string }[];

  if (moduleName === LOG_MODULE_DA) {
    currentTabs = daTabDefinitions.filter(tab => tab.condition);
  } else if (moduleName === LOG_MODULE_XSINDICATORSVCCLIENT) {
    currentTabs = xsIndicatorTabDefinitions.filter(tab => tab.condition);
  } else {
    // Default for other modules
    const defaultTabDefinitions: TabDefinition[] = [
      { mode: 'content', label: 'Log Content', condition: true },
      { mode: 'resourceChart', label: '資源使用狀況', condition: showResourceChartTab },
    ];
    currentTabs = defaultTabDefinitions.filter(tab => tab.condition);
  }


  return (
    <div className="h-full flex flex-col bg-gray-800">
      <div className="p-3 bg-gray-700 border-b border-gray-600">
        <h2 className="text-lg font-semibold text-white truncate mb-2" title={logName || ''}>{logName}</h2>
        <div className="border-b border-gray-600">
          <nav className="-mb-px flex space-x-1 overflow-x-auto" aria-label="Tabs">
            {currentTabs.map(tab => (
              <button
                key={tab.mode}
                onClick={() => setActiveViewMode(tab.mode)}
                className={getTabClass(tab.mode)}
                aria-current={activeViewMode === tab.mode ? 'page' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

export default LogViewer;
