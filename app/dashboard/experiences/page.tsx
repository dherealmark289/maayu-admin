'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import DashboardLayout from '@/components/DashboardLayout';

interface Experience {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  duration?: string;
  priceTHB?: number;
  difficulty?: string;
  capacity?: string;
  schedule?: string;
  includes?: string[];
  bring?: string[];
  image?: string;
  imageUrls?: string[];
  cta?: string;
  link?: string;
  badge?: string;
  published: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_EXPERIENCES = [
  {
    id: "ice-bath",
    title: "Ice Bath + Breath Reset",
    subtitle: "Cold plunge ritual with guided breathwork",
    category: "Recovery",
    duration: "45–60 min",
    priceTHB: 400,
    difficulty: "All levels",
    capacity: "Up to 8",
    schedule: "Wed & Sat, 5:30 pm",
    includes: ["Coach guidance", "Clean towels", "Herbal tea"],
    bring: ["Swimwear", "Change of clothes"],
    image: "/images/experiences/ice-bath.jpg",
    cta: "Book Ice Bath",
    link: "/book?exp=ice-bath",
    badge: "Popular",
    published: true,
    order: 0,
  },
  {
    id: "yoga",
    title: "Mountain View Yoga",
    subtitle: "Vinyasa / Yin sessions in our open-air shala",
    category: "Wellness",
    duration: "60 min",
    priceTHB: 500,
    difficulty: "All levels",
    capacity: "Up to 14",
    schedule: "Mon, Wed, Fri — 8:00 am / 5:00 pm",
    includes: ["Mats & blocks", "Filtered water"],
    bring: ["Comfortable clothing"],
    image: "/images/experiences/yoga.jpg",
    cta: "Book Yoga",
    link: "/book?exp=yoga",
    badge: "Sunrise",
    published: true,
    order: 1,
  },
  {
    id: "mtb",
    title: "Mountain Bike Ride",
    subtitle: "Singletrack & farm trails around Chiang Dao",
    category: "Adventure",
    duration: "2–3 hrs",
    priceTHB: 800,
    difficulty: "Intermediate",
    capacity: "Up to 6",
    schedule: "Tue & Sun — 7:00 am",
    includes: ["Guide", "Helmet", "Route support"],
    bring: ["Bike (or rent)", "Water bottle", "Sunscreen"],
    image: "/images/experiences/mtb.jpg",
    cta: "Join the Ride",
    link: "/book?exp=mtb",
    published: true,
    order: 2,
  },
  {
    id: "run",
    title: "Trail Run — Rice Fields to Ridge",
    subtitle: "Gentle 5–8 km loop with view stops",
    category: "Adventure",
    duration: "60–90 min",
    priceTHB: 0,
    difficulty: "Beginner-friendly",
    capacity: "Open group",
    schedule: "Thu — 7:00 am (community run)",
    includes: ["Paced guide", "Cool-down stretch"],
    bring: ["Running shoes", "Cap", "Water"],
    image: "/images/experiences/trail-run.jpg",
    cta: "RSVP",
    link: "/book?exp=run",
    badge: "Free weekly",
    published: true,
    order: 3,
  },
  {
    id: "farming",
    title: "Hands-on Farming",
    subtitle: "Compost, plant, harvest — practical regenerative skills",
    category: "Farm Life",
    duration: "90 min",
    priceTHB: 300,
    difficulty: "All levels",
    capacity: "Up to 12",
    schedule: "Daily — 9:30 am",
    includes: ["Tools & gloves", "Garden tour"],
    bring: ["Sun protection", "Closed shoes"],
    image: "/images/experiences/farming.jpg",
    cta: "Join Farming",
    link: "/book?exp=farming",
    published: true,
    order: 4,
  },
  {
    id: "mud",
    title: "Mud Building Workshop",
    subtitle: "Cob & earth techniques for real structures",
    category: "Craft & Build",
    duration: "2–4 hrs",
    priceTHB: 600,
    difficulty: "All levels",
    capacity: "Up to 16",
    schedule: "Sat — 2:00 pm",
    includes: ["Materials", "Safety briefing", "Hands-on guidance"],
    bring: ["Clothes to get dirty", "Water bottle"],
    image: "/images/experiences/mud-build.jpg",
    cta: "Build with Mud",
    link: "/book?exp=mud",
    badge: "Workshop",
    published: true,
    order: 5,
  },
];

export default function ExperiencesPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingExperience, setEditingExperience] = useState<Experience | null>(null);
  const [formData, setFormData] = useState<Partial<Experience>>({
    title: '',
    subtitle: '',
    category: '',
    duration: '',
    priceTHB: 0,
    difficulty: '',
    capacity: '',
    schedule: '',
    includes: [],
    bring: [],
    image: '',
    imageUrls: [],
    cta: '',
    link: '',
    badge: '',
    published: false,
    order: 0,
  });
  const [newInclude, setNewInclude] = useState('');
  const [newBring, setNewBring] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchExperiences();
  }, []);

  const fetchExperiences = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/experiences', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch experiences');
      }

      const data = await response.json();
      setExperiences(data.experiences || []);
      setError('');
    } catch (err: any) {
      console.error('Error fetching experiences:', err);
      setError(err.message || 'Failed to load experiences');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (experience: Experience) => {
    setEditingExperience(experience);
    setFormData({
      title: experience.title || '',
      subtitle: experience.subtitle || '',
      category: experience.category || '',
      duration: experience.duration || '',
      priceTHB: experience.priceTHB || 0,
      difficulty: experience.difficulty || '',
      capacity: experience.capacity || '',
      schedule: experience.schedule || '',
      includes: experience.includes || [],
      bring: experience.bring || [],
      image: experience.image || '',
      imageUrls: experience.imageUrls || [],
      cta: experience.cta || '',
      link: experience.link || '',
      badge: experience.badge || '',
      published: experience.published || false,
      order: experience.order || 0,
    });
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingExperience(null);
    setFormData({
      title: '',
      subtitle: '',
      category: '',
      duration: '',
      priceTHB: 0,
      difficulty: '',
      capacity: '',
      schedule: '',
      includes: [],
      bring: [],
      image: '',
      imageUrls: [],
      cta: '',
      link: '',
      badge: '',
      published: false,
      order: 0,
    });
    setShowForm(true);
  };

  const handleLoadDefault = () => {
    setEditingExperience(null);
    const defaultExp = DEFAULT_EXPERIENCES[0];
    setFormData({
      ...defaultExp,
      imageUrls: [],
    });
    setShowForm(true);
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
          
          let newQuality = quality;
          const tryCompress = (q: number) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  resolve(new File([blob!], file.name, { type: file.type }));
                  return;
                }
                const sizeKB = blob.size / 1024;
                if (sizeKB <= maxSizeKB || q <= 0.1) {
                  resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
                } else {
                  tryCompress(Math.max(0.1, q - 0.1));
                }
              },
              file.type,
              q
            );
          };
          tryCompress(newQuality);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!formData.title) {
      setError('Please enter experience title first before uploading images');
      return;
    }

    const maxImages = 10;
    const currentCount = formData.imageUrls?.length || 0;
    const remainingSlots = maxImages - currentCount;

    if (files.length > remainingSlots) {
      setError(`You can only upload ${remainingSlots} more image(s) (maximum ${maxImages} total)`);
      return;
    }

    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length && i < remainingSlots; i++) {
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

        // Upload to S3 via experience image API
        const uploadFormData = new FormData();
        uploadFormData.append('image', fileToUpload);
        uploadFormData.append('experienceName', formData.title);
        if (editingExperience?.id) {
          uploadFormData.append('experienceId', editingExperience.id);
        }

        const response = await fetch('/api/experiences/image', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: uploadFormData,
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
        imageUrls: [...(formData.imageUrls || []), ...uploadedUrls],
      });
      setError('');
    } catch (err: any) {
      console.error('Error uploading images:', err);
      setError(err.message || 'Failed to upload images');
    } finally {
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    setFormData({
      ...formData,
      imageUrls: formData.imageUrls?.filter((_, i) => i !== index) || [],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const url = '/api/experiences';
      const method = editingExperience ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(editingExperience ? { id: editingExperience.id } : {}),
          ...formData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save experience');
      }

      await fetchExperiences();
      setShowForm(false);
      setEditingExperience(null);
    } catch (err: any) {
      console.error('Error saving experience:', err);
      setError(err.message || 'Failed to save experience');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this experience?')) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`/api/experiences?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete experience');
      }

      await fetchExperiences();
    } catch (err: any) {
      console.error('Error deleting experience:', err);
      setError(err.message || 'Failed to delete experience');
    }
  };

  const addInclude = () => {
    if (newInclude.trim()) {
      setFormData({
        ...formData,
        includes: [...(formData.includes || []), newInclude.trim()],
      });
      setNewInclude('');
    }
  };

  const removeInclude = (index: number) => {
    setFormData({
      ...formData,
      includes: formData.includes?.filter((_, i) => i !== index) || [],
    });
  };

  const addBring = () => {
    if (newBring.trim()) {
      setFormData({
        ...formData,
        bring: [...(formData.bring || []), newBring.trim()],
      });
      setNewBring('');
    }
  };

  const removeBring = (index: number) => {
    setFormData({
      ...formData,
      bring: formData.bring?.filter((_, i) => i !== index) || [],
    });
  };

  const loadAllDefaults = async () => {
    if (!confirm('This will create all 6 default experiences. Continue?')) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      setError('');
      let successCount = 0;
      let errorCount = 0;

      for (const defaultExp of DEFAULT_EXPERIENCES) {
        try {
          const response = await fetch('/api/experiences', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              ...defaultExp,
              imageUrls: [],
            }),
          });

          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          errorCount++;
        }
      }

      if (successCount > 0) {
        await fetchExperiences();
        setError(`Created ${successCount} experiences${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
        setTimeout(() => setError(''), 3000);
      } else {
        setError('Failed to create experiences');
      }
    } catch (err: any) {
      console.error('Error loading defaults:', err);
      setError(err.message || 'Failed to load default experiences');
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Experiences
          </h1>
          <div className="flex gap-2">
            <button
              onClick={fetchExperiences}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Refresh
            </button>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Add Experience
            </button>
            <button
              onClick={handleLoadDefault}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Load Default
            </button>
            <button
              onClick={loadAllDefaults}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Load All Defaults
            </button>
          </div>
        </div>

        {error && (
          <div className={`mb-4 p-4 rounded-lg ${
            error.includes('Created') || error.includes('success')
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <p className={error.includes('Created') || error.includes('success')
              ? 'text-green-800 dark:text-green-300'
              : 'text-red-800 dark:text-red-300'
            }>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {experiences.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-12">
                No experiences found. Click &quot;Add Experience&quot; to create one.
              </p>
            ) : (
              experiences.map((experience) => (
                <div
                  key={experience.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {experience.title}
                        </h3>
                        {experience.badge && (
                          <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                            {experience.badge}
                          </span>
                        )}
                        {experience.published && (
                          <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                            Published
                          </span>
                        )}
                      </div>
                      {experience.subtitle && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {experience.subtitle}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {experience.category && <span>Category: {experience.category}</span>}
                        {experience.duration && <span>• Duration: {experience.duration}</span>}
                        {experience.priceTHB !== undefined && (
                          <span>• Price: {experience.priceTHB === 0 ? 'Free' : `THB ${experience.priceTHB}`}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(experience)}
                        className="px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(experience.id)}
                        className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {editingExperience ? 'Edit Experience' : 'Add Experience'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Wellness, Adventure, Farm Life"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subtitle
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Duration
                    </label>
                    <input
                      type="text"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., 60 min"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Price (THB)
                    </label>
                    <input
                      type="number"
                      value={formData.priceTHB || 0}
                      onChange={(e) => setFormData({ ...formData, priceTHB: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Difficulty
                    </label>
                    <input
                      type="text"
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., All levels"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Capacity
                    </label>
                    <input
                      type="text"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Up to 8"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Schedule
                    </label>
                    <input
                      type="text"
                      value={formData.schedule}
                      onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Wed & Sat, 5:30 pm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    What&apos;s Included
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newInclude}
                      onChange={(e) => setNewInclude(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInclude())}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Add item"
                    />
                    <button
                      type="button"
                      onClick={addInclude}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-1">
                    {formData.includes?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded">
                        <span className="text-sm text-gray-900 dark:text-white">{item}</span>
                        <button
                          type="button"
                          onClick={() => removeInclude(idx)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    What to Bring
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newBring}
                      onChange={(e) => setNewBring(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBring())}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Add item"
                    />
                    <button
                      type="button"
                      onClick={addBring}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-1">
                    {formData.bring?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded">
                        <span className="text-sm text-gray-900 dark:text-white">{item}</span>
                        <button
                          type="button"
                          onClick={() => removeBring(idx)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      CTA Button Text
                    </label>
                    <input
                      type="text"
                      value={formData.cta}
                      onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., Book Ice Bath"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Link
                    </label>
                    <input
                      type="text"
                      value={formData.link}
                      onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g., /book?exp=ice-bath"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Badge
                  </label>
                  <input
                    type="text"
                    value={formData.badge}
                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Popular, Sunrise, Workshop"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Images (Maximum 10)
                    {formData.imageUrls && formData.imageUrls.length > 0 && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        ({formData.imageUrls.length}/10)
                      </span>
                    )}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    ref={imageInputRef}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
                    disabled={!formData.title || (formData.imageUrls?.length || 0) >= 10}
                  />
                  {!formData.title && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
                      Please enter experience title first before uploading images
                    </p>
                  )}
                  {(formData.imageUrls?.length || 0) >= 10 && (
                    <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                      Maximum 10 images reached
                    </p>
                  )}
                  {formData.imageUrls && formData.imageUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {formData.imageUrls.map((url, idx) => (
                        <div key={idx} className="relative">
                          <Image
                            src={url}
                            alt={`Experience image ${idx + 1}`}
                            width={200}
                            height={128}
                            unoptimized
                            className="w-full h-32 object-cover rounded border border-gray-300 dark:border-gray-600"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                            title="Remove image"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.published}
                      onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Published
                    </span>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                      className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingExperience(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                  >
                    {editingExperience ? 'Update' : 'Create'} Experience
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


