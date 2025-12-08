import React, { useMemo } from 'react';
import { Item, ItemType, Tag } from '../types';
import { ExternalLink, FileText, Image as ImageIcon, Video, Copy, Trash2, Download, Star } from 'lucide-react';
import { format } from 'date-fns';
import { getFileUrl } from '../services/db';
import { linkifyText } from '../utils/linkify';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';

interface FeedItemProps {
  item: Item;
  tags: Tag[];
  onDelete: (id: string) => void;
  onClick: () => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  compact?: boolean;
}

const FeedItem: React.FC<FeedItemProps> = ({ item, tags, onDelete, onClick, onToggleFavorite, compact = false }) => {
  const { showToast } = useToast();
  const { settings } = useSettings();

  // Get file URL from R2
  const fileUrl = useMemo(() => {
    if (item.fileKey) {
      return getFileUrl(item.fileKey);
    }
    return null;
  }, [item.fileKey]);

  const itemTags = useMemo(() => {
    return tags.filter(t => item.tags.includes(t.id));
  }, [tags, item.tags]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === ItemType.LINK || item.type === ItemType.TEXT) {
      try {
        await navigator.clipboard.writeText(item.content);
        showToast('클립보드에 복사되었습니다', 'success');
      } catch (err) {
        showToast('복사에 실패했습니다', 'error');
      }
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileUrl) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = item.fileName || 'download';
      a.target = '_blank';
      a.click();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(item.id, !item.isFavorite);
  };

  // Format date based on settings
  const formattedDate = useMemo(() => {
    if (settings.dateFormat === 'iso') {
      return format(item.createdAt, 'yyyy-MM-dd HH:mm');
    }
    return format(item.createdAt, 'MMM d, h:mm a');
  }, [item.createdAt, settings.dateFormat]);

  // Image fit class based on settings
  const imageFitClass = settings.imageFit === 'contain' ? 'object-contain' : 'object-cover';

  const renderThumbnail = () => {
    switch (item.type) {
      case ItemType.IMAGE:
        return (
          <div className={`relative aspect-square w-full bg-slate-100 overflow-hidden ${settings.imageFit === 'contain' ? 'bg-slate-900' : ''}`}>
            {fileUrl ? (
              <img src={fileUrl} alt={item.fileName} className={`w-full h-full ${imageFitClass}`} loading="lazy" />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-300">
                <ImageIcon size={32} />
              </div>
            )}
          </div>
        );
      case ItemType.VIDEO:
        return (
          <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden flex items-center justify-center">
            {fileUrl ? (
              <video src={fileUrl} controls className="w-full h-full" preload="metadata" />
            ) : (
              <Video size={32} className="text-white/50" />
            )}
          </div>
        );
      case ItemType.FILE:
        return (
          <div className="p-4 flex flex-col items-center justify-center aspect-square bg-slate-50 text-slate-500 gap-2">
            <div className="w-12 h-12 bg-white rounded-lg shadow-sm flex items-center justify-center text-indigo-600">
              <FileText size={24} />
            </div>
            <span className="text-xs font-medium text-center truncate w-full px-2">{item.fileName}</span>
            <span className="text-[10px] text-slate-400 uppercase">{item.fileName?.split('.').pop()}</span>
          </div>
        );
      case ItemType.LINK:
        // If OG image exists, show rich preview card
        if (item.ogImage) {
          return (
            <div className="flex flex-col h-full">
              {/* OG Image */}
              <div className={`relative aspect-[1.91/1] w-full bg-slate-100 overflow-hidden ${settings.imageFit === 'contain' ? 'bg-slate-900' : ''}`}>
                <img 
                  src={item.ogImage} 
                  alt={item.ogTitle || 'Link preview'} 
                  className={`w-full h-full ${imageFitClass}`}
                  loading="lazy"
                  onError={(e) => {
                    // Hide image on error and show fallback
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              {/* Content */}
              <div className="p-3 bg-white flex flex-col gap-1.5 flex-1">
                {/* Title */}
                {(item.ogTitle || item.title) && (
                  <h4 className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">
                    {item.ogTitle || item.title}
                  </h4>
                )}
                {/* Description */}
                {item.ogDescription && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {item.ogDescription}
                  </p>
                )}
                {/* Full URL */}
                <div className="flex items-center gap-1.5 text-indigo-500 mt-auto pt-1">
                  <ExternalLink size={12} className="flex-shrink-0" />
                  <span className="text-[11px] font-medium truncate hover:underline">{item.content}</span>
                </div>
              </div>
            </div>
          );
        }

        // Fallback: Show simple link card (no OG image)
        return (
          <div className="p-4 bg-gradient-to-br from-indigo-50 to-slate-50 flex flex-col h-full min-h-[120px]">
            <div className="flex items-center gap-2 mb-2 text-indigo-600">
              <ExternalLink size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Link</span>
            </div>
            {item.ogTitle && (
              <h4 className="text-sm font-semibold text-slate-800 line-clamp-2 mb-1">
                {item.ogTitle}
              </h4>
            )}
            {item.ogDescription && (
              <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                {item.ogDescription}
              </p>
            )}
            {/* Full URL */}
            <p className="text-xs text-indigo-600 font-medium break-all line-clamp-2 mt-auto">
              {item.content}
            </p>
          </div>
        );
      case ItemType.TEXT:
      default:
        // If text contains a link with OG image, show rich preview
        if (item.ogImage) {
          return (
            <div className="flex flex-col h-full">
              {/* Text content */}
              <div className="p-3 bg-white">
                <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3 leading-relaxed">
                  {linkifyText(item.content, "text-indigo-600 hover:text-indigo-700 hover:underline")}
                </p>
              </div>
              {/* OG Preview */}
              <div className="border-t border-slate-100 bg-slate-50">
                {/* OG Image */}
                <div className={`relative aspect-[1.91/1] w-full bg-slate-100 overflow-hidden ${settings.imageFit === 'contain' ? 'bg-slate-900' : ''}`}>
                  <img 
                    src={item.ogImage} 
                    alt={item.ogTitle || 'Link preview'} 
                    className={`w-full h-full ${imageFitClass}`}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                {/* OG Content */}
                {(item.ogTitle || item.ogDescription) && (
                  <div className="p-2.5 flex flex-col gap-1">
                    {item.ogTitle && (
                      <h4 className="text-xs font-semibold text-slate-700 line-clamp-1 leading-snug">
                        {item.ogTitle}
                      </h4>
                    )}
                    {item.ogDescription && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed">
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
          <div className="p-4 bg-white flex flex-col h-full min-h-[100px]">
            <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-6 leading-relaxed">
              {linkifyText(item.content, "text-indigo-600 hover:text-indigo-700 hover:underline")}
            </p>
          </div>
        );
    }
  };

  // Compact mode render
  if (compact) {
    const getTypeIcon = () => {
      switch (item.type) {
        case ItemType.IMAGE: return <ImageIcon size={16} className="text-emerald-500" />;
        case ItemType.VIDEO: return <Video size={16} className="text-purple-500" />;
        case ItemType.FILE: return <FileText size={16} className="text-orange-500" />;
        case ItemType.LINK: return <ExternalLink size={16} className="text-indigo-500" />;
        default: return <FileText size={16} className="text-slate-400" />;
      }
    };

    const getDisplayText = () => {
      if (item.title) return item.title;
      if (item.ogTitle) return item.ogTitle;
      if (item.fileName) return item.fileName;
      if (item.content) return item.content;
      return 'Untitled';
    };

    return (
      <div 
        className="group flex items-center gap-3 px-3 py-2.5 bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={onClick}
      >
        {/* Thumbnail or Icon */}
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
          {(item.type === ItemType.IMAGE && fileUrl) ? (
            <img src={fileUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (item.ogImage) ? (
            <img src={item.ogImage} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            getTypeIcon()
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800 truncate font-medium">{getDisplayText()}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-400">{formattedDate}</span>
            {itemTags.length > 0 && (
              <div className="flex gap-1">
                {itemTags.slice(0, 2).map(tag => (
                  <span key={tag.id} className="text-[9px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                    #{tag.name}
                  </span>
                ))}
                {itemTags.length > 2 && (
                  <span className="text-[9px] text-slate-400">+{itemTags.length - 2}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button 
            onClick={handleToggleFavorite} 
            className={`p-1.5 hover:bg-amber-50 rounded ${item.isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}
          >
            <Star size={14} fill={item.isFavorite ? 'currentColor' : 'none'} />
          </button>
          <button onClick={handleDelete} className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="group relative bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col cursor-pointer"
      onClick={onClick}
    >
      {/* Header / Meta */}
      {(item.title || itemTags.length > 0) && (
        <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {item.title && <h3 className="font-semibold text-slate-800 text-sm truncate">{item.title}</h3>}
            {itemTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {itemTags.map(tag => (
                  <span key={tag.id} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium">
                    #{tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Body */}
      <div className={`${(item.title || itemTags.length > 0) ? '' : 'pt-0'} flex-1`}>
        {renderThumbnail()}
      </div>

      {/* Footer / Actions */}
      <div className="px-3 py-2 border-t border-slate-50 flex items-center justify-between text-slate-400 bg-white">
        <span className="text-[10px] font-medium">{formattedDate}</span>
        
        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={handleToggleFavorite} 
            className={`p-1.5 hover:bg-amber-50 rounded ${item.isFavorite ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`} 
            title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={14} fill={item.isFavorite ? 'currentColor' : 'none'} />
          </button>
          {item.fileKey ? (
            <button onClick={handleDownload} className="p-1.5 hover:bg-slate-100 rounded text-slate-500" title="Download">
              <Download size={14} />
            </button>
          ) : (
            <button onClick={handleCopy} className="p-1.5 hover:bg-slate-100 rounded text-slate-500" title="Copy">
              <Copy size={14} />
            </button>
          )}
          <button onClick={handleDelete} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedItem;
