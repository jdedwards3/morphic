import { promisify } from "util";
import fs from "fs-extra";
import sass from "sass";
import IConfig from "../interfaces/IConfig.js";

const { render } = sass;
const { mkdirs, writeFile } = fs;
const sassRender = promisify(render);

export default class StyleBuilder {
  private static instance: StyleBuilder;
  private styles?: string;

  private constructor() {}

  private static async initialize() {
    StyleBuilder.instance = new StyleBuilder();
  }

  static async resetStyles() {
    if (StyleBuilder.instance.styles) {
      delete StyleBuilder.instance.styles;
    }
  }

  static async getStyles(config: IConfig) {
    if (!config.sass.enabled) {
      return;
    }

    if (!StyleBuilder.instance) {
      await StyleBuilder.initialize();
    }

    await StyleBuilder.buildStyles(config);

    return StyleBuilder.instance.styles as string;
  }

  private static async buildStyles(config: IConfig) {
    if (!StyleBuilder.instance) {
      await StyleBuilder.initialize();
    }

    if (!StyleBuilder.instance.styles) {
      if (config.environment.inlineSassOutput) {
        const styleResult = await sassRender({
          file: `${config.folders.src.sass.path}/index.scss`,
        });

        StyleBuilder.instance.styles = `<style>${styleResult.css.toString()}</style>`;

        console.log("Inlined SASS output.");
      } else {
        await fs.remove(
          `${config.folders.output.path}/${config.folders.src.sass.outputFolder}`
        );

        await mkdirs(
          `${config.folders.output.path}/${config.folders.src.sass.outputFolder}`
        );

        const styleResult = await sassRender({
          file: `${config.folders.src.sass.path}/index.scss`,
          outFile: `${config.folders.output.path}/${config.folders.src.sass.outputFolder}/index.css`,
          sourceMap: true,
          sourceMapContents: true,
          outputStyle: "compressed",
        });

        await writeFile(
          `${config.folders.output.path}/${config.folders.src.sass.outputFolder}/index.css.map`,
          styleResult.map,
          "utf8"
        );

        await writeFile(
          `${config.folders.output.path}/${config.folders.src.sass.outputFolder}/index.css`,
          styleResult.css,
          "utf8"
        );

        StyleBuilder.instance.styles = config.sass.versionOutputFolderPath
          ? `<link href="/${config.folders.src.sass.outputFolder}/${config.version}/index.css" rel="stylesheet" />`
          : `<link href="/${config.folders.src.sass.outputFolder}/index.css" rel="stylesheet" />`;

        console.log(
          `SASS output copied to ${config.folders.output.path}/${config.folders.src.sass.outputFolder}`
        );
      }
    }
  }
}
