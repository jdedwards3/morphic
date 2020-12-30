import fs from "fs-extra";
import IConfig from "../interfaces/IConfig";
import IContentData from "../interfaces/IContentData";

export default class DataCache {
  private static instance: DataCache;
  [index: string]: IContentData;

  private constructor() {}

  private static async initialize() {
    DataCache.instance = new DataCache();
  }

  static async getData(config: IConfig, path: string) {
    if (!DataCache.instance) {
      DataCache.initialize();
    }

    if (!DataCache.instance[path]) {
      const fileResult = JSON.parse(
        await fs.readFile(
          `${config.folders.data.path}/${path.split(".")[0]}.json`,
          "utf8"
        )
      );

      DataCache.instance[path] = fileResult;
    }

    return DataCache.instance[path];
  }
}
