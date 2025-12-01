// Service Worker for Self PWA
const CACHE_NAME = 'self-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// IndexedDB for offline share queue
const DB_NAME = 'self-sw-db';
const DB_VERSION = 1;
const SHARE_QUEUE_STORE = 'share-queue';

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(SHARE_QUEUE_STORE)) {
        db.createObjectStore(SHARE_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Save share data to queue for offline processing
async function saveToShareQueue(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(SHARE_QUEUE_STORE);
    const request = store.add({
      ...data,
      timestamp: Date.now(),
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Get all queued shares
async function getQueuedShares() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_QUEUE_STORE, 'readonly');
    const store = tx.objectStore(SHARE_QUEUE_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Delete from queue
async function deleteFromQueue(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(SHARE_QUEUE_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Handle share target POST requests
async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const title = formData.get('title');
    const text = formData.get('text');
    const url = formData.get('url');
    const files = formData.getAll('files');

    // Prepare share data
    const shareData = {
      title: title || '',
      text: text || '',
      url: url || '',
      files: [],
    };

    // Process files - convert to base64 for storage
    if (files && files.length > 0) {
      for (const file of files) {
        if (file && file.size > 0) {
          const arrayBuffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          shareData.files.push({
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64,
          });
        }
      }
    }

    // Try to send to server immediately
    try {
      const serverFormData = new FormData();
      if (title) serverFormData.append('title', title);
      if (text) serverFormData.append('text', text);
      if (url) serverFormData.append('url', url);
      
      // Re-create files from the original formData
      for (const file of files) {
        if (file && file.size > 0) {
          serverFormData.append('files', file);
        }
      }

      const response = await fetch('/share-target', {
        method: 'POST',
        body: serverFormData,
      });

      if (response.ok || response.redirected) {
        // Success - redirect to home with success message
        return Response.redirect('/?shared=success', 303);
      }
      throw new Error('Server returned error');
    } catch (networkError) {
      // Offline or server error - queue for later
      console.log('Network error, queuing share:', networkError);
      await saveToShareQueue(shareData);
      
      // Still redirect to app with pending message
      return Response.redirect('/?shared=pending', 303);
    }
  } catch (error) {
    console.error('Share target error:', error);
    return Response.redirect('/?shared=error', 303);
  }
}

// Process queued shares when back online
async function processShareQueue() {
  const queuedShares = await getQueuedShares();
  
  for (const share of queuedShares) {
    try {
      const formData = new FormData();
      if (share.title) formData.append('title', share.title);
      if (share.text) formData.append('text', share.text);
      if (share.url) formData.append('url', share.url);
      
      // Convert base64 files back to blobs
      if (share.files && share.files.length > 0) {
        for (const fileData of share.files) {
          const binaryStr = atob(fileData.data);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: fileData.type });
          const file = new File([blob], fileData.name, { type: fileData.type });
          formData.append('files', file);
        }
      }

      const response = await fetch('/share-target', {
        method: 'POST',
        body: formData,
      });

      if (response.ok || response.redirected) {
        await deleteFromQueue(share.id);
        // Notify client about successful sync
        notifyClients({ type: 'SHARE_SYNCED', id: share.id });
      }
    } catch (error) {
      console.error('Failed to process queued share:', error);
    }
  }
}

// Notify all clients
async function notifyClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// Fetch event handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle share target POST
  if (url.pathname === '/share-target' && request.method === 'POST') {
    event.respondWith(handleShareTarget(request));
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone the response before caching
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return index.html for navigation requests (SPA support)
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Sync event - process queued shares when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'share-sync') {
    event.waitUntil(processShareQueue());
  }
});

// Periodic sync for background processing
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'share-sync') {
    event.waitUntil(processShareQueue());
  }
});

// Message event - handle commands from main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PROCESS_SHARE_QUEUE') {
    event.waitUntil(processShareQueue());
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
