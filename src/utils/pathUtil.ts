import fs from "fs-extra";
import PathsCache from "../models/pathsCache.js";
import IConfig from "../interfaces/IConfig.js";

const getRenderPath = (config: IConfig, path: string) => {
  const outputPath = pathClean(path);

  const folderPrefix = outputPath.split("/")[0];

  return config.removeFolderPrefix.includes(folderPrefix)
    ? pathUtil.is404(path) || pathUtil.isIndex(path)
      ? outputPath.slice(outputPath.indexOf("/") + 1, outputPath.length)
      : outputPath.slice(outputPath.indexOf("/") + 1, outputPath.length) +
        "/index"
    : pathUtil.is404(path) || pathUtil.isIndex(path)
    ? outputPath
    : outputPath + "/index";
};

const pathClean = (path: string) =>
  path.slice(
    0,
    path.lastIndexOf(".") == -1 ? path.length : path.lastIndexOf(".")
  );

const pathPretty = (path: string) => `${pathClean(path.replace("/index", ""))}`;

const isIndex = (path: string) => pathClean(path).endsWith("index");

const isPost = (path: string) => path.startsWith("posts");

const isPage = (path: string) => path.startsWith("pages");

const is404 = (path: string) => pathClean(path).endsWith("/404");

async function getPaths(config: IConfig) {
  return PathsCache.getPaths(config);
}

async function getPostPaths(config: IConfig) {
  return PathsCache.getPostPaths(config);
}

async function cacheOutputPaths(config: IConfig) {
  return PathsCache.cacheOutputPaths(config);
}

async function createOutputFolders(path: string, config: IConfig) {
  const outputPath = is404(path) || isIndex(path) ? "" : pathPretty(path);

  const folderPrefix = outputPath.split("/")[0];

  const outputFolder = config.removeFolderPrefix.includes(folderPrefix)
    ? outputPath.slice(outputPath.indexOf("/") + 1, outputPath.length)
    : outputPath;

  await fs.mkdirs(`${config.folders.output.path}/${outputFolder}`);
  if (config.environment.jsonApi) {
    await fs.mkdirs(`${config.folders.output.path}/api/${outputFolder}`);
  }
}

const pathUtil = {
  pathClean,
  pathPretty,
  isIndex,
  isPost,
  isPage,
  is404,
  getPaths,
  getPostPaths,
  createOutputFolders,
  cacheOutputPaths,
  getRenderPath,
};

export { pathUtil };
