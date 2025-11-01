'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import DashboardLayout from '@/components/DashboardLayout';

interface Animal {
  id: string;
  name: string;
  species?: string;
  breed?: string;
  bio?: string;
  status?: string;
  photoUrls?: string[];
  healthInfo?: string;
  createdAt?: string;
}

export default function AnimalsPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    species: '',
    breed: '',
    bio: '',
    status: 'available',
    photoUrls: [] as string[],
    healthInfo: '',
  });

  useEffect(() => {
    fetchAnimals();
  }, []);

  // Compress image using Canvas API
  const compressImage = (file: File, maxSizeKB: number = 500, quality: number = 0.85): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/') || file.size <= maxSizeKB * 1024) {
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

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

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Compression failed'));
                return;
              }

              const compressedSizeKB = blob.size / 1024;
              
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (!file.type.startsWith('image/')) {
          setError('Please select image files only');
          continue;
        }

        // Compress image
        let fileToUpload = file;
        try {
          fileToUpload = await compressImage(file, 500, 0.85);
        } catch (compressionError) {
          console.warn('Image compression failed, using original:', compressionError);
        }

        // Upload to S3 via animals image API
        const formData = new FormData();
        formData.append('image', fileToUpload);
        // Pass animalId if editing existing animal
        if (editingAnimal?.id) {
          formData.append('animalId', editingAnimal.id);
        }

        const response = await fetch('/api/animals/image', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to upload image');
        }

        const data = await response.json();
        uploadedUrls.push(data.url);
      }

      setFormData({
        ...formData,
        photoUrls: [...formData.photoUrls, ...uploadedUrls],
      });
      setError('');
    } catch (err: any) {
      console.error('Error uploading images:', err);
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setFormData({
      ...formData,
      photoUrls: formData.photoUrls.filter((_, i) => i !== index),
    });
  };

  const fetchAnimals = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/animals', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch animals');
      }

      const data = await response.json();
      setAnimals(data.animals || []);
      setError('');
    } catch (err: any) {
      console.error('Error fetching animals:', err);
      setError(err.message || 'Failed to load animals');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const method = editingAnimal ? 'PUT' : 'POST';
      const body = editingAnimal
        ? {
            id: editingAnimal.id,
            name: formData.name,
            species: formData.species,
            breed: formData.breed,
            bio: formData.bio,
            status: formData.status,
            photoUrls: formData.photoUrls,
            healthInfo: formData.healthInfo,
          }
        : {
            name: formData.name,
            species: formData.species,
            breed: formData.breed,
            bio: formData.bio,
            status: formData.status,
            photoUrls: formData.photoUrls,
            healthInfo: formData.healthInfo,
          };

      const response = await fetch('/api/animals', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save animal');
      }

      await fetchAnimals();
      setShowForm(false);
      setEditingAnimal(null);
      setFormData({
        name: '',
        species: '',
        breed: '',
        bio: '',
        status: 'available',
        photoUrls: [],
        healthInfo: '',
      });
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      setError('');
    } catch (err: any) {
      console.error('Error saving animal:', err);
      setError(err.message || 'Failed to save animal');
    }
  };

  const handleEdit = (animal: Animal) => {
    setEditingAnimal(animal);
    setFormData({
      name: animal.name || '',
      species: animal.species || '',
      breed: animal.breed || '',
      bio: animal.bio || '',
      status: animal.status || 'available',
      photoUrls: animal.photoUrls || [],
      healthInfo: animal.healthInfo || '',
    });
    setShowForm(true);
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

      const response = await fetch(`/api/animals?id=${confirmDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete animal');
      }

      await fetchAnimals();
      setConfirmDelete(null);
      setError('');
    } catch (err: any) {
      console.error('Error deleting animal:', err);
      setError(err.message || 'Failed to delete animal');
    } finally {
      setDeletingId(null);
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingAnimal(null);
    setFormData({
      name: '',
      species: '',
      breed: '',
      bio: '',
      status: 'available',
      photoUrls: [],
      healthInfo: '',
    });
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'adopted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Animal Profiles</h1>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Add Animal
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {editingAnimal ? 'Edit Animal' : 'Add Animal'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Species
                  </label>
                  <input
                    type="text"
                    value={formData.species}
                    onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                    placeholder="e.g., Dog, Cat, Chicken"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Breed
                  </label>
                  <input
                    type="text"
                    value={formData.breed}
                    onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="available">Available</option>
                    <option value="adopted">Adopted</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bio
                  </label>
                  <textarea
                    rows={3}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                {/* Image Upload */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Photos
                  </label>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImages}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 mb-3"
                  >
                    {uploadingImages ? 'Uploading...' : 'Upload Photos'}
                  </button>
                  {formData.photoUrls.length > 0 && (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-3">
                      {formData.photoUrls.map((url, index) => (
                        <div key={index} className="relative">
                          <Image
                            src={url}
                            alt={`Upload ${index + 1}`}
                            width={200}
                            height={96}
                            unoptimized
                            className="w-full h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Health Info
                  </label>
                  <textarea
                    rows={3}
                    value={formData.healthInfo}
                    onChange={(e) => setFormData({ ...formData, healthInfo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  {editingAnimal ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {!loading && !error && (
          <>
            {animals.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No animals found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {animals.map((animal) => (
                  <div
                    key={animal.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                  >
                    {animal.photoUrls && animal.photoUrls.length > 0 && (
                      <Image
                        src={animal.photoUrls[0]}
                        alt={animal.name}
                        width={400}
                        height={192}
                        unoptimized
                        className="w-full h-48 object-cover rounded-lg mb-3"
                      />
                    )}
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{animal.name}</h3>
                    <div className="flex items-center space-x-2 mb-2">
                      {animal.species && (
                        <span className="text-sm text-indigo-600 dark:text-indigo-400">{animal.species}</span>
                      )}
                      {animal.breed && (
                        <span className="text-sm text-gray-600 dark:text-gray-300">• {animal.breed}</span>
                      )}
                    </div>
                    <span className={`px-2 py-1 text-xs rounded mb-2 inline-block ${getStatusColor(animal.status)}`}>
                      {animal.status || 'available'}
                    </span>
                    {animal.bio && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-3">
                        {animal.bio}
                      </p>
                    )}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(animal)}
                        className="px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(animal.id, animal.name)}
                        disabled={deletingId === animal.id}
                        className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                      >
                        {deletingId === animal.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
      </div>
    </DashboardLayout>
  );
}


