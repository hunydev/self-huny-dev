// Service Worker for Self PWA
const CACHE_NAME = 'self-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
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
    
    // Collect ALL files from formData - Android may use different field names
    // Common field names: files, file, media, image, video, audio, attachment
    const allFiles = [];
    const formDataEntries = [];
    
    // Iterate through all formData entries to find files
    for (const [key, value] of formData.entries()) {
      formDataEntries.push({ key, type: typeof value, isFile: value instanceof File, size: value instanceof File ? value.size : null });
      if (value instanceof File && value.size > 0) {
        allFiles.push(value);
      }
    }

    console.log('[SW] Share target received:', {
      title,
      text,
      url,
      formDataEntries,
      filesCount: allFiles.length,
      fileDetails: allFiles.map(f => ({ name: f?.name, size: f?.size, type: f?.type }))
    });

    // IMPORTANT: Read file data FIRST before any other operation
    // Once we read formData, the file streams are consumed
    const fileBuffers = [];
    if (allFiles.length > 0) {
      for (const file of allFiles) {
        try {
          // Read the entire file into an ArrayBuffer immediately
          const arrayBuffer = await file.arrayBuffer();
          fileBuffers.push({
            name: file.name || 'unnamed',
            type: file.type || 'application/octet-stream',
            size: file.size,
            buffer: arrayBuffer,
          });
          console.log('[SW] File buffered:', file.name, file.size, 'bytes');
        } catch (fileErr) {
          console.error('[SW] Error reading file:', file.name, fileErr);
        }
      }
    }

    // Prepare share data for offline queue (base64 encoded)
    const shareData = {
      title: title || '',
      text: text || '',
      url: url || '',
      files: fileBuffers.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
        data: arrayBufferToBase64(f.buffer),
      })),
    };

    // Try to send to server immediately
    // IMPORTANT: Use /api/share instead of /share-target to avoid service worker intercepting again
    try {
      const serverFormData = new FormData();
      if (title) serverFormData.append('title', title);
      if (text) serverFormData.append('text', text);
      if (url) serverFormData.append('url', url);
      
      // Create new File objects from the buffered data
      for (const fileData of fileBuffers) {
        const blob = new Blob([fileData.buffer], { type: fileData.type });
        const newFile = new File([blob], fileData.name, { 
          type: fileData.type,
          lastModified: Date.now()
        });
        serverFormData.append('files', newFile);
        console.log('[SW] Sending file to server:', newFile.name, newFile.size, 'bytes');
      }

      const response = await fetch('/api/share', {
        method: 'POST',
        body: serverFormData,
      });

      console.log('[SW] Server response:', response.status, response.statusText);

      if (response.ok) {
        // Success - redirect to home with success message
        return Response.redirect('/?shared=success', 303);
      }
      
      // Try to get error details
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[SW] Server error response:', errorText);
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    } catch (networkError) {
      // Offline or server error - queue for later
      console.log('[SW] Network error, queuing share:', networkError);
      await saveToShareQueue(shareData);
      
      // Still redirect to app with pending message
      return Response.redirect('/?shared=pending', 303);
    }
  } catch (error) {
    console.error('[SW] Share target error:', error);
    return Response.redirect('/?shared=error&reason=unknown', 303);
  }
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// Process queued shares when back online
async function processShareQueue() {
  const queuedShares = await getQueuedShares();
  console.log('[SW] Processing share queue, items:', queuedShares.length);
  
  for (const share of queuedShares) {
    try {
      const formData = new FormData();
      if (share.title) formData.append('title', share.title);
      if (share.text) formData.append('text', share.text);
      if (share.url) formData.append('url', share.url);
      
      // Convert base64 files back to blobs
      if (share.files && share.files.length > 0) {
        console.log('[SW] Processing queued files:', share.files.length);
        for (const fileData of share.files) {
          try {
            const binaryStr = atob(fileData.data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: fileData.type });
            const file = new File([blob], fileData.name, { 
              type: fileData.type,
              lastModified: Date.now()
            });
            formData.append('files', file);
            console.log('[SW] Queued file recreated:', fileData.name, bytes.length, 'bytes');
          } catch (fileErr) {
            console.error('[SW] Error recreating file from queue:', fileData.name, fileErr);
          }
        }
      }

      // Use /api/share to avoid service worker intercepting the request
      const response = await fetch('/api/share', {
        method: 'POST',
        body: formData,
      });

      console.log('[SW] Queue sync response:', response.status);

      if (response.ok) {
        await deleteFromQueue(share.id);
        // Notify client about successful sync
        notifyClients({ type: 'SHARE_SYNCED', id: share.id });
        console.log('[SW] Queued share synced and removed:', share.id);
      }
    } catch (error) {
      console.error('[SW] Failed to process queued share:', error);
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
