import ConfigBuilder from "./models/configBuilder.js";
import { siteUtil } from "./utils/siteUtil.js";
import { renderUtil } from "./utils/renderUtil.js";
import StyleBuilder from "./models/styleBuilder.js";
import ArchiveBuilder from "./models/archiveBuilder.js";
import { pathUtil } from "./utils/pathUtil.js";
import IArchiveTypeDisplayMap from "./interfaces/IArchiveTypeDisplayMap.js";
import IArchiveType from "./interfaces/IArchiveType.js";
import fs from "fs-extra";
import ContentGuidWriter from "./models/contentGuidWriter.js";
import ServiceWorkerBuilder from "./models/serviceWorkerBuilder.js";
import { commandUtil } from "./utils/commandUtil.js";
import { versionUtil } from "./utils/versionUtil.js";
import slash from "slash";
import { ParsedArgs } from "minimist";

async function morphic(input: string, output: string, argv?: ParsedArgs) {
  const siteFolder = slash(input);

  const outputFolder = slash(output);

  process.env.morphicEnv = process.env.morphicEnv ?? "production";

  const config = await ConfigBuilder.getConfig(siteFolder, outputFolder);

  await fs.mkdirs(`${config.folders.output.path}`);

  await pathUtil.cacheOutputPaths(config);

  const contentPaths = await pathUtil.getPaths(config);

  const styles = (await StyleBuilder.getStyles(config)) as string;

  const serviceWorkerRegistration =
    (await ServiceWorkerBuilder.getServiceWorkerRegistration(config)) as string;

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
    serviceWorkerRegistration,
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
      serviceWorkerRegistration,
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

  await siteUtil.cleanOldOutputFiles(config);

  if (config.typescript.enabled) {
    await commandUtil.processScripts(config, argv?.typecheck);
  }

  await fs.copy(
    `${config.folders.public.path}`,
    `${config.folders.output.path}/`,
    { overwrite: true }
  );

  await versionUtil.applyVersioning(config);

  if (argv?.watch) {
    await commandUtil.watcher(config, argv?.typecheck);
  }

  if (argv?.serve) {
    await commandUtil.watcher(config, argv?.typecheck, true);
  }

  console.log("File generation complete.");
}

export { morphic };
