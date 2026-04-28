import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, GripVertical, CheckSquare, Square } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../services/api';
import './PdfGeneration.css';

const SortableItem = ({ id, document, isSelected, toggleSelection }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`sortable-item ${isSelected ? 'selected' : ''}`}>
      <div className="drag-handle" {...attributes} {...listeners}>
        <GripVertical color="#94a3b8" />
      </div>
      <div className="select-box" onClick={() => toggleSelection(id)}>
        {isSelected ? <CheckSquare color="var(--primary-color)" /> : <Square color="#94a3b8" />}
      </div>
      <img src={document.fileUrl} alt={document.name} className="pdf-doc-thumb" />
      <span className="pdf-doc-name">{document.name}</span>
    </div>
  );
};

const PdfGeneration = () => {
  const [documents, setDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data } = await api.get('/documents');
      setDocuments(data);
    } catch (error) {
      console.error('Failed to fetch documents', error);
    }
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setDocuments((items) => {
        const oldIndex = items.findIndex(i => i._id === active.id);
        const newIndex = items.findIndex(i => i._id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const generatePDF = async () => {
    if (selectedIds.length === 0) return alert('Select at least one document');
    
    const orderedSelectedIds = documents
      .filter(doc => selectedIds.includes(doc._id))
      .map(doc => doc._id);

    setIsGenerating(true);
    try {
      const response = await api.post('/pdf/generate', { documentIds: orderedSelectedIds }, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'dokioki_documents.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="pdf-layout">
      <header className="pdf-header">
        <div className="header-left">
          <button className="icon-btn back-btn" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={"1.5rem"} />
          </button>
          <h2>Create PDF</h2>
        </div>
        <button 
          className="generate-btn" 
          onClick={generatePDF} 
          disabled={isGenerating || selectedIds.length === 0}
        >
          <Download size={"1.2rem"} /> 
          {isGenerating ? 'Generating...' : `Download PDF (${selectedIds.length})`}
        </button>
      </header>

      <main className="pdf-content">
        <p className="pdf-instruction">Select documents and drag to reorder them for your PDF.</p>
        
        <div className="pdf-list-container">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={documents.map(d => d._id)} strategy={verticalListSortingStrategy}>
              {documents.map(doc => (
                <SortableItem 
                  key={doc._id} 
                  id={doc._id} 
                  document={doc} 
                  isSelected={selectedIds.includes(doc._id)}
                  toggleSelection={toggleSelection}
                />
              ))}
            </SortableContext>
          </DndContext>
          {documents.length === 0 && <p className="empty-msg">No documents available.</p>}
        </div>
      </main>
    </div>
  );
};

export default PdfGeneration;
