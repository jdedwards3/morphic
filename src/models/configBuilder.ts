import fs from "fs-extra";
import IConfig from "../interfaces/IConfig.js";
import simpleGit from "simple-git/promise.js";
import slash from "slash";
import IFolder from "../interfaces/IFolder.js";

export default class ConfigBuilder {
  private static instance: ConfigBuilder;
  private config?: IConfig;

  private constructor() {}

  static async getConfig(siteFolder: string, outputFolder: string) {
    if (!ConfigBuilder.instance) {
      ConfigBuilder.instance = new ConfigBuilder();
    }

    if (!ConfigBuilder.instance.config) {
      const configFile = await fs
        .readFile(`${siteFolder}/config.json`, "utf8")
        .catch(() => {
          return "{}";
        });

      const defaultConfig = JSON.parse(configFile) as IConfig;

      if (!defaultConfig.folders) {
        (defaultConfig.folders as any) = {};
      }

      const defaultFolders: {
        [index: string]:
          | IFolder
          | (IFolder & {
              typescript: IFolder & { outputFolder: string };
              sass: IFolder & { outputFolder: string };
            });
      } = {
        content: { path: "content" },
        data: { path: "data" },
        layouts: { path: "layouts" },
        public: { path: "public" },
        src: {
          path: "src",
          typescript: { path: "src/typescript", outputFolder: "js" },
          sass: { path: "src/sass", outputFolder: "css" },
        },
        templates: { path: "templates" },
      };

      Object.keys(defaultConfig.folders).forEach((key) => {
        defaultConfig.folders[key] = Object.assign(
          defaultFolders[key],
          defaultConfig.folders[key]
        );

        defaultConfig.folders[key].path = slash(
          `${siteFolder}${defaultConfig.folders[key].path}`
        );
      });

      Object.keys(defaultFolders).forEach((key) => {
        if (!defaultConfig.folders[key]) {
          defaultFolders[key].path = slash(
            `${siteFolder}${defaultFolders[key].path}`
          );
        }
      });

      const folders = {
        ...defaultFolders,
        ...defaultConfig.folders,
        ...{ output: { path: outputFolder }, site: { path: siteFolder } },
      };

      const removeFolderPrefix = Array.isArray(defaultConfig.removeFolderPrefix)
        ? defaultConfig.removeFolderPrefix
        : ["pages", "posts"];

      if (defaultConfig.typescript) {
        defaultConfig.typescript.ignoreGlobs = [
          "node_modules",
          ...(defaultConfig.typescript.ignoreGlobs || []),
        ];
      }

      ConfigBuilder.instance.config = {
        removeFolderPrefix: removeFolderPrefix,
        saveContentGuid: defaultConfig.saveContentGuid ?? { enabled: false },
        typescript: defaultConfig.typescript ?? { enabled: false },
        sass: defaultConfig.sass ?? { enabled: false },
        folders: folders,
        siteName: defaultConfig.siteName ?? "",
        siteDescription: defaultConfig.siteDescription ?? "",
        version: defaultConfig.version ?? "0.0.0",
        environment: ((defaultConfig as any).environment ??
          ({ production: { domain: "" }, dev: { domain: "" } } as any))[
          process.env.morphicEnv as string
        ] ?? { domain: "" },
        notAdded: await ConfigBuilder.instance.getFilesNotTracked({
          folders,
        } as IConfig),
        archiveData: defaultConfig.archiveData,
      };
    }

    return ConfigBuilder.instance.config;
  }

  static async updateFilesNotAdded() {
    ConfigBuilder.instance.config!.notAdded =
      await ConfigBuilder.instance.getFilesNotTracked(
        ConfigBuilder.instance.config as IConfig
      );
  }

  private async getFilesNotTracked(config: IConfig) {
    return (await simpleGit(process.cwd()).status()).not_added.reduce(
      (notTracked: string[], item: string) => {
        const contentFolderName = config.folders.content.path.split(
          `${config.folders.site.path}`
        )[1];

        const path = slash(item.substring(item.lastIndexOf(contentFolderName)));

        if (path.startsWith(contentFolderName)) {
          notTracked.push(path.split(`${contentFolderName}/`)[1]);
        }
        return notTracked;
      },
      []
    );
  }
}
