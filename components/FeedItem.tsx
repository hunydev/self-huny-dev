import React, { useMemo, useRef, useState } from 'react';
import { Item, ItemType, Tag } from '../types';
import { ExternalLink, FileText, Image as ImageIcon, Video, Copy, Trash2, Download, Star, Eye, LockKeyhole, Unlock, Play, Music, Pause, Code } from 'lucide-react';
import { format } from 'date-fns';
import { getFileUrl } from '../services/db';
import { linkifyText } from '../utils/linkify';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { checkPreviewSupport } from '../services/filePreviewService';
import { createHighlightedCodeHtml } from '../utils/codeHighlight';
import { sanitizeHtml } from '../utils/htmlSanitizer';

// YouTube URL 감지
const isYouTubeUrl = (url: string): boolean => {
  return /(?:youtube\.com|youtu\.be)/.test(url);
};

// 오디오 파일 확장자 체크
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'webm'];
const isAudioFile = (fileName?: string, mimeType?: string): boolean => {
  if (mimeType?.startsWith('audio/')) return true;
  if (!fileName) return false;
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext ? AUDIO_EXTENSIONS.includes(ext) : false;
};

// 파일 카테고리별 색상 스타일 정의
type FileCategory = 'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'archive' | 'code' | 'image' | 'video' | 'audio' | 'font' | 'data' | 'unknown';

const FILE_CATEGORY_MAP: Record<string, FileCategory> = {
  // Document
  doc: 'document', docx: 'document', odt: 'document', rtf: 'document', txt: 'document', md: 'document',
  // Spreadsheet
  xls: 'spreadsheet', xlsx: 'spreadsheet', ods: 'spreadsheet', csv: 'spreadsheet',
  // Presentation
  ppt: 'presentation', pptx: 'presentation', odp: 'presentation', key: 'presentation',
  // PDF
  pdf: 'pdf',
  // Archive
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive', bz2: 'archive',
  // Code
  js: 'code', ts: 'code', jsx: 'code', tsx: 'code', py: 'code', java: 'code', c: 'code', cpp: 'code',
  h: 'code', hpp: 'code', cs: 'code', go: 'code', rs: 'code', rb: 'code', php: 'code', swift: 'code',
  kt: 'code', scala: 'code', html: 'code', css: 'code', scss: 'code', sass: 'code', less: 'code',
  json: 'code', xml: 'code', yaml: 'code', yml: 'code', sql: 'code', sh: 'code', bash: 'code',
  // Image
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', bmp: 'image', svg: 'image', webp: 'image',
  ico: 'image', tiff: 'image', psd: 'image', ai: 'image', eps: 'image',
  // Video
  mp4: 'video', mkv: 'video', avi: 'video', mov: 'video', wmv: 'video', flv: 'video', webm: 'video',
  // Audio
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio', m4a: 'audio', wma: 'audio',
  // Font
  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font', eot: 'font',
  // Data
  db: 'data', sqlite: 'data', mdb: 'data',
};

const FILE_CATEGORY_STYLES: Record<FileCategory, { bg: string; iconBg: string; iconColor: string; extColor: string }> = {
  document: { bg: 'bg-gradient-to-br from-blue-50 to-blue-100', iconBg: 'bg-blue-500', iconColor: 'text-white', extColor: 'text-blue-600' },
  spreadsheet: { bg: 'bg-gradient-to-br from-green-50 to-green-100', iconBg: 'bg-green-500', iconColor: 'text-white', extColor: 'text-green-600' },
  presentation: { bg: 'bg-gradient-to-br from-orange-50 to-orange-100', iconBg: 'bg-orange-500', iconColor: 'text-white', extColor: 'text-orange-600' },
  pdf: { bg: 'bg-gradient-to-br from-red-50 to-red-100', iconBg: 'bg-red-500', iconColor: 'text-white', extColor: 'text-red-600' },
  archive: { bg: 'bg-gradient-to-br from-amber-50 to-yellow-100', iconBg: 'bg-amber-500', iconColor: 'text-white', extColor: 'text-amber-600' },
  code: { bg: 'bg-gradient-to-br from-slate-700 to-slate-800', iconBg: 'bg-slate-600', iconColor: 'text-emerald-400', extColor: 'text-emerald-400' },
  image: { bg: 'bg-gradient-to-br from-pink-50 to-rose-100', iconBg: 'bg-pink-500', iconColor: 'text-white', extColor: 'text-pink-600' },
  video: { bg: 'bg-gradient-to-br from-purple-50 to-violet-100', iconBg: 'bg-purple-500', iconColor: 'text-white', extColor: 'text-purple-600' },
  audio: { bg: 'bg-gradient-to-br from-indigo-50 to-purple-100', iconBg: 'bg-indigo-500', iconColor: 'text-white', extColor: 'text-indigo-600' },
  font: { bg: 'bg-gradient-to-br from-teal-50 to-cyan-100', iconBg: 'bg-teal-500', iconColor: 'text-white', extColor: 'text-teal-600' },
  data: { bg: 'bg-gradient-to-br from-cyan-50 to-sky-100', iconBg: 'bg-cyan-500', iconColor: 'text-white', extColor: 'text-cyan-600' },
  unknown: { bg: 'bg-gradient-to-br from-slate-50 to-slate-100', iconBg: 'bg-slate-400', iconColor: 'text-white', extColor: 'text-slate-500' },
};

const getFileCategory = (fileName?: string, mimeType?: string): FileCategory => {
  // MIME type으로 먼저 판단
  if (mimeType) {
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive')) return 'archive';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('text/plain')) return 'document';
  }
  
  // 확장자로 판단
  if (!fileName) return 'unknown';
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return 'unknown';
  
  return FILE_CATEGORY_MAP[ext] || 'unknown';
};

const getFileCategoryStyle = (fileName?: string, mimeType?: string) => {
  const category = getFileCategory(fileName, mimeType);
  return FILE_CATEGORY_STYLES[category];
};

interface FeedItemProps {
  item: Item;
  tags: Tag[];
  onDelete: (id: string) => void;
  onClick: () => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onToggleEncryption?: (id: string) => void;
  compact?: boolean;
}

const FeedItem: React.FC<FeedItemProps> = ({ item, tags, onDelete, onClick, onToggleFavorite, onToggleEncryption, compact = false }) => {
  const { showToast } = useToast();
  const { settings } = useSettings();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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

  const handleToggleEncryption = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleEncryption) {
      onToggleEncryption(item.id);
    }
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
    // Encrypted item - show lock screen
    if (item.isEncrypted) {
      return (
        <div className="p-6 flex flex-col items-center justify-center aspect-square bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 gap-3">
          <div className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-400">
            <LockKeyhole size={28} />
          </div>
          <span className="text-xs font-medium text-slate-500">암호화됨</span>
          <span className="text-[10px] text-slate-400">클릭하여 잠금 해제</span>
        </div>
      );
    }
    
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
        const previewCheck = item.fileName ? checkPreviewSupport(item.fileName, item.fileSize) : { canPreview: false };
        const isAudio = isAudioFile(item.fileName, item.mimeType);
        
        // 오디오 파일인 경우 별도 UI
        if (isAudio && fileUrl) {
          return (
            <div className="p-4 flex flex-col items-center justify-center aspect-square bg-gradient-to-br from-purple-50 to-indigo-50 text-slate-500 gap-3 relative">
              <div 
                className="w-14 h-14 bg-white rounded-full shadow-md flex items-center justify-center text-purple-600 cursor-pointer hover:scale-105 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  if (audioRef.current) {
                    if (isPlaying) {
                      audioRef.current.pause();
                    } else {
                      audioRef.current.play();
                    }
                    setIsPlaying(!isPlaying);
                  }
                }}
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
              </div>
              <span className="text-xs font-medium text-center truncate w-full px-2 text-slate-700">{item.fileName}</span>
              <span className="text-[10px] text-purple-500 uppercase font-medium">{item.fileName?.split('.').pop()}</span>
              <audio 
                ref={audioRef} 
                src={fileUrl} 
                onEnded={() => setIsPlaying(false)}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                className="hidden"
              />
            </div>
          );
        }
        
        const fileStyle = getFileCategoryStyle(item.fileName, item.mimeType);
        const isCodeCategory = getFileCategory(item.fileName, item.mimeType) === 'code';
        
        return (
          <div className={`p-4 flex flex-col items-center justify-center aspect-square ${fileStyle.bg} text-slate-500 gap-2 relative`}>
            {previewCheck.canPreview && (
              <div className="absolute top-2 right-2">
                <Eye size={14} className={isCodeCategory ? 'text-emerald-400' : 'text-indigo-500'} />
              </div>
            )}
            <div className={`w-12 h-12 ${fileStyle.iconBg} rounded-lg shadow-sm flex items-center justify-center ${fileStyle.iconColor}`}>
              <FileText size={24} />
            </div>
            <span className={`text-xs font-medium text-center truncate w-full px-2 ${isCodeCategory ? 'text-slate-200' : 'text-slate-700'}`}>{item.fileName}</span>
            <span className={`text-[10px] uppercase font-medium ${fileStyle.extColor}`}>{item.fileName?.split('.').pop()}</span>
          </div>
        );
      case ItemType.LINK:
        const isYouTube = isYouTubeUrl(item.content);
        // If OG image exists, show rich preview card
        if (item.ogImage) {
          return (
            <div className="flex flex-col h-full">
              {/* OG Image with YouTube play overlay */}
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
                {/* YouTube Play Button Overlay */}
                {isYouTube && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                      <Play size={24} className="text-white ml-1" fill="white" />
                    </div>
                  </div>
                )}
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
                  {isYouTube ? (
                    <Play size={12} className="flex-shrink-0 text-red-500" />
                  ) : (
                    <ExternalLink size={12} className="flex-shrink-0" />
                  )}
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
        // 코드 블록 스타일
        if (item.isCode) {
          return (
            <div className="p-3 bg-slate-900 flex flex-col h-full min-h-[100px] overflow-hidden">
              <div className="flex items-center gap-2 mb-2 text-slate-400">
                <Code size={14} />
                <span className="text-[10px] font-medium uppercase tracking-wider">Code</span>
              </div>
              <pre className="text-xs whitespace-pre-wrap line-clamp-6 leading-relaxed font-mono overflow-hidden">
                <code dangerouslySetInnerHTML={createHighlightedCodeHtml(item.content)} />
              </pre>
            </div>
          );
        }
        
        // HTML 서식 콘텐츠가 있는 경우
        if (item.htmlContent) {
          return (
            <div className="p-4 bg-white flex flex-col h-full min-h-[100px] max-h-[200px] overflow-hidden">
              <div 
                className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none overflow-hidden"
                style={{ 
                  display: '-webkit-box', 
                  WebkitLineClamp: 6, 
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.htmlContent) }}
              />
            </div>
          );
        }
        
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
          {(item.type === ItemType.IMAGE && fileUrl && !item.isEncrypted) ? (
            <img src={fileUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (item.ogImage && !item.isEncrypted) ? (
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
      {renderThumbnail()}

      {/* Footer / Actions */}
      <div className="px-3 py-2 border-t border-slate-50 flex items-center justify-between text-slate-400 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium">{formattedDate}</span>
        </div>
        
        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={handleToggleFavorite} 
            className={`p-1.5 hover:bg-amber-50 rounded ${item.isFavorite ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`} 
            title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={14} fill={item.isFavorite ? 'currentColor' : 'none'} />
          </button>
          {onToggleEncryption && (
            <button 
              onClick={handleToggleEncryption} 
              className={`p-1.5 rounded ${item.isEncrypted ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'}`}
              title={item.isEncrypted ? '암호화 해제' : '암호화'}
            >
              {item.isEncrypted ? <Unlock size={14} /> : <LockKeyhole size={14} />}
            </button>
          )}
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
