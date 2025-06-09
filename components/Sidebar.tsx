
import React, { useState } from 'react';
import { CategorizedLogs, SelectedLogIdentifier, LogFileEntry } from '../types';
import { FolderIcon, FileIcon, ChevronDownIcon, ChevronRightIcon, XMarkIcon } from './icons';

interface SidebarProps {
  categorizedLogs: CategorizedLogs;
  selectedLogId: string | null;
  onSelectLog: (identifier: SelectedLogIdentifier) => void;
  onCloseLog: (identifier: SelectedLogIdentifier) => void; // New prop
}

const Sidebar: React.FC<SidebarProps> = ({ categorizedLogs, selectedLogId, onSelectLog, onCloseLog }) => {
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const toggleModule = (moduleName: string) => {
    setExpandedModules(prev => ({ ...prev, [moduleName]: !prev[moduleName] }));
  };

  const moduleNames = Object.keys(categorizedLogs).sort();

  if (moduleNames.length === 0) {
    return (
      <div className="p-4 text-gray-400">
        No log files uploaded yet. Use the button above to upload .log files.
      </div>
    );
  }

  return (
    <nav className="space-y-1">
      {moduleNames.map(moduleName => (
        <div key={moduleName}>
          <button
            onClick={() => toggleModule(moduleName)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md text-gray-200 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-expanded={expandedModules[moduleName]}
            aria-controls={`module-content-${moduleName}`}
          >
            <div className="flex items-center">
              <FolderIcon className="mr-2 text-blue-400" />
              <span>{moduleName}</span>
            </div>
            {expandedModules[moduleName] ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
          {expandedModules[moduleName] && (
            <div id={`module-content-${moduleName}`} className="ml-4 mt-1 space-y-1 pl-3 border-l border-gray-600">
              {Object.values(categorizedLogs[moduleName])
                .sort((a, b) => b.date.localeCompare(a.date)) // Sort by date descending
                .map((logEntry: LogFileEntry) => (
                  <div key={logEntry.id} className="flex items-center justify-between group">
                    <button
                      onClick={() => onSelectLog({ moduleName: logEntry.moduleName, date: logEntry.date })}
                      className={`flex-grow text-left flex items-center px-3 py-2 text-sm rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400
                        ${selectedLogId === logEntry.id 
                          ? 'bg-blue-500 text-white font-semibold' 
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`}
                    >
                      <FileIcon className={`mr-2 ${selectedLogId === logEntry.id ? 'text-white' : 'text-gray-400'}`} />
                      <span className="truncate" title={`${logEntry.date} (${logEntry.name})`}>
                        {logEntry.date} ({logEntry.name})
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent log selection when closing
                        onCloseLog({ moduleName: logEntry.moduleName, date: logEntry.date });
                      }}
                      className="p-1 ml-1 text-gray-400 hover:text-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`Close log ${logEntry.name}`}
                      aria-label={`Close log ${logEntry.name}`}
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
};

export default Sidebar;
