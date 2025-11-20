import React, { useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const SystemSetting: React.FC = () => {
  const [restarting, setRestarting] = useState(false);
  const [restartMessage, setRestartMessage] = useState('');

  const handleRestartBackend = async () => {
    setRestarting(true);
    setRestartMessage('');
    try {
      const result = await (window as any).electron.restartBackend();
      setRestartMessage(result.success ? 'Backend restarted successfully!' : result.message);
      setTimeout(() => setRestartMessage(''), 5000);
    } catch (error) {
      setRestartMessage('Failed to restart backend. Please try again.');
      setTimeout(() => setRestartMessage(''), 5000);
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <ArrowPathIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">System Controls</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Restart backend if experiencing connection issues</p>
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            If you're experiencing connectivity issues or the app is not responding properly, use this button to restart the backend server.
          </p>
          <button
            onClick={handleRestartBackend}
            disabled={restarting}
            className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {restarting ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                <span>Restarting Backend...</span>
              </>
            ) : (
              <>
                <ArrowPathIcon className="h-5 w-5" />
                <span>Restart Backend Server</span>
              </>
            )}
          </button>
          {restartMessage && (
            <div className={`p-3 rounded-lg text-sm font-medium ${
              restartMessage.includes('successfully')
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {restartMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemSetting;
