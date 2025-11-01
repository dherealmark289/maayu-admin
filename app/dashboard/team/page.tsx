'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import DashboardLayout from '@/components/DashboardLayout';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio?: string;
  group?: string;
  photoUrl?: string;
  order?: number;
  socialLinks?: any;
  skills?: Array<{ skill: { id: string; name: string }; level: number }>;
  createdAt?: string;
  updatedAt?: string;
}

interface TeamMemberSkill {
  skillId: string;
  skillName: string;
  level: number;
}

export default function TeamPage() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    bio: '',
    group: '',
    photoUrl: '',
    order: 0,
    skills: [] as TeamMemberSkill[],
  });

  const [newSkill, setNewSkill] = useState({
    skillName: '',
    level: 5,
  });

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/team', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch team members');
      }

      const data = await response.json();
      setTeamMembers(data.teamMembers || []);
      setError('');
    } catch (err: any) {
      console.error('Error fetching team members:', err);
      setError(err.message || 'Failed to load team members');
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

      const method = editingMember ? 'PUT' : 'POST';
      const body = editingMember
        ? { id: editingMember.id, ...formData }
        : formData;

      const response = await fetch('/api/team', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        const errorMsg = data.error || 'Failed to save team member';
        const details = data.details ? ` (${data.details})` : '';
        throw new Error(`${errorMsg}${details}`);
      }

      await fetchTeamMembers();
      setShowForm(false);
      setEditingMember(null);
      setFormData({ name: '', role: '', bio: '', group: '', photoUrl: '', order: 0, skills: [] });
      setNewSkill({ skillName: '', level: 5 });
      setError('');
    } catch (err: any) {
      console.error('Error saving team member:', err);
      setError(err.message || 'Failed to save team member');
    }
  };

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
    
    // Convert skills from API format to form format
    const skills: TeamMemberSkill[] = (member.skills && Array.isArray(member.skills)) 
      ? member.skills.map((s: any) => ({
          skillId: s.skill?.id || '',
          skillName: s.skill?.name || '',
          level: s.level || 5,
        }))
      : [];

    setFormData({
      name: member.name || '',
      role: member.role || '',
      bio: member.bio || '',
      group: member.group || '',
      photoUrl: member.photoUrl || '',
      order: member.order || 0,
      skills: skills,
    });
    setPhotoPreview(member.photoUrl || '');
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

      const response = await fetch(`/api/team?id=${confirmDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete team member');
      }

      await fetchTeamMembers();
      setConfirmDelete(null);
      setError('');
    } catch (err: any) {
      console.error('Error deleting team member:', err);
      setError(err.message || 'Failed to delete team member');
    } finally {
      setDeletingId(null);
    }
  };

  // Compress image using Canvas API (same as media page)
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

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setUploadingPhoto(true);
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

      // Preview image
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(fileToUpload);

      // Upload to S3 via team API
      const uploadFormData = new FormData();
      uploadFormData.append('photo', fileToUpload);
      // Pass teamMemberId if editing existing team member
      if (editingMember?.id) {
        uploadFormData.append('teamMemberId', editingMember.id);
      }

      const response = await fetch('/api/team/photo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: uploadFormData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload photo');
      }

      const data = await response.json();
      setFormData((prev) => ({ ...prev, photoUrl: data.url }));
      setError('');
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddSkill = () => {
    if (!newSkill.skillName.trim()) {
      setError('Skill name is required');
      return;
    }

    if (newSkill.level < 1 || newSkill.level > 10) {
      setError('Skill level must be between 1 and 10');
      return;
    }

    // Check if skill already exists in the list
    if (formData.skills && formData.skills.some(s => s.skillName.toLowerCase() === newSkill.skillName.trim().toLowerCase())) {
      setError('This skill is already added');
      return;
    }

    setFormData({
      ...formData,
      skills: [
        ...(formData.skills || []),
        {
          skillId: '', // Will be set by API if skill exists
          skillName: newSkill.skillName.trim(),
          level: newSkill.level,
        },
      ],
    });
    setNewSkill({ skillName: '', level: 5 });
    setError('');
  };

  const handleRemoveSkill = (index: number) => {
    setFormData({
      ...formData,
      skills: (formData.skills || []).filter((_, i) => i !== index),
    });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingMember(null);
    setFormData({ name: '', role: '', bio: '', group: '', photoUrl: '', order: 0, skills: [] });
    setPhotoPreview('');
    setNewSkill({ skillName: '', level: 5 });
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const groupByGroup = (members: TeamMember[]) => {
    const grouped: { [key: string]: TeamMember[] } = {};
    members.forEach((member) => {
      const group = member.group || 'Other';
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(member);
    });
    return grouped;
  };

  return (
    <DashboardLayout>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Members</h1>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Add Team Member
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
              {editingMember ? 'Edit Team Member' : 'Add Team Member'}
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
                    Role *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Group
                  </label>
                  <select
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Select Group</option>
                    <option value="Founders">Founders</option>
                    <option value="Core Team">Core Team</option>
                    <option value="Creative & Partners">Creative & Partners</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Photo
                  </label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                    </button>
                    {(photoPreview || formData.photoUrl) && (
                      <div className="relative">
                        <Image
                          src={photoPreview || formData.photoUrl}
                          alt="Preview"
                          width={400}
                          height={400}
                          className="w-24 h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                          unoptimized
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, photoUrl: '' });
                            setPhotoPreview('');
                            if (photoInputRef.current) {
                              photoInputRef.current.value = '';
                            }
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                  {formData.photoUrl && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Photo URL: {formData.photoUrl}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bio
                  </label>
                  <textarea
                    rows={4}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                
                {/* Skills Section */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Skills
                  </label>
                  
                  {/* Add Skill Input */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newSkill.skillName}
                      onChange={(e) => setNewSkill({ ...newSkill, skillName: e.target.value })}
                      placeholder="Skill name (e.g., foraging)"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                    />
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={newSkill.level}
                      onChange={(e) => setNewSkill({ ...newSkill, level: parseInt(e.target.value) || 5 })}
                      className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="1-10"
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium"
                    >
                      Add
                    </button>
                  </div>

                  {/* Skills List */}
                  {formData.skills && formData.skills.length > 0 && (
                    <div className="space-y-2">
                      {formData.skills.map((skill, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {skill.skillName}
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              Level: {skill.level}/10
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(index)}
                            className="px-2 py-1 text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
                  {editingMember ? 'Update' : 'Create'}
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
            {teamMembers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No team members found.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupByGroup(teamMembers)).map(([group, members]) => (
                  <div key={group}>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      {group}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                        >
                          {member.photoUrl && (
                            <Image
                              src={member.photoUrl}
                              alt={member.name}
                              width={400}
                              height={400}
                              unoptimized
                              className="w-full h-48 object-cover rounded-lg mb-3"
                            />
                          )}
                          <h4 className="font-semibold text-gray-900 dark:text-white">{member.name}</h4>
                          <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-2">{member.role}</p>
                          {member.bio && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-3">
                              {member.bio}
                            </p>
                          )}
                          {member.skills && member.skills.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Skills:</p>
                              <div className="flex flex-wrap gap-1">
                                {member.skills.map((skill: any, idx: number) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded"
                                  >
                                    {skill.skill?.name || skill.name}: {skill.level}/10
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(member)}
                              className="px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(member.id, member.name)}
                              disabled={deletingId === member.id}
                              className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                            >
                              {deletingId === member.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      ))}
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


