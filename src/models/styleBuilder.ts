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
          file: `${config.folders.styles.path}/styles.scss`,
        });

        StyleBuilder.instance.styles = `<style>${styleResult.css.toString()}</style>`;

        console.log("Inlined SASS output.");
      } else {
        const styleOutputFolder = config.folders.styles.path.split(
          config.folders.site.path
        )[1];

        await fs.remove(`${config.folders.output.path}/${styleOutputFolder}`);

        await mkdirs(`${config.folders.output.path}/${styleOutputFolder}`);

        const styleResult = await sassRender({
          file: `${config.folders.styles.path}/styles.scss`,
          outFile: `${config.folders.output.path}/${styleOutputFolder}/styles.css`,
          sourceMap: true,
          outputStyle: "compressed",
        });

        await writeFile(
          `${config.folders.output.path}/${styleOutputFolder}/styles.css.map`,
          styleResult.map,
          "utf8"
        );

        await writeFile(
          `${config.folders.output.path}/${styleOutputFolder}/styles.css`,
          styleResult.css,
          "utf8"
        );

        StyleBuilder.instance.styles = config.folders.styles.cacheBust
          ? `<link href="/${styleOutputFolder}/${config.version}/styles.css" rel="stylesheet" />`
          : `<link href="/${styleOutputFolder}/styles.css" rel="stylesheet" />`;

        console.log("SASS output copied to styles folder.");
      }
    }
  }
}
