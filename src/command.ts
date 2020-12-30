#!/usr/bin/env node
import { cacheBust } from "./cacheBust.js";
import { main } from "./main.js";
import ConfigBuilder from "./models/configBuilder.js";
import minimist from "minimist";
import slash from "slash";
import { commandUtil } from "./utils/commandUtil.js";

const argv = minimist(process.argv.slice(2));

(async function () {
  const outputFolder = slash(`${process.cwd()}/${argv.output ?? "_output"}`);

  const siteFolder = slash(`${process.cwd()}/${argv.input ?? ""}`);

  process.env.morphicEnv = process.env.morphicEnv ?? "production";

  const config = await ConfigBuilder.getConfig(siteFolder, outputFolder);

  await main(config);

  if (config.typescript.enabled) {
    await commandUtil.processScripts(config, argv.typecheck);
  }

  await cacheBust.all(config);

  if (argv.watch) {
    await commandUtil.watcher(config, argv.typecheck);
  }

  if (argv.serve) {
    await commandUtil.watcher(config, argv.typecheck, true);
  }
})();
