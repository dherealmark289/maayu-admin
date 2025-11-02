'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import DashboardLayout from '@/components/DashboardLayout';

interface RetreatWorkshop {
  id: string;
  title: string;
  dates?: string;
  location?: string;
  overview?: string;
  tagline?: string;
  objectives?: string[];
  program?: Array<{ date: string; activity: string }>;
  dailyRhythm?: string;
  accommodation?: string[];
  meals?: string;
  volunteerPathway?: string;
  facilitators?: string[];
  story?: string;
  imageUrls?: string[];
  published: boolean;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function RetreatWorkshopsPage() {
  const [workshops, setWorkshops] = useState<RetreatWorkshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<RetreatWorkshop | null>(null);
  const [formData, setFormData] = useState<Partial<RetreatWorkshop>>({
    title: '',
    dates: '',
    location: '',
    overview: '',
    tagline: '',
    objectives: [],
    program: [],
    dailyRhythm: '',
    accommodation: [],
    meals: '',
    volunteerPathway: '',
    facilitators: [],
    story: '',
    published: false,
    order: 0,
  });
  const [newObjective, setNewObjective] = useState('');
  const [newProgramDate, setNewProgramDate] = useState('');
  const [newProgramActivity, setNewProgramActivity] = useState('');
  const [newAccommodation, setNewAccommodation] = useState('');
  const [newFacilitator, setNewFacilitator] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchWorkshops();
  }, []);

  const fetchWorkshops = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/retreat/workshops', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workshops');
      }

      const data = await response.json();
      setWorkshops(data.workshops || []);
      setError('');
    } catch (err: any) {
      console.error('Error fetching workshops:', err);
      setError(err.message || 'Failed to load workshops');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (workshop: RetreatWorkshop) => {
    setEditingWorkshop(workshop);
    setFormData({
      title: workshop.title || '',
      dates: workshop.dates || '',
      location: workshop.location || '',
      overview: workshop.overview || '',
      tagline: workshop.tagline || '',
      objectives: workshop.objectives || [],
      program: workshop.program || [],
      dailyRhythm: workshop.dailyRhythm || '',
      accommodation: workshop.accommodation || [],
      meals: workshop.meals || '',
      volunteerPathway: workshop.volunteerPathway || '',
      facilitators: workshop.facilitators || [],
      story: workshop.story || '',
      imageUrls: workshop.imageUrls || [],
      published: workshop.published || false,
      order: workshop.order || 0,
    });
    setShowForm(true);
  };

  const defaultWorkshopContent = {
    title: '🪵 Mud in the Sky Workshop',
    dates: 'February 17 – 27, 2026',
    location: 'Ma Yu Farm, Chiang Dao, Thailand',
    overview: 'The Mud in the Sky Workshop is a 10-day immersive experience in natural building and community connection at Ma Yu Farm, Chiang Dao. Participants will learn hands-on earthen construction with Maggi — a renowned mudhome and tropical earthship builder — while engaging with the Chiang Dao community through shared meals, wellness activities, and cultural outings.',
    tagline: 'This workshop goes beyond building — it\'s about connecting with nature, people, and place.',
    objectives: [
      'Build a key feature of Ma Yu\'s Mud in the Sky project.',
      'Complete a small satellite project at Yidan\'s farm (e.g., clay pizza oven).',
      'Host daily community activities like qi gong, workouts, and fireside dinners.',
      'Foster connection with Chiang Dao\'s land, people, and rhythm.',
      'Open opportunities for participants to stay on and continue building.'
    ],
    program: [
      { date: 'Feb 17', activity: 'Arrivals, evening group meeting & welcome dinner.' },
      { date: 'Feb 18–21', activity: 'Mud-building sessions at Ma Yu Farm.' },
      { date: 'Feb 22', activity: 'Community outing — Tropical Earthship visit, cave, temple steps, hot springs, group lunch.' },
      { date: 'Feb 23–25', activity: 'Continued mud-building.' },
      { date: 'Feb 26', activity: 'Closing build day + celebration BBQ dinner.' },
      { date: 'Feb 27', activity: 'Reflection, closing activity, shared lunch, departures.' }
    ],
    dailyRhythm: 'Daily rhythm: breakfast around the fire, mindful breaks, evening gatherings.',
    accommodation: [
      'Camping at Ma Yu Farm (tent spaces available)',
      'Yidan\'s Farmstay (discounted partner rates)',
      'La La Land Guesthouse / Café My Day Off (partner lodging nearby)'
    ],
    meals: 'Three meals per day served on-site at Ma Yu Farm, with occasional hosted meals at Yidan\'s Farm. Meals are made from local produce, with vegetarian/vegan options available.',
    volunteerPathway: 'After the workshop, up to 5 participants may stay on as volunteers to continue the Mud in the Sky project and contribute to community life at Ma Yu Farm.',
    facilitators: [
      'Maggi: Facilitator, tropical earthship & natural building specialist.',
      'Yidan\'s Farm: Partner accommodation & co-promotion.',
      'Ma Yu Farm: Host, logistics, food, and community coordination.'
    ],
    story: 'More than mud building — connect with Chiang Dao\'s land, people, and community.',
    published: true,
    order: 0,
  };

  const handleAdd = () => {
    setEditingWorkshop(null);
    setFormData({
      title: '',
      dates: '',
      location: '',
      overview: '',
      tagline: '',
      objectives: [],
      program: [],
      dailyRhythm: '',
      accommodation: [],
      meals: '',
      volunteerPathway: '',
      facilitators: [],
      story: '',
      imageUrls: [],
      published: false,
      order: 0,
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
      setError('Please enter workshop title first before uploading images');
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

        // Upload to S3 via workshop image API
        const uploadFormData = new FormData();
        uploadFormData.append('image', fileToUpload);
        uploadFormData.append('workshopName', formData.title);
        if (editingWorkshop?.id) {
          uploadFormData.append('workshopId', editingWorkshop.id);
        }

        const response = await fetch('/api/retreat/workshops/image', {
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

      const url = editingWorkshop
        ? '/api/retreat/workshops'
        : '/api/retreat/workshops';
      const method = editingWorkshop ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(editingWorkshop ? { id: editingWorkshop.id } : {}),
          ...formData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save workshop');
      }

      await fetchWorkshops();
      setShowForm(false);
      setEditingWorkshop(null);
    } catch (err: any) {
      console.error('Error saving workshop:', err);
      setError(err.message || 'Failed to save workshop');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workshop?')) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`/api/retreat/workshops?id=${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete workshop');
      }

      await fetchWorkshops();
    } catch (err: any) {
      console.error('Error deleting workshop:', err);
      setError(err.message || 'Failed to delete workshop');
    }
  };

  const addObjective = () => {
    if (newObjective.trim()) {
      setFormData({
        ...formData,
        objectives: [...(formData.objectives || []), newObjective.trim()],
      });
      setNewObjective('');
    }
  };

  const removeObjective = (index: number) => {
    setFormData({
      ...formData,
      objectives: formData.objectives?.filter((_, i) => i !== index) || [],
    });
  };

  const addProgramDay = () => {
    if (newProgramDate.trim() && newProgramActivity.trim()) {
      setFormData({
        ...formData,
        program: [
          ...(formData.program || []),
          { date: newProgramDate.trim(), activity: newProgramActivity.trim() },
        ],
      });
      setNewProgramDate('');
      setNewProgramActivity('');
    }
  };

  const removeProgramDay = (index: number) => {
    setFormData({
      ...formData,
      program: formData.program?.filter((_, i) => i !== index) || [],
    });
  };

  const addAccommodation = () => {
    if (newAccommodation.trim()) {
      setFormData({
        ...formData,
        accommodation: [...(formData.accommodation || []), newAccommodation.trim()],
      });
      setNewAccommodation('');
    }
  };

  const removeAccommodation = (index: number) => {
    setFormData({
      ...formData,
      accommodation: formData.accommodation?.filter((_, i) => i !== index) || [],
    });
  };

  const addFacilitator = () => {
    if (newFacilitator.trim()) {
      setFormData({
        ...formData,
        facilitators: [...(formData.facilitators || []), newFacilitator.trim()],
      });
      setNewFacilitator('');
    }
  };

  const removeFacilitator = (index: number) => {
    setFormData({
      ...formData,
      facilitators: formData.facilitators?.filter((_, i) => i !== index) || [],
    });
  };

  return (
    <DashboardLayout>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
            Retreat Workshops
          </h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={fetchWorkshops}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium w-full sm:w-auto"
            >
              Refresh
            </button>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium w-full sm:w-auto"
            >
              Add Workshop
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {workshops.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-12">
                No workshops found. Click &quot;Add Workshop&quot; to create one.
              </p>
            ) : (
              workshops.map((workshop) => (
                <div
                  key={workshop.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white">
                          {workshop.title}
                        </h3>
                        {workshop.published && (
                          <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                            Published
                          </span>
                        )}
                      </div>
                      {workshop.dates && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {workshop.dates}
                        </p>
                      )}
                      {workshop.location && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {workshop.location}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleEdit(workshop)}
                        className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors w-full sm:w-auto"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(workshop.id)}
                        className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors w-full sm:w-auto"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 lg:p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {editingWorkshop ? 'Edit Workshop' : 'Add Workshop'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Dates
                    </label>
                    <input
                      type="text"
                      value={formData.dates}
                      onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="February 17 – 27, 2026"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Ma Yu Farm, Chiang Dao, Thailand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Overview
                  </label>
                  <textarea
                    value={formData.overview}
                    onChange={(e) => setFormData({ ...formData, overview: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tagline
                  </label>
                  <textarea
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Objectives
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <input
                      type="text"
                      value={newObjective}
                      onChange={(e) => setNewObjective(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addObjective())}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Add objective"
                    />
                    <button
                      type="button"
                      onClick={addObjective}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-1">
                    {formData.objectives?.map((obj, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded">
                        <span className="text-sm text-gray-900 dark:text-white">{obj}</span>
                        <button
                          type="button"
                          onClick={() => removeObjective(idx)}
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
                    Program Outline
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={newProgramDate}
                      onChange={(e) => setNewProgramDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Date (e.g., Feb 17)"
                    />
                    <input
                      type="text"
                      value={newProgramActivity}
                      onChange={(e) => setNewProgramActivity(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProgramDay())}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Activity"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addProgramDay}
                    className="mb-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
                  >
                    Add Program Day
                  </button>
                  <div className="space-y-1">
                    {formData.program?.map((day, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded">
                        <span className="text-sm text-gray-900 dark:text-white">
                          <strong>{day.date}:</strong> {day.activity}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeProgramDay(idx)}
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
                    Daily Rhythm
                  </label>
                  <input
                    type="text"
                    value={formData.dailyRhythm}
                    onChange={(e) => setFormData({ ...formData, dailyRhythm: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="Daily rhythm: breakfast around the fire, mindful breaks, evening gatherings."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Accommodation Options
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <input
                      type="text"
                      value={newAccommodation}
                      onChange={(e) => setNewAccommodation(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAccommodation())}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Add accommodation option"
                    />
                    <button
                      type="button"
                      onClick={addAccommodation}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-1">
                    {formData.accommodation?.map((acc, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded">
                        <span className="text-sm text-gray-900 dark:text-white">{acc}</span>
                        <button
                          type="button"
                          onClick={() => removeAccommodation(idx)}
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
                    Meals
                  </label>
                  <textarea
                    value={formData.meals}
                    onChange={(e) => setFormData({ ...formData, meals: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Volunteer Pathway
                  </label>
                  <textarea
                    value={formData.volunteerPathway}
                    onChange={(e) => setFormData({ ...formData, volunteerPathway: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Facilitators & Partners
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <input
                      type="text"
                      value={newFacilitator}
                      onChange={(e) => setNewFacilitator(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFacilitator())}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Add facilitator/partner"
                    />
                    <button
                      type="button"
                      onClick={addFacilitator}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-1">
                    {formData.facilitators?.map((fac, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded">
                        <span className="text-sm text-gray-900 dark:text-white">{fac}</span>
                        <button
                          type="button"
                          onClick={() => removeFacilitator(idx)}
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
                    Story
                  </label>
                  <textarea
                    value={formData.story}
                    onChange={(e) => setFormData({ ...formData, story: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-2"
                    disabled={!formData.title || (formData.imageUrls?.length || 0) >= 10}
                  />
                  {!formData.title && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
                      Please enter workshop title first before uploading images
                    </p>
                  )}
                  {(formData.imageUrls?.length || 0) >= 10 && (
                    <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                      Maximum 10 images reached
                    </p>
                  )}
                  {formData.imageUrls && formData.imageUrls.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                      {formData.imageUrls.map((url, idx) => (
                        <div key={idx} className="relative">
                          <Image
                            src={url}
                            alt={`Workshop image ${idx + 1}`}
                            width={200}
                            height={128}
                            className="w-full h-32 object-cover rounded border border-gray-300 dark:border-gray-600"
                            unoptimized
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

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
                      className="w-full sm:w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingWorkshop(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                  >
                    {editingWorkshop ? 'Update' : 'Create'} Workshop
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

