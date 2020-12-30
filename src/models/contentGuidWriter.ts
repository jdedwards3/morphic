import { siteUtil } from "../utils/siteUtil.js";
import matter from "gray-matter";
import ContentCache from "../models/contentCache.js";
import { v4 as uuidv4 } from "uuid";
import fs from "fs-extra";
import IConfig from "../interfaces/IConfig";

export default class ContentGuidWriter {
  private static instance = new ContentGuidWriter();

  private constructor() {}

  private static async initialize() {
    ContentGuidWriter.instance = new ContentGuidWriter();
  }

  static async saveIfNotExists(config: IConfig, contentPaths: string[]) {
    if (!ContentGuidWriter.instance) {
      ContentGuidWriter.initialize();
    }
    for (const paths of siteUtil.chunkItems(contentPaths)) {
      await Promise.all(
        paths.map(async (path: string) => {
          const fileMatter = matter(
            await ContentCache.getContent(config, path),
            {}
          );

          if (!fileMatter.data.guid) {
            fileMatter.data.guid = uuidv4();
            const store = matter.stringify(fileMatter.content, fileMatter.data);

            ContentCache.updateContent(path, store);

            await fs.writeFile(
              `${config.folders.content.path}/${path}`,
              store,
              "utf8"
            );
          }
        })
      );
    }
  }
}
