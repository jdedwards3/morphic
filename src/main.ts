import { siteUtil } from "./utils/siteUtil.js";
import { renderUtil } from "./utils/renderUtil.js";
import StyleBuilder from "./models/styleBuilder.js";
import ArchiveBuilder from "./models/archiveBuilder.js";
import { pathUtil } from "./utils/pathUtil.js";
import IArchiveTypeDisplayMap from "./interfaces/IArchiveTypeDisplayMap.js";
import IArchiveType from "./interfaces/IArchiveType.js";
import fs from "fs-extra";
import IConfig from "./interfaces/IConfig.js";
import ContentGuidWriter from "./models/contentGuidWriter.js";

async function main(config: IConfig) {
  await fs.mkdirs(`${config.folders.output.path}`);

  // scan output folder to delete old files after build
  await pathUtil.cacheOutputPaths(config);

  const contentPaths = await pathUtil.getPaths(config);

  const styles = (await StyleBuilder.getStyles(config)) as string;

  if (config.saveContentGuid.enabled) {
    await ContentGuidWriter.saveIfNotExists(config, contentPaths);
  }

  const archiveTypeDisplayMap = config.archiveData
    ? ((await ArchiveBuilder.getArchiveTypeDisplayMap(
        config,
        contentPaths
      )) as IArchiveTypeDisplayMap)
    : {};

  await renderUtil.createContent(
    config,
    styles,
    archiveTypeDisplayMap,
    contentPaths
  );

  const archiveTypeContentPaths =
    config.archiveData || config.environment.sitemap
      ? ((await ArchiveBuilder.getArchiveTypeContentPaths(
          config,
          contentPaths
        )) as IArchiveType)
      : {};

  if (config.archiveData) {
    await renderUtil.createArchives(
      config,
      styles,
      archiveTypeDisplayMap,
      archiveTypeContentPaths
    );
  }

  if (config.environment.sitemap) {
    await siteUtil.createSitemap(
      config,
      contentPaths,
      archiveTypeContentPaths,
      archiveTypeDisplayMap
    );
  }

  if (config.environment.rssFeed) {
    await siteUtil.createRssFeed(config, contentPaths, archiveTypeDisplayMap);
  }

  if (config.folders.content.rootFiles.copyToOutput) {
    await fs.copy(
      `${config.folders.content.path}/${config.folders.content.rootFiles.path}`,
      `${config.folders.output.path}/`,
      { overwrite: true }
    );
  }

  await siteUtil.cleanOldOutputFiles(config);

  //todo: add dynamic folder support
  if (config.folders.assets.copyToOutput) {
    await fs.copy(
      `${config.folders.assets.path}`,
      `${config.folders.output.path}/${
        config.folders.assets.path.split(config.folders.site.path)[1]
      }`,
      { overwrite: true }
    );
  }

  if (config.folders.images.copyToOutput) {
    await fs.copy(
      `${config.folders.images.path}`,
      `${config.folders.output.path}/${
        config.folders.images.path.split(config.folders.site.path)[1]
      }`,
      { overwrite: true }
    );
  }

  if (!config.sass.enabled && config.folders.styles.copyToOutput) {
    await fs.copy(
      `${config.folders.styles.path}`,
      `${config.folders.output.path}/${
        config.folders.styles.path.split(config.folders.site.path)[1]
      }`,
      { overwrite: true }
    );
  }

  if (!config.typescript.enabled && config.folders.scripts.copyToOutput) {
    await fs.copy(
      `${config.folders.scripts.path}`,
      `${config.folders.output.path}/${
        config.folders.scripts.path.split(config.folders.site.path)[1]
      }`,
      { overwrite: true }
    );
  }
  console.log("Files Generated.");
}

export { main };
