'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';

interface Retreat {
  id: number;
  title?: string;
  description?: string;
  location?: string;
  date?: string;
  price?: number;
  capacity?: number;
  created_at?: string;
  [key: string]: any;
}

export default function RetreatPage() {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; title: string } | null>(null);

  useEffect(() => {
    fetchRetreats();
  }, []);

  const fetchRetreats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/retreat', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch retreats');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setRetreats(data.retreats || []);
      setError('');
      
      // Log debug info in development
      if (data.tableName) {
        console.log('Fetched from table:', data.tableName);
        console.log('Record count:', data.count || data.retreats?.length || 0);
      }
    } catch (err: any) {
      console.error('Error fetching retreats:', err);
      setError(err.message || 'Failed to load retreat data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, title?: string) => {
    setConfirmDelete({ id, title: title || 'this retreat' });
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      setDeletingId(confirmDelete.id);

      const response = await fetch(`/api/retreat?id=${confirmDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete retreat');
      }

      // Remove the deleted retreat from the list
      setRetreats(retreats.filter((r) => r.id !== confirmDelete.id));
      setConfirmDelete(null);
      setError('');
    } catch (err: any) {
      console.error('Error deleting retreat:', err);
      setError(err.message || 'Failed to delete retreat');
    } finally {
      setDeletingId(null);
    }
  };

  const cancelDelete = () => {
    setConfirmDelete(null);
  };

  return (
    <DashboardLayout>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
            Retreats
          </h1>
          <button
            onClick={fetchRetreats}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-800 dark:text-red-300 font-medium mb-2">Error loading retreat data:</p>
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            <p className="text-red-600 dark:text-red-500 text-xs mt-2">
              Check the browser console and server logs for more details.
            </p>
          </div>
        )}

        {!loading && !error && (
          <>
            {retreats.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-gray-700 dark:text-gray-300">
                  No retreats found in the database.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {retreats.map((retreat) => (
                  <div
                    key={retreat.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 items-start sm:items-center">
                      <div className="md:col-span-1">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">ID</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{retreat.id}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Title</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{retreat.title || 'N/A'}</p>
                      </div>
                      <div className="md:col-span-1">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Location</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{retreat.location || 'N/A'}</p>
                      </div>
                      <div className="md:col-span-1">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Date</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {retreat.date ? new Date(retreat.date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="md:col-span-1">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Price</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {retreat.price !== null && retreat.price !== undefined ? `$${retreat.price}` : 'N/A'}
                        </p>
                      </div>
                      <div className="md:col-span-1">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Capacity</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{retreat.capacity || 'N/A'}</p>
                      </div>
                      <div className="md:col-span-1">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">Created</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {retreat.created_at ? new Date(retreat.created_at).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        <button
                          onClick={() => handleDelete(retreat.id, retreat.title)}
                          disabled={deletingId === retreat.id}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Delete retreat"
                        >
                          {deletingId === retreat.id ? (
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 text-sm text-gray-700 dark:text-gray-300 font-medium">
              Total retreats: {retreats.length}
            </div>
          </>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Confirm Delete
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <strong>{confirmDelete.title}</strong>? This action cannot be undone.
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  onClick={cancelDelete}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAction}
                  disabled={deletingId !== null}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId !== null ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

