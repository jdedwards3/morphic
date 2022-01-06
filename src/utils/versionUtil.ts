import fs from "fs-extra";
import IConfig from "../interfaces/IConfig.js";
import { v4 as uuidv4 } from "uuid";
import IFolder from "../interfaces/IFolder.js";

const { move, remove } = fs;

async function applyVersioning(config: IConfig) {
  if (config.typescript.enabled && config.typescript.versionOutputFolderPath) {
    await versionFolder(config, config.folders.src.typescript);
  }

  if (
    config.sass.enabled &&
    config.sass.versionOutputFolderPath &&
    !config.environment.inlineSassOutput
  ) {
    await versionFolder(config, config.folders.src.sass);
  }

  for (const folder of Object.keys(config.folders)) {
    if (config.folders[folder].applyVersion) {
      await versionFolder(config, config.folders[folder]);
    }
  }
}

async function versionFolder(config: IConfig, folder: IFolder) {
  let folderRelativePath = folder.path.split(`${config.folders.site.path}`)[1];

  if (
    folder.path === config.folders.src.typescript.path &&
    config.typescript.versionOutputFolderPath &&
    config.typescript.enabled
  ) {
    folderRelativePath = config.folders.src.typescript.outputFolder;
  }

  if (
    folder.path === config.folders.src.sass.path &&
    config.sass.versionOutputFolderPath &&
    config.sass.enabled &&
    !config.environment.inlineSassOutput
  ) {
    folderRelativePath = config.folders.src.sass.outputFolder;
  }

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
}

const versionUtil = { applyVersioning, versionFolder };

export { versionUtil };
