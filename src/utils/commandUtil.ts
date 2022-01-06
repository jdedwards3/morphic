import IConfig from "../interfaces/IConfig";
import ContentCache from "../models/contentCache.js";
import slash from "slash";
import { morphic } from "../morphic.js";
import PathsCache from "../models/pathsCache.js";
import ConfigBuilder from "../models/configBuilder.js";
import chokidar from "chokidar";
import browserSync from "browser-sync";
import { exec as execstd } from "child_process";
import glob from "fast-glob";
import { promisify } from "util";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { versionUtil } from "../utils/versionUtil.js";
import StyleBuilder from "../models/styleBuilder.js";
import { dirname } from "path";

const exec = promisify(execstd);
const __dirname = fileURLToPath((import.meta as any).url);

async function watcher(config: IConfig, typeCheck: boolean, reload?: boolean) {
  let globalSync: browserSync.BrowserSyncInstance;

  if (reload) {
    globalSync = browserSync.create("global");

    globalSync.init({
      server: { baseDir: `${config.folders.output.path}` },
      watch: false,
      ignore: ["node_modules"],
      notify: false,
      ui: false,
    });
  }

  const watcher = chokidar.watch(`${config.folders.site.path}**/*.{ejs,md}`, {
    ignored: [/(^|[\/\\])\../, "node_modules", config.folders.output.path],
    persistent: true,
    ignorePermissionErrors: true,
  });

  if (config.typescript.enabled) {
    watcher.add(`${config.folders.src.typescript.path}**/*.ts`);
    watcher.unwatch(
      config.typescript.ignoreGlobs.map(
        (item) => `${config.folders.site.path}${item}`
      )
    );
  }

  if (config.sass.enabled) {
    watcher.add(`${config.folders.src.sass.path}**/*.scss`);
  }

  const syncChanges = async (
    path: string,
    options?: { clearContent?: boolean; clearPath?: boolean; addPath?: boolean }
  ) => {
    if (reload) {
      globalSync.pause();
    }
    if (
      (path.endsWith(".md") || path.endsWith(".ejs")) &&
      options?.clearContent
    ) {
      ContentCache.clearContent(
        slash(path).split(`${config.folders.content.path}/`)[1]
      );
    }

    if ((path.endsWith(".md") || path.endsWith(".ejs")) && options?.clearPath) {
      PathsCache.clearPath(
        slash(path).split(`${config.folders.content.path}/`)[1]
      );
    }

    if ((path.endsWith(".md") || path.endsWith(".ejs")) && options?.addPath) {
      PathsCache.addPath(
        slash(path).split(`${config.folders.content.path}/`)[1]
      );

      await ConfigBuilder.updateFilesNotAdded();
    }

    if (config.sass.enabled && path.endsWith(".scss")) {
      await StyleBuilder.resetStyles();
      if (!config.environment.inlineSassOutput) {
        await StyleBuilder.getStyles(config);
        if (config.sass.versionOutputFolderPath) {
          await versionUtil.versionFolder(config, config.folders.src.sass);
        }
      }
    }

    if (
      path.endsWith(".md") ||
      path.endsWith(".ejs") ||
      (config.environment.inlineSassOutput && path.endsWith(".scss"))
    ) {
      if (config.sass.enabled && config.sass.versionOutputFolderPath) {
        await StyleBuilder.resetStyles();
      }
      await morphic(config.folders.site.path, config.folders.output.path);
    }

    if (config.typescript.enabled && path.endsWith(".ts")) {
      await processScripts(config, typeCheck);
    }

    if (path.endsWith(".ts") && config.typescript.versionOutputFolderPath) {
      await versionUtil.versionFolder(config, config.folders.src.typescript);
    }

    if (reload) {
      globalSync.resume();
      globalSync.reload();
    }
  };

  watcher
    .on("change", async (path) => {
      console.log(`File ${path} has been changed`);
      syncChanges(path, { clearContent: true });
    })
    .on("unlink", async (path) => {
      console.log(`File ${path} has been removed`);
      syncChanges(path, { clearPath: true, clearContent: true });
    })
    .on("addDir", async (path) => {
      console.log(`Directory ${path} has been added`);
      syncChanges(path);
    })
    .on("unlinkDir", async (path) => {
      console.log(`Directory ${path} has been removed`);
      syncChanges(path);
    })
    .on("ready", async () => {
      console.log("Initial scan complete. Ready for changes");
      watcher.on("add", async (path) => {
        console.log(`File ${path} has been added`);
        syncChanges(path, { addPath: true });
      });
    });
}

async function processScripts(config: IConfig, typecheck: boolean) {
  if (typecheck) {
    const result = await typeCheckScripts(config);
    if (!result.stderr) {
      await compileClient(config);
      console.log("TypeScript compiled with type checking.");
      console.log(
        `TypeScript output copied to ${config.folders.output.path}/${config.folders.src.typescript.outputFolder}`
      );
    } else {
      console.warn("TypeScript type checking errors. Compilation stopped.");
    }
  } else {
    await compileClient(config);
    console.log("TypeScript compiled without type checking.");
    console.log(
      `TypeScript output copied to ${config.folders.output.path}/${config.folders.src.typescript.outputFolder}`
    );
  }
}

async function typeCheckScripts(config: IConfig) {
  const result = await exec(
    `npm --prefix ${__dirname}/../../../ run typeCheck-client -- ${(
      await glob("**/*.ts", {
        cwd: config.folders.src.typescript.path,
        ignore: config.typescript.ignoreGlobs,
      })
    )
      .map(
        (path) =>
          `${config.folders.site.path}/${config.folders.src.typescript.path}/${path}`
      )
      .join(" ")}`
  ).catch((error) => {
    console.error(error.stdout);
    return error;
  });
  return result;
}

async function compileClient(config: IConfig) {
  const tsFiles = (
    await glob("**/*.ts", {
      cwd: `${config.folders.src.typescript.path}`,
      ignore: config.typescript.ignoreGlobs,
    })
  ).reduce(function (files: string[], file) {
    const filePath = dirname(file);
    if (files.indexOf(filePath) == -1 && files.indexOf(file) == -1) {
      if (filePath && filePath != ".") {
        files.push(filePath);
      } else {
        files.push(file);
      }
    }
    return files;
  }, []);

  await fs.remove(
    `${config.folders.output.path}/${config.folders.src.typescript.outputFolder}`
  );

  const ignored = config.typescript.ignoreGlobs
    .map((item) => `${config.folders.site.path}${item}`)
    .join(",");

  await exec(
    `npm --prefix ${__dirname}/../../../ run compile-client ${
      config.environment.minifyTypescriptOutput
        ? `-- --minified --ignore ${ignored} ${config.folders.site.path}/${config.folders.src.typescript.path} -d ${config.folders.output.path}/${config.folders.src.typescript.outputFolder}`
        : `-- --ignore ${ignored} ${config.folders.site.path}/${config.folders.src.typescript.path} -d ${config.folders.output.path}/${config.folders.src.typescript.outputFolder}`
    }`
  );
}

const commandUtil = { watcher, processScripts };

export { commandUtil };
