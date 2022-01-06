#!/usr/bin/env node
import { morphic } from "./morphic.js";
import minimist from "minimist";

const argv = minimist(process.argv.slice(2));

(async function () {
  await morphic(
    `${process.cwd()}/${argv.input ?? ""}`,
    `${process.cwd()}/${argv.output ?? "_output"}`,
    argv
  );
})();
