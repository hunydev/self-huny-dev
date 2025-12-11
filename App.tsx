import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Menu, CheckCircle, XCircle, Clock, WifiOff, Search, X, RefreshCw, ArrowUp, Zap, Edit3, Bell } from 'lucide-react';
import Sidebar from './components/Sidebar';
import InputArea, { InputAreaHandle } from './components/InputArea';
import Feed from './components/Feed';
import ScheduledView from './components/ScheduledView';
import ItemModal from './components/ItemModal';
import SettingsModal from './components/SettingsModal';
import LoginScreen from './components/LoginScreen';
import UserMenu from './components/UserMenu';
import UploadProgress from './components/UploadProgress';
import EncryptionModal from './components/EncryptionModal';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { UploadProvider, useUpload } from './contexts/UploadContext';
import { Item, ItemType, Tag } from './types';
import * as db from './services/db';

type ShareStatus = 'success' | 'error' | 'pending' | 'uploading' | null;

interface ShareChoiceData {
  content: string;
  title?: string;
}

// Authenticated app content
const AuthenticatedContent: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [trashItems, setTrashItems] = useState<(Item & { deletedAt?: number })[]>([]);
  const [scheduledItems, setScheduledItems] = useState<Item[]>([]);
  const [expiringItems, setExpiringItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeFilter, setActiveFilter] = useState<ItemType | 'all' | 'favorites' | 'encrypted' | 'trash' | 'scheduled' | 'expiring'>('all');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shareStatus, setShareStatus] = useState<ShareStatus>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [shouldAutoFocus, setShouldAutoFocus] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [shareChoiceData, setShareChoiceData] = useState<ShareChoiceData | null>(null);
  const [encryptionTarget, setEncryptionTarget] = useState<{ id: string; isEncrypted: boolean; title?: string } | null>(null);
  const [swVersion, setSwVersion] = useState<number | null>(null);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  const inputAreaRef = useRef<InputAreaHandle>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { showToast, showUndoToast } = useToast();
  const { addUpload, updateUpload, registerAbortController } = useUpload();

  // Load data function
  const loadData = useCallback(async () => {
    try {
      // First, check and move expired items to trash
      await db.checkExpiredItems();
      
      const [loadedItems, loadedTags, loadedScheduledItems, loadedExpiringItems] = await Promise.all([
        db.getItems(),
        db.getTags(),
        db.getScheduledItems(),
        db.getExpiringItems()
      ]);
      setItems(loadedItems);
      setTags(loadedTags);
      setScheduledItems(loadedScheduledItems);
      setExpiringItems(loadedExpiringItems);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load trash items when trash filter is selected
  const loadTrashItems = useCallback(async () => {
    try {
      const loadedTrashItems = await db.getTrashItems();
      setTrashItems(loadedTrashItems);
    } catch (err) {
      console.error("Failed to load trash items", err);
    }
  }, []);

  // Load scheduled items function
  const loadScheduledItems = useCallback(async () => {
    try {
      const loadedScheduledItems = await db.getScheduledItems();
      setScheduledItems(loadedScheduledItems);
    } catch (err) {
      console.error("Failed to load scheduled items", err);
    }
  }, []);

  // Load expiring items function
  const loadExpiringItems = useCallback(async () => {
    try {
      const loadedExpiringItems = await db.getExpiringItems();
      setExpiringItems(loadedExpiringItems);
    } catch (err) {
      console.error("Failed to load expiring items", err);
    }
  }, []);

  // Load trash items when filter changes to trash
  useEffect(() => {
    if (activeFilter === 'trash') {
      loadTrashItems();
    } else if (activeFilter === 'scheduled') {
      loadScheduledItems();
    } else if (activeFilter === 'expiring') {
      loadExpiringItems();
    }
  }, [activeFilter, loadTrashItems, loadScheduledItems, loadExpiringItems]);

  // Manual refresh function with loading indicator
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadData();
      showToast('목록이 갱신되었습니다', 'success');
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData, isRefreshing, showToast]);

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Track scroll position for scroll-to-top button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || isLoading) return;

    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 300);
    };

    // Check initial scroll position
    handleScroll();

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isLoading]); // Re-run when loading completes

  // Process share queue when back online
  const processShareQueue = useCallback(async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'PROCESS_SHARE_QUEUE' });
    }
  }, []);

  // Get SW version and check for updates
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const getSwVersion = async () => {
      const registration = await navigator.serviceWorker.ready;
      const sw = registration.active;
      if (sw) {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event: MessageEvent) => {
          if (event.data?.version) {
            setSwVersion(event.data.version);
          }
        };
        sw.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
      }
    };

    // Check for SW updates
    const checkForUpdates = async () => {
      const registration = await navigator.serviceWorker.ready;
      
      // Listen for new SW waiting
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New SW is waiting
              setSwUpdateAvailable(true);
            }
          });
        }
      });

      // Check if there's already a waiting SW
      if (registration.waiting) {
        setSwUpdateAvailable(true);
      }

      // Manually check for updates
      registration.update();
    };

    getSwVersion();
    checkForUpdates();
  }, []);

  // Function to apply SW update
  const applySwUpdate = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (registration.waiting) {
      // Set up one-time listener before sending message
      const reloadOnce = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', reloadOnce);
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
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

  // Refresh data when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData]);

  // Check for due reminders and show notifications
  const notifiedReminders = useRef<Set<string>>(new Set());
  const initialLoadTime = useRef<number>(Date.now());
  
  useEffect(() => {
    // Request notification permission on mount if not already granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();
      items.forEach(item => {
        if (item.reminderAt && !notifiedReminders.current.has(item.id)) {
          // Only notify for reminders that are due now (within 1 minute window)
          // Skip reminders that were already past when the page loaded
          const isDueNow = item.reminderAt <= now && item.reminderAt > now - 60000;
          const wasAlreadyPast = item.reminderAt < initialLoadTime.current - 60000;
          
          if (isDueNow && !wasAlreadyPast) {
            notifiedReminders.current.add(item.id);
          
            // Show browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              const title = item.title || (item.type === 'text' ? item.content.slice(0, 50) : item.fileName) || '알림';
              const notification = new Notification('📅 일정 알림', {
                body: title,
                icon: '/icons/icon-192.png',
                tag: item.id,
                data: { itemId: item.id },
              });
              
              notification.onclick = () => {
                window.focus();
                setSelectedItem(item);
                notification.close();
              };
            }
            
            // Also show in-app toast
            showToast(`일정: ${item.title || item.content?.slice(0, 30) || '알림'}`, 'info');
          }
        }
      });
    };

    // Check immediately
    checkReminders();
    
    // Check every minute
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [items, showToast]);

  // Load initial data and check share status - runs only once on mount
  useEffect(() => {
    // Track polling interval to avoid duplicates
    let pollInterval: NodeJS.Timeout | null = null;
    let hasShownUploadToast = false;
    
    loadData();
    
    // Check for share result notification and action parameter
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('shared') as ShareStatus;
    const action = params.get('action');
    const shareMode = params.get('share_mode');
    const shareContent = params.get('share_content');
    const shareTitle = params.get('share_title');
    
    if (shared) {
      setShareStatus(shared);
      // Clean URL immediately
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Clear notification after delay (longer for pending/uploading)
      const delay = shared === 'pending' ? 5000 : shared === 'uploading' ? 10000 : 3000;
      setTimeout(() => setShareStatus(null), delay);
      
      // Reload items to show newly shared content
      // Also claim any orphan items from PWA share target
      if (shared === 'success' || shared === 'uploading') {
        // First claim any orphan items (from PWA share target which can't use auth)
        db.claimOrphanItems()
          .then((result) => {
            if (result.claimed > 0) {
              console.log('[Share] Claimed orphan items:', result.claimed);
            }
          })
          .catch((err) => console.error('[Share] Failed to claim orphans:', err))
          .finally(() => {
            loadData();
            
            // For uploading status, poll for completion (only once)
            if (shared === 'uploading' && !pollInterval) {
              pollInterval = setInterval(async () => {
                try {
                  const items = await db.getItems();
                  const hasUploading = items.some(item => item.uploadStatus === 'uploading');
                  if (!hasUploading && pollInterval && !hasShownUploadToast) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                    hasShownUploadToast = true;
                    loadData();
                    showToast('파일 업로드가 완료되었습니다', 'success');
                  } else if (hasUploading) {
                    // Just update items without toast while uploading
                    setItems(items);
                  }
                } catch (err) {
                  console.error('[Share] Poll error:', err);
                }
              }, 3000);
              
              // Stop polling after 2 minutes max
              setTimeout(() => {
                if (pollInterval) {
                  clearInterval(pollInterval);
                  pollInterval = null;
                }
              }, 120000);
            }
          });
      }
    }
    
    // Handle share choice mode
    if (shareMode === 'choice' && shareContent) {
      setShareChoiceData({
        content: shareContent,
        title: shareTitle || undefined,
      });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Handle "add" action from app shortcut
    if (action === 'add') {
      setShouldAutoFocus(true);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Run only once on mount

  // Auto-match tags based on keywords
  const getAutoMatchedTags = useCallback((content: string, title?: string): string[] => {
    const textToCheck = `${content} ${title || ''}`.toLowerCase();
    const matchedTagIds: string[] = [];
    
    for (const tag of tags) {
      if (tag.autoKeywords && tag.autoKeywords.length > 0) {
        for (const keyword of tag.autoKeywords) {
          if (keyword && textToCheck.includes(keyword.toLowerCase())) {
            matchedTagIds.push(tag.id);
            break;
          }
        }
      }
    }
    
    return matchedTagIds;
  }, [tags]);

  // Handle share choice - instant save
  const handleShareInstant = useCallback(async () => {
    if (!shareChoiceData) return;
    
    const { content, title } = shareChoiceData;
    const type = /^https?:\/\//i.test(content.trim()) ? ItemType.LINK : ItemType.TEXT;
    const autoTags = getAutoMatchedTags(content, title);
    
    try {
      const newItem = await db.saveItem({
        type,
        content,
        title,
        tags: autoTags,
        isFavorite: false,
        isEncrypted: false,
      });
      setItems(prev => [newItem, ...prev]);
      setShareChoiceData(null);
      
      if (autoTags.length > 0) {
        const matchedTagNames = tags
          .filter(t => autoTags.includes(t.id))
          .map(t => t.name)
          .join(', ');
        showToast(`저장 완료 (자동 태그: ${matchedTagNames})`, 'success');
      } else {
        showToast('저장 완료', 'success');
      }
    } catch (err) {
      console.error("Failed to save shared item", err);
      showToast('저장 실패', 'error');
      setShareChoiceData(null);
    }
  }, [shareChoiceData, getAutoMatchedTags, tags, showToast]);

  // Handle share choice - edit mode
  const handleShareEdit = useCallback(() => {
    if (!shareChoiceData || !inputAreaRef.current) return;
    
    // Pass data to InputArea via a special method
    inputAreaRef.current.setShareData(shareChoiceData.content, shareChoiceData.title);
    setShareChoiceData(null);
  }, [shareChoiceData]);

  // Cancel share choice
  const handleShareCancel = useCallback(() => {
    setShareChoiceData(null);
  }, []);

  const handleSaveItem = async (draft: Omit<Item, 'id' | 'createdAt'>) => {
    // Check if this is a file upload
    const isFileUpload = draft.fileBlob && (
      draft.type === ItemType.IMAGE || 
      draft.type === ItemType.VIDEO || 
      draft.type === ItemType.FILE
    );

    let uploadId: string | null = null;
    let abortController: AbortController | null = null;

    // If file upload, add to upload queue
    if (isFileUpload && draft.fileBlob) {
      uploadId = crypto.randomUUID();
      abortController = new AbortController();
      
      // Create preview URL for images/videos
      let previewUrl: string | undefined;
      if (draft.type === ItemType.IMAGE || draft.type === ItemType.VIDEO) {
        previewUrl = URL.createObjectURL(draft.fileBlob);
      }

      addUpload({
        id: uploadId,
        fileName: draft.fileName || 'file',
        fileSize: draft.fileBlob.size,
        type: draft.type === ItemType.IMAGE ? 'image' : draft.type === ItemType.VIDEO ? 'video' : 'file',
        previewUrl,
      });

      // Register abort controller for cancellation
      registerAbortController(uploadId, abortController);

      // Update status to uploading
      updateUpload(uploadId, { status: 'uploading' });
    }

    try {
      const newItem = await db.saveItem(draft, (progress) => {
        if (uploadId) {
          updateUpload(uploadId, { progress, status: 'uploading' });
        }
      }, abortController || undefined);

      // Update status to processing briefly, then completed
      if (uploadId) {
        updateUpload(uploadId, { status: 'processing', progress: 100 });
        setTimeout(() => {
          updateUpload(uploadId!, { status: 'completed' });
        }, 500);
      }

      setItems(prev => [newItem, ...prev]);
      // 리마인더가 있으면 scheduledItems도 업데이트
      if (newItem.reminderAt) {
        setScheduledItems(prev => [...prev, newItem].sort((a, b) => (a.reminderAt || 0) - (b.reminderAt || 0)));
      }
      showToast('아이템이 추가되었습니다', 'success');
    } catch (err) {
      console.error("Failed to save item", err);
      
      if (uploadId) {
        // Check if it was cancelled
        const isCancelled = err instanceof Error && err.message === 'Upload cancelled';
        updateUpload(uploadId, { 
          status: isCancelled ? 'cancelled' : 'error', 
          error: isCancelled ? '업로드가 취소되었습니다' : (err instanceof Error ? err.message : '업로드 실패')
        });
        
        if (!isCancelled) {
          showToast('아이템 추가에 실패했습니다', 'error');
        }
      } else {
        showToast('아이템 추가에 실패했습니다', 'error');
      }
    }
  };

  const handleDeleteItem = async (id: string) => {
    // Find the item before deleting to show in undo toast
    const itemToDelete = items.find(i => i.id === id);
    if (!itemToDelete) return;

    try {
      // Optimistically remove from UI
      setItems(prev => prev.filter(i => i.id !== id));
      
      // Call soft delete API
      await db.deleteItem(id);
      
      // Show undo toast
      showUndoToast(
        `'${itemToDelete.title || itemToDelete.fileName || '아이템'}'이(가) 휴지통으로 이동되었습니다`,
        async () => {
          try {
            // Restore the item
            await db.restoreItem(id);
            // Add it back to the list
            setItems(prev => [itemToDelete, ...prev]);
            showToast('아이템이 복구되었습니다', 'success');
          } catch (err) {
            console.error("Failed to restore item", err);
            showToast('아이템 복구에 실패했습니다', 'error');
          }
        }
      );
    } catch (err) {
      console.error("Failed to delete item", err);
      // Restore the item in UI if delete failed
      setItems(prev => [itemToDelete, ...prev]);
      showToast('아이템 삭제에 실패했습니다', 'error');
    }
  };

  // Restore item from trash
  const handleRestoreItem = async (id: string) => {
    const itemToRestore = trashItems.find(i => i.id === id);
    if (!itemToRestore) return;

    try {
      await db.restoreItem(id);
      // Remove from trash items
      setTrashItems(prev => prev.filter(i => i.id !== id));
      // Add back to main items (without deletedAt)
      const { deletedAt, ...restoredItem } = itemToRestore;
      setItems(prev => [restoredItem, ...prev]);
      showToast('아이템이 복구되었습니다', 'success');
    } catch (err) {
      console.error("Failed to restore item", err);
      showToast('아이템 복구에 실패했습니다', 'error');
    }
  };

  // Permanently delete item from trash
  const handlePermanentDelete = async (id: string) => {
    const itemToDelete = trashItems.find(i => i.id === id);
    if (!itemToDelete) return;

    try {
      await db.permanentDeleteItem(id);
      setTrashItems(prev => prev.filter(i => i.id !== id));
      showToast('아이템이 영구 삭제되었습니다', 'success');
    } catch (err) {
      console.error("Failed to permanently delete item", err);
      showToast('아이템 삭제에 실패했습니다', 'error');
    }
  };

  // Empty entire trash
  const handleEmptyTrash = async () => {
    if (trashItems.length === 0) return;

    try {
      const count = await db.emptyTrash();
      setTrashItems([]);
      showToast(`${count}개의 아이템이 영구 삭제되었습니다`, 'success');
    } catch (err) {
      console.error("Failed to empty trash", err);
      showToast('휴지통 비우기에 실패했습니다', 'error');
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

  const handleUpdateTag = async (tag: Tag) => {
    try {
      await db.updateTag(tag);
      setTags(prev => prev.map(t => t.id === tag.id ? tag : t));
      showToast(`'${tag.name}' 레이블이 수정되었습니다`, 'success');
    } catch (err) {
      console.error("Failed to update tag", err);
      showToast('레이블 수정에 실패했습니다', 'error');
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

  const handleToggleFavorite = async (itemId: string, isFavorite: boolean) => {
    try {
      await db.toggleFavorite(itemId, isFavorite);
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, isFavorite } : item
      ));
      // Update the selected item if it's the one being edited
      if (selectedItem?.id === itemId) {
        setSelectedItem(prev => prev ? { ...prev, isFavorite } : null);
      }
      showToast(isFavorite ? '즐겨찾기에 추가되었습니다' : '즐겨찾기에서 제거되었습니다', 'success');
    } catch (err) {
      console.error("Failed to toggle favorite", err);
      showToast('즐겨찾기 변경에 실패했습니다', 'error');
    }
  };

  // 제목 업데이트
  const handleUpdateTitle = (itemId: string, title: string) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, title } : item
    ));
    if (selectedItem?.id === itemId) {
      setSelectedItem(prev => prev ? { ...prev, title } : null);
    }
    showToast('제목이 업데이트되었습니다', 'success');
  };

  // 리마인더 업데이트
  const handleUpdateReminder = (itemId: string, reminderAt: number | null) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, reminderAt: reminderAt ?? undefined } : item
    ));
    if (selectedItem?.id === itemId) {
      setSelectedItem(prev => prev ? { ...prev, reminderAt: reminderAt ?? undefined } : null);
    }
    // 스케줄 목록도 업데이트
    if (activeFilter === 'scheduled') {
      loadScheduledItems();
    }
    showToast(reminderAt ? '알림이 설정되었습니다' : '알림이 삭제되었습니다', 'success');
  };

  // 만료 업데이트
  const handleUpdateExpiry = (itemId: string, expiresAt: number | null) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, expiresAt: expiresAt ?? undefined } : item
    ));
    if (selectedItem?.id === itemId) {
      setSelectedItem(prev => prev ? { ...prev, expiresAt: expiresAt ?? undefined } : null);
    }
    // 만료 목록도 업데이트
    if (activeFilter === 'expiring') {
      loadExpiringItems();
    } else {
      // 다른 뷰에서도 expiringItems 업데이트
      setExpiringItems(prev => {
        if (expiresAt) {
          // 만료 설정 시 추가 (이미 있으면 업데이트)
          const exists = prev.some(i => i.id === itemId);
          if (exists) {
            return prev.map(i => i.id === itemId ? { ...i, expiresAt } : i);
          } else {
            const item = items.find(i => i.id === itemId);
            if (item) return [...prev, { ...item, expiresAt }];
          }
        } else {
          // 만료 해제 시 제거
          return prev.filter(i => i.id !== itemId);
        }
        return prev;
      });
    }
    showToast(expiresAt ? '만료가 설정되었습니다' : '만료가 해제되었습니다', 'success');
  };

  // 암호화 토글 모달 열기
  const handleOpenEncryptionModal = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setEncryptionTarget({
        id: itemId,
        isEncrypted: item.isEncrypted,
        title: item.title,
      });
    }
  };

  // 암호화 토글 확인
  const handleEncryptionConfirm = async (key: string, title?: string) => {
    if (!encryptionTarget) return;
    
    try {
      await db.toggleEncryption(
        encryptionTarget.id,
        !encryptionTarget.isEncrypted,
        key,
        title
      );
      
      // 암호화 해제 시 서버에서 아이템을 다시 불러와 content 복원
      if (encryptionTarget.isEncrypted) {
        // 암호화 해제: 서버에서 전체 데이터 가져오기
        const updatedItem = await db.getItem(encryptionTarget.id);
        
        setItems(prev => prev.map(item =>
          item.id === encryptionTarget.id ? updatedItem : item
        ));
        
        if (selectedItem?.id === encryptionTarget.id) {
          setSelectedItem(updatedItem);
        }
      } else {
        // 암호화 설정: 로컬에서 업데이트
        setItems(prev => prev.map(item =>
          item.id === encryptionTarget.id
            ? { 
                ...item, 
                isEncrypted: true,
                title: title || item.title,
                // 암호화 시 민감 데이터 숨기기
                content: '',
                fileKey: undefined,
                ogImage: undefined,
                ogDescription: undefined,
              }
            : item
        ));
        
        if (selectedItem?.id === encryptionTarget.id) {
          setSelectedItem(prev => prev ? {
            ...prev,
            isEncrypted: true,
            title: title || prev.title,
            content: '',
            fileKey: undefined,
            ogImage: undefined,
            ogDescription: undefined,
          } : null);
        }
      }
      
      showToast(
        encryptionTarget.isEncrypted ? '암호화가 해제되었습니다' : '암호화되었습니다',
        'success'
      );
    } catch (err) {
      console.error("Failed to toggle encryption", err);
      throw err;
    }
  };

  // Trigger for recalculating upcomingReminder periodically
  const [reminderTick, setReminderTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setReminderTick(t => t + 1), 60000); // Every minute
    return () => clearInterval(interval);
  }, []);

  // Get the next upcoming reminder (future only, at least 1 minute away)
  const upcomingReminder = useMemo(() => {
    const now = Date.now();
    // Only show reminders that are at least 1 minute in the future
    const futureItems = scheduledItems.filter(item => item.reminderAt && item.reminderAt > now + 30000);
    if (futureItems.length === 0) return null;
    
    // Sort by reminderAt to get the nearest one
    const sortedItems = [...futureItems].sort((a, b) => (a.reminderAt || 0) - (b.reminderAt || 0));
    const nextItem = sortedItems[0];
    if (!nextItem.reminderAt) return null;
    
    const reminderDate = new Date(nextItem.reminderAt);
    const diffMs = nextItem.reminderAt - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    let timeText: string;
    if (diffMinutes < 1) {
      timeText = '곧';
    } else if (diffMinutes < 60) {
      timeText = `${diffMinutes}분 후`;
    } else if (diffHours < 24) {
      timeText = `${diffHours}시간 후`;
    } else if (diffDays < 7) {
      timeText = `${diffDays}일 후`;
    } else {
      timeText = reminderDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }
    
    return {
      item: nextItem,
      timeText,
      isUrgent: diffHours < 24
    };
  }, [scheduledItems, reminderTick]);

  // Filtered items based on type, tag, and search
  const filteredItems = useMemo(() => {
    // For trash view, return trash items
    if (activeFilter === 'trash') {
      return trashItems;
    }

    // For scheduled view, return scheduled items
    if (activeFilter === 'scheduled') {
      return scheduledItems;
    }

    // For expiring view, return expiring items sorted by expiration date (soonest first)
    if (activeFilter === 'expiring') {
      return [...expiringItems].sort((a, b) => (a.expiresAt || 0) - (b.expiresAt || 0));
    }

    let result = items;
    
    // Filter by favorites
    if (activeFilter === 'favorites') {
      result = result.filter(item => item.isFavorite);
    }
    // Filter by encrypted
    else if (activeFilter === 'encrypted') {
      result = result.filter(item => item.isEncrypted);
    }
    // Filter by type
    else if (activeFilter !== 'all') {
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
  }, [items, trashItems, scheduledItems, expiringItems, activeFilter, activeTagFilter, searchQuery]);

  // Calculate item counts for sidebar
  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: items.length,
      favorites: items.filter(i => i.isFavorite).length,
      encrypted: items.filter(i => i.isEncrypted).length,
      scheduled: items.filter(i => i.reminderAt != null).length,
      expiring: expiringItems.length,
      trash: trashItems.length,
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
      uploading: {
        bg: 'bg-indigo-500',
        icon: <RefreshCw size={18} className="animate-spin" />,
        text: '파일 업로드 중...',
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

      {/* Share choice modal */}
      {shareChoiceData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">공유 방식 선택</h3>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                {shareChoiceData.content}
              </p>
            </div>
            
            <div className="p-3 space-y-2">
              <button
                onClick={handleShareInstant}
                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-indigo-50 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-200 transition-colors">
                  <Zap size={24} className="text-indigo-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">즉시</div>
                  <div className="text-sm text-slate-500">바로 저장합니다</div>
                </div>
              </button>
              
              <button
                onClick={handleShareEdit}
                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-amber-50 transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
                  <Edit3 size={24} className="text-amber-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">편집</div>
                  <div className="text-sm text-slate-500">저장 전 수정합니다</div>
                </div>
              </button>
            </div>
            
            <div className="p-3 border-t border-slate-100">
              <button
                onClick={handleShareCancel}
                className="w-full py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-800 text-white flex items-center gap-2 text-sm shadow-lg">
          <WifiOff size={16} />
          <span>오프라인 모드</span>
        </div>
      )}

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
          aria-label="맨 위로 스크롤"
        >
          <ArrowUp size={24} />
        </button>
      )}

      <Sidebar 
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        activeTagFilter={activeTagFilter}
        onTagFilterChange={setActiveTagFilter}
        tags={tags}
        onAddTag={handleAddTag}
        onUpdateTag={handleUpdateTag}
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
            <img 
              src="/icons/favicon-32.png" 
              alt="Self" 
              className="ml-2 w-7 h-7 rounded-md"
            />
            <span className="ml-2 font-bold text-slate-800">Self.</span>
            <span className="ml-2 text-[10px] text-slate-400 font-mono">{__COMMIT_HASH__}</span>
            {swVersion && (
              <span className="ml-1 text-[10px] text-slate-400 font-mono">SW:{swVersion}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Upcoming reminder indicator */}
            {upcomingReminder && (
              <button
                onClick={() => {
                  setActiveFilter('scheduled');
                  setSelectedItem(upcomingReminder.item);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                  upcomingReminder.isUrgent 
                    ? 'bg-orange-50 text-orange-600 border border-orange-200' 
                    : 'bg-blue-50 text-blue-600 border border-blue-200'
                }`}
                title={upcomingReminder.item.title || upcomingReminder.item.content?.substring(0, 50) || '예정된 알림'}
              >
                <Bell size={12} className={upcomingReminder.isUrgent ? 'animate-pulse' : ''} />
                <span className="max-w-[60px] truncate hidden sm:inline">{upcomingReminder.item.title || '알림'}</span>
                <span className="font-medium">{upcomingReminder.timeText}</span>
              </button>
            )}
            {swUpdateAvailable && (
              <button
                onClick={applySwUpdate}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 animate-pulse"
                title="새 버전 적용"
              >
                업데이트
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              title="목록 갱신"
            >
              <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <UserMenu />
          </div>
        </div>

        {/* Desktop Header with User Menu */}
        <div className="hidden lg:flex h-14 items-center justify-end px-6 bg-white border-b border-slate-200 shrink-0 gap-3">
          {/* Upcoming reminder indicator */}
          {upcomingReminder && (
            <button
              onClick={() => {
                setActiveFilter('scheduled');
                setSelectedItem(upcomingReminder.item);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                upcomingReminder.isUrgent 
                  ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100' 
                  : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
              } transition-colors`}
              title={upcomingReminder.item.title || upcomingReminder.item.content?.substring(0, 50) || '예정된 알림'}
            >
              <Bell size={14} className={upcomingReminder.isUrgent ? 'animate-pulse' : ''} />
              <span className="max-w-[150px] truncate">{upcomingReminder.item.title || '알림'}</span>
              <span className="font-medium">{upcomingReminder.timeText}</span>
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            title="목록 갱신"
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <UserMenu />
        </div>

        <div ref={scrollContainerRef} className={`flex-1 overflow-y-auto scroll-smooth ${activeFilter === 'scheduled' ? 'flex flex-col' : ''}`}>
          <div className={`${activeFilter === 'scheduled' ? 'flex-1 flex flex-col' : 'max-w-7xl mx-auto'}`}>
            {/* Active filter indicator */}
            {(activeTagFilter || searchQuery) && activeFilter !== 'scheduled' && (
              <div className="px-4 lg:px-8 pt-4 pb-2">
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
            <div className={`${activeFilter === 'scheduled' ? 'flex-1 min-h-0' : ''} px-4 lg:px-8 pb-4 lg:pb-8`}>
              {activeFilter === 'scheduled' ? (
                <div className="h-full">
                  <ScheduledView
                    items={scheduledItems}
                    tags={tags}
                    onItemClick={setSelectedItem}
                  />
                </div>
              ) : (
                <Feed 
                  items={filteredItems} 
                  tags={tags} 
                  onDelete={handleDeleteItem}
                  onItemClick={setSelectedItem}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleEncryption={handleOpenEncryptionModal}
                  isTrashView={activeFilter === 'trash'}
                  onRestore={handleRestoreItem}
                  onPermanentDelete={handlePermanentDelete}
                  onEmptyTrash={handleEmptyTrash}
                />
              )}
            </div>
          </div>
        </div>

        {/* Bottom Input Area - expands upward (hidden in trash and expiring view) */}
        {activeFilter !== 'trash' && activeFilter !== 'expiring' && activeFilter !== 'scheduled' && (
          <div className="shrink-0 px-4 lg:px-8 pb-4 pt-2 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
            <div className="max-w-3xl mx-auto w-full">
              <div className="shadow-lg shadow-slate-900/10 rounded-xl">
                <InputArea 
                  ref={inputAreaRef}
                  onSave={handleSaveItem} 
                  availableTags={tags}
                  autoFocus={shouldAutoFocus}
                  onAddTag={handleAddTag}
                  onDeleteTag={handleDeleteTag}
                  activeTagFilter={activeTagFilter}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Upload Progress */}
      <UploadProgress />

      {/* Item Modal */}
      <ItemModal
        item={selectedItem!}
        tags={tags}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdateTags={handleUpdateItemTags}
        onToggleEncryption={handleOpenEncryptionModal}
        onUpdateTitle={handleUpdateTitle}
        onUpdateReminder={handleUpdateReminder}
        onUpdateExpiry={handleUpdateExpiry}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Encryption Modal */}
      <EncryptionModal
        isOpen={!!encryptionTarget}
        onClose={() => setEncryptionTarget(null)}
        mode={encryptionTarget?.isEncrypted ? 'decrypt' : 'encrypt'}
        currentTitle={encryptionTarget?.title}
        requireTitle={!encryptionTarget?.isEncrypted}
        content={items.find(i => i.id === encryptionTarget?.id)?.content}
        onConfirm={handleEncryptionConfirm}
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
          <UploadProvider>
            <AppContent />
          </UploadProvider>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
};

export default App;