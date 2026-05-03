import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  matchPrecache,
} from "workbox-precaching";
import {
  registerRoute,
  NavigationRoute,
  setCatchHandler,
} from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

const LEGACY_CACHE_NAMES = ["pages-cache-v1"];

cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

const appShellHandler = createHandlerBoundToURL("/index.html");
const isDocumentRequest = (request) =>
  request.mode === "navigate" || request.destination === "document";

const getAppShellResponse = async () =>
  (await matchPrecache("/index.html")) ||
  (await caches.match("/index.html")) ||
  Response.error();

self.addEventListener("fetch", (event) => {
  if (isDocumentRequest(event.request)) {
    event.respondWith(getAppShellResponse());
  }
});

registerRoute(
  new NavigationRoute(appShellHandler, {
    denylist: [/^\/api\//],
  }),
);

registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ["script", "style", "worker", "manifest"].includes(request.destination),
  new CacheFirst({
    cacheName: "static-assets-cache-v1",
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
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

setCatchHandler(async ({ request }) => {
  if (isDocumentRequest(request)) {
    return getAppShellResponse();
  }

  return Response.error();
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      ...LEGACY_CACHE_NAMES.map((cacheName) => caches.delete(cacheName)),
    ]),
  );
});
