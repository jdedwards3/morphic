import glob from "fast-glob";
import { pathUtil } from "../utils/pathUtil.js";
import IConfig from "../interfaces/IConfig.js";

export default class PathsCache {
  private static instance: PathsCache;
  private paths?: string[];
  private postPaths?: string[];
  private outputPaths?: string[];

  private constructor() {}

  private static initialize() {
    PathsCache.instance = new PathsCache();
  }

  static addPath(path: string) {
    PathsCache.instance.paths?.push(path);
    if (pathUtil.isPost(path)) {
      PathsCache.instance.postPaths?.push(path);
    }
  }

  static clearPath(path: string) {
    if (
      PathsCache.instance.paths &&
      PathsCache.instance.paths.indexOf(path) > -1
    ) {
      PathsCache.instance.paths?.splice(
        PathsCache.instance.paths?.indexOf(path),
        1
      );
    }

    if (
      PathsCache.instance.postPaths &&
      PathsCache.instance.postPaths.indexOf(path) > -1
    ) {
      PathsCache.instance.postPaths?.splice(
        PathsCache.instance.postPaths?.indexOf(path),
        1
      );
    }
  }

  static async getPaths(config: IConfig) {
    if (!PathsCache.instance) {
      PathsCache.initialize();
    }

    if (!PathsCache.instance.paths) {
      PathsCache.instance.paths = await glob("**/*.{md,ejs}", {
        cwd: `${config.folders.content.path}`,
        ignore: [config.folders.output.path, "node_modules"],
      });
    }

    return PathsCache.instance.paths;
  }
  static async getPostPaths(config: IConfig) {
    if (!PathsCache.instance) {
      PathsCache.initialize();
    }

    if (!PathsCache.instance.postPaths) {
      PathsCache.instance.postPaths = (
        await PathsCache.getPaths(config)
      ).filter((path) => pathUtil.isPost(path));
    }

    return PathsCache.instance.postPaths;
  }

  static clearOutputPath(path: string) {
    if (!PathsCache.instance.outputPaths) {
      throw new Error("Output paths must be cached before using.");
    }
    if (
      PathsCache.instance.outputPaths &&
      PathsCache.instance.outputPaths.indexOf(path) > -1
    ) {
      PathsCache.instance.outputPaths?.splice(
        PathsCache.instance.outputPaths?.indexOf(path),
        1
      );
    }
  }

  static async cacheOutputPaths(config: IConfig) {
    if (!PathsCache.instance) {
      PathsCache.initialize();
    }

    if (!PathsCache.instance.outputPaths) {
      const filePatterns = [
        `${config.folders.output.path}/**/*.html`,
        `${config.folders.output.path}/api/**/*.json`,
        `${config.folders.output.path}/feed.rss`,
        `${config.folders.output.path}/sitemap.xml`,
      ];

      PathsCache.instance.outputPaths = await glob(filePatterns, {
        cwd: `${config.folders.site.path}`,
      });
    }
  }

  static getOutputPaths() {
    if (!PathsCache.instance.outputPaths) {
      throw new Error(
        "Output paths must be initialized and cached before using."
      );
    }
    return PathsCache.instance.outputPaths;
  }
}
