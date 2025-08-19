// Helen's Kitchen Service Worker
// Handles push notifications, badge updates, and basic caching

const CACHE_NAME = 'helens-kitchen-v2';
const urlsToCache = [
  '/',
  '/menu',
  '/cart',
  '/checkout',
  '/track-order',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add other critical assets as needed
];

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  let notificationData = {
    title: 'Helen\'s Kitchen',
    body: 'New order received!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'new-order',
    requireInteraction: true,
    actions: [
      {
        action: 'view-orders',
        title: 'View Orders',
        icon: '/icons/icon-192x192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/icon-192x192.png'
      }
    ],
    data: {
      url: '/admin/orders',
      timestamp: Date.now()
    }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = {
        ...notificationData,
        ...pushData
      };
    } catch (e) {
      console.log('Service Worker: Could not parse push data as JSON');
    }
  }

  // Update badge count if provided
  if (notificationData.badgeCount !== undefined) {
    updateBadgeCount(notificationData.badgeCount);
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      actions: notificationData.actions,
      data: notificationData.data,
      vibrate: [200, 100, 200], // Vibration pattern
      sound: '/sounds/notification.mp3' // Optional notification sound
    })
  );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();

  if (event.action === 'view-orders') {
    // Open orders page
    event.waitUntil(
      clients.openWindow('/admin/orders')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes('/admin') && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise, open new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data?.url || '/admin/orders');
        }
      })
    );
  }
});

// Background sync event - handle offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered');
  
  if (event.tag === 'badge-update') {
    event.waitUntil(updateBadgeFromServer());
  }
});

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received:', event.data);
  
  if (event.data.type === 'UPDATE_BADGE') {
    updateBadgeCount(event.data.count);
  } else if (event.data.type === 'CLEAR_BADGE') {
    clearBadgeCount();
  } else if (event.data.type === 'GET_BADGE_COUNT') {
    // Send current badge count back to main thread
    getBadgeCount().then(count => {
      event.ports[0]?.postMessage({ type: 'BADGE_COUNT', count });
    });
  } else if (event.data.type === 'SKIP_WAITING') {
    // Skip waiting and take control immediately
    console.log('Service Worker: Skipping waiting and taking control');
    self.skipWaiting();
    
    // Notify all clients that the service worker has been updated
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'SW_UPDATED' });
      });
    });
  }
});

// Badge management functions
async function updateBadgeCount(count) {
  console.log('Service Worker: Updating badge count to:', count);
  
  try {
    // Use the Badge API if available (iOS 16.4+)
    if ('setAppBadge' in navigator) {
      await navigator.setAppBadge(count);
    }
    
    // Store badge count in localStorage for persistence
    await storeBadgeCount(count);
    
    // Notify all clients about badge update
    notifyClientsOfBadgeUpdate(count);
    
  } catch (error) {
    console.error('Service Worker: Error updating badge:', error);
  }
}

async function clearBadgeCount() {
  console.log('Service Worker: Clearing badge count');
  
  try {
    // Clear badge using Badge API
    if ('clearAppBadge' in navigator) {
      await navigator.clearAppBadge();
    }
    
    // Clear stored count
    await storeBadgeCount(0);
    
    // Notify clients
    notifyClientsOfBadgeUpdate(0);
    
  } catch (error) {
    console.error('Service Worker: Error clearing badge:', error);
  }
}

async function getBadgeCount() {
  try {
    // Try to get from stored data
    const stored = await getStoredBadgeCount();
    return stored || 0;
  } catch (error) {
    console.error('Service Worker: Error getting badge count:', error);
    return 0;
  }
}

async function storeBadgeCount(count) {
  // Store in IndexedDB for persistence across browser sessions
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HelensBadgeDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['badges'], 'readwrite');
      const store = transaction.objectStore('badges');
      
      store.put({ id: 'order-count', count: count });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('badges')) {
        db.createObjectStore('badges', { keyPath: 'id' });
      }
    };
  });
}

async function getStoredBadgeCount() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HelensBadgeDB', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['badges'], 'readonly');
      const store = transaction.objectStore('badges');
      const getRequest = store.get('order-count');
      
      getRequest.onsuccess = () => {
        resolve(getRequest.result?.count || 0);
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('badges')) {
        db.createObjectStore('badges', { keyPath: 'id' });
      }
    };
  });
}

function notifyClientsOfBadgeUpdate(count) {
  // Send message to all clients about badge update
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'BADGE_UPDATED',
        count: count
      });
    });
  });
}

async function updateBadgeFromServer() {
  try {
    // Fetch current unread order count from server
    const response = await fetch('/api/admin/orders/unread-count', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      await updateBadgeCount(data.count || 0);
    }
  } catch (error) {
    console.error('Service Worker: Error updating badge from server:', error);
  }
}

console.log('Service Worker: Loaded and ready');