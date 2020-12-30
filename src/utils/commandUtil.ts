import IConfig from "../interfaces/IConfig";
import ContentCache from "../models/contentCache.js";
import slash from "slash";
import { main } from "../main.js";
import PathsCache from "../models/pathsCache.js";
import ConfigBuilder from "../models/configBuilder.js";
import chokidar from "chokidar";
import browserSync from "browser-sync";
import { exec as execstd } from "child_process";
import glob, { sync } from "fast-glob";
import { promisify } from "util";
import { fileURLToPath } from "url";
import fs from "fs-extra";
import { cacheBust } from "../cacheBust.js";
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
    ignored: [/(^|[\/\\])\../, "node_modules"],
    persistent: true,
    ignorePermissionErrors: true,
  });

  if (config.typescript.enabled) {
    watcher.add(`${config.folders.site.path}**/*.ts`);
  }

  if (config.sass.enabled) {
    watcher.add(`${config.folders.site.path}**/*.scss`);
  }

  const syncChanges = async (
    path: string,
    options?: { clearContent?: boolean; clearPath?: boolean; addPath?: boolean }
  ) => {
    if (reload) {
      globalSync.pause();
    }
    if (path.endsWith(".md") && options?.clearContent) {
      ContentCache.clearContent(
        slash(path).split(`${config.folders.content.path}/`)[1]
      );
    }

    if (path.endsWith(".md") && options?.clearPath) {
      PathsCache.clearPath(
        slash(path).split(`${config.folders.content.path}/`)[1]
      );
    }

    if (path.endsWith(".md") && options?.addPath) {
      PathsCache.addPath(
        slash(path).split(`${config.folders.content.path}/`)[1]
      );

      await ConfigBuilder.updateFilesNotAdded();
    }

    if (config.sass.enabled && path.endsWith(".scss")) {
      await StyleBuilder.resetStyles();
      if (!config.environment.inlineSassOutput) {
        StyleBuilder.getStyles(config);
      }
    }

    if (
      path.endsWith(".md") ||
      path.endsWith(".ejs") ||
      (config.environment.inlineSassOutput && path.endsWith(".scss"))
    ) {
      await main(config);
    }

    if (path.endsWith(".scss") && !config.environment.inlineSassOutput) {
      await cacheBust.folder(config, config.folders.styles);
    }

    if (config.typescript.enabled && path.endsWith(".ts")) {
      await processScripts(config, typeCheck);
    }

    if (path.endsWith(".ts")) {
      await cacheBust.folder(config, config.folders.scripts);
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
    } else {
      console.warn("TypeScript type checking errors. Compilation stopped.");
    }
  } else {
    await compileClient(config);
    console.log("TypeScript compiled without type checking.");
  }
}

async function typeCheckScripts(config: IConfig) {
  const result = await exec(
    `npm --prefix ${__dirname}/../../../ run typeCheck-client -- ${(
      await glob("**/*.ts", { cwd: config.folders.site.path })
    )
      .map((path) => `${config.folders.site.path}${path}`)
      .join(" ")}`
  ).catch((error) => {
    console.error(error.stdout);
    return error;
  });
  return result;
}

async function compileClient(config: IConfig) {
  const tsFiles = (
    await glob("**/*.ts", { cwd: `${config.folders.site.path}` })
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

  await Promise.all(
    tsFiles.map(async function (file) {
      await fs.remove(`${config.folders.output.path}/${file}`);
    })
  );

  await exec(
    `npm --prefix ${__dirname}/../../../ run compile-client ${
      config.environment.minifyTypescriptOutput
        ? `-- --minified ${config.folders.site.path} -d ${config.folders.output.path}`
        : `-- ${config.folders.site.path} -d ${config.folders.output.path}`
    }`
  );
}

const commandUtil = { watcher, processScripts };

export { commandUtil };
