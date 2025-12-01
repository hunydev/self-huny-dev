import React, { useMemo } from 'react';
import { Item, ItemType, Tag } from '../types';
import { ExternalLink, FileText, Image as ImageIcon, Video, Copy, Trash2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { getFileUrl } from '../services/db';

interface FeedItemProps {
  item: Item;
  tags: Tag[];
  onDelete: (id: string) => void;
  onClick: () => void;
}

const FeedItem: React.FC<FeedItemProps> = ({ item, tags, onDelete, onClick }) => {

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

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === ItemType.LINK || item.type === ItemType.TEXT) {
      navigator.clipboard.writeText(item.content);
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

  const renderThumbnail = () => {
    switch (item.type) {
      case ItemType.IMAGE:
        return (
          <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
            {fileUrl ? (
              <img src={fileUrl} alt={item.fileName} className="w-full h-full object-cover" loading="lazy" />
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
        return (
          <div className="p-4 bg-indigo-50/50 flex flex-col h-full min-h-[120px]">
            <div className="flex items-center gap-2 mb-2 text-indigo-600">
              <ExternalLink size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Link</span>
            </div>
            <a href={item.content} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-900 hover:underline line-clamp-3 break-all">
              {item.content}
            </a>
          </div>
        );
      case ItemType.TEXT:
      default:
        return (
          <div className="p-4 bg-white flex flex-col h-full min-h-[100px]">
            <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-6 leading-relaxed">
              {item.content}
            </p>
          </div>
        );
    }
  };

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
        <span className="text-[10px] font-medium">{format(item.createdAt, 'MMM d, h:mm a')}</span>
        
        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
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
