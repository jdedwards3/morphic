import fs from "fs-extra";
import IConfig from "../interfaces/IConfig.js";

const { writeFile } = fs;

export default class ServiceWorkerBuilder {
  private static instance: ServiceWorkerBuilder;
  private serviceWorkerRegistration?: string;

  private constructor() {}

  private static async initialize() {
    ServiceWorkerBuilder.instance = new ServiceWorkerBuilder();

    ServiceWorkerBuilder.instance.serviceWorkerRegistration = `<script> if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/service-worker.js", { scope: "/" })
          .then(function () {
            console.log("Service Worker Registered");
          });
      }</script>`;
  }

  static async getServiceWorkerRegistration(config: IConfig) {
    if (!config.environment.serviceWorker?.enabled) {
      await fs.remove(`${config.folders.output.path}/service-worker.js`);

      return;
    }

    await ServiceWorkerBuilder.build(config);

    return ServiceWorkerBuilder.instance.serviceWorkerRegistration as string;
  }

  private static async build(config: IConfig) {
    if (!ServiceWorkerBuilder.instance) {
      await ServiceWorkerBuilder.initialize();
    }

    const serviceWorker = ServiceWorkerBuilder.getServiceWorker(
      config.siteName.split(" ").join("").toLowerCase(),
      config.version
    );

    await writeFile(
      `${config.folders.output.path}/service-worker.js`,
      serviceWorker,
      "utf8"
    );

    console.log(`Service Worker copied to ${config.folders.output.path}.`);
  }

  private static getServiceWorker(cacheName: string, version: string) {
    return `var cacheName = "::${cacheName}";
     var version = "v${version}";
    self.addEventListener("install", function (event) {
      event.waitUntil(
        caches.open(version + cacheName).then(function (cache) {
          return cache.addAll(["/", "/offline/"]);
        })
      );
    });
    self.addEventListener("activate", function (event) {
      event.waitUntil(
        caches.keys().then(function (keys) {
          return Promise.all(
            keys
              .filter(function (key) {
                return key.indexOf(version) !== 0;
              })
              .map(function (key) {
                return caches.delete(key);
              })
          );
        })
      );
    });
    self.addEventListener("fetch", function (event) {
      var _request$headers$get, _request$headers$get2;
      var request = event.request;
      if (request.method !== "GET") {
        event.respondWith(
          fetch(request).catch(function () {
            return caches.match("/offline/");
          })
        );
        return;
      }
      if (
        ((_request$headers$get = request.headers.get("Accept")) === null ||
        _request$headers$get === void 0
          ? void 0
          : _request$headers$get.indexOf("text/html")) !== -1 &&
        request.url.startsWith(this.origin)
      ) {
        event.respondWith(
          fetch(request)
            .then(function (response) {
              var copy = response.clone();
              caches.open(version + cacheName).then(function (cache) {
                cache.put(request, copy);
              });
              return response;
            })
            .catch(function () {
              return caches.match(request).then(function (response) {
                return response || caches.match("/offline/");
              });
            })
        );
        return;
      }
      if (
        ((_request$headers$get2 = request.headers.get("Accept")) === null ||
        _request$headers$get2 === void 0
          ? void 0
          : _request$headers$get2.indexOf("text/plain")) === -1 &&
        request.url.startsWith(this.origin)
      ) {
        event.respondWith(
          caches.match(request).then(function (response) {
            return (
              response ||
              fetch(request)
                .then(function (response) {
                  var _copy$headers$get;
                  var copy = response.clone();
                  if (
                    ((_copy$headers$get = copy.headers.get("Content-Type")) ===
                      null || _copy$headers$get === void 0
                      ? void 0
                      : _copy$headers$get.indexOf("text/plain")) === -1
                  ) {
                    caches.open(version + cacheName).then(function (cache) {
                      cache.put(request, copy);
                    });
                  }
                  return response;
                })
                .catch(function () {})
            );
          })
        );
        return;
      }
    });`;
  }
}
