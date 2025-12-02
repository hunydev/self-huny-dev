import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Menu, CheckCircle, XCircle, Clock, WifiOff, Search, X } from 'lucide-react';
import Sidebar from './components/Sidebar';
import InputArea, { InputAreaHandle } from './components/InputArea';
import Feed from './components/Feed';
import ItemModal from './components/ItemModal';
import SettingsModal from './components/SettingsModal';
import LoginScreen from './components/LoginScreen';
import UserMenu from './components/UserMenu';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { Item, ItemType, Tag } from './types';
import * as db from './services/db';

type ShareStatus = 'success' | 'error' | 'pending' | null;

// Authenticated app content
const AuthenticatedContent: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeFilter, setActiveFilter] = useState<ItemType | 'all'>('all');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shareStatus, setShareStatus] = useState<ShareStatus>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [shouldAutoFocus, setShouldAutoFocus] = useState(false);
  const inputAreaRef = useRef<InputAreaHandle>(null);
  const { showToast } = useToast();

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
    
    // Check for share result notification and action parameter
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('shared') as ShareStatus;
    const action = params.get('action');
    
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
    
    // Handle "add" action from app shortcut
    if (action === 'add') {
      setShouldAutoFocus(true);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [loadData]);

  const handleSaveItem = async (draft: Omit<Item, 'id' | 'createdAt'>) => {
    try {
      const newItem = await db.saveItem(draft);
      setItems(prev => [newItem, ...prev]);
      showToast('아이템이 추가되었습니다', 'success');
    } catch (err) {
      console.error("Failed to save item", err);
      showToast('아이템 추가에 실패했습니다', 'error');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await db.deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      showToast('아이템이 삭제되었습니다', 'success');
    } catch (err) {
      console.error("Failed to delete item", err);
      showToast('아이템 삭제에 실패했습니다', 'error');
    }
  };

  const handleAddTag = async (name: string) => {
    try {
      const newTag: Tag = { id: crypto.randomUUID(), name };
      const savedTag = await db.saveTag(newTag);
      setTags(prev => [...prev, savedTag]);
      showToast(`'${name}' 레이블이 추가되었습니다`, 'success');
    } catch (err) {
      console.error("Failed to add tag", err);
      showToast('레이블 추가에 실패했습니다', 'error');
    }
  };

  const handleDeleteTag = async (id: string) => {
    try {
      const tagName = tags.find(t => t.id === id)?.name;
      await db.deleteTag(id);
      setTags(prev => prev.filter(t => t.id !== id));
      showToast(`'${tagName}' 레이블이 삭제되었습니다`, 'success');
    } catch (err) {
      console.error("Failed to delete tag", err);
      showToast('레이블 삭제에 실패했습니다', 'error');
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
      showToast('레이블이 업데이트되었습니다', 'success');
    } catch (err) {
      console.error("Failed to update item tags", err);
      showToast('레이블 업데이트에 실패했습니다', 'error');
    }
  };

  // Filtered items based on type, tag, and search
  const filteredItems = useMemo(() => {
    let result = items;
    
    // Filter by type
    if (activeFilter !== 'all') {
      result = result.filter(item => item.type === activeFilter);
    }
    
    // Filter by tag
    if (activeTagFilter) {
      result = result.filter(item => item.tags.includes(activeTagFilter));
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        (item.title?.toLowerCase().includes(query)) ||
        (item.content?.toLowerCase().includes(query)) ||
        (item.fileName?.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [items, activeFilter, activeTagFilter, searchQuery]);

  // Calculate item counts for sidebar
  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: items.length,
      [ItemType.TEXT]: items.filter(i => i.type === ItemType.TEXT).length,
      [ItemType.LINK]: items.filter(i => i.type === ItemType.LINK).length,
      [ItemType.IMAGE]: items.filter(i => i.type === ItemType.IMAGE).length,
      [ItemType.VIDEO]: items.filter(i => i.type === ItemType.VIDEO).length,
      [ItemType.FILE]: items.filter(i => i.type === ItemType.FILE).length,
    };
    
    // Count items per tag
    tags.forEach(tag => {
      counts[`tag:${tag.id}`] = items.filter(i => i.tags.includes(tag.id)).length;
    });
    
    return counts;
  }, [items, tags]);

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
        activeTagFilter={activeTagFilter}
        onTagFilterChange={setActiveTagFilter}
        tags={tags}
        onAddTag={handleAddTag}
        onDeleteTag={handleDeleteTag}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onSettingsClick={() => setIsSettingsOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        itemCounts={itemCounts}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
        {/* Mobile Header */}
        <div className="lg:hidden h-16 flex items-center justify-between px-4 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600">
              <Menu size={24} />
            </button>
            <span className="ml-2 font-bold text-slate-800">Self.</span>
            <span className="ml-2 text-[10px] text-slate-400 font-mono">{__COMMIT_HASH__}</span>
          </div>
          <UserMenu />
        </div>

        {/* Desktop Header with User Menu */}
        <div className="hidden lg:flex h-14 items-center justify-end px-6 bg-white border-b border-slate-200 shrink-0">
          <UserMenu />
        </div>

        <div className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-7xl mx-auto">
            
            {/* Input Section - Sticky */}
            <div className="sticky top-0 z-20 bg-slate-50 pt-4 lg:pt-8 pb-4 px-4 lg:px-8">
              <div className="max-w-3xl mx-auto w-full">
                <InputArea 
                  ref={inputAreaRef}
                  onSave={handleSaveItem} 
                  availableTags={tags}
                  autoFocus={shouldAutoFocus}
                  onAddTag={handleAddTag}
                  onDeleteTag={handleDeleteTag}
                />
              </div>
            </div>

            {/* Active filter indicator */}
            {(activeTagFilter || searchQuery) && (
              <div className="px-4 lg:px-8 pb-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  {searchQuery && (
                    <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                      <Search size={14} />
                      "{searchQuery}"
                      <button onClick={() => setSearchQuery('')} className="ml-1 hover:text-slate-700">
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  {activeTagFilter && (
                    <span className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg border border-indigo-200">
                      #{tags.find(t => t.id === activeTagFilter)?.name}
                      <button onClick={() => setActiveTagFilter(null)} className="ml-1 hover:text-indigo-800">
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  <span className="text-slate-400">
                    {filteredItems.length} items
                  </span>
                </div>
              </div>
            )}

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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

// App content wrapper that handles auth state
const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <AuthenticatedContent />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
};

export default App;