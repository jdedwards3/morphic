import fs from "fs-extra";
import IConfig from "../interfaces/IConfig";

export default class ContentCache {
  private static instance: ContentCache;
  [index: string]: string;

  private constructor() {}

  private static async initialize() {
    ContentCache.instance = new ContentCache();
  }

  static clearContent(path: string) {
    delete ContentCache.instance[path];
  }

  static updateContent(path: string, file: string) {
    ContentCache.instance[path] = file;
  }

  static async getContent(config: IConfig, path: string) {
    if (!ContentCache.instance) {
      ContentCache.initialize();
    }

    if (!ContentCache.instance[path]) {
      const fileResult = await fs.readFile(
        `${config.folders.content.path}/${path}`,
        "utf8"
      );
      ContentCache.instance[path] = fileResult;
    }

    return ContentCache.instance[path];
  }
}
