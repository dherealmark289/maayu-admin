'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';

interface Zone {
  name: string;
  title: string;
  description: string[];
  tags: string[];
  imageUrl: string;
}

interface VisionContent {
  id: string | null;
  title: string;
  description: string;
  buttonText: string;
  introText1: string;
  introText2: string;
  zones: Zone[];
  ecosystemImageUrl: string;
  ecosystemText1: string;
  ecosystemText2: string;
}

export default function VisionPage() {
  const [visionContent, setVisionContent] = useState<VisionContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState<{ zoneName?: string; type?: 'ecosystem' } | null>(null);
  const [imageInputs, setImageInputs] = useState<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetchVisionContent();
  }, []);

  const fetchVisionContent = async () => {
    try {
      const response = await fetch('/api/vision');

      if (!response.ok) {
        throw new Error('Failed to fetch vision content');
      }

      const data = await response.json();
      const content = data.visionContent;
      
      // Parse zones if they're stored as JSON string
      if (content.zones && typeof content.zones === 'string') {
        content.zones = JSON.parse(content.zones);
      }
      
      setVisionContent(content);
      setError('');
    } catch (err: any) {
      console.error('Error fetching vision content:', err);
      setError(err.message || 'Failed to load vision content');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!visionContent) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      setSaving(true);
      setError('');

      const response = await fetch('/api/vision', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(visionContent),
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMsg = data.error || 'Failed to save vision content';
        const details = data.details ? ` (${data.details})` : '';
        const code = data.code ? ` [Code: ${data.code}]` : '';
        throw new Error(`${errorMsg}${details}${code}`);
      }

      await fetchVisionContent();
      setError('');
      alert('Vision content saved successfully!');
    } catch (err: any) {
      console.error('Error saving vision content:', err);
      setError(err.message || 'Failed to save vision content');
    } finally {
      setSaving(false);
    }
  };

  const handleZoneChange = (index: number, field: keyof Zone, value: any) => {
    if (!visionContent) return;
    const zones = [...visionContent.zones];
    zones[index] = { ...zones[index], [field]: value };
    setVisionContent({ ...visionContent, zones });
  };

  const handleZoneDescriptionChange = (index: number, descIndex: number, value: string) => {
    if (!visionContent) return;
    const zones = [...visionContent.zones];
    const description = [...zones[index].description];
    description[descIndex] = value;
    zones[index] = { ...zones[index], description };
    setVisionContent({ ...visionContent, zones });
  };

  const handleAddDescriptionLine = (index: number) => {
    if (!visionContent) return;
    const zones = [...visionContent.zones];
    zones[index].description.push('');
    setVisionContent({ ...visionContent, zones });
  };

  const handleRemoveDescriptionLine = (index: number, descIndex: number) => {
    if (!visionContent) return;
    const zones = [...visionContent.zones];
    zones[index].description = zones[index].description.filter((_, i) => i !== descIndex);
    setVisionContent({ ...visionContent, zones });
  };

  const handleTagChange = (index: number, tagIndex: number, value: string) => {
    if (!visionContent) return;
    const zones = [...visionContent.zones];
    const tags = [...zones[index].tags];
    tags[tagIndex] = value;
    zones[index] = { ...zones[index], tags };
    setVisionContent({ ...visionContent, zones });
  };

  const handleAddTag = (index: number) => {
    if (!visionContent) return;
    const zones = [...visionContent.zones];
    zones[index].tags.push('#');
    setVisionContent({ ...visionContent, zones });
  };

  const handleRemoveTag = (index: number, tagIndex: number) => {
    if (!visionContent) return;
    const zones = [...visionContent.zones];
    zones[index].tags = zones[index].tags.filter((_, i) => i !== tagIndex);
    setVisionContent({ ...visionContent, zones });
  };

  // Compress image using Canvas API (supports JPEG, PNG, WebP, GIF, BMP)
  // Note: SVG files are passed through without compression as they are vector-based
  const compressImage = (file: File, maxSizeKB: number = 500, quality: number = 0.85): Promise<File> => {
    return new Promise((resolve, reject) => {
      // Skip compression for SVG files (vector graphics)
      if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        resolve(file);
        return;
      }

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

                  // Convert to JPEG for compression (better compression ratio)
                  // But keep original format if it's PNG/WebP and user wants transparency
                  const outputType = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
                  
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
                              resolve(new File([blob], file.name, { type: outputType, lastModified: Date.now() }));
                              return;
                            }
                            resolve(new File([newBlob], file.name, { type: outputType, lastModified: Date.now() }));
                          },
                          outputType,
                          newQuality
                        );
                      } else {
                        resolve(new File([blob], file.name, { type: outputType, lastModified: Date.now() }));
                      }
                    },
                    outputType,
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>, zoneName?: string, type?: 'ecosystem') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setUploadingImage({ zoneName, type });
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      // Compress image
      let fileToUpload = file;
      try {
        fileToUpload = await compressImage(file, 500, 0.85);
      } catch (compressionError) {
        console.warn('Image compression failed, using original:', compressionError);
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);
      if (zoneName) {
        formData.append('zoneName', zoneName);
      } else if (type === 'ecosystem') {
        formData.append('zoneName', 'ecosystem');
      }

      const response = await fetch('/api/vision/image', {
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

      if (!visionContent) return;

      if (type === 'ecosystem') {
        setVisionContent({ ...visionContent, ecosystemImageUrl: data.url });
      } else if (zoneName) {
        const zones = [...visionContent.zones];
        const zoneIndex = zones.findIndex(z => z.name === zoneName);
        if (zoneIndex !== -1) {
          zones[zoneIndex].imageUrl = data.url;
          setVisionContent({ ...visionContent, zones });
        }
      }

      setError('');
    } catch (err: any) {
      console.error('Error uploading image:', err);
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(null);
      // Reset input
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!visionContent) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Failed to load vision content.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vision Page Content</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="space-y-8">
          {/* Intro Section */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Intro Section</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={visionContent.title || ''}
                  onChange={(e) => setVisionContent({ ...visionContent, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Building Our Own World"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={visionContent.description || ''}
                  onChange={(e) => setVisionContent({ ...visionContent, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Not an all-inclusive resort -but an ecosystem for growth, creation, and connection..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Button Text
                </label>
                <input
                  type="text"
                  value={visionContent.buttonText || 'Explore Our World Map'}
                  onChange={(e) => setVisionContent({ ...visionContent, buttonText: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Explore Our World Map"
                />
              </div>
            </div>
          </div>

          {/* Zone Cards */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Zone Cards</h2>
            {visionContent.zones.map((zone, index) => (
              <div key={zone.name} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 capitalize">
                  {zone.name.replace('-', ' ')} Zone
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={zone.title}
                      onChange={(e) => handleZoneChange(index, 'title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Image
                    </label>
                    <input
                      ref={(el) => {
                        if (el) imageInputs[`zone-${zone.name}`] = el;
                      }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageSelect(e, zone.name)}
                      className="hidden"
                    />
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => imageInputs[`zone-${zone.name}`]?.click()}
                        disabled={uploadingImage?.zoneName === zone.name}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {uploadingImage?.zoneName === zone.name ? 'Uploading...' : 'Upload Image'}
                      </button>
                      {zone.imageUrl && (
                        <div className="relative">
                          <img
                            src={zone.imageUrl}
                            alt={zone.title}
                            className="w-32 h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                          />
                          <button
                            type="button"
                            onClick={() => handleZoneChange(index, 'imageUrl', '')}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description Lines
                    </label>
                    <div className="space-y-2">
                      {zone.description.map((desc, descIndex) => (
                        <div key={descIndex} className="flex gap-2">
                          <textarea
                            rows={2}
                            value={desc}
                            onChange={(e) => handleZoneDescriptionChange(index, descIndex, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveDescriptionLine(index, descIndex)}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleAddDescriptionLine(index)}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                      >
                        Add Description Line
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {zone.tags.map((tag, tagIndex) => (
                        <div key={tagIndex} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={tag}
                            onChange={(e) => handleTagChange(index, tagIndex, e.target.value)}
                            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(index, tagIndex)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleAddTag(index)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                      >
                        Add Tag
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Ecosystem Card */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Ecosystem Card</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Image
                </label>
                <input
                  ref={(el) => {
                    if (el) imageInputs['ecosystem'] = el;
                  }}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageSelect(e, undefined, 'ecosystem')}
                  className="hidden"
                />
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => imageInputs['ecosystem']?.click()}
                    disabled={uploadingImage?.type === 'ecosystem'}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {uploadingImage?.type === 'ecosystem' ? 'Uploading...' : 'Upload Image'}
                  </button>
                  {visionContent.ecosystemImageUrl && (
                    <div className="relative">
                      <img
                        src={visionContent.ecosystemImageUrl}
                        alt="Ecosystem"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                      />
                      <button
                        type="button"
                        onClick={() => setVisionContent({ ...visionContent, ecosystemImageUrl: '' })}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Text 1
                </label>
                <textarea
                  rows={3}
                  value={visionContent.ecosystemText1}
                  onChange={(e) => setVisionContent({ ...visionContent, ecosystemText1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Text 2
                </label>
                <textarea
                  rows={3}
                  value={visionContent.ecosystemText2}
                  onChange={(e) => setVisionContent({ ...visionContent, ecosystemText2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

