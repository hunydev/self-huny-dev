import React, { useState, useEffect, useMemo } from 'react';
import { Item, ItemType, Tag } from '../types';
import { X, Copy, Download, ExternalLink, Check, FileText, Image as ImageIcon, Video, Eye, LockKeyhole, Unlock, Play, Music, Code, Wand2, Loader2, Pencil, Info, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';
import { getFileUrl, unlockItem, toggleEncryption, updateItemTitle } from '../services/db';
import { suggestTitle } from '../services/geminiService';
import { linkifyText } from '../utils/linkify';
import FilePreviewModal from './FilePreviewModal';
import { checkPreviewSupport, formatFileSize } from '../services/filePreviewService';
import EncryptionUnlock from './EncryptionUnlock';
import { createHighlightedCodeHtml } from '../utils/codeHighlight';
import { sanitizeHtml } from '../utils/htmlSanitizer';

// 오디오 파일 확장자 체크
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'webm'];
const isAudioFile = (fileName?: string, mimeType?: string): boolean => {
  if (mimeType?.startsWith('audio/')) return true;
  if (!fileName) return false;
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext ? AUDIO_EXTENSIONS.includes(ext) : false;
};

// 이미지/비디오 메타데이터 타입
interface ImageMetadata {
  width: number;
  height: number;
  aspectRatio: string;
}

interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  durationFormatted: string;
  aspectRatio: string;
}

// 시간 포맷팅 헬퍼
const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
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
  onUpdateTitle?: (itemId: string, title: string) => void;
}

const ItemModal: React.FC<ItemModalProps> = ({ item, tags, isOpen, onClose, onUpdateTags, onToggleEncryption, onUpdateTitle }) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  
  // 제목 편집 상태
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false);
  
  // 암호화된 아이템 잠금 해제 상태
  const [unlockedItem, setUnlockedItem] = useState<Item | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  
  // 이미지/비디오 메타데이터 상태
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  
  // 이미지 전체화면 상태
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);
  
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

  // 제목 편집 시작
  const handleStartEditTitle = () => {
    const currentTitle = displayItem?.title || item?.title || '';
    setEditTitle(currentTitle);
    setIsEditingTitle(true);
  };

  // 제목 저장
  const handleSaveTitle = async () => {
    if (!item || !onUpdateTitle) return;
    try {
      await updateItemTitle(item.id, editTitle);
      onUpdateTitle(item.id, editTitle);
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Failed to update title:', error);
    }
  };

  // 제목 편집 취소
  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
    setEditTitle('');
  };

  // AI 제목 추천
  const handleSuggestTitle = async () => {
    const content = displayItem?.content || item?.content;
    if (!content) return;
    
    setIsSuggestingTitle(true);
    try {
      const suggested = await suggestTitle(content);
      if (suggested) {
        setEditTitle(suggested);
        if (!isEditingTitle) {
          setIsEditingTitle(true);
        }
      }
    } catch (error) {
      console.error('Failed to suggest title:', error);
    } finally {
      setIsSuggestingTitle(false);
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
      // 제목 편집 상태 리셋
      setIsEditingTitle(false);
      setEditTitle('');
      // 메타데이터 상태 리셋
      setImageMetadata(null);
      setVideoMetadata(null);
      setShowMetadata(false);
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
          <div className="space-y-3">
            <div className="relative flex items-center justify-center bg-black/5 rounded-lg overflow-hidden max-h-[60vh] group">
              {fileUrl ? (
                <>
                  <img 
                    src={fileUrl} 
                    alt={contentItem.fileName} 
                    className="max-w-full max-h-[60vh] object-contain cursor-pointer"
                    onClick={() => setIsImageFullscreen(true)}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
                      const divisor = gcd(img.naturalWidth, img.naturalHeight);
                      setImageMetadata({
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                        aspectRatio: `${img.naturalWidth / divisor}:${img.naturalHeight / divisor}`
                      });
                    }}
                  />
                  {/* 확대 버튼 */}
                  <button
                    onClick={() => setIsImageFullscreen(true)}
                    className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    title="크게 보기"
                  >
                    <Maximize2 size={18} />
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-slate-300">
                  <ImageIcon size={48} />
                </div>
              )}
            </div>
            {/* 이미지 메타데이터 */}
            {(imageMetadata || contentItem.fileSize) && (
              <div className="bg-slate-50 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowMetadata(!showMetadata)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Info size={14} />
                    <span className="font-medium">이미지 정보</span>
                  </div>
                  {showMetadata ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showMetadata && (
                  <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-slate-100 pt-3">
                    {contentItem.fileName && (
                      <div className="col-span-2">
                        <span className="text-slate-400">파일명</span>
                        <p className="text-slate-700 font-medium truncate">{contentItem.fileName}</p>
                      </div>
                    )}
                    {imageMetadata && (
                      <>
                        <div>
                          <span className="text-slate-400">해상도</span>
                          <p className="text-slate-700 font-medium">{imageMetadata.width} × {imageMetadata.height}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">비율</span>
                          <p className="text-slate-700 font-medium">{imageMetadata.aspectRatio}</p>
                        </div>
                      </>
                    )}
                    {contentItem.fileSize && (
                      <div>
                        <span className="text-slate-400">파일 크기</span>
                        <p className="text-slate-700 font-medium">{formatFileSize(contentItem.fileSize)}</p>
                      </div>
                    )}
                    {contentItem.mimeType && (
                      <div>
                        <span className="text-slate-400">파일 형식</span>
                        <p className="text-slate-700 font-medium">{contentItem.mimeType}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      
      case ItemType.VIDEO:
        return (
          <div className="space-y-3">
            <div className="bg-black rounded-lg overflow-hidden">
              {fileUrl ? (
                <video 
                  src={fileUrl} 
                  controls 
                  className="w-full max-h-[60vh]"
                  autoPlay
                  onLoadedMetadata={(e) => {
                    const video = e.target as HTMLVideoElement;
                    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
                    const divisor = gcd(video.videoWidth, video.videoHeight);
                    setVideoMetadata({
                      width: video.videoWidth,
                      height: video.videoHeight,
                      duration: video.duration,
                      durationFormatted: formatDuration(video.duration),
                      aspectRatio: `${video.videoWidth / divisor}:${video.videoHeight / divisor}`
                    });
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-white/50">
                  <Video size={48} />
                </div>
              )}
            </div>
            {/* 비디오 메타데이터 */}
            {(videoMetadata || contentItem.fileSize) && (
              <div className="bg-slate-50 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowMetadata(!showMetadata)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Info size={14} />
                    <span className="font-medium">영상 정보</span>
                  </div>
                  {showMetadata ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showMetadata && (
                  <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t border-slate-100 pt-3">
                    {contentItem.fileName && (
                      <div className="col-span-2">
                        <span className="text-slate-400">파일명</span>
                        <p className="text-slate-700 font-medium truncate">{contentItem.fileName}</p>
                      </div>
                    )}
                    {videoMetadata && (
                      <>
                        <div>
                          <span className="text-slate-400">해상도</span>
                          <p className="text-slate-700 font-medium">{videoMetadata.width} × {videoMetadata.height}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">비율</span>
                          <p className="text-slate-700 font-medium">{videoMetadata.aspectRatio}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">재생 시간</span>
                          <p className="text-slate-700 font-medium">{videoMetadata.durationFormatted}</p>
                        </div>
                      </>
                    )}
                    {contentItem.fileSize && (
                      <div>
                        <span className="text-slate-400">파일 크기</span>
                        <p className="text-slate-700 font-medium">{formatFileSize(contentItem.fileSize)}</p>
                      </div>
                    )}
                    {contentItem.mimeType && (
                      <div>
                        <span className="text-slate-400">파일 형식</span>
                        <p className="text-slate-700 font-medium">{contentItem.mimeType}</p>
                      </div>
                    )}
                  </div>
                )}
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
                {contentItem.htmlContent ? (
                  <div 
                    className="text-slate-700 leading-relaxed select-text prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentItem.htmlContent) }}
                  />
                ) : (
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed select-text">
                    {linkifyText(contentItem.content, "text-indigo-600 hover:text-indigo-700 hover:underline")}
                  </p>
                )}
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
              <pre className="p-4 text-sm whitespace-pre-wrap leading-relaxed font-mono select-text">
                <code dangerouslySetInnerHTML={createHighlightedCodeHtml(contentItem.content)} />
              </pre>
            </div>
          );
        }
        
        return (
          <div className="p-6 bg-white rounded-lg border border-slate-100">
            {contentItem.htmlContent ? (
              <>
                <div 
                  className="text-slate-700 leading-relaxed select-text prose prose-sm max-w-none overflow-x-auto modal-html-content"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentItem.htmlContent) }}
                />
                <style>{`
                  .modal-html-content table {
                    width: 100%;
                    max-width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                    display: block;
                    overflow-x: auto;
                  }
                  .modal-html-content td, .modal-html-content th {
                    padding: 8px 12px;
                    border: 1px solid #e2e8f0;
                    min-width: 80px;
                  }
                  .modal-html-content th {
                    background-color: #f8fafc;
                    font-weight: 600;
                  }
                  .modal-html-content pre {
                    overflow-x: auto;
                    max-width: 100%;
                  }
                `}</style>
              </>
            ) : (
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed select-text">
                {linkifyText(contentItem.content, "text-indigo-600 hover:text-indigo-700 hover:underline")}
              </p>
            )}
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
            {/* 제목 편집 모드 */}
            {isEditingTitle && !isLocked ? (
              <div className="flex items-center gap-2">
                {item.isEncrypted && (
                  <LockKeyhole size={18} className="text-amber-500 flex-shrink-0" />
                )}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="제목 입력..."
                    className="w-full text-lg font-semibold px-3 py-1.5 pr-10 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') handleCancelEditTitle();
                    }}
                  />
                  <button
                    onClick={handleSuggestTitle}
                    disabled={!contentItem.content || isSuggestingTitle}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="AI로 제목 추천받기"
                  >
                    {isSuggestingTitle ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                  </button>
                </div>
                <button
                  onClick={handleSaveTitle}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                  title="저장"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={handleCancelEditTitle}
                  className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
                  title="취소"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {item.isEncrypted && (
                  <LockKeyhole size={18} className="text-amber-500 flex-shrink-0" />
                )}
                {(contentItem.title || item.title) ? (
                  <h2 className="font-semibold text-lg text-slate-800 truncate">{contentItem.title || item.title}</h2>
                ) : (
                  <span className="text-slate-400 text-lg italic">제목 없음</span>
                )}
                {/* 제목 편집 버튼 - 잠금 해제 시에만 */}
                {!isLocked && onUpdateTitle && (
                  <button
                    onClick={handleStartEditTitle}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    title="제목 편집"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
            <p className="text-sm text-slate-400 mt-1">
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

      {/* Image Fullscreen Overlay */}
      {isImageFullscreen && fileUrl && contentItem.type === ItemType.IMAGE && (
        <div 
          className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            setIsImageFullscreen(false);
          }}
        >
          {/* 컨트롤 버튼들 */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              title="다운로드"
            >
              <Download size={20} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsImageFullscreen(false);
              }}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              title="닫기"
            >
              <Minimize2 size={20} />
            </button>
          </div>
          
          {/* 이미지 */}
          <img 
            src={fileUrl} 
            alt={contentItem.fileName}
            className="max-w-[95vw] max-h-[95vh] object-contain select-none"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
          
          {/* 파일 정보 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-lg text-white text-sm">
            {contentItem.fileName}
            {imageMetadata && (
              <span className="ml-2 text-white/70">
                ({imageMetadata.width} × {imageMetadata.height})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemModal;
