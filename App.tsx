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
    
    // Simulate checking for Share Intent params (GET)
    // In a real PWA context, these would come from the Manifest start_url query params
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title');
    const text = params.get('text');
    const url = params.get('url');

    if (title || text || url) {
      // Create a new item from share intent
      const content = url || text || title || '';
      const type = url ? ItemType.LINK : ItemType.TEXT;
      
      const newItem: Item = {
        id: crypto.randomUUID(),
        type,
        content,
        title: title || undefined,
        tags: [],
        createdAt: Date.now()
      };
      
      db.saveItem(newItem).then(() => {
        setItems(prev => [newItem, ...prev]);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }

  }, []);

  const handleSaveItem = async (draft: Omit<Item, 'id' | 'createdAt'>) => {
    const newItem: Item = {
      ...draft,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    };

    await db.saveItem(newItem);
    setItems(prev => [newItem, ...prev]);
  };

  const handleDeleteItem = async (id: string) => {
    await db.deleteItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleAddTag = async (name: string) => {
    const newTag: Tag = { id: crypto.randomUUID(), name };
    await db.saveTag(newTag);
    setTags(prev => [...prev, newTag]);
  };

  const handleDeleteTag = async (id: string) => {
    await db.deleteTag(id);
    setTags(prev => prev.filter(t => t.id !== id));
  };

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter(item => item.type === activeFilter);
  }, [items, activeFilter]);

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-400">Loading Self...</div>;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
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
            
            {/* Input Section - Sticky-ish or just top */}
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
