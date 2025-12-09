import React, { useState, useEffect, useMemo } from 'react';
import { Item, ItemType, Tag } from '../types';
import { X, Copy, Download, ExternalLink, Check, FileText, Image as ImageIcon, Video, Eye } from 'lucide-react';
import { getFileUrl } from '../services/db';
import { linkifyText } from '../utils/linkify';
import FilePreviewModal from './FilePreviewModal';
import { canPreview } from '../services/filePreviewService';

interface ItemModalProps {
  item: Item | null;
  tags: Tag[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateTags: (itemId: string, tagIds: string[]) => void;
}

const ItemModal: React.FC<ItemModalProps> = ({ item, tags, isOpen, onClose, onUpdateTags }) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);

  // Reset when item changes
  useEffect(() => {
    if (item) {
      setSelectedTags(item.tags);
      setHasChanges(false);
      setShowFilePreview(false);
    }
  }, [item?.id, item?.tags]);

  // Get file URL
  const fileUrl = useMemo(() => {
    if (item?.fileKey) {
      return getFileUrl(item.fileKey);
    }
    return null;
  }, [item?.fileKey]);

  const handleCopy = async () => {
    if (item && (item.type === ItemType.LINK || item.type === ItemType.TEXT)) {
      await navigator.clipboard.writeText(item.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (fileUrl && item) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = item.fileName || 'download';
      a.target = '_blank';
      a.click();
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => {
      const newTags = prev.includes(tagId) 
        ? prev.filter(t => t !== tagId) 
        : [...prev, tagId];
      setHasChanges(true);
      return newTags;
    });
  };

  const handleSaveTags = () => {
    if (item) {
      onUpdateTags(item.id, selectedTags);
      setHasChanges(false);
    }
  };

  const handleClose = () => {
    if (hasChanges && item) {
      handleSaveTags();
    }
    onClose();
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, hasChanges, item]);

  if (!isOpen || !item) return null;

  const renderContent = () => {
    switch (item.type) {
      case ItemType.IMAGE:
        return (
          <div className="flex items-center justify-center bg-black/5 rounded-lg overflow-hidden max-h-[60vh]">
            {fileUrl ? (
              <img 
                src={fileUrl} 
                alt={item.fileName} 
                className="max-w-full max-h-[60vh] object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-slate-300">
                <ImageIcon size={48} />
              </div>
            )}
          </div>
        );
      
      case ItemType.VIDEO:
        return (
          <div className="bg-black rounded-lg overflow-hidden">
            {fileUrl ? (
              <video 
                src={fileUrl} 
                controls 
                className="w-full max-h-[60vh]"
                autoPlay
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-white/50">
                <Video size={48} />
              </div>
            )}
          </div>
        );
      
      case ItemType.FILE:
        const previewSupported = item.fileName ? canPreview(item.fileName) : false;
        return (
          <div className="p-8 bg-slate-50 rounded-lg flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
              <FileText size={32} />
            </div>
            <div className="text-center">
              <p className="font-medium text-slate-800">{item.fileName}</p>
              <p className="text-sm text-slate-500 mt-1">
                {item.fileSize ? `${(item.fileSize / 1024).toFixed(1)} KB` : ''}
                {item.mimeType ? ` • ${item.mimeType}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {previewSupported && fileUrl && (
                <button
                  onClick={() => setShowFilePreview(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <Eye size={18} />
                  미리보기
                </button>
              )}
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Download size={18} />
                다운로드
              </button>
            </div>
          </div>
        );
      
      case ItemType.LINK:
        return (
          <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
            {/* OG Image */}
            {item.ogImage && (
              <div className="relative aspect-[1.91/1] w-full bg-slate-100 overflow-hidden">
                <img 
                  src={item.ogImage} 
                  alt={item.ogTitle || 'Link preview'} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            
            {/* Content Section */}
            <div className="p-5">
              {/* Title */}
              {(item.ogTitle || item.title) && (
                <h3 className="text-lg font-semibold text-slate-800 mb-2 leading-snug">
                  {item.ogTitle || item.title}
                </h3>
              )}
              
              {/* Description */}
              {item.ogDescription && (
                <p className="text-sm text-slate-500 mb-3 leading-relaxed line-clamp-3">
                  {item.ogDescription}
                </p>
              )}
              
              {/* Full URL - always visible */}
              <div className="flex items-start gap-2 text-indigo-600 mt-3 p-3 bg-slate-50 rounded-lg">
                <ExternalLink size={14} className="flex-shrink-0 mt-0.5" />
                <a 
                  href={item.content} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm font-medium hover:underline break-all select-text"
                >
                  {item.content}
                </a>
              </div>
            </div>
          </div>
        );
      
      case ItemType.TEXT:
      default:
        // If text contains a link with OG data, show rich preview
        if (item.ogImage) {
          return (
            <div className="space-y-4">
              {/* Text content */}
              <div className="p-6 bg-white rounded-lg border border-slate-100">
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed select-text">
                  {linkifyText(item.content, "text-indigo-600 hover:text-indigo-700 hover:underline")}
                </p>
              </div>
              
              {/* OG Preview Card */}
              <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                {/* OG Image */}
                <div className="relative aspect-[1.91/1] w-full bg-slate-100 overflow-hidden">
                  <img 
                    src={item.ogImage} 
                    alt={item.ogTitle || 'Link preview'} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                
                {/* OG Content */}
                {(item.ogTitle || item.ogDescription) && (
                  <div className="p-4">
                    {item.ogTitle && (
                      <h4 className="text-sm font-semibold text-slate-800 mb-1 leading-snug">
                        {item.ogTitle}
                      </h4>
                    )}
                    {item.ogDescription && (
                      <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                        {item.ogDescription}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        }
        
        // Plain text without OG preview
        return (
          <div className="p-6 bg-white rounded-lg border border-slate-100">
            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed select-text">
              {linkifyText(item.content, "text-indigo-600 hover:text-indigo-700 hover:underline")}
            </p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="min-w-0 flex-1">
            {item.title && (
              <h2 className="font-semibold text-lg text-slate-800 truncate">{item.title}</h2>
            )}
            <p className="text-sm text-slate-400">
              {new Date(item.createdAt).toLocaleString()}
            </p>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>

        {/* Tags Section */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-slate-600">Tags</span>
            {hasChanges && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => handleTagToggle(tag.id)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors border ${
                  selectedTags.includes(tag.id)
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                #{tag.name}
              </button>
            ))}
            {tags.length === 0 && (
              <span className="text-sm text-slate-400">No tags available</span>
            )}
          </div>
          {hasChanges && (
            <button
              onClick={handleSaveTags}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Save tag changes
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          {(item.type === ItemType.TEXT || item.type === ItemType.LINK) && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          {item.fileKey && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Download size={18} />
              Download
            </button>
          )}
          {item.type === ItemType.LINK && (
            <a
              href={item.content}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <ExternalLink size={18} />
              Open Link
            </a>
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      {fileUrl && item.fileName && (
        <FilePreviewModal
          isOpen={showFilePreview}
          onClose={() => setShowFilePreview(false)}
          fileUrl={fileUrl}
          fileName={item.fileName}
          fileSize={item.fileSize}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};

export default ItemModal;
