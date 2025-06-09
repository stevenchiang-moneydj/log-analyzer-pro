
import React from 'react';

export const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 ${className}`}>
    <path fillRule="evenodd" d="M2 4.75A2.75 2.75 0 014.75 2h5.5A2.75 2.75 0 0113 4.75v1.5h4.25A2.75 2.75 0 0120 9v6.25A2.75 2.75 0 0117.25 18H2.75A2.75 2.75 0 010 15.25V6.75A2.75 2.75 0 012.75 4H2V2.75C2 2.336 2.336 2 2.75 2S3.5 2.336 3.5 2.75V4h1.25A.75.75 0 004 3.25H2zm.75 3A1.25 1.25 0 001.5 9v6.25c0 .69.56 1.25 1.25 1.25h14.5c.69 0 1.25-.56 1.25-1.25V9A1.25 1.25 0 0017.25 7.5H2.75z" clipRule="evenodd" />
  </svg>
);

export const FileIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 ${className}`}>
    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6.414A2.25 2.25 0 0017.121 5L13 1.879A2.25 2.25 0 0011.586 1H5.25A1.25 1.25 0 004 2.25V2zm1.25 0H4a.25.25 0 00-.25.25v15.5A.25.25 0 004 18h12a.25.25 0 00.25-.25v-9.5A.25.25 0 0016 8h-4.25A1.75 1.75 0 0110 6.25V2H5.25z" clipRule="evenodd" />
     <path d="M12.5 1.75a.75.75 0 00-.75.75v3.5c0 .414.336.75.75.75h3.5a.75.75 0 000-1.5h-2.75V2.5a.75.75 0 00-.75-.75z" />
  </svg>
);

export const SpinnerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 text-white ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 ${className}`}>
    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
  </svg>
);

export const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 ${className}`}>
   <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z" clipRule="evenodd" />
  </svg>
);

export const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 ${className}`}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
