'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';

interface GalleryAlbum {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  imageCount: number;
  createdAt?: string;
  updatedAt?: string;
}

interface GalleryImage {
  id: string;
  albumId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  alt?: string;
  description?: string;
  order: number;
  createdAt?: string;
}

export default function GalleryPage() {
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState<GalleryAlbum | null>(null);
  const [albumImages, setAlbumImages] = useState<GalleryImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<GalleryAlbum | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [albumFormData, setAlbumFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchAlbums();
  }, []);

  useEffect(() => {
    if (selectedAlbum) {
      fetchAlbumImages(selectedAlbum.id);
    }
  }, [selectedAlbum]);

  const fetchAlbums = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/gallery/albums', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch albums');
      }

      const data = await response.json();
      setAlbums(data.albums || []);
      setError('');
    } catch (err: any) {
      console.error('Error fetching albums:', err);
      setError(err.message || 'Failed to load albums');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlbumImages = async (albumId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/gallery/images?albumId=${albumId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }

      const data = await response.json();
      setAlbumImages(data.images || []);
    } catch (err: any) {
      console.error('Error fetching album images:', err);
    }
  };

  const handleCreateAlbum = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      if (!albumFormData.name.trim()) {
        setError('Album name is required');
        return;
      }

      const response = await fetch('/api/gallery/albums', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(albumFormData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create album');
      }

      const data = await response.json();
      await fetchAlbums();
      setAlbumFormData({ name: '', description: '' });
      setShowAlbumForm(false);
      setError('');
    } catch (err: any) {
      console.error('Error creating album:', err);
      setError(err.message || 'Failed to create album');
    }
  };

  const handleUpdateAlbum = async () => {
    if (!editingAlbum) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch('/api/gallery/albums', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: editingAlbum.id,
          ...albumFormData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update album');
      }

      await fetchAlbums();
      setAlbumFormData({ name: '', description: '' });
      setEditingAlbum(null);
      setError('');
    } catch (err: any) {
      console.error('Error updating album:', err);
      setError(err.message || 'Failed to update album');
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (!confirm('Are you sure you want to delete this album? All images in this album will also be deleted.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`/api/gallery/albums?id=${albumId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete album');
      }

      await fetchAlbums();
      if (selectedAlbum?.id === albumId) {
        setSelectedAlbum(null);
        setAlbumImages([]);
      }
      setError('');
    } catch (err: any) {
      console.error('Error deleting album:', err);
      setError(err.message || 'Failed to delete album');
    }
  };

  const compressImage = (file: File, maxSizeKB: number = 500, quality: number = 0.85): Promise<File> => {
    return new Promise((resolve, reject) => {
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

          // Calculate new dimensions
          if (width > height) {
            if (width > 1920) {
              height = (height * 1920) / width;
              width = 1920;
            }
          } else {
            if (height > 1920) {
              width = (width * 1920) / height;
              height = 1920;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              const compressedFile = new File([blob], file.name, { type: file.type });
              resolve(compressedFile);
            },
            file.type,
            quality
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedAlbum || !e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    setUploading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Process all files sequentially
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const file of files) {
        try {
          // Compress image
          const compressedFile = await compressImage(file);

          // Upload to S3 via gallery images API
          const formData = new FormData();
          formData.append('image', compressedFile);
          formData.append('albumId', selectedAlbum.id);

          const response = await fetch('/api/gallery/images', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `Failed to upload ${file.name}`);
          }

          successCount++;
        } catch (err: any) {
          console.error(`Error uploading ${file.name}:`, err);
          errorCount++;
          errors.push(`${file.name}: ${err.message}`);
        }
      }

      // Refresh images and albums
      await fetchAlbumImages(selectedAlbum.id);
      await fetchAlbums(); // Refresh to update image count

      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Show success/error message
      if (errorCount > 0) {
        setError(
          `Uploaded ${successCount} image(s) successfully. ${errorCount} failed: ${errors.join(', ')}`
        );
      } else {
        setError('');
      }
    } catch (err: any) {
      console.error('Error uploading images:', err);
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`/api/gallery/images?id=${imageId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete image');
      }

      await fetchAlbumImages(selectedAlbum!.id);
      await fetchAlbums(); // Refresh to update image count
      setError('');
    } catch (err: any) {
      console.error('Error deleting image:', err);
      setError(err.message || 'Failed to delete image');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gallery</h1>
          <button
            onClick={() => {
              setShowAlbumForm(true);
              setEditingAlbum(null);
              setAlbumFormData({ name: '', description: '' });
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            Create New Album
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {showAlbumForm && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              {editingAlbum ? 'Edit Album' : 'Create New Album'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Album Name *
                </label>
                <input
                  type="text"
                  value={albumFormData.name}
                  onChange={(e) => setAlbumFormData({ ...albumFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Summer 2024"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={albumFormData.description}
                  onChange={(e) => setAlbumFormData({ ...albumFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Album description..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={editingAlbum ? handleUpdateAlbum : handleCreateAlbum}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  {editingAlbum ? 'Update Album' : 'Create Album'}
                </button>
                <button
                  onClick={() => {
                    setShowAlbumForm(false);
                    setEditingAlbum(null);
                    setAlbumFormData({ name: '', description: '' });
                  }}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Loading albums...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {albums.map((album) => (
              <div
                key={album.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedAlbum(album)}
              >
                {album.coverImageUrl ? (
                  <img
                    src={album.coverImageUrl}
                    alt={album.name}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{album.name}</h3>
                  {album.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{album.description}</p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-500">{album.imageCount || 0} images</p>
                  <div className="mt-3 flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingAlbum(album);
                        setAlbumFormData({ name: album.name, description: album.description || '' });
                        setShowAlbumForm(true);
                      }}
                      className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAlbum(album.id);
                      }}
                      className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedAlbum && (
          <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedAlbum.name}</h2>
                {selectedAlbum.description && (
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{selectedAlbum.description}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedAlbum(null)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg transition-colors"
              >
                Close Album
              </button>
            </div>

            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
                disabled={uploading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Add Images to Album'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {albumImages.map((image) => (
                <div key={image.id} className="relative group">
                  <img
                    src={image.url}
                    alt={image.alt || image.originalName}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleDeleteImage(image.id)}
                    className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {albumImages.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No images in this album yet. Click "Add Images to Album" to upload images.
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

