import fs from "fs-extra";
import IConfig from "./interfaces/IConfig.js";
import { v4 as uuidv4 } from "uuid";

const { move, remove } = fs;

async function all(config: IConfig) {
  //todo: add dynamic folder support
  if (
    (config.typescript.enabled && config.folders.scripts.cacheBust) ||
    (config.folders.scripts.copyToOutput && config.folders.scripts.cacheBust)
  ) {
    await folder(config, config.folders.scripts);
  }

  if (
    (config.sass.enabled &&
      config.folders.styles.cacheBust &&
      !config.environment.inlineSassOutput) ||
    (config.folders.styles.copyToOutput && config.folders.styles.cacheBust)
  ) {
    await folder(config, config.folders.styles);
  }
}

async function folder(
  config: IConfig,
  folder: {
    path: string;
    copyToOutput: boolean;
    cacheBust: boolean;
  }
) {
  const folderRelativePath = folder.path.split(
    `${config.folders.site.path}`
  )[1];

  if (folder.cacheBust) {
    const tempFolder = uuidv4();

    await move(
      `${config.folders.output.path}/${folderRelativePath}`,
      `${config.folders.output.path}/${tempFolder}/${folderRelativePath}`
    );

    await move(
      `${config.folders.output.path}/${tempFolder}/${folderRelativePath}`,
      `${config.folders.output.path}/${folderRelativePath}/${config.version}`
    );

    await remove(`${config.folders.output.path}/${tempFolder}`);
  } else {
    console.warn(
      `Folder: ${folder.path} config.json settings do not enable cache busting.`
    );
  }
}

const cacheBust = { all, folder };

export { cacheBust };
