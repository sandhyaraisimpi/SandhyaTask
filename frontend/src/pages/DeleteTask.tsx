import React, { useEffect, useMemo, useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { taskApi } from '../services/api';

export const DeleteTask: React.FC = () => {
  const { tasks, loadTasks, deleteTask } = useTasks();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleModal, setRescheduleModal] = useState<{ taskId: string; taskTitle: string } | null>(null);
  const [newDate, setNewDate] = useState('');

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Filters
  const [searchName, setSearchName] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'regular' | 'revision' | 'recursive'>('all');

  // Selection for bulk delete
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Helper: Check if task is past-dated
  const isPastDate = (dueDate: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(dueDate);
    taskDate.setHours(0, 0, 0, 0);
    return taskDate < today;
  };

  // Helper: Check if task is completed
  const isTaskCompleted = (task: any): boolean => {
    return task.isCompleted === true;
  };

  // Helper: Check if task can be deleted (not completed and not past-due uncompleted)
  const canDeleteTask = (task: any): boolean => {
    // Completed tasks cannot be deleted
    if (isTaskCompleted(task)) {
      return false;
    }
    // Past uncompleted tasks cannot be deleted (must reschedule)
    if (isPastDate(task.dueDate)) {
      return false;
    }
    // Future uncompleted tasks can be deleted
    return true;
  };

  // Helper: Check if reschedule should be enabled (only past-due uncompleted tasks)
  const canRescheduleTask = (task: any): boolean => {
    // Only past-due uncompleted tasks can be rescheduled
    return isPastDate(task.dueDate) && !isTaskCompleted(task);
  };

  useEffect(() => {
    loadTasks().catch(err => console.error('Failed to load tasks', err));
  }, [loadTasks]);

  // Derived filtered list
  const filtered = useMemo(() => {
    // Calculate date range: 30 days in the past and 30 days in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thirtyDaysPast = new Date(today);
    thirtyDaysPast.setDate(today.getDate() - 30);
    
    const thirtyDaysFuture = new Date(today);
    thirtyDaysFuture.setDate(today.getDate() + 30);
    
    const q = (searchName || '').toLowerCase().trim();
    return tasks.filter(t => {
      // Date range filter: Only show tasks within 30 days past to 30 days future
      const taskDate = new Date(t.dueDate);
      taskDate.setHours(0, 0, 0, 0);
      if (taskDate < thirtyDaysPast || taskDate > thirtyDaysFuture) return false;
      
      // name search
      if (q && !(t.title || '').toLowerCase().includes(q)) return false;
      // date filter
      if (filterDate && t.dueDate !== filterDate) return false;
      // type filter
      if (filterType === 'revision' && !t.isRevision) return false;
      if (filterType === 'recursive' && !t.isRecursive) return false;
      if (filterType === 'regular' && (t.isRevision || t.isRecursive)) return false;
      return true;
    });
  }, [tasks, searchName, filterDate, filterType]);

  const toggleSelect = (id: string) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const clearSelection = () => setSelected({});

  // Select/Deselect all filtered tasks
  const toggleSelectAll = () => {
    const allSelected = filtered.every(t => selected[t.id]);
    if (allSelected) {
      // Deselect all
      setSelected({});
    } else {
      // Select all filtered tasks that can be deleted
      const newSelected: Record<string, boolean> = { ...selected };
      filtered.forEach(task => {
        if (canDeleteTask(task)) {
          newSelected[task.id] = true;
        }
      });
      setSelected(newSelected);
    }
  };

  // Count selected tasks
  const selectedCount = Object.values(selected).filter(Boolean).length;

  // Handle single task delete with protection
  const handleDelete = async (task: any) => {
    // Prevent deletion of completed tasks
    if (isTaskCompleted(task)) {
      setError(`⚠️ Cannot delete completed task "${task.title}". Completed tasks are protected to preserve your task history.`);
      return;
    }
    
    // Prevent deletion of past uncompleted tasks
    if (isPastDate(task.dueDate)) {
      setError(`⚠️ Cannot delete past-dated uncompleted task "${task.title}". Please reschedule it instead.`);
      return;
    }

    if (!confirm('Are you sure you want to delete this task?')) return;
    setLoading(true);
    setError(null);
    try {
      console.log('[INDIVIDUAL DELETE] Deleting task:', task.id, task.title);
      const ok = await deleteTask(task.id);
      console.log('[INDIVIDUAL DELETE] Delete result:', ok);
      if (!ok) throw new Error('Delete failed');
      await loadTasks();
      clearSelection();
    } catch (err: any) {
      console.error('[INDIVIDUAL DELETE] Delete failed', err);
      setError(err?.message || 'Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  // Handle reschedule
  const handleReschedule = (task: any) => {
    setRescheduleModal({ taskId: task.id, taskTitle: task.title });
    setNewDate(task.dueDate);
  };

  // Confirm reschedule
  const confirmReschedule = async () => {
    if (!rescheduleModal || !newDate) {
      setError('Please select a new date');
      return;
    }

    // Find the task to validate it's not completed
    const task = tasks.find(t => t.id === rescheduleModal.taskId);
    if (task && isTaskCompleted(task)) {
      setError('Cannot reschedule completed tasks. Please mark the task as incomplete first.');
      return;
    }

    // Validate that the new date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(newDate);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      setError('Cannot reschedule to a past date. Please select today or a future date.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Use the API service for rescheduling
      const result = await taskApi.rescheduleTask(rescheduleModal.taskId, newDate);
      
      if (!result.success) {
        throw new Error(result.data?.message || result.data?.error || 'Reschedule failed');
      }

      await loadTasks();
      setRescheduleModal(null);
      setNewDate('');
    } catch (err: any) {
      console.error('Reschedule failed', err);
      setError(err?.message || 'Failed to reschedule task');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Object.keys(selected).filter(k => selected[k]);
    if (ids.length === 0) {
      alert('Select at least one task to delete');
      return;
    }

    // Check for completed tasks
    const completedTasks = ids.filter(id => {
      const task = tasks.find(t => t.id === id);
      return task && isTaskCompleted(task);
    });

    if (completedTasks.length > 0) {
      setError(`⚠️ Cannot delete ${completedTasks.length} completed task(s). Completed tasks are protected to preserve your task history.`);
      return;
    }

    // Check for past uncompleted tasks
    const pastUncompleted = ids.filter(id => {
      const task = tasks.find(t => t.id === id);
      return task && isPastDate(task.dueDate);
    });

    if (pastUncompleted.length > 0) {
      setError(`⚠️ Cannot delete ${pastUncompleted.length} past-dated uncompleted task(s). Please reschedule them instead.`);
      return;
    }

    if (!confirm(`Delete ${ids.length} selected task(s)? This cannot be undone.`)) return;
    setLoading(true);
    setError(null);
    try {
      console.log('[BULK DELETE] Starting bulk delete for task IDs:', ids);
      
      // Use bulk delete API instead of looping through individual deletes
      const response = await taskApi.bulkDeleteTasks(ids);
      
      console.log('[BULK DELETE] Response received:', response);
      
      if (response.success) {
        console.log('[BULK DELETE] Success! Reloading tasks...');
        await loadTasks();
        clearSelection();
      } else {
        console.error('[BULK DELETE] Failed:', response.error);
        throw new Error(response.error || 'Bulk delete failed');
      }
    } catch (err:any) {
      console.error('[BULK DELETE] Error caught:', err);
      setError(err?.message || 'Bulk delete failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col overflow-hidden">
        {/* Header Section */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Task Manager</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Search, filter and remove tasks safely.</p>
            </div>
            <div className="text-right text-sm font-medium">
              <div className="text-gray-900 dark:text-white">Tasks total: <span className="text-indigo-600 dark:text-indigo-400">{tasks.length}</span></div>
              <div className="text-gray-600 dark:text-gray-400 mt-1">Showing: <span className="text-indigo-600 dark:text-indigo-400">{filtered.length}</span></div>
              {selectedCount > 0 && (
                <div className="text-blue-600 dark:text-blue-400 mt-1 font-semibold">Selected: {selectedCount}</div>
              )}
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Search by task name..."
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />

              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />

              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option value="all">All Types</option>
                <option value="regular">Regular</option>
                <option value="revision">Revision</option>
                <option value="recursive">Recursive</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.filter(t => canDeleteTask(t)).every(t => selected[t.id])}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Select All</span>
                </label>
                <button
                  onClick={() => { setSearchName(''); setFilterDate(''); setFilterType('all'); }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Clear Filters
                </button>
              </div>

              <div className="flex items-center gap-3">
                {selectedCount > 0 && (
                  <button
                    onClick={clearSelection}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Clear Selection
                  </button>
                )}
                <button
                  onClick={handleBulkDelete}
                  disabled={loading || selectedCount === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {selectedCount > 0 ? `Delete ${selectedCount} Selected` : 'Delete Selected'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex-shrink-0 p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between">
              <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-4 text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                title="Dismiss"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filtered.length === 0 && (
            <div className="p-8 bg-white dark:bg-gray-800 rounded-lg text-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              <p className="text-lg font-medium">No tasks match your filters.</p>
              <p className="text-sm mt-1">Try adjusting your search or filter criteria.</p>
            </div>
          )}

          {filtered.map((task, index) => (
            <div key={task.id} className={`flex items-center justify-between p-4 rounded-lg shadow-sm border transition-all ${
              selected[task.id] 
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 shadow-md' 
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md'
            }`}>
              <div className="flex items-start space-x-4 flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{index + 1}</span>
                  </div>
                </div>
                <div className="flex-1" onClick={() => canDeleteTask(task) && toggleSelect(task.id)} style={{cursor: canDeleteTask(task) ? 'pointer' : 'default'}}>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-gray-900 dark:text-white">{task.title}</div>
                    {selected[task.id] && (
                      <span className="px-2 py-0.5 bg-green-500 text-white rounded text-xs font-bold flex items-center gap-1">
                        ✓ Marked
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{task.dueDate}{task.dueTime ? ` • ${task.dueTime}` : ''}</div>
                  <div className="text-xs mt-2 flex gap-2">
                    {task.isCompleted && <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs font-medium">✓ Completed</span>}
                    {task.isRevision && <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium">Revision</span>}
                    {task.isRecursive && <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs font-medium">Recursive</span>}
                    {isPastDate(task.dueDate) && !task.isCompleted && <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full text-xs font-medium">⚠️ Past Due</span>}
                  </div>
                </div>
              </div>

              <div className="ml-4 flex-shrink-0 flex gap-2">
                {canRescheduleTask(task) && (
                  <button
                    onClick={() => handleReschedule(task)}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Reschedule
                  </button>
                )}
                <button
                  onClick={() => handleDelete(task)}
                  disabled={loading || !canDeleteTask(task)}
                  title={
                    !canDeleteTask(task) 
                      ? (task.isCompleted 
                          ? 'Cannot delete completed tasks - task history is protected' 
                          : 'Cannot delete past-dated uncompleted tasks - use reschedule instead')
                      : 'Delete this task'
                  }
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {canDeleteTask(task) ? 'Delete' : 'Protected'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Reschedule: {rescheduleModal.taskTitle}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Due Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setRescheduleModal(null)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReschedule}
                  disabled={loading || !newDate}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? 'Rescheduling...' : 'Reschedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
