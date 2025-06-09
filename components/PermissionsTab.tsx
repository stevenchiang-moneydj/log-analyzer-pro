
import React from 'react';
import { PermissionSnapshot } from '../types';
import { SpinnerIcon } from './icons';

interface PermissionsTabProps {
  snapshots: PermissionSnapshot[];
  isLoading: boolean;
}

const PermissionItem: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  if (!value) {
    return (
      <tr>
        <td className="px-4 py-3 text-sm font-medium text-gray-400 align-top whitespace-nowrap">{label}</td>
        <td className="px-4 py-3 text-sm text-gray-300 align-top">N/A</td>
      </tr>
    );
  }

  const items = value.split(';').map(item => item.trim()).filter(item => item.length > 0);

  return (
    <tr>
      <td className="px-4 py-3 text-sm font-medium text-gray-400 align-top whitespace-nowrap">{label}</td>
      <td className="px-4 py-3 text-sm text-gray-300 align-top">
        {items.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {items.map((item, index) => (
              <span key={index} className="bg-gray-600 text-gray-100 px-2 py-0.5 rounded-full text-xs">
                {item}
              </span>
            ))}
          </div>
        ) : (
          "None"
        )}
      </td>
    </tr>
  );
};

const PermissionsTab: React.FC<PermissionsTabProps> = ({ snapshots, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-300 p-8">
        <SpinnerIcon className="w-8 h-8 mr-2" />
        <span>Processing permissions information...</span>
      </div>
    );
  }

  if (!snapshots || snapshots.length === 0) {
    return <div className="p-8 text-center text-gray-400">No permission data (Features, XSAuth, XSPreset) found in this DA log.</div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-850 overflow-auto h-full text-gray-200">
      <div className="max-w-4xl mx-auto space-y-8">
        {snapshots.map((snapshot, index) => (
          <div key={snapshot.timestamp + '-' + index} className="bg-gray-800 shadow-md rounded-lg overflow-hidden">
            <div className="px-4 py-3 sm:px-6 bg-gray-750">
              <h3 className="text-md font-semibold leading-6 text-white">
                Permissions at {snapshot.timestamp}
              </h3>
            </div>
            <div className="border-t border-gray-700">
              <table className="min-w-full">
                <tbody className="divide-y divide-gray-700">
                  <PermissionItem label="Features" value={snapshot.permissions.features} />
                  <PermissionItem label="XSAuth" value={snapshot.permissions.xsAuth} />
                  <PermissionItem label="XSPreset" value={snapshot.permissions.xsPreset} />
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PermissionsTab;
