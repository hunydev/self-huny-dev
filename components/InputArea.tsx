import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Paperclip, Image as ImageIcon, X, Send, Wand2, Loader2, FileText, Plus, Trash2 } from 'lucide-react';
import { Item, ItemType, Tag } from '../types';
import { suggestMetadata } from '../services/geminiService';
import { useSettings } from '../contexts/SettingsContext';

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
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [autoMatchedTags, setAutoMatchedTags] = useState<string[]>([]); // Track which tags were auto-matched
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [text]);

  const detectType = (content: string, file: File | null): ItemType => {
    if (file) {
      if (file.type.startsWith('image/')) return ItemType.IMAGE;
      if (file.type.startsWith('video/')) return ItemType.VIDEO;
      return ItemType.FILE;
    }
    if (/^https?:\/\//i.test(content.trim())) return ItemType.LINK;
    return ItemType.TEXT;
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (e.clipboardData?.files.length) {
      const pastedFile = e.clipboardData.files[0];
      setFile(pastedFile);
      setIsExpanded(true);
      e.preventDefault();
    }
  }, []);

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

  const handleAnalyze = async () => {
    if (!text && !file) return;
    setIsAnalyzing(true);
    try {
      const type = detectType(text, file);
      // We only analyze text/links for now to avoid large uploads
      if (type === ItemType.TEXT || type === ItemType.LINK) {
        const suggestion = await suggestMetadata(text, type);
        if (suggestion.title) setTitle(suggestion.title);
        // Here we could map suggested string tags to existing Tag IDs, 
        // but for simplicity, we'll just log or alert. 
        // In a real app, we'd create new tags or match by name.
        // For this demo, let's just use the title.
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = () => {
    if (!text && !file) return;

    const type = detectType(text, file);
    
    // Construct the payload
    const newItem: Omit<Item, 'id' | 'createdAt'> = {
      type,
      content: text,
      tags: selectedTags,
      title: title || undefined,
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
    
    // Reset
    setText('');
    setTitle('');
    setFile(null);
    setSelectedTags([]);
    setAutoMatchedTags([]);
    setIsExpanded(false);
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

      {/* Main Input */}
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

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2">
          {/* Title Input (Explicit) */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (Optional)"
            className="w-full text-sm px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {/* Tag Selection */}
          <div className="flex flex-wrap gap-2 relative">
            {availableTags.map(tag => {
              const isSelected = selectedTags.includes(tag.id);
              const isAutoMatched = autoMatchedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTags(prev => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors border flex items-center gap-1 ${
                    isSelected 
                      ? isAutoMatched
                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                        : 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={isAutoMatched ? 'Auto-matched by keyword' : undefined}
                >
                  {isAutoMatched && isSelected && <span className="text-amber-500">⚡</span>}
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

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1">
              <label className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full cursor-pointer transition-colors">
                <input type="file" className="hidden" onChange={(e) => {
                  if (e.target.files?.length) setFile(e.target.files[0]);
                }} />
                <Paperclip size={18} />
              </label>
              <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing || (!text && !file)}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors disabled:opacity-50"
                title="AI Magic Suggest"
              >
                 {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
              </button>
            </div>

            <div className="flex items-center gap-2">
               <button 
                onClick={() => {
                  setIsExpanded(false);
                  setText('');
                  setFile(null);
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
