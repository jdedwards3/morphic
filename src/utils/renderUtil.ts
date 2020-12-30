import { slugUtil } from "./slugUtil.js";
import Pagination from "../models/pagination.js";
import Content from "../models/content.js";
import IArchiveData from "../interfaces/IArchiveData.js";
import IArchiveTypeDisplayMap from "../interfaces/IArchiveTypeDisplayMap.js";
import IConfig from "../interfaces/IConfig.js";
import IArchiveType from "../interfaces/IArchiveType.js";
import { siteUtil } from "./siteUtil.js";

async function createArchives(
  config: IConfig,
  styles: string,
  archives: IArchiveTypeDisplayMap,
  archiveTypeContentPaths: IArchiveType
) {
  await Promise.all(
    Object.keys(archiveTypeContentPaths ?? {}).map(async (type) => {
      const archive =
        config.archiveData.find((archive) => archive.type == type) ??
        ({} as IArchiveData);

      await Promise.all(
        Object.keys(archiveTypeContentPaths[type]).map(
          async (archiveKey: string) => {
            const archiveTitle = `${
              archive.type.charAt(0).toUpperCase() +
              slugUtil.makeSingular(archive.type).slice(1)
            }: ${archiveKey}`;

            const archiveModel = new Content({
              layout: `archives/${archive.type}`,
              title: archiveTitle,
              slug: `${slugUtil.makeSingular(
                archive.type
              )}/${slugUtil.slugClean(archiveKey)}`,
              metaDescription: archive.descriptionPrefix
                ? `${archive.descriptionPrefix} ${archiveKey}`
                : archiveTitle,
              pagination: archive.pagination,
            });

            const pagination = new Pagination({
              path: archiveModel.slug as string,
              data: await archiveModel.hydratePostData(
                config,
                archiveTypeContentPaths[type][archiveKey],
                archives
              ),
              pageSize: archiveModel.pagination?.pageSize ?? -1,
              template: "index",
              contentModel: archiveModel,
            });

            await pagination.render(config, styles, archives);
          }
        )
      );
    })
  );
}

async function createContent(
  config: IConfig,
  styles: string,
  archives: IArchiveTypeDisplayMap,
  paths: string[]
) {
  for (const contentPaths of siteUtil.chunkItems(paths)) {
    await Promise.all(
      contentPaths.map(async (path: string) => {
        const contentModel = new Content({ path: path });

        await contentModel.build(config, archives);

        if (contentModel.pagination) {
          const pagination = new Pagination({
            path: path,
            data: contentModel.data![Object.keys(contentModel.data!)[0]],
            pageSize: contentModel.pagination.pageSize,
            template: contentModel.template as string,
            contentModel: contentModel,
          });

          await pagination.render(config, styles, archives);
        } else {
          await contentModel.render(
            config,
            styles,
            archives as IArchiveTypeDisplayMap
          );
        }
      })
    );
  }
}

const renderUtil = { createContent, createArchives };

export { renderUtil };
