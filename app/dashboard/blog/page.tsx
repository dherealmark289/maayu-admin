'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import DashboardLayout from '@/components/DashboardLayout';

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  author?: string;
  category?: string;
  tags?: string[];
  published: boolean;
  publishedAt?: string;
  views?: number;
  seoTitle?: string;
  seoDescription?: string;
  createdAt?: string;
}

export default function BlogPage() {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const featuredImageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    featuredImage: '',
    author: '',
    category: '',
    tags: '' as string, // Comma-separated string for input
    published: false,
    seoTitle: '',
    seoDescription: '',
  });

  useEffect(() => {
    fetchBlogPosts();
  }, []);

  const fetchBlogPosts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch('/api/blog', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch blog posts');
      }

      const data = await response.json();
      setBlogPosts(data.blogPosts || []);
      setError('');
    } catch (err: any) {
      console.error('Error fetching blog posts:', err);
      setError(err.message || 'Failed to fetch blog posts');
    } finally {
      setLoading(false);
    }
  };

  const handleFeaturedImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setUploadingImage(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      // Upload to S3 via media API
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('category', 'images');

      const response = await fetch('/api/media', {
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
      setFormData((prev) => ({ ...prev, featuredImage: data.media.url }));
      setError('');
    } catch (err: any) {
      console.error('Error uploading image:', err);
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      if (featuredImageInputRef.current) {
        featuredImageInputRef.current.value = '';
      }
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

      // Parse tags from comma-separated string
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const method = editingPost ? 'PUT' : 'POST';
      const body = editingPost
        ? {
            id: editingPost.id,
            title: formData.title,
            slug: formData.slug || undefined,
            excerpt: formData.excerpt || undefined,
            content: formData.content,
            featuredImage: formData.featuredImage || undefined,
            author: formData.author || undefined,
            category: formData.category || undefined,
            tags: tagsArray,
            published: formData.published,
            seoTitle: formData.seoTitle || undefined,
            seoDescription: formData.seoDescription || undefined,
          }
        : {
            title: formData.title,
            slug: formData.slug || undefined,
            excerpt: formData.excerpt || undefined,
            content: formData.content,
            featuredImage: formData.featuredImage || undefined,
            author: formData.author || undefined,
            category: formData.category || undefined,
            tags: tagsArray,
            published: formData.published,
            seoTitle: formData.seoTitle || undefined,
            seoDescription: formData.seoDescription || undefined,
          };

      const response = await fetch('/api/blog', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save blog post');
      }

      await fetchBlogPosts();
      setShowForm(false);
      setEditingPost(null);
      resetForm();
      setError('');
    } catch (err: any) {
      console.error('Error saving blog post:', err);
      setError(err.message || 'Failed to save blog post');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      featuredImage: '',
      author: '',
      category: '',
      tags: '',
      published: false,
      seoTitle: '',
      seoDescription: '',
    });
    if (featuredImageInputRef.current) {
      featuredImageInputRef.current.value = '';
    }
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title || '',
      slug: post.slug || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      featuredImage: post.featuredImage || '',
      author: post.author || '',
      category: post.category || '',
      tags: post.tags?.join(', ') || '',
      published: post.published !== undefined ? post.published : false,
      seoTitle: post.seoTitle || '',
      seoDescription: post.seoDescription || '',
    });
    setShowForm(true);
  };

  const handleDelete = (id: string, title: string) => {
    setConfirmDelete({ id, title });
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;

    setDeletingId(confirmDelete.id);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`/api/blog?id=${confirmDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete blog post');
      }

      await fetchBlogPosts();
      setConfirmDelete(null);
      setDeletingId(null);
      setError('');
    } catch (err: any) {
      console.error('Error deleting blog post:', err);
      setError(err.message || 'Failed to delete blog post');
      setDeletingId(null);
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingPost(null);
    resetForm();
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's a Word document
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(doc|docx)$/i)) {
      setError('Please select a Word document (.doc or .docx)');
      return;
    }

    setUploadingDocument(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      // Upload Word document and convert to HTML
      const uploadFormData = new FormData();
      uploadFormData.append('document', file);
      
      // If editing existing post, include blogPostId so images are linked
      if (editingPost?.id) {
        uploadFormData.append('blogPostId', editingPost.id);
      }

      const response = await fetch('/api/blog/upload-document', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: uploadFormData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload document');
      }

      const data = await response.json();
      
      // Set the converted HTML content
      setFormData((prev) => ({ ...prev, content: data.html }));
      
      if (data.warnings && data.warnings.length > 0) {
        console.warn('Document conversion warnings:', data.warnings);
      }
      
      setError('');
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploadingDocument(false);
      if (documentInputRef.current) {
        documentInputRef.current.value = '';
      }
    }
  };

  // Image handler for rich text editor - insert image URL into editor
  const imageHandler = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Not authenticated');
          return;
        }

        // Upload to S3 via media API
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);
        uploadFormData.append('category', 'images');

        const response = await fetch('/api/media', {
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
        const url = data.media.url;

        // Insert image into editor (Quill will handle this automatically via toolbar)
        // We need to manually insert it since we're using custom handler
        const quill = (window as any).quillEditor;
        if (quill) {
          const range = quill.getSelection();
          quill.insertEmbed(range.index, 'image', url);
        }
      } catch (err: any) {
        console.error('Error uploading image:', err);
        setError(err.message || 'Failed to upload image');
      }
    };
  };

  const quillModules = {
    toolbar: {
      container: [
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ align: [] }],
        ['link', 'image'],
        ['clean'],
      ],
      handlers: {
        image: imageHandler,
      },
    },
    clipboard: {
      matchVisual: false,
    },
  };

  const quillFormats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'align',
    'link',
    'image',
  ];

  return (
    <DashboardLayout>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Blog Posts</h1>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Add Blog Post
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
              {editingPost ? 'Edit Blog Post' : 'Add Blog Post'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Slug (URL-friendly, auto-generated from title if empty)
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="my-blog-post"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Author
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
                    placeholder="e.g., News, Guides, Stories"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="tag1, tag2, tag3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Excerpt (Short summary for preview)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    placeholder="Brief description of the blog post..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Featured Image
                  </label>
                  <input
                    ref={featuredImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFeaturedImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => featuredImageInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 mb-3"
                  >
                    {uploadingImage ? 'Uploading...' : 'Upload Featured Image'}
                  </button>
                  {formData.featuredImage && (
                    <div className="mt-3">
                      <Image
                        src={formData.featuredImage}
                        alt="Featured"
                        width={400}
                        height={192}
                        className="w-full max-w-md h-48 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, featuredImage: '' })}
                        className="mt-2 px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
                      >
                        Remove Image
                      </button>
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Content *
                  </label>
                  <div className="mb-3 flex items-center space-x-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Or upload Word document:</span>
                    <input
                      ref={documentInputRef}
                      type="file"
                      accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleDocumentUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => documentInputRef.current?.click()}
                      disabled={uploadingDocument}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {uploadingDocument ? 'Converting...' : 'Upload Word Doc (.docx)'}
                    </button>
                    {uploadingDocument && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Converting document and extracting images...
                      </span>
                    )}
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
                    {typeof window !== 'undefined' && (
                      <ReactQuill
                        theme="snow"
                        value={formData.content}
                        onChange={(value) => {
                          setFormData({ ...formData, content: value });
                          // Store quill instance for image handler
                          (window as any).quillEditor = (document.querySelector('.ql-editor') as any)?.parentElement?.querySelector('.ql-container')?.__quill;
                        }}
                        modules={quillModules}
                        formats={quillFormats}
                        placeholder="Write your blog post content here or upload a Word document above..."
                        className="min-h-[300px]"
                      />
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    💡 Tip: Upload a Word document (.docx) and it will convert to HTML with images automatically extracted and uploaded to S3. All images will be linked to this blog post.
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SEO Title
                  </label>
                  <input
                    type="text"
                    value={formData.seoTitle}
                    onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                    placeholder="SEO-friendly title for search engines"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SEO Description
                  </label>
                  <textarea
                    rows={2}
                    value={formData.seoDescription}
                    onChange={(e) => setFormData({ ...formData, seoDescription: e.target.value })}
                    placeholder="SEO-friendly description for search engines"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.published}
                      onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Published</span>
                  </label>
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
                  {editingPost ? 'Update' : 'Create'}
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
            {blogPosts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No blog posts found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {blogPosts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">{post.title}</h3>
                          {post.published ? (
                            <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Published
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                              Draft
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          Slug: <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">{post.slug}</code>
                        </p>
                        {post.excerpt && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                            {post.excerpt}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                          {post.author && <span>By: {post.author}</span>}
                          {post.category && <span>Category: {post.category}</span>}
                          {post.tags && post.tags.length > 0 && (
                            <span>Tags: {post.tags.join(', ')}</span>
                          )}
                          {post.publishedAt && (
                            <span>Published: {new Date(post.publishedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleEdit(post)}
                          className="px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(post.id, post.title)}
                          disabled={deletingId === post.id}
                          className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                        >
                          {deletingId === post.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Total blog posts: {blogPosts.length}
            </div>
          </>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Confirm Delete</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <strong>{confirmDelete.title}</strong>? This action cannot be undone.
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

