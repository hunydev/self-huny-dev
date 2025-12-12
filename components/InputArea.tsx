import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Paperclip, Image as ImageIcon, X, Send, Wand2, Loader2, FileText, Plus, Trash2, LockKeyhole, Code, Bell, Timer, Sparkles } from 'lucide-react';
import { Item, ItemType, Tag } from '../types';
import { suggestTitle, formatText } from '../services/geminiService';
import { useSettings } from '../contexts/SettingsContext';
import { sanitizeHtml, hasRichFormatting } from '../utils/htmlSanitizer';

// Tag color utility functions
const TAG_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-500' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', dot: 'bg-yellow-500' },
  lime: { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-300', dot: 'bg-lime-500' },
  green: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', dot: 'bg-green-500' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-300', dot: 'bg-teal-500' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300', dot: 'bg-cyan-500' },
  sky: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-300', dot: 'bg-sky-500' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300', dot: 'bg-indigo-500' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300', dot: 'bg-violet-500' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', dot: 'bg-purple-500' },
  fuchsia: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-300', dot: 'bg-fuchsia-500' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-300', dot: 'bg-pink-500' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300', dot: 'bg-rose-500' },
};

const getTagColorClass = (color: string, isSelected: boolean): string | null => {
  const colors = TAG_COLORS[color];
  if (!colors) return null;
  return isSelected ? `${colors.bg} ${colors.text} ${colors.border}` : null;
};

const getTagDotClass = (color: string): string => {
  return TAG_COLORS[color]?.dot || 'bg-slate-400';
};

interface InputAreaProps {
  onSave: (item: Omit<Item, 'id' | 'createdAt'>) => void;
  availableTags: Tag[];
  autoFocus?: boolean;
  onAddTag?: (name: string) => void;
  onDeleteTag?: (id: string) => void;
  activeTagFilter?: string | null;
}

export interface InputAreaHandle {
  focus: () => void;
  setShareData: (content: string, title?: string) => void;
}

const InputArea = forwardRef<InputAreaHandle, InputAreaProps>(({ onSave, availableTags, autoFocus, onAddTag, onDeleteTag, activeTagFilter }, ref) => {
  const DRAFT_STORAGE_KEY = 'self-input-draft';
  
  // Load draft from localStorage on mount
  const loadDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load draft:', e);
    }
    return null;
  };
  
  const draft = loadDraft();
  
  const [text, setText] = useState(draft?.text || '');
  const [htmlContent, setHtmlContent] = useState<string | undefined>(draft?.htmlContent || undefined);
  const [title, setTitle] = useState(draft?.title || '');
  const [file, setFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(draft?.selectedTags || []);
  const [autoMatchedTags, setAutoMatchedTags] = useState<string[]>([]); // Track which tags were auto-matched
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(draft?.isEncrypted || false);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [isCode, setIsCode] = useState(draft?.isCode || false);
  const [reminderAt, setReminderAt] = useState<number | null>(draft?.reminderAt || null);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(draft?.expiresAt || null);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [hasContent, setHasContent] = useState(false); // Track if user has entered content
  const [savedHtmlContent, setSavedHtmlContent] = useState<string | undefined>(draft?.savedHtmlContent || undefined); // Save htmlContent when switching to code mode
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reminderPickerRef = useRef<HTMLDivElement>(null);
  const expiryPickerRef = useRef<HTMLDivElement>(null);
  const prevActiveTagFilterRef = useRef<string | null | undefined>(undefined);

  // Auto-select active filter tag when it changes (replace previous filter tag)
  useEffect(() => {
    const prevFilter = prevActiveTagFilterRef.current;
    
    // Remove previous filter tag if it exists and was auto-added
    // Add new filter tag if it exists
    setSelectedTags(prev => {
      let newTags = prev;
      
      // Remove previous filter tag (if different from new one)
      if (prevFilter && prevFilter !== activeTagFilter) {
        newTags = newTags.filter(t => t !== prevFilter);
      }
      
      // Add new filter tag if not already selected
      if (activeTagFilter && !newTags.includes(activeTagFilter)) {
        newTags = [...newTags, activeTagFilter];
      }
      
      return newTags;
    });
    
    // Update ref
    prevActiveTagFilterRef.current = activeTagFilter;
  }, [activeTagFilter]);
  const { settings } = useSettings();

  // Auto-match tags based on keywords when text changes
  useEffect(() => {
    const textToCheck = `${text} ${title}`.toLowerCase();
    const newAutoMatched: string[] = [];
    
    for (const tag of availableTags) {
      if (tag.autoKeywords && tag.autoKeywords.length > 0) {
        for (const keyword of tag.autoKeywords) {
          if (keyword && textToCheck.includes(keyword.toLowerCase())) {
            newAutoMatched.push(tag.id);
            break;
          }
        }
      }
    }
    
    // Add newly matched tags to selection (if not already selected)
    // Remove previously auto-matched tags that no longer match (if they weren't manually selected)
    setSelectedTags(prev => {
      const manuallySelected = prev.filter(id => !autoMatchedTags.includes(id));
      const combined = [...new Set([...manuallySelected, ...newAutoMatched])];
      return combined;
    });
    
    setAutoMatchedTags(newAutoMatched);
  }, [text, title, availableTags]);

  // Update hasContent when text, file, title, htmlContent changes
  useEffect(() => {
    setHasContent(!!(text || file || title || htmlContent || selectedTags.length > 0 || isEncrypted || isCode || reminderAt || expiresAt));
  }, [text, file, title, htmlContent, selectedTags, isEncrypted, isCode, reminderAt, expiresAt]);

  // Save draft to localStorage when content changes
  useEffect(() => {
    const hasDraftContent = text || title || htmlContent || isCode || isEncrypted || reminderAt || expiresAt || savedHtmlContent || selectedTags.length > 0;
    if (hasDraftContent) {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          text,
          title,
          htmlContent,
          selectedTags,
          isEncrypted,
          isCode,
          reminderAt,
          expiresAt,
          savedHtmlContent,
        }));
      } catch (e) {
        console.error('Failed to save draft:', e);
      }
    }
  }, [text, title, htmlContent, selectedTags, isEncrypted, isCode, reminderAt, expiresAt, savedHtmlContent]);

  // Expose focus and setShareData methods to parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        setIsExpanded(true);
      }
    },
    setShareData: (content: string, shareTitle?: string) => {
      setText(content);
      if (shareTitle) setTitle(shareTitle);
      setIsExpanded(true);
      // Focus after state update
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }));

  // Auto focus if prop is set
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      setIsExpanded(true);
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    // Use setTimeout to ensure DOM is updated after isCode toggle
    const adjustHeight = () => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      }
    };
    // Immediate call for text changes
    adjustHeight();
    // Delayed call for isCode toggle (DOM needs to update first)
    const timeoutId = setTimeout(adjustHeight, 0);
    return () => clearTimeout(timeoutId);
  }, [text, isCode]);

  // Close reminder picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (reminderPickerRef.current && !reminderPickerRef.current.contains(e.target as Node)) {
        setShowReminderPicker(false);
      }
    };
    if (showReminderPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showReminderPicker]);

  // Close expiry picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (expiryPickerRef.current && !expiryPickerRef.current.contains(e.target as Node)) {
        setShowExpiryPicker(false);
      }
    };
    if (showExpiryPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExpiryPicker]);

  const detectType = (content: string, file: File | null): ItemType => {
    if (file) {
      if (file.type.startsWith('image/')) return ItemType.IMAGE;
      if (file.type.startsWith('video/')) return ItemType.VIDEO;
      return ItemType.FILE;
    }
    if (/^https?:\/\//i.test(content.trim())) return ItemType.LINK;
    return ItemType.TEXT;
  };

  // RTF를 HTML로 변환 (간단한 변환 - 색상 정보 추출)
  const rtfToHtml = (rtf: string): string | null => {
    try {
      // RTF 색상 테이블 추출
      const colorTableMatch = rtf.match(/\\colortbl;(.*?)}/);
      if (!colorTableMatch) return null;
      
      const colors: string[] = ['#000000']; // index 0은 자동 색상
      const colorDefs = colorTableMatch[1].split(';');
      for (const def of colorDefs) {
        const r = def.match(/\\red(\d+)/)?.[1] || '0';
        const g = def.match(/\\green(\d+)/)?.[1] || '0';
        const b = def.match(/\\blue(\d+)/)?.[1] || '0';
        if (r || g || b) {
          colors.push(`rgb(${r},${g},${b})`);
        }
      }
      
      // RTF 본문 추출 (색상 테이블 이후)
      let body = rtf.substring(colorTableMatch.index! + colorTableMatch[0].length);
      
      // RTF 제어 코드 처리
      let html = '';
      let currentColor = '';
      let i = 0;
      
      while (i < body.length) {
        if (body[i] === '\\') {
          // 색상 변경 감지
          const cfMatch = body.substring(i).match(/^\\cf(\d+)/);
          if (cfMatch) {
            const colorIndex = parseInt(cfMatch[1]);
            if (colors[colorIndex]) {
              if (currentColor) html += '</span>';
              currentColor = colors[colorIndex];
              html += `<span style="color:${currentColor}">`;
            }
            i += cfMatch[0].length;
            continue;
          }
          
          // 줄바꿈
          if (body.substring(i, i + 4) === '\\par') {
            html += '<br>';
            i += 4;
            continue;
          }
          
          // 기타 제어 코드 스킵
          const ctrlMatch = body.substring(i).match(/^\\[a-z]+\d*\s?/);
          if (ctrlMatch) {
            i += ctrlMatch[0].length;
            continue;
          }
          
          // 이스케이프 문자
          if (body[i + 1] === '\\' || body[i + 1] === '{' || body[i + 1] === '}') {
            html += body[i + 1];
            i += 2;
            continue;
          }
          
          i++;
        } else if (body[i] === '{' || body[i] === '}') {
          i++;
        } else if (body[i] === '\r' || body[i] === '\n') {
          i++;
        } else {
          html += body[i];
          i++;
        }
      }
      
      if (currentColor) html += '</span>';
      
      // 의미있는 HTML이 생성되었는지 확인
      if (html.includes('<span')) {
        return `<pre style="font-family: monospace; white-space: pre-wrap;"><code>${html}</code></pre>`;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    // 파일 붙여넣기 처리
    if (e.clipboardData?.files.length) {
      const pastedFile = e.clipboardData.files[0];
      setFile(pastedFile);
      setIsExpanded(true);
      e.preventDefault();
      return;
    }
    
    // 클립보드 데이터 가져오기
    const html = e.clipboardData?.getData('text/html');
    const rtf = e.clipboardData?.getData('text/rtf');
    const plainText = e.clipboardData?.getData('text/plain');
    
    // 1. RTF 처리 (VS Code 등 코드 에디터에서 복사한 경우)
    if (rtf && plainText && !html) {
      const rtfHtml = rtfToHtml(rtf);
      if (rtfHtml) {
        e.preventDefault();
        
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newText = text.substring(0, start) + plainText + text.substring(end);
          setText(newText);
          setHtmlContent(rtfHtml);
          setIsExpanded(true);
          
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + plainText.length;
            textarea.focus();
          }, 0);
        } else {
          setText(prev => prev + plainText);
          setHtmlContent(rtfHtml);
          setIsExpanded(true);
        }
        return;
      }
    }
    
    // 2. HTML 처리 (표, 서식 텍스트 등)
    if (html) {
      // HTML이 서식을 포함하는지 확인
      if (hasRichFormatting(html)) {
        e.preventDefault();
        
        // HTML sanitize
        const sanitized = sanitizeHtml(html);
        
        // plainText가 없으면 HTML에서 텍스트 추출
        const textContent = plainText || (() => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          return doc.body.textContent || '';
        })();
        
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newText = text.substring(0, start) + textContent + text.substring(end);
          setText(newText);
          setHtmlContent(sanitized);
          setIsExpanded(true);
          
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + textContent.length;
            textarea.focus();
          }, 0);
        } else {
          setText(prev => prev + textContent);
          setHtmlContent(sanitized);
          setIsExpanded(true);
        }
      }
    }
  }, [text]);

  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      // Only capture paste if we are focused on the body or the textarea
      if (document.activeElement === document.body || document.activeElement === textareaRef.current) {
        handlePaste(e);
      }
    };
    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [handlePaste]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      setFile(e.dataTransfer.files[0]);
      setIsExpanded(true);
    }
  };

  const handleSuggestTitle = async () => {
    if (!text) return;
    setIsSuggestingTitle(true);
    try {
      const suggested = await suggestTitle(text);
      if (suggested) setTitle(suggested);
    } catch (error) {
      console.error('Failed to suggest title:', error);
    } finally {
      setIsSuggestingTitle(false);
    }
  };

  const handleFormatText = async () => {
    if (!text || htmlContent) return;
    setIsFormatting(true);
    try {
      const formatted = await formatText(text);
      if (formatted && formatted !== text) {
        setHtmlContent(formatted);
      }
    } catch (error) {
      console.error('Failed to format text:', error);
    } finally {
      setIsFormatting(false);
    }
  };

  // Handle code mode toggle - save/restore htmlContent
  const handleCodeToggle = useCallback(() => {
    if (!isCode) {
      // Turning ON code mode - save htmlContent if exists
      if (htmlContent) {
        setSavedHtmlContent(htmlContent);
        setHtmlContent(undefined);
      }
      setIsCode(true);
    } else {
      // Turning OFF code mode - restore htmlContent if saved
      if (savedHtmlContent) {
        setHtmlContent(savedHtmlContent);
        setSavedHtmlContent(undefined);
      }
      setIsCode(false);
    }
  }, [isCode, htmlContent, savedHtmlContent]);

  // Handle blur - collapse only if no content
  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Check if focus is moving to a child element
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    
    // Don't collapse if clicking within the InputArea component
    if (relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }
    
    // Collapse only if there's no content
    if (!hasContent) {
      setIsExpanded(false);
    }
  }, [hasContent]);

  const handleSubmit = () => {
    if (!text && !file) return;

    const type = detectType(text, file);
    
    // Construct the payload
    // 암호화 시 제목 필수
    if (isEncrypted && !title.trim()) {
      alert('암호화된 아이템은 제목이 필수입니다.');
      return;
    }
    if (isEncrypted && !encryptionKey.trim()) {
      alert('암호화 비밀번호를 입력해주세요.');
      return;
    }

    const newItem: Omit<Item, 'id' | 'createdAt'> & { encryptionKey?: string } = {
      type,
      content: text,
      htmlContent: htmlContent,
      tags: selectedTags,
      title: title || undefined,
      isFavorite: false,
      isEncrypted,
      encryptionKey: isEncrypted ? encryptionKey : undefined,
      isCode: isCode || undefined,
      reminderAt: reminderAt || undefined,
      expiresAt: expiresAt || undefined,
    };

    if (file) {
      newItem.fileBlob = file;
      newItem.fileName = file.name;
      newItem.fileSize = file.size;
      newItem.mimeType = file.type;
      // If file exists, text becomes title/description if title is empty
      if (text && !title) {
        newItem.title = text;
        newItem.content = ""; // Clear content if used as title
      }
    }

    onSave(newItem);
    
    // Clear localStorage draft
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    
    // Reset
    setText('');
    setHtmlContent(undefined);
    setSavedHtmlContent(undefined);
    setTitle('');
    setFile(null);
    setSelectedTags([]);
    setAutoMatchedTags([]);
    setIsExpanded(false);
    setIsEncrypted(false);
    setEncryptionKey('');
    setIsCode(false);
    setReminderAt(null);
    setShowReminderPicker(false);
    setExpiresAt(null);
    setShowExpiryPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const shouldSubmit = settings.submitShortcut === 'enter' 
      ? e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey
      : e.key === 'Enter' && (e.ctrlKey || e.metaKey);
    
    if (shouldSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAddNewTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTagName.trim() && onAddTag) {
      onAddTag(newTagName.trim());
      setNewTagName('');
    }
  };

  const handleDeleteTagClick = (tagId: string) => {
    if (onDeleteTag && confirm('이 레이블을 삭제하시겠습니까?')) {
      onDeleteTag(tagId);
      // Unselect if currently selected
      setSelectedTags(prev => prev.filter(t => t !== tagId));
    }
  };

  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border border-slate-200 transition-all duration-200 ${isExpanded ? 'p-4' : 'p-2'}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onBlur={handleBlur}
    >
      {/* File Preview Area */}
      {file && (
        <div className="flex items-center gap-3 p-3 mb-3 bg-slate-50 rounded-lg border border-slate-100 group relative">
          <div className="w-10 h-10 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
            {file.type.startsWith('image/') ? <ImageIcon size={20} /> : <FileText size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
            <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button 
            onClick={() => setFile(null)}
            className="p-1 hover:bg-slate-200 rounded-full text-slate-500"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* HTML Rich Text Preview - hidden in code mode */}
      {htmlContent && !isCode && (
        <div className="mb-3 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-purple-600 flex items-center gap-1">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              서식 텍스트 감지됨
            </span>
            <button
              onClick={() => {
                setHtmlContent(undefined);
                setSavedHtmlContent(undefined);
              }}
              className="text-xs text-purple-500 hover:text-purple-700 px-2 py-0.5 rounded hover:bg-purple-100 transition-colors"
            >
              서식 제거
            </button>
          </div>
          <div 
            className="text-sm text-slate-700 bg-white rounded p-2 border border-purple-100 max-h-[150px] overflow-auto prose prose-sm max-w-none preview-html-content"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlContent) }}
          />
          <style>{`
            .preview-html-content table {
              width: 100%;
              max-width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }
            .preview-html-content td, .preview-html-content th {
              padding: 4px 8px;
              border: 1px solid #e2e8f0;
              max-width: 150px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .preview-html-content th {
              background-color: #f8fafc;
              font-weight: 600;
            }
          `}</style>
        </div>
      )}

      {/* Main Input - Code mode styled */}
      {isCode ? (
        <div className="relative rounded-lg overflow-hidden">
          <div className="absolute top-2 left-3 flex items-center gap-2 text-slate-400 pointer-events-none z-10">
            <Code size={14} className="text-emerald-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-400/70">Code</span>
            {savedHtmlContent && (
              <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded ml-2">
                서식 저장됨
              </span>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onKeyDown={handleKeyDown}
            placeholder="코드를 입력하세요..."
            className="w-full resize-none bg-slate-900 text-slate-100 font-mono text-sm outline-none placeholder:text-slate-500 min-h-[44px] p-3 pt-8 max-h-[300px] rounded-lg leading-relaxed"
            rows={1}
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onKeyDown={handleKeyDown}
            placeholder={file ? "Add a caption or title (optional)..." : "Paste link, type note, or drop file..."}
            className="w-full resize-none bg-transparent outline-none text-slate-700 placeholder:text-slate-400 min-h-[44px] py-2.5 max-h-[300px]"
            rows={1}
          />
        </div>
      )}

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2">
          {/* Title Input with AI Suggest Button */}
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (Optional)"
              className="w-full text-sm px-3 py-2 pr-10 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleSuggestTitle}
              disabled={!text || isSuggestingTitle}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
              title="AI로 제목 추천받기"
            >
              {isSuggestingTitle ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            </button>
          </div>

          {/* AI Format Button - shown when text exists but no htmlContent */}
          {text && !htmlContent && (
            <button
              onClick={handleFormatText}
              disabled={isFormatting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="AI로 서식 자동 적용"
            >
              {isFormatting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              <span>{isFormatting ? '서식 적용 중...' : 'AI 서식 적용'}</span>
            </button>
          )}

          {/* Tag Selection */}
          <div className="flex flex-wrap gap-2 relative">
            {availableTags.map(tag => {
              const isSelected = selectedTags.includes(tag.id);
              const isAutoMatched = autoMatchedTags.includes(tag.id);
              const tagColorClass = tag.color ? getTagColorClass(tag.color, isSelected) : null;
              return (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTags(prev => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors border flex items-center gap-1 ${
                    isSelected 
                      ? tagColorClass 
                        ? tagColorClass
                        : isAutoMatched
                          ? 'bg-amber-100 text-amber-700 border-amber-300'
                          : 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={isAutoMatched ? 'Auto-matched by keyword' : undefined}
                >
                  {tag.color && <span className={`w-2 h-2 rounded-full ${getTagDotClass(tag.color)}`}></span>}
                  {isAutoMatched && isSelected && !tag.color && <span className="text-amber-500">⚡</span>}
                  # {tag.name}
                </button>
              );
            })}
            <button 
              onClick={() => setShowTagManager(!showTagManager)}
              className={`text-xs px-2.5 py-1 transition-colors ${showTagManager ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}
            >
              + Manage Tags
            </button>

            {/* Tag Manager Dropdown */}
            {showTagManager && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
                <div className="p-3 border-b border-slate-100">
                  <form onSubmit={handleAddNewTag} className="flex gap-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="새 레이블 이름..."
                      className="flex-1 text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!newTagName.trim()}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={16} />
                    </button>
                  </form>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {availableTags.length === 0 ? (
                    <p className="p-3 text-sm text-slate-400 text-center">레이블이 없습니다</p>
                  ) : (
                    availableTags.map(tag => (
                      <div 
                        key={tag.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 group"
                      >
                        <span className="text-sm text-slate-700">#{tag.name}</span>
                        <button
                          onClick={() => handleDeleteTagClick(tag.id)}
                          className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-slate-100">
                  <button
                    onClick={() => setShowTagManager(false)}
                    className="w-full px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Options: Code, Expiry, Reminder & Encryption */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
            {/* Code Toggle */}
            <button
              type="button"
              onClick={handleCodeToggle}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                isCode
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Code size={16} />
              <span className="hidden sm:inline">코드</span>
            </button>
            
            {/* Expiry Picker */}
            <div className="relative" ref={expiryPickerRef}>
              <button
                type="button"
                onClick={() => setShowExpiryPicker(!showExpiryPicker)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  expiresAt
                    ? 'bg-orange-100 text-orange-700 border border-orange-200'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Timer size={16} />
                {expiresAt ? (
                  <span className="hidden sm:inline">
                    {new Date(expiresAt).toLocaleDateString('ko-KR', { 
                      month: 'short', 
                      day: 'numeric'
                    })}
                  </span>
                ) : (
                  <span className="hidden sm:inline">만료</span>
                )}
                {expiresAt && (
                  <X 
                    size={14} 
                    className="ml-1 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpiresAt(null);
                    }}
                  />
                )}
              </button>
              
              {showExpiryPicker && (
                <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 w-48">
                  <div className="text-sm font-medium text-slate-700 mb-2">만료 기간</div>
                  <div className="space-y-1">
                    {[
                      { label: '1시간', hours: 1 },
                      { label: '1일', hours: 24 },
                      { label: '1주일', hours: 168 },
                      { label: '1개월', hours: 720 },
                      { label: '1년', hours: 8760 },
                    ].map(({ label, hours }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setExpiresAt(Date.now() + hours * 60 * 60 * 1000);
                          setShowExpiryPicker(false);
                        }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-slate-100 text-slate-600 rounded-lg"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Reminder Picker */}
            <div className="relative" ref={reminderPickerRef}>
              <button
                type="button"
                onClick={() => setShowReminderPicker(!showReminderPicker)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  reminderAt
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Bell size={16} />
                {reminderAt ? (
                  <span className="hidden sm:inline">
                    {new Date(reminderAt).toLocaleDateString('ko-KR', { 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                ) : (
                  <span className="hidden sm:inline">알림</span>
                )}
                {reminderAt && (
                  <X 
                    size={14} 
                    className="ml-1 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReminderAt(null);
                    }}
                  />
                )}
              </button>
              
              {showReminderPicker && (
                <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 w-64">
                  <div className="text-sm font-medium text-slate-700 mb-2">알림 설정</div>
                  <div className="space-y-2">
                    <input
                      type="datetime-local"
                      value={reminderAt ? new Date(reminderAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setReminderAt(new Date(e.target.value).getTime());
                        } else {
                          setReminderAt(null);
                        }
                      }}
                      min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                      className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: '1시간 후', hours: 1 },
                        { label: '내일', hours: 24 },
                        { label: '1주일 후', hours: 168 },
                      ].map(({ label, hours }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            setReminderAt(Date.now() + hours * 60 * 60 * 1000);
                            setShowReminderPicker(false);
                          }}
                          className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowReminderPicker(false)}
                      className="w-full mt-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      확인
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Encryption Toggle */}
            <button
              type="button"
              onClick={() => setIsEncrypted(!isEncrypted)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                isEncrypted
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <LockKeyhole size={16} />
              <span className="hidden sm:inline">암호화</span>
            </button>
            {isEncrypted && (
              <>
                <input
                  type="password"
                  value={encryptionKey}
                  onChange={(e) => setEncryptionKey(e.target.value)}
                  placeholder="비밀번호..."
                  className="flex-1 min-w-[100px] max-w-[180px] text-sm px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-xs text-amber-600 whitespace-nowrap">제목 필수</span>
              </>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1">
              <label className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full cursor-pointer transition-colors">
                <input type="file" className="hidden" onChange={(e) => {
                  if (e.target.files?.length) setFile(e.target.files[0]);
                }} />
                <Paperclip size={18} />
              </label>
            </div>

            <div className="flex items-center gap-2">
               <button 
                onClick={() => {
                  setIsExpanded(false);
                  setText('');
                  setHtmlContent(undefined);
                  setFile(null);
                  setTitle('');
                  setSelectedTags([]);
                  setIsEncrypted(false);
                  setEncryptionKey('');
                  setIsCode(false);
                  setSavedHtmlContent(undefined);
                  setReminderAt(null);
                  setExpiresAt(null);
                  // Clear localStorage draft
                  localStorage.removeItem(DRAFT_STORAGE_KEY);
                }}
                className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                disabled={!text && !file}
                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

InputArea.displayName = 'InputArea';

export default InputArea;
