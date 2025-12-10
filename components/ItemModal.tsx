import React, { useState, useEffect, useMemo } from 'react';
import { Item, ItemType, Tag } from '../types';
import { X, Copy, Download, ExternalLink, Check, FileText, Image as ImageIcon, Video, Eye, LockKeyhole, Unlock, Play, Music, Code } from 'lucide-react';
import { getFileUrl, unlockItem, toggleEncryption } from '../services/db';
import { linkifyText } from '../utils/linkify';
import FilePreviewModal from './FilePreviewModal';
import { checkPreviewSupport, formatFileSize } from '../services/filePreviewService';
import EncryptionUnlock from './EncryptionUnlock';

// 오디오 파일 확장자 체크
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'webm'];
const isAudioFile = (fileName?: string, mimeType?: string): boolean => {
  if (mimeType?.startsWith('audio/')) return true;
  if (!fileName) return false;
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext ? AUDIO_EXTENSIONS.includes(ext) : false;
};

// YouTube URL에서 비디오 ID 추출
const getYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

interface ItemModalProps {
  item: Item | null;
  tags: Tag[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateTags: (itemId: string, tagIds: string[]) => void;
  onToggleEncryption?: (id: string) => void;
}

const ItemModal: React.FC<ItemModalProps> = ({ item, tags, isOpen, onClose, onUpdateTags, onToggleEncryption }) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  
  // 암호화된 아이템 잠금 해제 상태
  const [unlockedItem, setUnlockedItem] = useState<Item | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  
  // 실제 표시할 아이템 (잠금 해제된 경우 unlockedItem, 아니면 원본)
  const displayItem = item?.isEncrypted && unlockedItem ? unlockedItem : item;
  const isLocked = item?.isEncrypted && !unlockedItem;

  // 잠금 해제 핸들러
  const handleUnlock = async (key: string) => {
    if (!item) return;
    setIsUnlocking(true);
    setUnlockError(null);
    try {
      const unlocked = await unlockItem(item.id, key);
      setUnlockedItem(unlocked);
    } catch (error) {
      setUnlockError('비밀번호가 올바르지 않습니다.');
    }
    setIsUnlocking(false);
  };

  // 암호화 토글 핸들러
  const handleToggleEncryption = () => {
    if (item && onToggleEncryption) {
      onToggleEncryption(item.id);
    }
  };

  // Reset when item changes
  useEffect(() => {
    if (item) {
      setSelectedTags(item.tags);
      setHasChanges(false);
      setShowFilePreview(false);
      // 암호화 상태 리셋
      setUnlockedItem(null);
      setUnlockError(null);
    }
  }, [item?.id, item?.tags]);

  // Get file URL (암호화 해제된 아이템 기준)
  const fileUrl = useMemo(() => {
    const targetItem = item?.isEncrypted && unlockedItem ? unlockedItem : item;
    if (targetItem?.fileKey) {
      return getFileUrl(targetItem.fileKey);
    }
    return null;
  }, [item?.fileKey, item?.isEncrypted, unlockedItem]);

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
  
  // 실제 표시할 아이템
  const contentItem = displayItem || item;

  const renderContent = () => {
    // 암호화된 아이템이 잠겨있는 경우
    if (isLocked) {
      return (
        <EncryptionUnlock
          onUnlock={handleUnlock}
          isLoading={isUnlocking}
          error={unlockError}
        />
      );
    }
    
    switch (contentItem.type) {
      case ItemType.IMAGE:
        return (
          <div className="flex items-center justify-center bg-black/5 rounded-lg overflow-hidden max-h-[60vh]">
            {fileUrl ? (
              <img 
                src={fileUrl} 
                alt={contentItem.fileName} 
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
        const previewCheck = contentItem.fileName ? checkPreviewSupport(contentItem.fileName, contentItem.fileSize) : { canPreview: false, reason: 'unsupported' as const, previewType: 'unsupported' as const };
        const isAudio = isAudioFile(contentItem.fileName, contentItem.mimeType);
        
        // 오디오 파일인 경우 별도 UI
        if (isAudio && fileUrl) {
          return (
            <div className="p-8 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center text-purple-600">
                <Music size={40} />
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-800">{contentItem.fileName}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {contentItem.fileSize ? formatFileSize(contentItem.fileSize) : ''}
                  {contentItem.mimeType ? ` • ${contentItem.mimeType}` : ''}
                </p>
              </div>
              {/* Audio Player */}
              <audio 
                src={fileUrl} 
                controls 
                className="w-full max-w-md mt-2"
                controlsList="nodownload"
              />
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Download size={18} />
                다운로드
              </button>
            </div>
          );
        }
        
        return (
          <div className="p-8 bg-slate-50 rounded-lg flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600">
              <FileText size={32} />
            </div>
            <div className="text-center">
              <p className="font-medium text-slate-800">{contentItem.fileName}</p>
              <p className="text-sm text-slate-500 mt-1">
                {contentItem.fileSize ? formatFileSize(contentItem.fileSize) : ''}
                {contentItem.mimeType ? ` • ${contentItem.mimeType}` : ''}
              </p>
            </div>
            {/* Size exceeded warning */}
            {previewCheck.reason === 'size_exceeded' && (
              <div className="text-center text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                <p>파일 용량이 커서 미리보기를 지원하지 않습니다.</p>
                <p className="text-xs text-amber-500 mt-1">
                  (미리보기 제한: {previewCheck.sizeLimit})
                </p>
              </div>
            )}
            <div className="flex gap-2">
              {previewCheck.canPreview && fileUrl && (
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
        const youtubeId = getYouTubeVideoId(contentItem.content);
        
        // YouTube 링크인 경우 임베드 플레이어 표시
        if (youtubeId) {
          return (
            <div className="space-y-4">
              {/* YouTube Embed Player */}
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
                  title={contentItem.ogTitle || contentItem.title || 'YouTube Video'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              
              {/* Video Info */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                {(contentItem.ogTitle || contentItem.title) && (
                  <h3 className="text-lg font-semibold text-slate-800 mb-2 leading-snug">
                    {contentItem.ogTitle || contentItem.title}
                  </h3>
                )}
                {contentItem.ogDescription && (
                  <p className="text-sm text-slate-500 mb-3 leading-relaxed line-clamp-3">
                    {contentItem.ogDescription}
                  </p>
                )}
                <div className="flex items-center gap-2 text-indigo-600 mt-2">
                  <Play size={14} className="flex-shrink-0" />
                  <a 
                    href={contentItem.content} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm font-medium hover:underline"
                  >
                    YouTube에서 열기
                  </a>
                </div>
              </div>
            </div>
          );
        }
        
        // 일반 링크
        return (
          <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
            {/* OG Image */}
            {contentItem.ogImage && (
              <div className="relative aspect-[1.91/1] w-full bg-slate-100 overflow-hidden">
                <img 
                  src={contentItem.ogImage} 
                  alt={contentItem.ogTitle || 'Link preview'} 
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
              {(contentItem.ogTitle || contentItem.title) && (
                <h3 className="text-lg font-semibold text-slate-800 mb-2 leading-snug">
                  {contentItem.ogTitle || contentItem.title}
                </h3>
              )}
              
              {/* Description */}
              {contentItem.ogDescription && (
                <p className="text-sm text-slate-500 mb-3 leading-relaxed line-clamp-3">
                  {contentItem.ogDescription}
                </p>
              )}
              
              {/* Full URL - always visible */}
              <div className="flex items-start gap-2 text-indigo-600 mt-3 p-3 bg-slate-50 rounded-lg">
                <ExternalLink size={14} className="flex-shrink-0 mt-0.5" />
                <a 
                  href={contentItem.content} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm font-medium hover:underline break-all select-text"
                >
                  {contentItem.content}
                </a>
              </div>
            </div>
          </div>
        );
      
      case ItemType.TEXT:
      default:
        // If text contains a link with OG data, show rich preview
        if (contentItem.ogImage) {
          return (
            <div className="space-y-4">
              {/* Text content */}
              <div className="p-6 bg-white rounded-lg border border-slate-100">
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed select-text">
                  {linkifyText(contentItem.content, "text-indigo-600 hover:text-indigo-700 hover:underline")}
                </p>
              </div>
              
              {/* OG Preview Card */}
              <div className="rounded-lg overflow-hidden border border-slate-200 bg-white">
                {/* OG Image */}
                <div className="relative aspect-[1.91/1] w-full bg-slate-100 overflow-hidden">
                  <img 
                    src={contentItem.ogImage} 
                    alt={contentItem.ogTitle || 'Link preview'} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                
                {/* OG Content */}
                {(contentItem.ogTitle || contentItem.ogDescription) && (
                  <div className="p-4">
                    {contentItem.ogTitle && (
                      <h4 className="text-sm font-semibold text-slate-800 mb-1 leading-snug">
                        {contentItem.ogTitle}
                      </h4>
                    )}
                    {contentItem.ogDescription && (
                      <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                        {contentItem.ogDescription}
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
        if (contentItem.isCode) {
          return (
            <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                <div className="flex items-center gap-2 text-slate-400">
                  <Code size={16} />
                  <span className="text-xs font-medium">Code</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(contentItem.content);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="p-4 text-sm text-emerald-400 whitespace-pre-wrap leading-relaxed font-mono overflow-x-auto select-text max-h-[60vh] overflow-y-auto">
                <code>{contentItem.content}</code>
              </pre>
            </div>
          );
        }
        
        return (
          <div className="p-6 bg-white rounded-lg border border-slate-100">
            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed select-text">
              {linkifyText(contentItem.content, "text-indigo-600 hover:text-indigo-700 hover:underline")}
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
            <div className="flex items-center gap-2">
              {item.isEncrypted && (
                <LockKeyhole size={18} className="text-amber-500 flex-shrink-0" />
              )}
              {(contentItem.title || item.title) && (
                <h2 className="font-semibold text-lg text-slate-800 truncate">{contentItem.title || item.title}</h2>
              )}
            </div>
            <p className="text-sm text-slate-400">
              {new Date(contentItem.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {/* 암호화 토글 버튼 */}
            {onToggleEncryption && !isLocked && (
              <button
                onClick={handleToggleEncryption}
                className={`p-2 rounded-lg transition-colors ${
                  item.isEncrypted
                    ? 'text-amber-500 hover:bg-amber-50'
                    : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                }`}
                title={item.isEncrypted ? '암호화 해제' : '암호화'}
              >
                {item.isEncrypted ? <Unlock size={20} /> : <LockKeyhole size={20} />}
              </button>
            )}
            <button 
              onClick={handleClose}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </div>

        {/* Tags Section - only show when unlocked */}
        {!isLocked && (
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
        )}

        {/* Actions - only show when unlocked */}
        {!isLocked && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
            {(contentItem.type === ItemType.TEXT || contentItem.type === ItemType.LINK) && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
            {contentItem.fileKey && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Download size={18} />
                Download
              </button>
            )}
            {contentItem.type === ItemType.LINK && (
              <a
                href={contentItem.content}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <ExternalLink size={18} />
                Open Link
              </a>
            )}
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {fileUrl && contentItem.fileName && !isLocked && (
        <FilePreviewModal
          isOpen={showFilePreview}
          onClose={() => setShowFilePreview(false)}
          fileUrl={fileUrl}
          fileName={contentItem.fileName}
          fileSize={contentItem.fileSize}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};

export default ItemModal;
