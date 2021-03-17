import simpleGit from "simple-git/promise.js";
import { ListLogSummary } from "simple-git/typings/response";
import IConfig from "../interfaces/IConfig";
const git = simpleGit(process.cwd());

export default class GitLogCache {
  private static instance: GitLogCache;
  [index: string]: ListLogSummary;

  private constructor() {}

  private static async initialize() {
    GitLogCache.instance = new GitLogCache();
  }

  static async getLog(config: IConfig, path: string) {
    if (!GitLogCache.instance) {
      GitLogCache.initialize();
    }

    if (!GitLogCache.instance[path]) {
      const log = await git.log({
        file: `${config.folders.content.path}/${path}`,
      });

      GitLogCache.instance[path] = log;
    }

    return GitLogCache.instance[path];
  }
}
