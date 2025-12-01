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
  Plus
} from 'lucide-react';
import { NavItem, ItemType, Tag } from '../types';

interface SidebarProps {
  activeFilter: ItemType | 'all';
  onFilterChange: (type: ItemType | 'all') => void;
  tags: Tag[];
  onAddTag: (name: string) => void;
  onDeleteTag: (id: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeFilter, 
  onFilterChange, 
  tags, 
  onAddTag, 
  onDeleteTag,
  isOpen,
  setIsOpen
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

          {/* Main Nav */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.filterType) onFilterChange(item.filterType);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeFilter === item.filterType 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}

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
                {tags.map((tag) => (
                  <div key={tag.id} className="group flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                      <TagIcon size={16} className="text-slate-400" />
                      {tag.name}
                    </div>
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
                ))}
              </div>
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100">
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
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
