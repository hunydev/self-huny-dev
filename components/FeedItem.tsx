import React, { useMemo, useState, useEffect } from 'react';
import { Item, ItemType, Tag } from '../types';
import { ExternalLink, FileText, Image as ImageIcon, Video, MoreHorizontal, Copy, Trash2, Download } from 'lucide-react';
import { format } from 'date-fns';

interface FeedItemProps {
  item: Item;
  tags: Tag[];
  onDelete: (id: string) => void;
}

const FeedItem: React.FC<FeedItemProps> = ({ item, tags, onDelete }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Convert Blob to URL for display
  useEffect(() => {
    if (item.fileBlob) {
      const url = URL.createObjectURL(item.fileBlob);
      setImageSrc(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [item.fileBlob]);

  const itemTags = useMemo(() => {
    return tags.filter(t => item.tags.includes(t.id));
  }, [tags, item.tags]);

  const handleCopy = () => {
    if (item.type === ItemType.LINK || item.type === ItemType.TEXT) {
      navigator.clipboard.writeText(item.content);
      // Show toast ideally
    }
  };

  const handleDownload = () => {
    if (item.fileBlob && imageSrc) {
      const a = document.createElement('a');
      a.href = imageSrc;
      a.download = item.fileName || 'download';
      a.click();
    }
  };

  const renderThumbnail = () => {
    switch (item.type) {
      case ItemType.IMAGE:
        return (
          <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
             {imageSrc ? (
               <img src={imageSrc} alt={item.fileName} className="w-full h-full object-cover" />
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
             {imageSrc ? (
               <video src={imageSrc} controls className="w-full h-full" />
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
             {/* If we had a meta scraper, we'd show the OG image here */}
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
    <div className="group relative bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
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
           {item.fileBlob ? (
             <button onClick={handleDownload} className="p-1.5 hover:bg-slate-100 rounded text-slate-500" title="Download">
               <Download size={14} />
             </button>
           ) : (
             <button onClick={handleCopy} className="p-1.5 hover:bg-slate-100 rounded text-slate-500" title="Copy">
               <Copy size={14} />
             </button>
           )}
           <button onClick={() => onDelete(item.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded" title="Delete">
             <Trash2 size={14} />
           </button>
        </div>
      </div>
    </div>
  );
};

export default FeedItem;
