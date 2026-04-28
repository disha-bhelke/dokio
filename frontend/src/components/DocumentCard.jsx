import React from 'react';
import { Tag, Trash2, Edit, FileText } from 'lucide-react';
import './DocumentCard.css';

const DocumentCard = ({ document, onDelete, onEdit, onOpen }) => {
  const fileUrl = document?.fileUrl;
  const isPdf = typeof fileUrl === 'string' && fileUrl.toLowerCase().includes('.pdf');

  const handleOpen = () => {
    if (!fileUrl) return;
    if (typeof onOpen === 'function') return onOpen(document);
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="document-card">
      <div className="document-image-container" onClick={handleOpen} role="button" tabIndex={0}>
        {isPdf ? (
          <div className="document-file-placeholder" aria-label="PDF document">
            <FileText size={"3rem"} />
            <span>PDF</span>
          </div>
        ) : (
          <img src={document.fileUrl} alt={document.name} className="document-image" />
        )}
        <div className="document-tags">
          {document.tags?.map(tag => (
            <span key={tag._id} className="tag-badge" style={{ backgroundColor: tag.color }}>
              <Tag size={"0.8rem"} /> {tag.name}
            </span>
          ))}
        </div>
      </div>
      <div className="document-info">
        <h4 className="document-name" onClick={handleOpen}>{document.name}</h4>
        <div className="document-actions">
          <button
            className="icon-btn edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(document);
            }}
          >
            <Edit size={"1rem"} />
          </button>
          <button
            className="icon-btn delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(document._id);
            }}
          >
            <Trash2 size={"1rem"} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentCard;
