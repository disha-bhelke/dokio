import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Plus,
  Menu,
  X,
  UploadCloud,
  Camera as CameraIcon,
  FolderOpen,
  FileText,
  Edit,
  Trash2,
} from 'lucide-react';
import api from '../services/api';
import DocumentCard from '../components/DocumentCard';
import CameraCapture from '../components/CameraCapture';
import './Dashboard.css';

const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#22c55e', // green
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#a855f7', // purple
];

const Dashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isDesktopCameraBlockedOpen, setIsDesktopCameraBlockedOpen] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [isCameraReviewOpen, setIsCameraReviewOpen] = useState(false);
  const [cameraReviewTagId, setCameraReviewTagId] = useState('');
  const [cameraReviewOriginalFile, setCameraReviewOriginalFile] = useState(null);
  const [cameraReviewOriginalData, setCameraReviewOriginalData] = useState(null);
  const [cameraReviewScannedData, setCameraReviewScannedData] = useState(null);
  const [isPreparingCameraReview, setIsPreparingCameraReview] = useState(false);

  const [isPickTagForUploadOpen, setIsPickTagForUploadOpen] = useState(false);
  const [pickTagForAction, setPickTagForAction] = useState(null); // 'file' | 'camera'
  const [pickedTagId, setPickedTagId] = useState('');
  const [pendingUploadTagId, setPendingUploadTagId] = useState('');
  const [pendingCameraTagId, setPendingCameraTagId] = useState('');

  const [isRenameDocOpen, setIsRenameDocOpen] = useState(false);
  const [docToRename, setDocToRename] = useState(null);
  const [renameDocName, setRenameDocName] = useState('');
  const [renameDocTagId, setRenameDocTagId] = useState('');
  const [isRenamingDoc, setIsRenamingDoc] = useState(false);

  const [isDeleteDocOpen, setIsDeleteDocOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  const [isEditTagOpen, setIsEditTagOpen] = useState(false);
  const [editTagId, setEditTagId] = useState(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState(TAG_COLORS[0]);
  const [isUpdatingTag, setIsUpdatingTag] = useState(false);

  const [isDeleteTagOpen, setIsDeleteTagOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);
  const [isDeletingTag, setIsDeletingTag] = useState(false);

  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [docsRes, tagsRes] = await Promise.all([api.get('/documents'), api.get('/tags')]);
      setDocuments(docsRes.data);
      setTags(tagsRes.data);

      // Keep selectedTag in sync with latest tag list
      setSelectedTag((prev) => {
        if (!prev?._id) return prev;
        const updated = tagsRes.data.find((t) => t._id === prev._id);
        return updated || null;
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMobileMenuOpen]);

  const filteredDocs = useMemo(() => {
    if (!selectedTag) return documents;
    return documents.filter((doc) => doc.tags?.some((t) => t._id === selectedTag._id));
  }, [documents, selectedTag]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const uploadFile = async (file, tagId) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('name', file.name || 'Captured Document');
    if (tagId) formData.append('tags', JSON.stringify([tagId]));

    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchData();
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const applyScanFilter = (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const contrast = 1.5;
      const intercept = 128 * (1 - contrast);
      const color = avg * contrast + intercept;

      const finalColor = color > 255 ? 255 : (color < 0 ? 0 : color);

      data[i] = finalColor;
      data[i + 1] = finalColor;
      data[i + 2] = finalColor;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const prepareReviewFromFile = async (file) => {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = objectUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const original = canvas.toDataURL('image/jpeg', 0.9);

      const formData = new FormData();
      formData.append('image', file);
      formData.append('blackAndWhite', 'false');

      const response = await api.post('/documents/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const scanned = response.data?.previewDataUrl || original;

      return { original, scanned };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    const tagId = pendingUploadTagId;
    setPendingUploadTagId('');
    event.target.value = '';
    if (!file) return;
    await uploadFile(file, tagId);
  };

  const handleCameraCapture = async (file) => {
    setIsCameraOpen(false);
    const tagId = pendingCameraTagId;
    setPendingCameraTagId('');
    await uploadFile(file, tagId);
  };

  const handleCameraFileUpload = async (event) => {
    const file = event.target.files?.[0];
    const tagId = pendingCameraTagId;
    setPendingCameraTagId('');
    event.target.value = '';
    if (!file) return;

    setIsPreparingCameraReview(true);
    try {
      const { original, scanned } = await prepareReviewFromFile(file);
      setCameraReviewOriginalFile(file);
      setCameraReviewTagId(tagId);
      setCameraReviewOriginalData(original);
      setCameraReviewScannedData(scanned);
      setIsCameraReviewOpen(true);
    } catch (error) {
      console.error('Failed to prepare camera review:', error);
      alert('Could not process this photo.');
    } finally {
      setIsPreparingCameraReview(false);
    }
  };

  const closeCameraReview = () => {
    setIsCameraReviewOpen(false);
    setCameraReviewTagId('');
    setCameraReviewOriginalFile(null);
    setCameraReviewOriginalData(null);
    setCameraReviewScannedData(null);
  };

  const handleSaveCameraReviewOriginal = async () => {
    if (!cameraReviewOriginalFile) return;
    await uploadFile(cameraReviewOriginalFile, cameraReviewTagId);
    closeCameraReview();
  };

  const handleSaveCameraReviewScanned = async () => {
    if (!cameraReviewScannedData) return;
    const res = await fetch(cameraReviewScannedData);
    const blob = await res.blob();
    const file = new File([blob], 'capture-scanned.jpg', { type: 'image/jpeg' });
    await uploadFile(file, cameraReviewTagId);
    closeCameraReview();
  };

  const handleDeleteDocument = async (id) => {
    const doc = documents.find((d) => d._id === id) || null;
    setDocToDelete(doc || { _id: id, name: 'this document' });
    setIsDeleteDocOpen(true);
  };

  const handleEditDocument = async (doc) => {
    if (!doc?._id) return;
    setDocToRename(doc);
    setRenameDocName(doc?.name || '');
    setRenameDocTagId(doc?.tags?.[0]?._id || '');
    setIsRenameDocOpen(true);
  };

  const handleConfirmRenameDocument = async () => {
    if (!docToRename?._id) return;

    const trimmed = String(renameDocName).trim();
    if (!trimmed) {
      alert('Name cannot be empty');
      return;
    }

    setIsRenamingDoc(true);
    try {
      await api.put(`/documents/${docToRename._id}`,
        {
          name: trimmed,
          tags: renameDocTagId ? [renameDocTagId] : [],
        }
      );
      setIsRenameDocOpen(false);
      setDocToRename(null);
      fetchData();
    } catch (error) {
      console.error('Error updating document:', error);
      alert(error.response?.data?.message || 'Failed to rename document');
    } finally {
      setIsRenamingDoc(false);
    }
  };

  const handleConfirmDeleteDocument = async () => {
    if (!docToDelete?._id) return;

    setIsDeletingDoc(true);
    try {
      await api.delete(`/documents/${docToDelete._id}`);
      setIsDeleteDocOpen(false);
      setDocToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
      alert(error.response?.data?.message || 'Failed to delete document');
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const isMobileDevice = () => {
    try {
      const ua = navigator.userAgent || '';
      const isPhoneOrTabletUA = /Android|iPhone|iPad|iPod/i.test(ua);
      const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const hasTouch = typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 0;
      return isPhoneOrTabletUA || (isCoarsePointer && hasTouch);
    } catch {
      return false;
    }
  };

  const openPickTagModal = (action) => {
    // if (action === 'camera' && !isMobileDevice()) {
    //   setIsDesktopCameraBlockedOpen(true);
    //   return;
    // }
    setPickTagForAction(action);
    setPickedTagId(selectedTag?._id || '');
    setIsPickTagForUploadOpen(true);
  };

  const runAfterCloseMobileMenu = (action) => {
    setIsMobileMenuOpen(false);
    window.setTimeout(action, 0);
  };

  const handleConfirmPickedTag = () => {
    if (pickTagForAction === 'file') {
      setPendingUploadTagId(pickedTagId);
      setIsPickTagForUploadOpen(false);
      setPickTagForAction(null);
      if (fileInputRef.current) fileInputRef.current.click();
      return;
    }

    if (pickTagForAction === 'camera') {
      setPendingCameraTagId(pickedTagId);
      setIsPickTagForUploadOpen(false);
      setPickTagForAction(null);
      const canUseGetUserMedia =
        Boolean(window.isSecureContext) &&
        Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');

      if (canUseGetUserMedia) {
        setIsCameraOpen(true);
      } else {
        if (cameraInputRef.current) cameraInputRef.current.click();
        else alert('Camera is not supported on this device/browser.');
      }
    }
  };

  // Tag modals
  const handleCreateTag = () => {
    setNewTagName('');
    setNewTagColor(TAG_COLORS[0]);
    setIsCreateTagOpen(true);
  };

  const handleConfirmCreateTag = async () => {
    const trimmed = String(newTagName).trim();
    if (!trimmed) {
      alert('Tag name is required');
      return;
    }

    setIsCreatingTag(true);
    try {
      await api.post('/tags', { name: trimmed, color: newTagColor });
      setIsCreateTagOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error creating tag:', error);
      alert(error.response?.data?.message || 'Failed to create tag');
    } finally {
      setIsCreatingTag(false);
    }
  };

  const openEditTagModal = (tag) => {
    if (!tag?._id) return;
    setEditTagId(tag._id);
    setEditTagName(tag.name || '');
    setEditTagColor(tag.color || TAG_COLORS[0]);
    setIsEditTagOpen(true);
  };

  const handleConfirmEditTag = async () => {
    const trimmed = String(editTagName).trim();
    if (!trimmed) {
      alert('Tag name is required');
      return;
    }

    setIsUpdatingTag(true);
    try {
      await api.put(`/tags/${editTagId}`, { name: trimmed, color: editTagColor });
      setIsEditTagOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating tag:', error);
      alert(error.response?.data?.message || 'Failed to update tag');
    } finally {
      setIsUpdatingTag(false);
    }
  };

  const openDeleteTagModal = (tag) => {
    if (!tag?._id) return;
    setTagToDelete(tag);
    setIsDeleteTagOpen(true);
  };

  const handleConfirmDeleteTag = async () => {
    if (!tagToDelete?._id) return;

    setIsDeletingTag(true);
    try {
      await api.delete(`/tags/${tagToDelete._id}`);
      if (selectedTag?._id === tagToDelete._id) setSelectedTag(null);
      setIsDeleteTagOpen(false);
      setTagToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting tag:', error);
      alert(error.response?.data?.message || 'Failed to delete tag');
    } finally {
      setIsDeletingTag(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Main Content */}
      <main className="dashboard-content">
        <header className="content-header">
          <div className="content-header-top">
            <h2>{selectedTag ? selectedTag.name : 'All Documents'}</h2>
            <button
              type="button"
              className="icon-btn mobile-menu-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={"1.25rem"} />
            </button>
          </div>

          <div className="header-actions">
            <button type="button" className="nav-btn" onClick={handleCreateTag}>
              Create Tag
            </button>
            <button type="button" className="nav-btn" onClick={() => navigate('/pdf')}>
              Create PDF
            </button>

            <div className="upload-group">
              <button className="action-btn upload-btn" type="button" onClick={() => openPickTagModal('file')}>
                <UploadCloud size={"1.2rem"} /> Upload
              </button>
              <button className="action-btn camera-btn" type="button" onClick={() => openPickTagModal('camera')}>
                <CameraIcon size={"1.2rem"} /> Camera
              </button>
              <button type="button" className="action-btn logout-inline-btn" onClick={handleLogout}>
                <LogOut size={"1.2rem"} /> Logout
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} hidden />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCameraFileUpload}
                hidden
              />
            </div>
          </div>
        </header>

        <div className="tag-filters" aria-label="Tag filters">
          <button
            type="button"
            className={`tag-chip ${!selectedTag ? 'active' : ''}`}
            onClick={() => setSelectedTag(null)}
          >
            <span className="tag-chip-dot" style={{ backgroundColor: 'var(--muted-ink)' }} />
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag._id}
              type="button"
              className={`tag-chip ${selectedTag?._id === tag._id ? 'active' : ''}`}
              onClick={() => setSelectedTag(tag)}
              title={tag.name}
            >
              <span className="tag-chip-dot" style={{ backgroundColor: tag.color || 'var(--muted-ink)' }} />
              <span className="tag-chip-label">{tag.name}</span>
            </button>
          ))}
        </div>

        {selectedTag && (
          <div className="tag-actions-below">
            <div className="tag-page-actions">
              <button className="tag-action-btn" onClick={() => openEditTagModal(selectedTag)}>
                <Edit size={"1.1rem"} /> Edit Tag
              </button>
              <button className="tag-action-btn danger" onClick={() => openDeleteTagModal(selectedTag)}>
                <Trash2 size={"1.1rem"} /> Delete Tag
              </button>
            </div>
          </div>
        )}

        {isUploading && <div className="loading-state">Uploading...</div>}
        {isPreparingCameraReview && <div className="loading-state">Preparing scan preview...</div>}

        <div className="documents-grid">
          {filteredDocs.map((doc) => (
            <DocumentCard key={doc._id} document={doc} onDelete={handleDeleteDocument} onEdit={handleEditDocument} />
          ))}

          {filteredDocs.length === 0 && !isUploading && (
            <div className="empty-state">
              <FolderOpen size={"3rem"} color="#cbd5e1" />
              <p>No documents found.</p>
            </div>
          )}
        </div>
      </main>

      {isCameraOpen && <CameraCapture onClose={() => setIsCameraOpen(false)} onCapture={handleCameraCapture} />}

      {/* Mobile hamburger menu */}
      {isMobileMenuOpen && (
        <div className="tag-modal-overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="tag-modal mobile-menu-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <h3>Menu</h3>
              <button type="button" className="icon-btn" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu">
                <X size={"1.2rem"} />
              </button>
            </div>

            <div className="mobile-menu-actions">
              <button
                type="button"
                className="mobile-menu-item"
                onClick={() => runAfterCloseMobileMenu(() => navigate('/pdf'))}
              >
                <FileText size={"1.1rem"} /> Create PDF
              </button>
              <button
                type="button"
                className="mobile-menu-item"
                onClick={() => runAfterCloseMobileMenu(() => openPickTagModal('file'))}
              >
                <UploadCloud size={"1.1rem"} /> Upload
              </button>
              <button
                type="button"
                className="mobile-menu-item"
                onClick={() => runAfterCloseMobileMenu(() => openPickTagModal('camera'))}
              >
                <CameraIcon size={"1.1rem"} /> Camera
              </button>
              <button
                type="button"
                className="mobile-menu-item"
                onClick={() => runAfterCloseMobileMenu(() => handleCreateTag())}
              >
                <Plus size={"1.1rem"} /> Create Tag
              </button>
              <button
                type="button"
                className="mobile-menu-item danger"
                onClick={() => runAfterCloseMobileMenu(() => handleLogout())}
              >
                <LogOut size={"1.1rem"} /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Tag Modal */}
      {isCreateTagOpen && (
        <div className="tag-modal-overlay">
          <div className="tag-modal">
            <h3>Create Tag</h3>

            <div className="tag-modal-field">
              <label htmlFor="tagName">Tag name</label>
              <input
                id="tagName"
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter tag name"
                disabled={isCreatingTag}
              />
            </div>

            <div className="tag-modal-field">
              <label>Color</label>
              <div className="tag-color-grid">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`tag-color-swatch ${newTagColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                    disabled={isCreatingTag}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="tag-modal-actions">
              <button
                type="button"
                className="tag-modal-btn secondary"
                onClick={() => setIsCreateTagOpen(false)}
                disabled={isCreatingTag}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tag-modal-btn primary"
                onClick={handleConfirmCreateTag}
                disabled={isCreatingTag}
              >
                {isCreatingTag ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {isEditTagOpen && (
        <div className="tag-modal-overlay">
          <div className="tag-modal">
            <h3>Edit Tag</h3>

            <div className="tag-modal-field">
              <label htmlFor="editTagName">Tag name</label>
              <input
                id="editTagName"
                type="text"
                value={editTagName}
                onChange={(e) => setEditTagName(e.target.value)}
                placeholder="Enter tag name"
                disabled={isUpdatingTag}
              />
            </div>

            <div className="tag-modal-field">
              <label>Color</label>
              <div className="tag-color-grid">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`tag-color-swatch ${editTagColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setEditTagColor(color)}
                    disabled={isUpdatingTag}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            <div className="tag-modal-actions">
              <button
                type="button"
                className="tag-modal-btn secondary"
                onClick={() => setIsEditTagOpen(false)}
                disabled={isUpdatingTag}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tag-modal-btn primary"
                onClick={handleConfirmEditTag}
                disabled={isUpdatingTag}
              >
                {isUpdatingTag ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tag Confirm Modal */}
      {isDeleteTagOpen && (
        <div className="tag-modal-overlay">
          <div className="tag-modal">
            <h3>Delete Tag</h3>
            <p className="tag-modal-text">
              Are you sure you want to delete <strong>{tagToDelete?.name || 'this tag'}</strong>?
            </p>

            <div className="tag-modal-actions">
              <button
                type="button"
                className="tag-modal-btn secondary"
                onClick={() => {
                  setIsDeleteTagOpen(false);
                  setTagToDelete(null);
                }}
                disabled={isDeletingTag}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tag-modal-btn primary"
                onClick={handleConfirmDeleteTag}
                disabled={isDeletingTag}
              >
                {isDeletingTag ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Document Modal */}
      {isRenameDocOpen && (
        <div className="tag-modal-overlay">
          <div className="tag-modal">
            <h3>Rename Document</h3>

            <div className="tag-modal-field">
              <label htmlFor="renameDocName">Document name</label>
              <input
                id="renameDocName"
                type="text"
                value={renameDocName}
                onChange={(e) => setRenameDocName(e.target.value)}
                placeholder="Enter document name"
                disabled={isRenamingDoc}
              />
            </div>

            <div className="tag-modal-field">
              <label htmlFor="renameDocTag">Tag</label>
              <select
                id="renameDocTag"
                value={renameDocTagId}
                onChange={(e) => setRenameDocTagId(e.target.value)}
                disabled={isRenamingDoc}
              >
                <option value="">No tag</option>
                {tags.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="tag-modal-actions">
              <button
                type="button"
                className="tag-modal-btn secondary"
                onClick={() => {
                  setIsRenameDocOpen(false);
                  setDocToRename(null);
                }}
                disabled={isRenamingDoc}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tag-modal-btn primary"
                onClick={handleConfirmRenameDocument}
                disabled={isRenamingDoc}
              >
                {isRenamingDoc ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pick tag before Upload/Camera (optional) */}
      {isPickTagForUploadOpen && (
        <div className="tag-modal-overlay">
          <div className="tag-modal">
            <h3>Add to tag? (optional)</h3>
            <p className="tag-modal-text">You can choose a tag or continue with no tag.</p>

            <div className="tag-modal-field">
              <label htmlFor="pickedTag">Tag</label>
              <select
                id="pickedTag"
                value={pickedTagId}
                onChange={(e) => setPickedTagId(e.target.value)}
              >
                <option value="">No tag</option>
                {tags.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="tag-modal-actions">
              <button
                type="button"
                className="tag-modal-btn secondary"
                onClick={() => {
                  setIsPickTagForUploadOpen(false);
                  setPickTagForAction(null);
                }}
              >
                Cancel
              </button>
              <button type="button" className="tag-modal-btn primary" onClick={handleConfirmPickedTag}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Document Confirm Modal */}
      {isDeleteDocOpen && (
        <div className="tag-modal-overlay">
          <div className="tag-modal">
            <h3>Delete Document</h3>
            <p className="tag-modal-text">
              Are you sure you want to delete <strong>{docToDelete?.name || 'this document'}</strong>?
            </p>

            <div className="tag-modal-actions">
              <button
                type="button"
                className="tag-modal-btn secondary"
                onClick={() => {
                  setIsDeleteDocOpen(false);
                  setDocToDelete(null);
                }}
                disabled={isDeletingDoc}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tag-modal-btn primary"
                onClick={handleConfirmDeleteDocument}
                disabled={isDeletingDoc}
              >
                {isDeletingDoc ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phone camera fallback review modal */}
      {isCameraReviewOpen && (
        <div className="tag-modal-overlay">
          <div className="tag-modal">
            <h3>Choose version to save</h3>
            <p className="tag-modal-text">Preview the original photo and the scanned (B/W) version.</p>

            <div className="doc-preview-grid">
              <div className="doc-preview">
                <div className="doc-preview-label">Original</div>
                <img className="doc-preview-img" src={cameraReviewOriginalData} alt="Original preview" />
              </div>
              <div className="doc-preview">
                <div className="doc-preview-label">Scanned (B/W)</div>
                <img className="doc-preview-img" src={cameraReviewScannedData} alt="Scanned preview" />
              </div>
            </div>

            <div className="tag-modal-actions">
              <button
                type="button"
                className="tag-modal-btn secondary"
                onClick={() => {
                  closeCameraReview();
                  if (cameraInputRef.current) cameraInputRef.current.click();
                }}
                disabled={isUploading}
              >
                Retake
              </button>
              <button type="button" className="tag-modal-btn secondary" onClick={closeCameraReview} disabled={isUploading}>
                Cancel
              </button>
              <button type="button" className="tag-modal-btn secondary" onClick={handleSaveCameraReviewOriginal} disabled={isUploading}>
                Save Original
              </button>
              <button type="button" className="tag-modal-btn primary" onClick={handleSaveCameraReviewScanned} disabled={isUploading}>
                Save Scanned
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop camera blocked modal */}
      {isDesktopCameraBlockedOpen && (
        <div className="tag-modal-overlay">
          <div className="tag-modal">
            <h3>Camera not available on desktop</h3>
            <p className="tag-modal-text">Camera capture is only allowed on mobile devices.</p>
            <div className="tag-modal-actions">
              <button
                type="button"
                className="tag-modal-btn primary"
                onClick={() => setIsDesktopCameraBlockedOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
