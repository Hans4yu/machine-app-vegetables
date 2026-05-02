import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//],
  }),
);

registerRoute(
  ({ url }) =>
    url.pathname.startsWith("/model/") &&
    (url.pathname.endsWith(".json") || url.pathname.endsWith(".bin")),
  new CacheFirst({
    cacheName: "ai-model-cache-v1",
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

registerRoute(
  ({ url }) =>
    url.hostname.includes("huggingface.co") ||
    url.hostname.includes("cdn-lfs") ||
    url.hostname.includes("transformers"),
  new CacheFirst({
    cacheName: "transformers-cache-v1",
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

registerRoute(
  ({ url }) =>
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.hostname.includes("unpkg.com"),
  new StaleWhileRevalidate({
    cacheName: "third-party-cache-v1",
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
