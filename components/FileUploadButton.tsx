
import React, { useRef } from 'react';

interface FileUploadButtonProps {
  onFilesSelected: (files: FileList) => void;
  isProcessing: boolean;
}

const FileUploadButton: React.FC<FileUploadButtonProps> = ({ onFilesSelected, isProcessing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      onFilesSelected(event.target.files);
      event.target.value = ''; // Reset file input
    }
  };

  return (
    <div>
      <input
        type="file"
        multiple
        accept=".log"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        disabled={isProcessing}
      />
      <button
        onClick={handleButtonClick}
        disabled={isProcessing}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          'Upload Log Files'
        )}
      </button>
    </div>
  );
};

export default FileUploadButton;
    