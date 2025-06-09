
import React, { useState, useMemo } from 'react';
import { IndicatorStartEvent } from '../types';
import { SpinnerIcon } from './icons';

interface XSIndicatorSvcClientTabProps {
  indicatorStartEvents: IndicatorStartEvent[];
  isLoading: boolean;
  logDate: string | null; // Date of the log file, e.g., "20240730"
}

const FREQUENCY_DISPLAY_MAP: Record<string, string> = {
  "2": "1分鐘",
  "3": "5分鐘",
  "4": "10分鐘",
  "5": "15分鐘",
  "6": "30分鐘",
  "7": "60分鐘",
  "8": "日",
  "9": "週",
  "10": "月",
  "11": "還原日",
  "12": "還原週",
  "13": "還原月",
  "14": "季",
  "15": "半年",
  "16": "年",
  "17": "20分鐘",
  "18": "3分鐘",
  "19": "45分鐘",
  "20": "90分鐘",
  "21": "120分鐘",
  "22": "180分鐘",
  "23": "2分鐘",
  "24": "135分鐘",
  "25": "240分鐘",
  "26": "還原1分鐘",
  "27": "還原2分鐘",
  "28": "還原3分鐘",
  "29": "還原5分鐘",
  "30": "還原10分鐘",
  "31": "還原15分鐘",
  "32": "還原20分鐘",
  "33": "還原30分鐘",
  "34": "還原45分鐘",
  "35": "還原60分鐘",
  "36": "還原90分鐘",
  "37": "還原120分鐘",
  "38": "還原135分鐘",
  "39": "還原180分鐘",
  "40": "還原240分鐘",
};

const getFreqDisplayName = (freqId?: string): string => {
  if (!freqId) return 'N/A';
  return FREQUENCY_DISPLAY_MAP[freqId] || freqId; // Fallback to raw ID if not in map
};

const isUnreasonableUsage = (event: IndicatorStartEvent, logFileDateStr: string | null): boolean => {
  if (!event.freq) {
    return false;
  }

  const freqNum = parseInt(event.freq, 10);
  if (isNaN(freqNum)) {
    return false;
  }

  const isFreqInRange =
    (freqNum >= 2 && freqNum <= 7) || (freqNum >= 17 && freqNum <= 40);

  if (!isFreqInRange) {
    return false; 
  }

  // Condition A
  let conditionAMet = false;
  if (event.firstBarDate === "-2147483648" && event.tDayCount != null) {
    const tDayCountNum = parseInt(event.tDayCount, 10);
    if (!isNaN(tDayCountNum) && tDayCountNum > 300) {
      conditionAMet = true;
    }
  }

  // Condition B
  let conditionBMet = false;
  if (
    event.totalBar === "-2147483648" &&
    event.firstBarDate === "-2147483648" &&
    event.tDayCount === "-2147483648"
  ) {
    conditionBMet = true;
  }

  // Condition C
  let conditionCMet = false;
  if (logFileDateStr && event.firstBarDate && event.firstBarDate !== "-2147483648") {
    const firstBarDateValue = event.firstBarDate;
    // Validate YYYYMMDD format for firstBarDateValue
    if (/^\d{8}$/.test(firstBarDateValue)) {
      const fbYear = parseInt(firstBarDateValue.substring(0, 4), 10);
      const fbMonth = parseInt(firstBarDateValue.substring(4, 6), 10); // 1-12
      const fbDay = parseInt(firstBarDateValue.substring(6, 8), 10);

      // Validate YYYYMMDD format for logFileDateStr
      if (/^\d{8}$/.test(logFileDateStr)) {
        const logYear = parseInt(logFileDateStr.substring(0, 4), 10);
        const logMonth = parseInt(logFileDateStr.substring(4, 6), 10); // 1-12
        const logDay = parseInt(logFileDateStr.substring(6, 8), 10);

        // Basic sanity check for year, month, day values
        if (fbYear > 1000 && fbMonth >= 1 && fbMonth <= 12 && fbDay >= 1 && fbDay <= 31 &&
            logYear > 1000 && logMonth >= 1 && logMonth <= 12 && logDay >= 1 && logDay <= 31) {
            
            const parsedFirstBarDate = new Date(fbYear, fbMonth - 1, fbDay);
            // Check if Date constructor created a valid date from parsed components
            if (parsedFirstBarDate.getFullYear() === fbYear &&
                parsedFirstBarDate.getMonth() === fbMonth - 1 &&
                parsedFirstBarDate.getDate() === fbDay) {
                
                const parsedLogFileDate = new Date(logYear, logMonth - 1, logDay);
                
                const twelveMonthsBeforeLogDate = new Date(parsedLogFileDate);
                twelveMonthsBeforeLogDate.setMonth(parsedLogFileDate.getMonth() - 12);
                
                // Set hours to 0 to compare dates only
                parsedFirstBarDate.setHours(0,0,0,0);
                twelveMonthsBeforeLogDate.setHours(0,0,0,0);

                if (parsedFirstBarDate < twelveMonthsBeforeLogDate) {
                    conditionCMet = true;
                }
            }
        }
      }
    }
  }

  return conditionAMet || conditionBMet || conditionCMet;
};


const XSIndicatorSvcClientTab: React.FC<XSIndicatorSvcClientTabProps> = ({ indicatorStartEvents, isLoading, logDate }) => {
  const [showOnlyUnreasonableUsage, setShowOnlyUnreasonableUsage] = useState(false);

  const unreasonableEvents = useMemo(() => {
    if (!indicatorStartEvents) return [];
    return indicatorStartEvents.filter(event => isUnreasonableUsage(event, logDate));
  }, [indicatorStartEvents, logDate]);

  const displayedEvents = useMemo(() => {
    if (!indicatorStartEvents) return [];
    return showOnlyUnreasonableUsage ? unreasonableEvents : indicatorStartEvents;
  }, [indicatorStartEvents, showOnlyUnreasonableUsage, unreasonableEvents]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-300 p-8">
        <SpinnerIcon className="w-8 h-8 mr-2" />
        <span>Processing indicator information...</span>
      </div>
    );
  }

  if (!indicatorStartEvents || indicatorStartEvents.length === 0) {
    return <div className="p-8 text-center text-gray-400">No indicator start events (StartXSIndicator) found in this log.</div>;
  }

  const thClass = "px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-b border-gray-600";
  const tdClass = "px-4 py-3 text-sm text-gray-200 whitespace-nowrap border-b border-gray-700";

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-850 overflow-auto h-full text-gray-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h3 className="text-xl font-semibold leading-7 text-white mb-3 sm:mb-0">XSIndicatorSvcClient - Indicator Start Events</h3>
        {indicatorStartEvents.length > 0 && (
          <div className="flex flex-col items-start sm:items-end">
             {unreasonableEvents.length > 0 && (
              <p className="text-sm text-yellow-400 mb-2">
                偵測到 {unreasonableEvents.length} 筆潛在不合理指標使用。
              </p>
            )}
            <button
              onClick={() => setShowOnlyUnreasonableUsage(!showOnlyUnreasonableUsage)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out text-sm"
              aria-pressed={showOnlyUnreasonableUsage}
            >
              {showOnlyUnreasonableUsage ? "顯示所有指標" : "篩選不合理使用指標"}
            </button>
          </div>
        )}
      </div>

      {displayedEvents.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          {showOnlyUnreasonableUsage 
            ? "沒有符合條件的不合理使用指標。" 
            : "No indicator start events to display." /* Should not happen if initial check passes */
          }
        </div>
      ) : (
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-750">
              <tr>
                <th className={thClass}>啟動時間</th>
                <th className={thClass}>指標ID</th>
                <th className={thClass}>指標名稱</th>
                <th className={thClass}>商品</th>
                <th className={thClass}>頻率</th>
                <th className={thClass}>TotalBar</th>
                <th className={thClass}>FirstBarDate</th>
                <th className={thClass}>TDayCount</th>
                <th className={thClass}>AlignType</th>
                <th className={thClass}>AlignMode</th>
                <th className={thClass}>Sync</th>
                <th className={thClass}>AddFakeBar</th>
                <th className={thClass}>AutoCloseK</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {displayedEvents.map((event, index) => (
                <tr 
                  key={`${event.indicatorId}-${event.startTimestamp}-${index}`} 
                  className={`hover:bg-gray-700 transition-colors duration-150 ${isUnreasonableUsage(event, logDate) ? 'bg-red-900 bg-opacity-50 hover:bg-red-800 hover:bg-opacity-60' : ''}`}
                  title={isUnreasonableUsage(event, logDate) ? 'This row matches unreasonable usage criteria' : undefined}
                  aria-live="polite" 
                  aria-roledescription={isUnreasonableUsage(event, logDate) ? 'unreasonable usage indicator' : undefined}
                >
                  <td className={tdClass}>{event.startTimestamp}</td>
                  <td className={tdClass} title={event.indicatorId}>
                    <div className="truncate w-24" aria-label={`Indicator ID: ${event.indicatorId}`}>{event.indicatorId}</div>
                  </td>
                  <td className={tdClass}>{event.name || 'N/A'}</td>
                  <td className={tdClass}>{event.mainSymbolId || 'N/A'}</td>
                  <td className={tdClass}>{getFreqDisplayName(event.freq)}</td>
                  <td className={tdClass}>{event.totalBar}</td>
                  <td className={tdClass}>{event.firstBarDate}</td>
                  <td className={tdClass}>{event.tDayCount}</td>
                  <td className={tdClass}>{event.alignType}</td>
                  <td className={tdClass}>{event.alignMode}</td>
                  <td className={tdClass}>{event.sync}</td>
                  <td className={tdClass}>{event.addFakeBar}</td>
                  <td className={tdClass}>{event.autoCloseK}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {displayedEvents.length > 15 && (
        <p className="mt-4 text-xs text-gray-400">
          Displaying {displayedEvents.length} indicator start events. Scroll horizontally if needed to see all columns.
        </p>
      )}
    </div>
  );
};

export default XSIndicatorSvcClientTab;
