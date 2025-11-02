'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import DashboardLayout from '@/components/DashboardLayout';

interface Accommodation {
  id: string;
  name: string;
  hostedBy?: string;
  zone?: string;
  coHost?: string;
  description?: string;
  type?: string;
  price?: number;
  capacity?: number;
  whatOffers?: any; // JSON object or array
  amenities?: string[];
  imageUrls?: string[];
  houseRules?: string;
  location?: string;
  safety?: string;
  url?: string;
  available?: boolean;
  createdAt?: string;
}

const WHAT_OFFERS_OPTIONS = [
  'Air Conditioning',
  'All Around Property',
  'Balcony',
  'Barbecue Utensils',
  'BBQ Grill',
  'Bed Linen',
  'Bidet',
  'Bikes',
  'Blender',
  'Board Games',
  'Body Soap',
  'Books and Reading Material',
  'Breakfast',
  'Bathroom',
  'Carbon Monoxide Alarm',
  'Ceiling Fan',
  'Cleaning Products',
  'Clothes Storage',
  'Coffee',
  'Coffee Maker',
  'Conditioner',
  'Dedicated Workspace',
  'Dinner',
  'Dryer',
  'Essentials',
  'Exterior Security Cameras on Property',
  'Exercise Equipment',
  'Extra Pillows and Blankets',
  'Firepit',
  'Fireplace',
  'First Aid Kit',
  'Free Parking on Premises',
  'Garden',
  'Grill, Charcoal, Bamboo Skewers/Iron Skewers',
  'Gym',
  'Hair Dryer',
  'Hangers',
  'Heating',
  'Host Greets You',
  'Hot Tub',
  'Hot Water',
  'Iron',
  'Kitchen',
  'Lunch',
  'Outdoor Dining Area',
  'Outdoor Shower',
  'Paid Parking on Premises',
  'Patio',
  'Pet Friendly',
  'Pool',
  'Room-darkening Blinds',
  'Safe',
  'Smoke Alarm',
  'Smoking Allowed',
  'Space Where Guests Can Cook Their Own Meals',
  'TV',
  'Towels, Bed Sheets, Soap and Toilet Paper',
  'Washing Machine',
  'Wheelchair Accessible',
  'WiFi',
];

export default function AccommodationPage() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    hostedBy: '',
    coHost: '',
    description: '',
    type: '',
    zone: '',
    price: '',
    capacity: '',
    whatOffers: [] as string[],
    whatOffersText: '',
    amenities: '',
    imageUrls: [] as string[],
    houseRules: '',
    location: '',
    safety: '',
    url: '',
    available: true,
  });

  useEffect(() => {
    fetchAccommodations();
  }, []);

  const fetchAccommodations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/accommodation', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch accommodations');
      }

      const data = await response.json();
      setAccommodations(data.accommodations || []);
      setError('');
    } catch (err: any) {
      console.error('Error fetching accommodations:', err);
      setError(err.message || 'Failed to load accommodations');
    } finally {
      setLoading(false);
    }
  };

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

        // Upload to S3 via accommodation image API
        const formData = new FormData();
        formData.append('image', fileToUpload);
        // Pass accommodationId if editing existing accommodation
        if (editingAccommodation?.id) {
          formData.append('accommodationId', editingAccommodation.id);
        }

        const response = await fetch('/api/accommodation/image', {
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
        imageUrls: [...formData.imageUrls, ...uploadedUrls],
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
      imageUrls: formData.imageUrls.filter((_, i) => i !== index),
    });
  };

  const toggleWhatOffers = (option: string) => {
    const current = formData.whatOffers;
    const newOffers = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option];
    
    setFormData({
      ...formData,
      whatOffers: newOffers,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const amenitiesArray = formData.amenities.split(',').map(a => a.trim()).filter(a => a);
      
      // Combine whatOffers array with text
      let whatOffers: any = formData.whatOffers;
      if (formData.whatOffersText.trim()) {
        if (Array.isArray(whatOffers)) {
          whatOffers = {
            options: whatOffers,
            additional: formData.whatOffersText.trim(),
          };
        } else {
          whatOffers = {
            ...whatOffers,
            additional: formData.whatOffersText.trim(),
          };
        }
      }

      const method = editingAccommodation ? 'PUT' : 'POST';
      const body = {
        ...(editingAccommodation && { id: editingAccommodation.id }),
        name: formData.name,
        hostedBy: formData.hostedBy || null,
        coHost: formData.coHost || null,
        description: formData.description || null,
        type: formData.type || null,
        zone: formData.zone || null,
        price: formData.price ? parseFloat(formData.price) : null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        whatOffers: whatOffers || null,
        amenities: amenitiesArray,
        imageUrls: formData.imageUrls,
        houseRules: formData.houseRules || null,
        location: formData.location || null,
        safety: formData.safety || null,
        url: formData.url || null,
        available: formData.available,
      };

      const response = await fetch('/api/accommodation', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save accommodation');
      }

      await fetchAccommodations();
      setShowForm(false);
      setEditingAccommodation(null);
      resetForm();
      setError('');
    } catch (err: any) {
      console.error('Error saving accommodation:', err);
      setError(err.message || 'Failed to save accommodation');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      hostedBy: '',
      coHost: '',
      description: '',
      type: '',
      zone: '',
      price: '',
      capacity: '',
      whatOffers: [],
      whatOffersText: '',
      amenities: '',
      imageUrls: [],
      houseRules: '',
      location: '',
      safety: '',
      url: '',
      available: true,
    });
  };

  const handleEdit = (accommodation: Accommodation) => {
    setEditingAccommodation(accommodation);
    
    // Parse whatOffers
    let whatOffers: string[] = [];
    let whatOffersText = '';
    if (accommodation.whatOffers) {
      if (Array.isArray(accommodation.whatOffers)) {
        whatOffers = accommodation.whatOffers;
      } else if (typeof accommodation.whatOffers === 'object') {
        if (accommodation.whatOffers.options) {
          whatOffers = accommodation.whatOffers.options;
        }
        if (accommodation.whatOffers.additional) {
          whatOffersText = accommodation.whatOffers.additional;
        }
      }
    }

    setFormData({
      name: accommodation.name || '',
      hostedBy: accommodation.hostedBy || '',
      coHost: accommodation.coHost || '',
      description: accommodation.description || '',
      type: accommodation.type || '',
      zone: accommodation.zone || '',
      price: accommodation.price?.toString() || '',
      capacity: accommodation.capacity?.toString() || '',
      whatOffers: whatOffers,
      whatOffersText: whatOffersText,
      amenities: accommodation.amenities?.join(', ') || '',
      imageUrls: accommodation.imageUrls || [],
      houseRules: accommodation.houseRules || '',
      location: accommodation.location || '',
      safety: accommodation.safety || '',
      url: accommodation.url || '',
      available: accommodation.available !== undefined ? accommodation.available : true,
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

      const response = await fetch(`/api/accommodation?id=${confirmDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete accommodation');
      }

      await fetchAccommodations();
      setConfirmDelete(null);
      setError('');
    } catch (err: any) {
      console.error('Error deleting accommodation:', err);
      setError(err.message || 'Failed to delete accommodation');
    } finally {
      setDeletingId(null);
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingAccommodation(null);
    resetForm();
  };

  return (
    <DashboardLayout>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Accommodation</h1>
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Add Accommodation
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="mb-6 p-4 lg:p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {editingAccommodation ? 'Edit Accommodation' : 'Add Accommodation'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Property Name *
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
                    Hosted By
                  </label>
                  <input
                    type="text"
                    value={formData.hostedBy}
                    onChange={(e) => setFormData({ ...formData, hostedBy: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Co-Host
                  </label>
                  <input
                    type="text"
                    value={formData.coHost}
                    onChange={(e) => setFormData({ ...formData, coHost: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type
                  </label>
                  <input
                    type="text"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="e.g., Single, Double, Dorm"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Zone/Category
                  </label>
                  <select
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Select Zone</option>
                    <option value="dao-home">DAO HOME</option>
                    <option value="lilac">LILAC</option>
                    <option value="common">Common</option>
                  </select>
                  <input
                    type="text"
                    value={formData.zone && !['dao-home', 'lilac', 'common'].includes(formData.zone) ? formData.zone : ''}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    onFocus={(e) => {
                      if (['dao-home', 'lilac', 'common'].includes(formData.zone)) {
                        setFormData({ ...formData, zone: '' });
                      }
                    }}
                    placeholder="Or type custom zone name"
                    className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                
                {/* What This Place Offers */}
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    What This Place Offers
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-3">
                    {WHAT_OFFERS_OPTIONS.map((option) => (
                      <label key={option} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.whatOffers.includes(option)}
                          onChange={() => toggleWhatOffers(option)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{option}</span>
                      </label>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={formData.whatOffersText}
                    onChange={(e) => setFormData({ ...formData, whatOffersText: e.target.value })}
                    placeholder="Additional offers (e.g., Free breakfast, Pool access)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amenities (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.amenities}
                    onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                    placeholder="e.g., WiFi, Air Conditioning, Breakfast"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Image Upload */}
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Images
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
                    {uploadingImages ? 'Uploading...' : 'Upload Images'}
                  </button>
                  {formData.imageUrls.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-3">
                      {formData.imageUrls.map((url, index) => (
                        <div key={index} className="relative">
                          <Image
                            src={url}
                            alt={`Upload ${index + 1}`}
                            width={200}
                            height={96}
                            className="w-full h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                            unoptimized
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

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    House Rules
                  </label>
                  <textarea
                    rows={3}
                    value={formData.houseRules}
                    onChange={(e) => setFormData({ ...formData, houseRules: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <textarea
                    rows={2}
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Safety
                  </label>
                  <textarea
                    rows={2}
                    value={formData.safety}
                    onChange={(e) => setFormData({ ...formData, safety: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL (Airbnb/Booking Website)
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://airbnb.com/..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.available}
                      onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Available</span>
                  </label>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                >
                  {editingAccommodation ? 'Update' : 'Create'}
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
            {accommodations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No accommodations found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accommodations.map((accommodation) => (
                  <div
                    key={accommodation.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                  >
                    {accommodation.imageUrls && accommodation.imageUrls.length > 0 && (
                      <Image
                        src={accommodation.imageUrls[0]}
                        alt={accommodation.name}
                        width={400}
                        height={192}
                        className="w-full h-48 object-cover rounded-lg mb-3"
                        unoptimized
                      />
                    )}
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{accommodation.name}</h3>
                    {accommodation.hostedBy && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                        Hosted by: {accommodation.hostedBy}
                      </p>
                    )}
                    {accommodation.coHost && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                        Co-Host: {accommodation.coHost}
                      </p>
                    )}
                    <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-2">{accommodation.type || 'N/A'}</p>
                    {accommodation.price && (
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        ${accommodation.price}
                      </p>
                    )}
                    {accommodation.url && (
                      <a
                        href={accommodation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2 block"
                      >
                        View on Airbnb →
                      </a>
                    )}
                    {accommodation.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                        {accommodation.description}
                      </p>
                    )}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <span className={`px-2 py-1 text-xs rounded ${accommodation.available ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                        {accommodation.available ? 'Available' : 'Unavailable'}
                      </span>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleEdit(accommodation)}
                          className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded w-full sm:w-auto"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(accommodation.id, accommodation.name)}
                          disabled={deletingId === accommodation.id}
                          className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 w-full sm:w-auto"
                        >
                          {deletingId === accommodation.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
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
              <div className="flex flex-col sm:flex-row justify-end gap-3">
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
