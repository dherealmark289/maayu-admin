'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';

interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  alt?: string;
  description?: string;
  category?: string;
  folder?: string;
  uploadedBy?: string;
  accommodationId?: string;
  accommodationName?: string;
  animalId?: string;
  animalName?: string;
  teamMemberId?: string;
  teamMemberName?: string;
  blogPostId?: string;
  blogPostTitle?: string;
  visionZoneName?: string;
  createdAt?: string;
}

export default function MediaPage() {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadData, setUploadData] = useState({
    category: 'images',
    alt: '',
    description: '',
  });

  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async (syncFromS3 = false) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const url = syncFromS3 ? '/api/media?sync=true' : '/api/media';
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch media');
      }

      const data = await response.json();
      setMediaFiles(data.media || []);
      setError('');
    } catch (err: any) {
      console.error('Error fetching media:', err);
      setError(err.message || 'Failed to load media');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromS3 = async () => {
    setLoading(true);
    setError('');
    await fetchMedia(true); // Sync from S3
  };

  // Compress image using Canvas API (browser built-in, no library needed)
  const compressImage = (file: File, maxSizeKB: number = 500, quality: number = 0.85): Promise<File> => {
    return new Promise((resolve, reject) => {
      // Only compress if it's an image and larger than maxSizeKB
      if (!file.type.startsWith('image/') || file.size <= maxSizeKB * 1024) {
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions if needed (max 3000px on longest side)
          const maxDimension = 3000;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Draw image with high quality
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Compression failed'));
                return;
              }

              // Check if compressed size is acceptable
              const compressedSizeKB = blob.size / 1024;
              
              // If still larger than max, reduce quality and try again
              if (compressedSizeKB > maxSizeKB && quality > 0.5) {
                const newQuality = Math.max(0.5, quality - 0.1);
                canvas.toBlob(
                  (newBlob) => {
                    if (!newBlob) {
                      resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
                      return;
                    }
                    resolve(new File([newBlob], file.name, { type: file.type, lastModified: Date.now() }));
                  },
                  file.type,
                  newQuality
                );
              } else {
                resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
              }
            },
            file.type,
            quality
          );
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Auto-detect category based on file type
    let autoCategory = uploadData.category;
    if (file.type.startsWith('image/')) {
      autoCategory = 'images';
    } else if (file.type.startsWith('video/')) {
      autoCategory = 'videos';
    } else {
      autoCategory = 'files';
    }

    // Update category if different
    if (autoCategory !== uploadData.category) {
      setUploadData({ ...uploadData, category: autoCategory });
    }

    setUploading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      // Compress image if it's an image file
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        try {
          fileToUpload = await compressImage(file, 500, 0.85); // Max 500KB, quality 85%
          const originalSize = (file.size / 1024).toFixed(2);
          const compressedSize = (fileToUpload.size / 1024).toFixed(2);
          console.log(`Image compressed: ${originalSize}KB → ${compressedSize}KB`);
        } catch (compressionError) {
          console.warn('Image compression failed, using original:', compressionError);
          // Continue with original file if compression fails
        }
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('category', autoCategory); // Use auto-detected category
      formData.append('alt', uploadData.alt);
      formData.append('description', uploadData.description);

      const response = await fetch('/api/media', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        // Show detailed error message
        const errorMsg = data.error || 'Failed to upload file';
        const details = data.details ? ` (${data.details})` : '';
        throw new Error(`${errorMsg}${details}`);
      }

      await fetchMedia();
      setUploadData({ category: 'images', alt: '', description: '' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setError('');
    } catch (err: any) {
      console.error('Error uploading file:', err);
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmDelete({ id, name });
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

      const response = await fetch(`/api/media?id=${confirmDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete file');
      }

      await fetchMedia();
      setConfirmDelete(null);
      setSelectedFiles(new Set());
      setError('');
    } catch (err: any) {
      console.error('Error deleting file:', err);
      setError(err.message || 'Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const ids = Array.from(selectedFiles);
      setDeletingIds(ids);
      setConfirmBulkDelete(null);

      const response = await fetch(`/api/media?ids=${ids.join(',')}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete files');
      }

      const result = await response.json();
      await fetchMedia();
      setSelectedFiles(new Set());
      setError('');
      alert(`Successfully deleted ${result.deleted} file(s)`);
    } catch (err: any) {
      console.error('Error deleting files:', err);
      setError(err.message || 'Failed to delete files');
    } finally {
      setDeletingIds([]);
    }
  };

  const handleSelectFile = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredMedia.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredMedia.map(f => f.id)));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const isImage = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  const isVideo = (mimeType: string) => {
    return mimeType.startsWith('video/');
  };

  // Filter media by category
  const filteredMedia = filterCategory === 'all' 
    ? mediaFiles 
    : mediaFiles.filter(file => file.category === filterCategory);

  // Helper to get file URL - either direct URL or API route
  const getFileUrl = (file: MediaFile) => {
    // If URL is already a full URL, return it
    if (file.url.startsWith('http://') || file.url.startsWith('https://')) {
      return file.url;
    }
    // If URL is already an API route, return it
    if (file.url.startsWith('/api/media/file')) {
      return file.url;
    }
    // Otherwise, construct API route URL from filename
    // The filename is stored in the database, use it directly
    const category = file.category || 'images';
    return `/api/media/file?id=${file.filename}&category=${category}`;
  };

  return (
    <DashboardLayout>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Media Library</h1>
          <div className="flex gap-2 items-center">
            {selectedFiles.size > 0 && (
              <button
                onClick={() => setConfirmBulkDelete(selectedFiles.size)}
                disabled={deletingIds.length > 0}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                {deletingIds.length > 0 ? 'Deleting...' : `Delete Selected (${selectedFiles.size})`}
              </button>
            )}
            <button
              onClick={handleSyncFromS3}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              title="Sync files from S3 bucket"
            >
              {loading ? 'Syncing...' : 'Sync from S3'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        </div>

        {/* Upload Form */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={uploadData.category}
                onChange={(e) => setUploadData({ ...uploadData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                        <option value="images">Images</option>
                        <option value="videos">Videos</option>
                        <option value="files">Files</option>
                        <option value="team">Team</option>
                        <option value="accommodation">Accommodation</option>
                        <option value="animals">Animals</option>
                      </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alt Text (for images)
              </label>
              <input
                type="text"
                value={uploadData.alt}
                onChange={(e) => setUploadData({ ...uploadData, alt: e.target.value })}
                placeholder="Alt text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={uploadData.description}
                onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                placeholder="Description"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {/* Category Filter */}
        {!loading && mediaFiles.length > 0 && (
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterCategory === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              All ({mediaFiles.length})
            </button>
            <button
              onClick={() => setFilterCategory('images')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterCategory === 'images'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Images ({mediaFiles.filter(f => f.category === 'images').length})
            </button>
            <button
              onClick={() => setFilterCategory('videos')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterCategory === 'videos'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Videos ({mediaFiles.filter(f => f.category === 'videos').length})
            </button>
            <button
              onClick={() => setFilterCategory('files')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterCategory === 'files'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Files ({mediaFiles.filter(f => f.category === 'files').length})
            </button>
                    <button
                      onClick={() => setFilterCategory('team')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterCategory === 'team'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Team ({mediaFiles.filter(f => f.category === 'team').length})
                    </button>
                    <button
                      onClick={() => setFilterCategory('accommodation')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterCategory === 'accommodation'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Accommodation ({mediaFiles.filter(f => f.category === 'accommodation').length})
                    </button>
                    <button
                      onClick={() => setFilterCategory('animals')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterCategory === 'animals'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Animals ({mediaFiles.filter(f => f.category === 'animals').length})
                    </button>
                    <button
                      onClick={() => setFilterCategory('vision')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterCategory === 'vision'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Vision ({mediaFiles.filter(f => f.category === 'vision').length})
                    </button>
                    <button
                      onClick={() => setFilterCategory('gallery')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filterCategory === 'gallery'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      Gallery ({mediaFiles.filter(f => f.category === 'gallery').length})
                    </button>
                  </div>
                )}

        {!loading && !error && (
          <>
            {filteredMedia.length > 0 && (
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {selectedFiles.size === filteredMedia.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedFiles.size > 0 && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedFiles.size} file(s) selected
                  </span>
                )}
              </div>
            )}
            {filteredMedia.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  {filterCategory === 'all' 
                    ? 'No media files found.' 
                    : `No ${filterCategory} found.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredMedia.map((file) => (
                  <div
                    key={file.id}
                    className={`bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-2 ${
                      selectedFiles.has(file.id)
                        ? 'border-indigo-500 dark:border-indigo-400'
                        : 'border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="mb-2">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.id)}
                        onChange={() => handleSelectFile(file.id)}
                        disabled={deletingIds.includes(file.id)}
                        className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </div>
                    {isImage(file.mimeType) ? (
                      <img
                        src={getFileUrl(file)}
                        alt={file.alt || file.originalName}
                        className="w-full h-48 object-cover rounded-lg mb-3"
                      />
                    ) : isVideo(file.mimeType) ? (
                      <div className="relative w-full h-48 bg-gray-200 dark:bg-gray-600 rounded-lg mb-3 overflow-hidden">
                        <video
                          src={getFileUrl(file)}
                          className="w-full h-full object-cover"
                          controls={false}
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-gray-200 dark:bg-gray-600 rounded-lg mb-3 flex items-center justify-center">
                        <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate mb-1">
                      {file.originalName}
                    </h3>
                    
                    {/* Show which entity this media belongs to */}
                    {(file.accommodationName || file.animalName || file.teamMemberName || file.blogPostTitle) && (
                      <div className="space-y-1 mb-2">
                        {file.accommodationName && (
                          <div className="flex items-center space-x-1">
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">🏠 Accommodation:</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{file.accommodationName}</span>
                          </div>
                        )}
                        {file.animalName && (
                          <div className="flex items-center space-x-1">
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400">🐾 Animal:</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{file.animalName}</span>
                          </div>
                        )}
                        {file.teamMemberName && (
                          <div className="flex items-center space-x-1">
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">👤 Team:</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{file.teamMemberName}</span>
                          </div>
                        )}
                        {file.blogPostTitle && (
                          <div className="flex items-center space-x-1">
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">📝 Blog:</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{file.blogPostTitle}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {formatFileSize(file.size)}
                    </p>
                    {file.alt && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                        Alt: {file.alt}
                      </p>
                    )}
                    <button
                      onClick={() => handleDelete(file.id, file.originalName)}
                      disabled={deletingId === file.id}
                      className="w-full px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                    >
                      {deletingId === file.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              {filterCategory === 'all' ? (
                <>Total files: {mediaFiles.length}</>
              ) : (
                <>Showing {filteredMedia.length} {filterCategory}</>
              )}
            </div>
          </>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Confirm Delete</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAction}
                  disabled={deletingId !== null}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  {deletingId !== null ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {confirmBulkDelete !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Confirm Bulk Delete</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <strong>{confirmBulkDelete} file(s)</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setConfirmBulkDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={deletingIds.length > 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  {deletingIds.length > 0 ? 'Deleting...' : `Delete ${confirmBulkDelete} file(s)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

