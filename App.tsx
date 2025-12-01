import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Menu, CheckCircle, XCircle, Clock, WifiOff } from 'lucide-react';
import Sidebar from './components/Sidebar';
import InputArea from './components/InputArea';
import Feed from './components/Feed';
import ItemModal from './components/ItemModal';
import { Item, ItemType, Tag } from './types';
import * as db from './services/db';

type ShareStatus = 'success' | 'error' | 'pending' | null;

const App: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeFilter, setActiveFilter] = useState<ItemType | 'all'>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shareStatus, setShareStatus] = useState<ShareStatus>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Load data function
  const loadData = useCallback(async () => {
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
  }, []);

  // Process share queue when back online
  const processShareQueue = useCallback(async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'PROCESS_SHARE_QUEUE' });
    }
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Try to process any queued shares
      processShareQueue();
      // Reload data
      loadData();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData, processShareQueue]);

  // Listen for service worker messages
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'SHARE_SYNCED') {
          // Reload data when queued share is synced
          loadData();
          setShareStatus('success');
          setTimeout(() => setShareStatus(null), 3000);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, [loadData]);

  // Load initial data and check share status
  useEffect(() => {
    loadData();
    
    // Check for share result notification
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('shared') as ShareStatus;
    
    if (shared) {
      setShareStatus(shared);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Clear notification after delay (longer for pending)
      const delay = shared === 'pending' ? 5000 : 3000;
      setTimeout(() => setShareStatus(null), delay);
      
      // Reload items to show newly shared content
      if (shared === 'success') {
        loadData();
      }
    }
  }, [loadData]);

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

  const handleUpdateItemTags = async (itemId: string, tagIds: string[]) => {
    try {
      await db.updateItemTags(itemId, tagIds);
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, tags: tagIds } : item
      ));
      // Update the selected item if it's the one being edited
      if (selectedItem?.id === itemId) {
        setSelectedItem(prev => prev ? { ...prev, tags: tagIds } : null);
      }
    } catch (err) {
      console.error("Failed to update item tags", err);
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

  // Share notification component
  const ShareNotification = () => {
    if (!shareStatus) return null;

    const configs = {
      success: {
        bg: 'bg-emerald-500',
        icon: <CheckCircle size={18} />,
        text: '공유 완료!',
      },
      error: {
        bg: 'bg-red-500',
        icon: <XCircle size={18} />,
        text: '공유 실패',
      },
      pending: {
        bg: 'bg-amber-500',
        icon: <Clock size={18} />,
        text: '오프라인 - 연결 시 자동 저장됩니다',
      },
    };

    const config = configs[shareStatus];

    return (
      <div className={`fixed top-4 left-1/2 z-50 px-4 py-3 rounded-xl shadow-lg ${config.bg} text-white flex items-center gap-2 animate-toast`}>
        {config.icon}
        <span className="font-medium text-sm">{config.text}</span>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Share notification */}
      <ShareNotification />

      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-800 text-white flex items-center gap-2 text-sm shadow-lg">
          <WifiOff size={16} />
          <span>오프라인 모드</span>
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
          <span className="ml-2 text-[10px] text-slate-400 font-mono">{__COMMIT_HASH__}</span>
        </div>

        <div className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-7xl mx-auto">
            
            {/* Input Section - Sticky */}
            <div className="sticky top-0 z-20 bg-slate-50 pt-4 lg:pt-8 pb-4 px-4 lg:px-8">
              <div className="max-w-3xl mx-auto w-full">
                <InputArea 
                  onSave={handleSaveItem} 
                  availableTags={tags} 
                />
              </div>
            </div>

            {/* Feed Section */}
            <div className="px-4 lg:px-8 pb-4 lg:pb-8">
              <Feed 
                items={filteredItems} 
                tags={tags} 
                onDelete={handleDeleteItem}
                onItemClick={setSelectedItem}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Item Modal */}
      <ItemModal
        item={selectedItem!}
        tags={tags}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdateTags={handleUpdateItemTags}
      />
    </div>
  );
};

export default App;
