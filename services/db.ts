import { Item, Tag } from '../types';

const DB_NAME = 'SelfAppDB';
const DB_VERSION = 1;
const STORE_ITEMS = 'items';
const STORE_TAGS = 'tags';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject('IndexedDB error: ' + (event.target as any).error);

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const itemStore = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
        itemStore.createIndex('createdAt', 'createdAt', { unique: false });
        itemStore.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_TAGS)) {
        db.createObjectStore(STORE_TAGS, { keyPath: 'id' });
      }
    };
  });
};

export const saveItem = async (item: Item): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_ITEMS], 'readwrite');
    const store = transaction.objectStore(STORE_ITEMS);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getItems = async (): Promise<Item[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_ITEMS], 'readonly');
    const store = transaction.objectStore(STORE_ITEMS);
    const index = store.index('createdAt');
    const request = index.openCursor(null, 'prev'); // Sort by newest first
    const results: Item[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteItem = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_ITEMS], 'readwrite');
    const store = transaction.objectStore(STORE_ITEMS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const saveTag = async (tag: Tag): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_TAGS], 'readwrite');
    const store = transaction.objectStore(STORE_TAGS);
    const request = store.put(tag);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getTags = async (): Promise<Tag[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_TAGS], 'readonly');
    const store = transaction.objectStore(STORE_TAGS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deleteTag = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_TAGS], 'readwrite');
    const store = transaction.objectStore(STORE_TAGS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
