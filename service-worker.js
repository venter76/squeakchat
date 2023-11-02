const CACHE_NAME = 'static-cache-v10';
const STATIC_ASSETS = [
    
    '/iconLarge_1.png',
    '/iconLarge_2.png',
    '/iconLarge_3.png',
    '/placeholderchat.html',
    '/MrF.gif',
    '/NXRX.gif',
    '/penguin.gif',
    '/cat.gif',
    '/sound.mp3',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
   
    // ... other static assets
];


self.addEventListener('install', (event) => {
    self.skipWaiting();  // Add this line
    event.waitUntil(

        caches.open(CACHE_NAME).then(cache => {
            STATIC_ASSETS.forEach(asset => {
                cache.add(asset).catch(error => {
                    console.error(`Failed to cache asset: ${asset}`, error);
                });
            });
        })
    );
});











self.addEventListener('activate', (event) => {
    console.log('Service Worker activated!');

     // Manually trigger a test notification
    //  self.registration.showNotification('Test Notification', {
    //     body: 'This is a test push notification!',
    //     icon: '/iconLarge_1.png',
    //     badge: '/iconLarge_1.png',
    // });
});



self.addEventListener('push', function(event) {
    console.log("Push event received");
    const data = event.data.json();
    console.log("Received push data:", data);

    const options = {
        body: data.body,
        icon: '/iconLarge_1.png',
        badge: '/iconLarge_1.png',
        // sound: '/sound.mp3'  // Path to the sound file
    };

    // Try to play a sound manually
  try {
    const audio = new Audio('/sound.mp3');
    audio.play();
    console.log('Attempting to play notification sound');
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }

    const broadcast = new BroadcastChannel('push-channel');
    broadcast.postMessage(data);
    broadcast.close();

    event.waitUntil(
        self.registration.showNotification(data.title, options)
            .then(() => {
                console.log('Notification shown!');
            })
            .catch(err => {
                console.error('Error showing notification:', err);
            })
    );
});




self.addEventListener('fetch', (event) => {
    if (event.request.method === 'POST') {
        return;  // skip caching for POST requests
    }
    const dynamicPaths = ['/', '/dashboard'];

    if (dynamicPaths.some(path => event.request.url.includes(path))) {
        // Use Network Only strategy for dynamic content
    //     event.respondWith(fetch(event.request));
    // } else {
        // Use Cache First strategy for static assets
        event.respondWith(

            fetch(event.request).catch(() => {
                // Return placeholderchat.html if the app is offline and the request is for the homepage
                if (event.request.url.includes('/')) {
                    return caches.match('/placeholderchat.html');
                }

          
                    })
                );
            } else {
                // Use Cache First strategy for static assets
                event.respondWith(
                    caches.match(event.request).then((response) => {
                        return response || fetch(event.request).then((fetchResponse) => {
                            return caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, fetchResponse.clone());
                                return fetchResponse;
                            });
                        });
                    })
                );
            }
        });
    
        self.addEventListener('notificationclick', function(event) {
            event.notification.close(); // Close the notification to prevent it from lingering
        
            // Define the URL to open when the notification is clicked
            const targetUrl = '/dashboard';
        
            // Attempt to focus or open a new window/tab
            event.waitUntil(
                clients.matchAll({ type: 'window', includeUncontrolled: true })
                    .then(function(windowClients) {
                        // Check if there's already a window/tab open with this app
                        for (let i = 0; i < windowClients.length; i++) {
                            const client = windowClients[i];
                            if (client.url === targetUrl && 'focus' in client) {
                                return client.focus(); // Focus if found
                            }
                        }
        
                        // If no window/tab is found, open a new one
                        if (clients.openWindow) {
                            return clients.openWindow(targetUrl);
                        }
                    })
            );
        });
        
    