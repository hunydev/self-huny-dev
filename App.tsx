import React, { useEffect, useState, useMemo } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import InputArea from './components/InputArea';
import Feed from './components/Feed';
import { Item, ItemType, Tag } from './types';
import * as db from './services/db';

const App: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeFilter, setActiveFilter] = useState<ItemType | 'all'>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shareSuccess, setShareSuccess] = useState<boolean | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedItems, loadedTags] = await Promise.all([
          db.getItems(),
          db.getTags()
        ]);
        setItems(loadedItems);
        setTags(loadedTags);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
    
    // Check for share result notification
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('shared');
    
    if (shared === 'success') {
      setShareSuccess(true);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Clear notification after 3 seconds
      setTimeout(() => setShareSuccess(null), 3000);
      // Reload items to show newly shared content
      loadData();
    } else if (shared === 'error') {
      setShareSuccess(false);
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => setShareSuccess(null), 3000);
    }
  }, []);

  const handleSaveItem = async (draft: Omit<Item, 'id' | 'createdAt'>) => {
    try {
      const newItem = await db.saveItem(draft);
      setItems(prev => [newItem, ...prev]);
    } catch (err) {
      console.error("Failed to save item", err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await db.deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error("Failed to delete item", err);
    }
  };

  const handleAddTag = async (name: string) => {
    try {
      const newTag: Tag = { id: crypto.randomUUID(), name };
      const savedTag = await db.saveTag(newTag);
      setTags(prev => [...prev, savedTag]);
    } catch (err) {
      console.error("Failed to add tag", err);
    }
  };

  const handleDeleteTag = async (id: string) => {
    try {
      await db.deleteTag(id);
      setTags(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error("Failed to delete tag", err);
    }
  };

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter(item => item.type === activeFilter);
  }, [items, activeFilter]);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <span className="text-slate-400">Loading Self...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Share notification */}
      {shareSuccess !== null && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
          shareSuccess ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {shareSuccess ? '✓ Successfully shared!' : '✗ Failed to share'}
        </div>
      )}

      <Sidebar 
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        tags={tags}
        onAddTag={handleAddTag}
        onDeleteTag={handleDeleteTag}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
        {/* Mobile Header */}
        <div className="lg:hidden h-16 flex items-center px-4 bg-white border-b border-slate-200 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600">
            <Menu size={24} />
          </button>
          <span className="ml-2 font-bold text-slate-800">Self.</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Input Section */}
            <div className="max-w-3xl mx-auto w-full">
              <InputArea 
                onSave={handleSaveItem} 
                availableTags={tags} 
              />
            </div>

            {/* Feed Section */}
            <Feed 
              items={filteredItems} 
              tags={tags} 
              onDelete={handleDeleteItem} 
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
