import IArchiveData from "../interfaces/IArchiveData.js";
import IArchiveType from "../interfaces/IArchiveType.js";
import IArchiveTypeDisplayMap from "../interfaces/IArchiveTypeDisplayMap.js";
import IConfig from "../interfaces/IConfig.js";
import { pathUtil } from "../utils/pathUtil.js";
import { siteUtil } from "../utils/siteUtil.js";
import { slugUtil } from "../utils/slugUtil.js";
import Content from "./content.js";

export default class ArchiveBuilder {
  private static instance: ArchiveBuilder;
  private archiveTypeContentPaths?: IArchiveType;
  private archiveTypeKeys?: IArchiveTypeDisplayMap;

  private constructor() {}

  public static async getArchiveTypeDisplayMap(
    config: IConfig,
    paths: string[]
  ) {
    if (!ArchiveBuilder.instance) {
      ArchiveBuilder.instance = new ArchiveBuilder();
    }

    await ArchiveBuilder.instance.buildArchiveTypeDisplayMap(config, paths);

    return ArchiveBuilder.instance.archiveTypeKeys;
  }

  public static async getArchiveTypeContentPaths(
    config: IConfig,
    paths: string[]
  ) {
    if (!ArchiveBuilder.instance) {
      ArchiveBuilder.instance = new ArchiveBuilder();
    }

    await ArchiveBuilder.instance.buildContentPaths(config, paths);

    return ArchiveBuilder.instance.archiveTypeContentPaths;
  }

  private async buildArchiveTypeDisplayMap(config: IConfig, paths: string[]) {
    ArchiveBuilder.instance.archiveTypeKeys = Object.keys(
      (await ArchiveBuilder.getArchiveTypeContentPaths(config, paths)) ?? {}
    ).reduce((archiveMap: IArchiveTypeDisplayMap, type) => {
      archiveMap[type] = Object.keys(
        ArchiveBuilder.instance.archiveTypeContentPaths![type]
      ).map((item) => ({
        name: item,
        slug: `${slugUtil.makeSingular(type)}/${slugUtil.slugClean(item)}`,
      }));
      return archiveMap;
    }, {});
  }

  private async buildContentPaths(config: IConfig, contentPaths: string[]) {
    ArchiveBuilder.instance.archiveTypeContentPaths = await config.archiveData?.reduce(
      async (
        archiveMap: IArchiveType | Promise<IArchiveType>,
        archive: IArchiveData
      ) => {
        archiveMap = await archiveMap;
        for (const paths of siteUtil.chunkItems(contentPaths)) {
          archiveMap[archive.type] = await paths.reduce(
            async (
              data:
                | { [index: string]: string[] }
                | Promise<{ [index: string]: string[] }>,
              path: string
            ) => {
              data = await data;

              if (!pathUtil.isPost(path) || pathUtil.isIndex(path)) {
                return data;
              }

              const contentModel = new Content({
                path: path,
              });

              await contentModel.build(config);

              if (Array.isArray((contentModel as any)[archive.type])) {
                const itemMap = (contentModel as any)[archive.type]
                  ? (contentModel as any)[archive.type].reduce(
                      (itemMap: { [index: string]: string }, key: string) => ({
                        ...itemMap,
                        [key]: path,
                      }),
                      {}
                    )
                  : {};
                Object.keys(itemMap).forEach((item) => {
                  data.hasOwnProperty(item)
                    ? (data as any)[item].push(itemMap[item])
                    : ((data as any)[item] = [itemMap[item]]);
                });
              } else {
                if ((contentModel as any)[archive.type]) {
                  data.hasOwnProperty((contentModel as any)[archive.type])
                    ? data[(contentModel as any)[archive.type]].push(path)
                    : (data[(contentModel as any)[archive.type]] = [path]);
                }
              }
              return data;
            },
            Promise.resolve({})
          );
        }
        return archiveMap;
      },
      Promise.resolve({})
    );
  }
}
