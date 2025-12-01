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
  Search
} from 'lucide-react';
import { NavItem, ItemType, Tag, Item } from '../types';

interface SidebarProps {
  activeFilter: ItemType | 'all';
  onFilterChange: (type: ItemType | 'all') => void;
  activeTagFilter: string | null;
  onTagFilterChange: (tagId: string | null) => void;
  tags: Tag[];
  onAddTag: (name: string) => void;
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

  const navItems: NavItem[] = [
    { id: 'all', label: 'All', icon: <LayoutGrid size={18} />, filterType: 'all' },
    { id: 'text', label: 'Text', icon: <FileText size={18} />, filterType: ItemType.TEXT },
    { id: 'link', label: 'Links', icon: <LinkIcon size={18} />, filterType: ItemType.LINK },
    { id: 'image', label: 'Images', icon: <ImageIcon size={18} />, filterType: ItemType.IMAGE },
    { id: 'video', label: 'Videos', icon: <Video size={18} />, filterType: ItemType.VIDEO },
    { id: 'file', label: 'Files', icon: <FileIcon size={18} />, filterType: ItemType.FILE },
  ];

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
                      <div className="flex items-center gap-3 text-sm font-medium">
                        <TagIcon size={16} className={activeTagFilter === tag.id ? 'text-indigo-500' : 'text-slate-400'} />
                        {tag.name}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {tagCount}
                        </span>
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
    </>
  );
};

export default Sidebar;
