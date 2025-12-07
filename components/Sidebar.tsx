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
  Zap
} from 'lucide-react';
import { NavItem, ItemType, Tag, Item } from '../types';

interface SidebarProps {
  activeFilter: ItemType | 'all' | 'favorites';
  onFilterChange: (type: ItemType | 'all' | 'favorites') => void;
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
  const [editTagKeywords, setEditTagKeywords] = useState('');
  const [showTagModal, setShowTagModal] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  const navItems: NavItem[] = [
    { id: 'all', label: 'All', icon: <LayoutGrid size={18} />, filterType: 'all' },
    { id: 'favorites', label: 'Favorites', icon: <Star size={18} />, filterType: 'favorites' as any },
    { id: 'text', label: 'Text', icon: <FileText size={18} />, filterType: ItemType.TEXT },
    { id: 'link', label: 'Links', icon: <LinkIcon size={18} />, filterType: ItemType.LINK },
    { id: 'image', label: 'Images', icon: <ImageIcon size={18} />, filterType: ItemType.IMAGE },
    { id: 'video', label: 'Videos', icon: <Video size={18} />, filterType: ItemType.VIDEO },
    { id: 'file', label: 'Files', icon: <FileIcon size={18} />, filterType: ItemType.FILE },
  ];

  const openTagModal = (tag?: Tag) => {
    if (tag) {
      setEditingTag(tag);
      setEditTagName(tag.name);
      setEditTagKeywords((tag.autoKeywords || []).join(', '));
      setIsCreatingTag(false);
    } else {
      setEditingTag(null);
      setEditTagName('');
      setEditTagKeywords('');
      setIsCreatingTag(true);
    }
    setShowTagModal(true);
  };

  const closeTagModal = () => {
    setShowTagModal(false);
    setEditingTag(null);
    setEditTagName('');
    setEditTagKeywords('');
    setIsCreatingTag(false);
  };

  const handleSaveTag = () => {
    if (!editTagName.trim()) return;

    const keywords = editTagKeywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (editingTag) {
      onUpdateTag({
        ...editingTag,
        name: editTagName.trim(),
        autoKeywords: keywords,
      });
    }
    closeTagModal();
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

          {/* Main Nav */}
          <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
            {navItems.map((item) => {
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
                          <Zap size={16} className={`shrink-0 ${activeTagFilter === tag.id ? 'text-amber-500' : 'text-amber-400'}`} title="Auto-classification enabled" />
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
            <button 
              onClick={onSettingsClick}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Settings size={18} />
              Settings
            </button>
          </div>
        </div>
      </div>

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
                <textarea
                  value={editTagKeywords}
                  onChange={(e) => setEditTagKeywords(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="Enter keywords separated by commas (e.g., youtube.com, youtu.be)"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Items containing these keywords will be automatically tagged.
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
