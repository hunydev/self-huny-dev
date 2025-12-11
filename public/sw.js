// Service Worker for Self PWA
// Version 9 - Share-target interception for instant response
const CACHE_NAME = 'self-v9';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// IndexedDB for pending uploads
const DB_NAME = 'self-pending-uploads';
const DB_VERSION = 1;
const STORE_NAME = 'uploads';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function savePendingUpload(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(data);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getPendingUploads() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function deletePendingUpload(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version 9');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Force immediate activation
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version 9');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Handle share-target requests
async function handleShareTarget(request) {
  console.log('[SW] Processing share-target request');
  
  try {
    const formData = await request.formData();
    
    const title = formData.get('title');
    const text = formData.get('text');
    const url = formData.get('url');
    
    // Collect files
    const files = [];
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.size > 0) {
        // Read file as ArrayBuffer for storage
        const arrayBuffer = await value.arrayBuffer();
        files.push({
          name: value.name,
          type: value.type,
          size: value.size,
          data: arrayBuffer,
        });
        console.log('[SW] Found file:', value.name, 'size:', value.size);
      }
    }
    
    // If there are files, save to IndexedDB and let main app handle upload
    if (files.length > 0) {
      const uploadId = crypto.randomUUID();
      const pendingUpload = {
        id: uploadId,
        files,
        title,
        timestamp: Date.now(),
      };
      
      await savePendingUpload(pendingUpload);
      console.log('[SW] Saved pending upload:', uploadId);
      
      // Redirect immediately to main page with pending upload ID
      return Response.redirect('/?shared=uploading&pendingId=' + uploadId, 303);
    }
    
    // For text/link content, pass through (small and fast)
    if (url || text || title) {
      const content = url || text || title;
      const params = new URLSearchParams();
      params.set('share_mode', 'choice');
      params.set('share_content', content);
      if (title) params.set('share_title', title);
      
      return Response.redirect(`/?${params.toString()}`, 303);
    }
    
    return Response.redirect('/', 303);
  } catch (error) {
    console.error('[SW] Error handling share-target:', error);
    // Fall through to server on error
    return fetch(request);
  }
}

// Fetch event handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Intercept share-target POST requests for instant response
  if (url.pathname === '/share-target' && request.method === 'POST') {
    console.log('[SW] Intercepting share-target POST');
    event.respondWith(handleShareTarget(request));
    return;
  }

  // DO NOT intercept other POST requests
  if (request.method !== 'GET') {
    return;
  }

  // DO NOT intercept API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip non-http(s) schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Only handle GET requests for static assets
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Handle messages from the main app
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  
  // Get pending uploads
  if (event.data && event.data.type === 'GET_PENDING_UPLOADS') {
    const port = event.ports[0];
    if (port) {
      const uploads = await getPendingUploads();
      port.postMessage({ uploads });
    }
    return;
  }
  
  // Delete pending upload
  if (event.data && event.data.type === 'DELETE_PENDING_UPLOAD') {
    const { id } = event.data;
    await deletePendingUpload(id);
    return;
  }
});
