import React, { useState } from 'react';
import { 
  LayoutGrid, 
  FileText, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Video, 
  File as FileIcon, 
  Settings,
  Tag as TagIcon,
  X,
  Plus,
  Search,
  Star,
  Edit2,
  Zap,
  LockKeyhole,
  Code2,
  Info,
  Trash2,
  HelpCircle,
  Bell
} from 'lucide-react';
import { NavItem, ItemType, Tag } from '../types';

interface SidebarProps {
  activeFilter: ItemType | 'all' | 'favorites' | 'encrypted' | 'trash' | 'scheduled';
  onFilterChange: (type: ItemType | 'all' | 'favorites' | 'encrypted' | 'trash' | 'scheduled') => void;
  activeTagFilter: string | null;
  onTagFilterChange: (tagId: string | null) => void;
  tags: Tag[];
  onAddTag: (name: string) => void;
  onUpdateTag: (tag: Tag) => void;
  onDeleteTag: (id: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSettingsClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  itemCounts: Record<string, number>;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeFilter, 
  onFilterChange,
  activeTagFilter,
  onTagFilterChange,
  tags, 
  onAddTag,
  onUpdateTag,
  onDeleteTag,
  isOpen,
  setIsOpen,
  onSettingsClick,
  searchQuery,
  onSearchChange,
  itemCounts
}) => {
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagKeywords, setEditTagKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [showTagModal, setShowTagModal] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Type filters
  const typeNavItems: NavItem[] = [
    { id: 'all', label: 'All', icon: <LayoutGrid size={18} />, filterType: 'all' },
    { id: 'text', label: 'Text', icon: <FileText size={18} />, filterType: ItemType.TEXT },
    { id: 'link', label: 'Links', icon: <LinkIcon size={18} />, filterType: ItemType.LINK },
    { id: 'image', label: 'Images', icon: <ImageIcon size={18} />, filterType: ItemType.IMAGE },
    { id: 'video', label: 'Videos', icon: <Video size={18} />, filterType: ItemType.VIDEO },
    { id: 'file', label: 'Files', icon: <FileIcon size={18} />, filterType: ItemType.FILE },
  ];

  // Special filters (separated)
  const specialNavItems: NavItem[] = [
    { id: 'favorites', label: 'Favorites', icon: <Star size={18} />, filterType: 'favorites' as any },
    { id: 'encrypted', label: 'Encrypted', icon: <LockKeyhole size={18} />, filterType: 'encrypted' as any },
    { id: 'scheduled', label: 'Scheduled', icon: <Bell size={18} />, filterType: 'scheduled' as any },
    { id: 'trash', label: 'Trash', icon: <Trash2 size={18} />, filterType: 'trash' as any },
  ];

  const openTagModal = (tag?: Tag) => {
    if (tag) {
      setEditingTag(tag);
      setEditTagName(tag.name);
      setEditTagKeywords(tag.autoKeywords || []);
      setKeywordInput('');
      setIsCreatingTag(false);
    } else {
      setEditingTag(null);
      setEditTagName('');
      setEditTagKeywords([]);
      setKeywordInput('');
      setIsCreatingTag(true);
    }
    setShowTagModal(true);
  };

  const closeTagModal = () => {
    setShowTagModal(false);
    setEditingTag(null);
    setEditTagName('');
    setEditTagKeywords([]);
    setKeywordInput('');
    setIsCreatingTag(false);
  };

  const handleSaveTag = () => {
    if (!editTagName.trim()) return;

    if (editingTag) {
      onUpdateTag({
        ...editingTag,
        name: editTagName.trim(),
        autoKeywords: editTagKeywords,
      });
    }
    closeTagModal();
  };

  const addKeyword = (keyword: string) => {
    const trimmed = keyword.trim().toLowerCase();
    if (trimmed && !editTagKeywords.includes(trimmed)) {
      setEditTagKeywords([...editTagKeywords, trimmed]);
    }
    setKeywordInput('');
  };

  const removeKeyword = (keyword: string) => {
    setEditTagKeywords(editTagKeywords.filter(k => k !== keyword));
  };

  const handleKeywordInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(keywordInput);
    } else if (e.key === 'Backspace' && !keywordInput && editTagKeywords.length > 0) {
      removeKeyword(editTagKeywords[editTagKeywords.length - 1]);
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.trim()) {
      onAddTag(newTag.trim());
      setNewTag('');
      setShowTagInput(false);
    }
  };

  const handleTagClick = (tagId: string) => {
    // Clear type filter when selecting a tag
    if (activeTagFilter === tagId) {
      onTagFilterChange(null);
    } else {
      onTagFilterChange(tagId);
      onFilterChange('all');
    }
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 bottom-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:z-0
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-100 justify-between">
            <div className="flex items-center gap-2">
              <img 
                src="/icons/favicon-32.png" 
                alt="Self" 
                className="w-8 h-8 rounded-lg"
              />
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Self.
              </h1>
              <span className="text-[10px] text-slate-400 font-mono">{__COMMIT_HASH__}</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400">
              <X size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {searchQuery && (
                <button 
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded text-slate-400"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Main Nav - Type Filters */}
          <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
            {typeNavItems.map((item) => {
              const count = itemCounts[item.filterType || 'all'] || 0;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.filterType) {
                      onFilterChange(item.filterType);
                      onTagFilterChange(null); // Clear tag filter
                    }
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeFilter === item.filterType && !activeTagFilter
                      ? 'bg-indigo-50 text-indigo-600' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    {item.label}
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {count}
                  </span>
                </button>
              );
            })}

            <div className="my-4 border-t border-slate-100 mx-3" />

            {/* Special Filters - Favorites, Encrypted, Trash */}
            <div className="px-0">
              <span className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Collections</span>
              <div className="mt-2 space-y-1">
                {specialNavItems.map((item) => {
                  const count = itemCounts[item.filterType || 'all'] || 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.filterType) {
                          onFilterChange(item.filterType);
                          onTagFilterChange(null);
                        }
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        activeFilter === item.filterType && !activeTagFilter
                          ? item.id === 'trash' 
                            ? 'bg-red-50 text-red-600'
                            : item.id === 'favorites'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-indigo-50 text-indigo-600'
                          : item.id === 'trash'
                          ? 'text-slate-600 hover:bg-red-50 hover:text-red-600'
                          : item.id === 'favorites'
                          ? 'text-slate-600 hover:bg-amber-50 hover:text-amber-600'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        {item.label}
                      </div>
                      {count > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                          item.id === 'trash' 
                            ? 'text-red-500 bg-red-100' 
                            : item.id === 'favorites'
                            ? 'text-amber-500 bg-amber-100'
                            : 'text-slate-400 bg-slate-100'
                        }`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="my-4 border-t border-slate-100 mx-3" />

            {/* Tags Section */}
            <div className="px-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Labels</span>
                <button 
                  onClick={() => setShowTagInput(!showTagInput)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600"
                >
                  <Plus size={14} />
                </button>
              </div>

              {showTagInput && (
                <form onSubmit={handleAddTag} className="mb-2">
                  <input
                    type="text"
                    autoFocus
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="w-full text-sm px-2 py-1 border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="New label..."
                    onBlur={() => !newTag && setShowTagInput(false)}
                  />
                </form>
              )}

              <div className="space-y-0.5">
                {tags.map((tag) => {
                  const tagCount = itemCounts[`tag:${tag.id}`] || 0;
                  const hasAutoKeywords = tag.autoKeywords && tag.autoKeywords.length > 0;
                  return (
                    <div 
                      key={tag.id} 
                      onClick={() => handleTagClick(tag.id)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                        activeTagFilter === tag.id
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium min-w-0">
                        {hasAutoKeywords ? (
                          <Zap size={16} className={`shrink-0 ${activeTagFilter === tag.id ? 'text-amber-500' : 'text-amber-400'}`} aria-label="Auto-classification enabled" />
                        ) : (
                          <TagIcon size={16} className={`shrink-0 ${activeTagFilter === tag.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                        )}
                        <span className="truncate">{tag.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {tagCount}
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openTagModal(tag);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-indigo-500 transition-opacity"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if(confirm('Delete label?')) onDeleteTag(tag.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center justify-center gap-2">
              <button 
                onClick={onSettingsClick}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings size={18} />
              </button>
              <button 
                onClick={() => setShowCreditsModal(true)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                title="Open Source Credits"
              >
                <Code2 size={18} />
              </button>
              <button 
                onClick={() => setShowAboutModal(true)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                title="About"
              >
                <Info size={18} />
              </button>
              <button 
                onClick={() => setShowHelpModal(true)}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="사용방법"
              >
                <HelpCircle size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Credits Modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">오픈소스 라이선스</h3>
              <button onClick={() => setShowCreditsModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              <p className="text-sm text-slate-600">
                이 프로젝트는 다음의 훌륭한 오픈소스 라이브러리들을 사용합니다:
              </p>
              <div className="space-y-3">
                {[
                  { name: 'React', license: 'MIT', url: 'https://react.dev' },
                  { name: 'Vite', license: 'MIT', url: 'https://vitejs.dev' },
                  { name: 'Hono', license: 'MIT', url: 'https://hono.dev' },
                  { name: 'Tailwind CSS', license: 'MIT', url: 'https://tailwindcss.com' },
                  { name: 'Lucide Icons', license: 'ISC', url: 'https://lucide.dev' },
                  { name: 'JSZip', license: 'MIT/GPLv3', url: 'https://stuk.github.io/jszip' },
                  { name: 'Prism.js', license: 'MIT', url: 'https://prismjs.com' },
                  { name: 'PDF.js', license: 'Apache 2.0', url: 'https://mozilla.github.io/pdf.js' },
                  { name: 'SheetJS', license: 'Apache 2.0', url: 'https://sheetjs.com' },
                ].map((lib) => (
                  <a
                    key={lib.name}
                    href={lib.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <span className="font-medium text-slate-800">{lib.name}</span>
                    <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded">{lib.license}</span>
                  </a>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-4">
                모든 라이브러리의 저작권자들께 감사드립니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">Self. 소개</h3>
              <button onClick={() => setShowAboutModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <img 
                  src="/icons/favicon-32.png" 
                  alt="Self" 
                  className="w-16 h-16 rounded-xl"
                />
                <div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                    Self.
                  </h2>
                  <p className="text-sm text-slate-500">Personal Knowledge Manager</p>
                </div>
              </div>
              
              <p className="text-sm text-slate-600 leading-relaxed">
                Self는 개인 지식과 정보를 효율적으로 관리하기 위한 PWA 기반 애플리케이션입니다. 
                텍스트, 링크, 이미지, 동영상, 파일 등 다양한 형태의 콘텐츠를 저장하고 정리할 수 있습니다.
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium">버전:</span>
                  <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{__COMMIT_HASH__}</code>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium">기술 스택:</span>
                  <span>React, Cloudflare Workers, D1, R2</span>
                </div>
              </div>

              <a
                href="https://github.com/hunydev/self-huny-dev"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
                GitHub에서 보기
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal - 사용방법 */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">📖 사용 방법</h3>
              <button onClick={() => setShowHelpModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(85vh-60px)]">
              {/* 기본 사용법 */}
              <section>
                <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  콘텐츠 저장하기
                </h4>
                <ul className="space-y-1.5 text-sm text-slate-600 ml-8">
                  <li>• <strong>텍스트/링크:</strong> 입력창에 직접 붙여넣기 또는 입력</li>
                  <li>• <strong>파일:</strong> 드래그 앤 드롭 또는 📎 버튼 클릭</li>
                  <li>• <strong>공유:</strong> 다른 앱에서 Self로 공유 (PWA 설치 시)</li>
                </ul>
              </section>

              {/* 레이블 관리 */}
              <section>
                <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  레이블로 정리하기
                </h4>
                <ul className="space-y-1.5 text-sm text-slate-600 ml-8">
                  <li>• 사이드바 Labels에서 <strong>+</strong> 버튼으로 새 레이블 생성</li>
                  <li>• 레이블 편집에서 <strong>자동 분류 키워드</strong> 설정 가능</li>
                  <li>• 키워드가 포함된 콘텐츠는 자동으로 해당 레이블이 지정됨</li>
                </ul>
              </section>

              {/* 특수 기능 */}
              <section>
                <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  특수 기능
                </h4>
                <div className="space-y-2 text-sm text-slate-600 ml-8">
                  <div className="flex items-start gap-2">
                    <Star size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <span><strong>즐겨찾기:</strong> 중요한 아이템을 별표 표시하여 빠르게 접근</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <LockKeyhole size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                    <span><strong>암호화:</strong> 민감한 정보를 비밀번호로 보호</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Trash2 size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <span><strong>휴지통:</strong> 삭제된 아이템은 휴지통에서 복구 가능</span>
                  </div>
                </div>
              </section>

              {/* 팁 */}
              <section>
                <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xs font-bold">💡</span>
                  유용한 팁
                </h4>
                <ul className="space-y-1.5 text-sm text-slate-600 ml-8">
                  <li>• URL을 입력하면 자동으로 OG 미리보기를 가져옵니다</li>
                  <li>• 검색창에서 제목, 내용, 파일명으로 검색 가능</li>
                  <li>• 삭제 후 5초 내 <strong>실행 취소</strong>로 즉시 복구 가능</li>
                  <li>• PWA 설치 시 홈 화면에서 앱처럼 사용 가능</li>
                </ul>
              </section>

              {/* 키보드 단축키 */}
              <section>
                <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-xs font-bold">⌨️</span>
                  입력 단축키
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm ml-8">
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-slate-100 rounded text-xs font-mono">Ctrl/⌘ + Enter</kbd>
                    <span className="text-slate-600">저장</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-slate-100 rounded text-xs font-mono">Ctrl/⌘ + V</kbd>
                    <span className="text-slate-600">붙여넣기</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Tag Edit Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">
                {isCreatingTag ? 'New Label' : 'Edit Label'}
              </h3>
              <button
                onClick={closeTagModal}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Label Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={editTagName}
                  onChange={(e) => setEditTagName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter label name..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Auto-classification Keywords
                </label>
                <div className="border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
                  {/* 키워드 칩 목록 */}
                  {editTagKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 pb-0">
                      {editTagKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-md"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => removeKeyword(keyword)}
                            className="hover:bg-indigo-200 rounded-full p-0.5 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* 입력 필드 */}
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeywordInputKeyDown}
                    onBlur={() => keywordInput && addKeyword(keywordInput)}
                    className="w-full px-3 py-2 border-0 focus:outline-none focus:ring-0 bg-transparent"
                    placeholder={editTagKeywords.length > 0 ? "Add more..." : "Type and press Enter to add..."}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Enter</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">,</kbd> to add. <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Backspace</kbd> to remove last.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 p-4 border-t border-slate-100">
              <button
                onClick={closeTagModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTag}
                disabled={!editTagName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingTag ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
