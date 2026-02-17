self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Shiftway';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: '/icon.png',
    badge: '/icon.png',
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(clients.openWindow(url));
});
