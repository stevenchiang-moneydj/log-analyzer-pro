import React from 'react';
import { SystemInfoSnapshot, ValueWithTimestamp, MonitorInfo } from '../types';
import { SpinnerIcon } from './icons';

interface SystemInfoTabProps {
  snapshots: SystemInfoSnapshot[];
  isLoading: boolean;
}

const areMonitorsEqual = (monitorsA?: MonitorInfo[], monitorsB?: MonitorInfo[]): boolean => {
  if (!monitorsA && !monitorsB) return true;
  if (!monitorsA || !monitorsB) return false;
  if (monitorsA.length !== monitorsB.length) return false;
  // Assuming monitors are sorted by ID
  for (let i = 0; i < monitorsA.length; i++) {
    if (monitorsA[i].id !== monitorsB[i].id || 
        monitorsA[i].resolution !== monitorsB[i].resolution ||
        monitorsA[i].details !== monitorsB[i].details) {
      return false;
    }
  }
  return true;
};

interface InfoDisplayProps<T> {
  label: string;
  getValue: (snapshot: SystemInfoSnapshot) => ValueWithTimestamp<T> | undefined;
  snapshots: SystemInfoSnapshot[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compareValues?: (valA: T, valB: T) => boolean; // For complex types like MonitorInfo[]
  formatValue?: (value: T) => React.ReactNode; // For custom rendering
}

const InfoItemDisplay = <T,>({ label, getValue, snapshots, compareValues, formatValue }: InfoDisplayProps<T>) => {
  const history: { value: T; timestamp: string }[] = [];
  let previousValue: T | undefined = undefined;

  snapshots.forEach(snapshot => {
    const dataPoint = getValue(snapshot);
    if (dataPoint) {
      let changed = false;
      if (history.length === 0) {
        changed = true;
      } else if (compareValues) {
        if (!compareValues(dataPoint.value, previousValue!)) { // previousValue will be defined if history.length > 0
          changed = true;
        }
      } else {
        if (dataPoint.value !== previousValue) {
          changed = true;
        }
      }

      if (changed) {
        history.push({ value: dataPoint.value, timestamp: dataPoint.timestamp });
        previousValue = dataPoint.value;
      }
    } 
  });

  if (history.length === 0) {
    return (
      <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt className="text-sm font-medium text-gray-400">{label}</dt>
        <dd className="mt-1 text-sm text-gray-200 sm:mt-0 sm:col-span-2">N/A</dd>
      </div>
    );
  }

  return (
    <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-gray-400">{label}</dt>
      <dd className="mt-1 text-sm text-gray-200 sm:mt-0 sm:col-span-2">
        {history.map((item, index) => (
          <div key={index} className={index > 0 ? "mt-2 pt-2 border-t border-gray-700" : ""}>
            <span className="block">
              {index > 0 ? `Changed to: ` : ''}
              {formatValue ? formatValue(item.value) : (typeof item.value === 'string' ? item.value : JSON.stringify(item.value))}
            </span>
            <span className="block text-xs text-gray-500">(at {item.timestamp})</span>
          </div>
        ))}
      </dd>
    </div>
  );
};

const SystemInfoTab: React.FC<SystemInfoTabProps> = ({ snapshots, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-300 p-8">
        <SpinnerIcon className="w-8 h-8 mr-2" />
        <span>Processing system information...</span>
      </div>
    );
  }

  if (!snapshots || snapshots.length === 0) {
    return <div className="p-8 text-center text-gray-400">No system information found in this DA log.</div>;
  }
  
  const formatMonitors = (monitorValue: MonitorInfo[]): React.ReactNode => {
    if (!monitorValue || monitorValue.length === 0) return "N/A";
    return (
        <>
            <span>{monitorValue.length} monitor(s) detected:</span>
            <ul className="list-disc list-inside pl-2 mt-1">
            {monitorValue.map(m => (
                <li key={m.id}>{m.id}: {m.resolution} <span className="text-xs text-gray-500">({m.details})</span></li>
            ))}
            </ul>
        </>
    );
  };

  // Get the first snapshot that has datacenter connections, as this list is global to the log file.
  const firstSnapshotWithDatacenters = snapshots.find(s => s.allDatacenterConnections && s.allDatacenterConnections.length > 0);
  const datacenterConnections = firstSnapshotWithDatacenters?.allDatacenterConnections || [];


  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-850 overflow-auto h-full text-gray-200">
      <div className="max-w-4xl mx-auto">
        <h3 className="text-xl font-semibold leading-7 text-white mb-6">System Information History</h3>
        <div className="border-t border-gray-700">
          <dl className="divide-y divide-gray-700">
            <InfoItemDisplay label="AP Version" getValue={s => s.apVersion} snapshots={snapshots} />
            <InfoItemDisplay label="CPU Model" getValue={s => s.cpuModel} snapshots={snapshots} />
            <InfoItemDisplay label="Total Memory" getValue={s => s.totalMemory} snapshots={snapshots} />
            <InfoItemDisplay label="OS Version" getValue={s => s.osVersion} snapshots={snapshots} />
            <InfoItemDisplay label="DPI Settings" getValue={s => s.dpi} snapshots={snapshots} />
            <InfoItemDisplay<MonitorInfo[]> 
              label="Monitor Configuration" 
              getValue={s => s.monitors} 
              snapshots={snapshots}
              compareValues={(a,b) => areMonitorsEqual(a,b)}
              formatValue={formatMonitors}
            />
            {/* Display for Connected Datacenters */}
            <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-400">連線機房 (Connected Datacenters)</dt>
              <dd className="mt-1 text-sm text-gray-200 sm:mt-0 sm:col-span-2">
                {datacenterConnections.length > 0 ? (
                  <ul className="space-y-1">
                    {datacenterConnections.map((dc, index) => (
                      <li key={index}>
                        {dc.value}
                        <span className="block text-xs text-gray-500">(at {dc.timestamp})</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  "N/A"
                )}
              </dd>
            </div>
          </dl>
        </div>
        {snapshots.length > 1 && !datacenterConnections.length && ( // Show this only if other info changed
            <p className="mt-6 text-xs text-gray-500">
                The information above shows the initial reported values and any subsequent changes detected throughout the log, based on AP Version entries. Each change is timestamped according to the log entry.
            </p>
        )}
         {snapshots.length === 1 && !datacenterConnections.length && (
             <p className="mt-6 text-xs text-gray-500">
                Displaying the system information found associated with AP version entry at {snapshots[0].anchorTimestamp}.
            </p>
         )}
         {datacenterConnections.length > 0 && (
             <p className="mt-6 text-xs text-gray-500">
                Connected datacenter information is listed chronologically as found in the log. Other system details show initial values and subsequent changes anchored by AP Version entries.
            </p>
         )}
      </div>
    </div>
  );
};

export default SystemInfoTab;