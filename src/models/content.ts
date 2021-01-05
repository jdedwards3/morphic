import fs from "fs-extra";
import { pathUtil } from "../utils/pathUtil.js";
import IPagination from "../interfaces/IPagination.js";
import htmlMinifier from "html-minifier";
import simpleGit from "simple-git/promise.js";
import IContentData from "../interfaces/IContentData.js";
import DataCache from "./dataCache.js";
import IConfig from "../interfaces/IConfig.js";
import IArchiveTypeDisplayMap from "../interfaces/IArchiveTypeDisplayMap.js";
import { siteUtil } from "../utils/siteUtil.js";
import ejs from "ejs";
import matter from "gray-matter";
import ContentCache from "./contentCache.js";
import { markdown } from "../utils/markdownUtil.js";
import PathsCache from "./pathsCache.js";

const git = simpleGit(process.cwd());
const htmlMinify = htmlMinifier.minify;

export default class Content {
  path: string;
  renderPath?: string;
  rawContent?: string;
  content?: string;
  guid?: string;
  title?: string;
  createdDate?: string;
  modifiedDate?: string;
  data?: { [index: string]: {}[] };
  slug?: string;
  layout?: string;
  template?: string;
  author?: string;
  pagination?: IPagination;
  metaDescription?: string;
  tags?: string[];
  canonical?: string;

  constructor(init: { path: string });
  constructor(init: Partial<Content>);
  constructor(init: {
    path: string;
    renderPath: string;
    rawContent?: string;
    content?: string;
    guid?: string;
    title?: string;
    createdDate?: string;
    modifiedDate?: string;
    data?: { [index: string]: {}[] };
    slug?: string;
    layout?: string;
    template?: string;
    author?: string;
    pagination?: IPagination;
    metaDescription?: string;
    tags?: string[];
    canonical?: string;
  }) {
    Object.assign(this, init);
    this.path = init.path;
    if (!this.path) {
      this.build = () => {
        throw Error("Cannot build. Initialized without path.");
      };
      this.render = () => {
        throw Error("Cannot render. Initialized without path.");
      };
    }
  }

  async render(
    config: IConfig,
    styles: string,
    archives: IArchiveTypeDisplayMap
  ): Promise<void | string> {
    await pathUtil.createOutputFolders(this.path as string, config);

    const model = {
      ...this,
      styles: styles,
      archives: archives,
    };

    const renderedFile = await ejs.renderFile(
      `${config.folders.templates.path}/${this.template}.ejs`,
      {
        model: model,
        config: config,
      },
      {
        rmWhitespace: true,
      }
    );

    const filePath = `${config.folders.output.path}/${this.renderPath}.html`;

    await fs.writeFile(
      filePath,
      config.environment.minifyHtml
        ? htmlMinify(renderedFile, {
            collapseWhitespace: true,
            removeComments: true,
            minifyJS: true,
            minifyCSS: true,
          })
        : renderedFile,
      "utf8"
    );

    PathsCache.clearOutputPath(filePath);

    if (config.environment.jsonApi) {
      const {
        layout,
        template,
        path,
        rawContent,
        renderPath,
        ...apiModel
      } = this;

      if (config.environment.minifyHtml) {
        apiModel.content = htmlMinify(apiModel.content as string, {
          collapseWhitespace: true,
          removeComments: true,
          minifyJS: true,
          minifyCSS: true,
        });
      }

      const apiPath = `${config.folders.output.path}/api/${this.renderPath}.json`;

      await fs.writeFile(apiPath, JSON.stringify(apiModel), "utf8");

      PathsCache.clearOutputPath(apiPath);
    }
  }

  async build(config: IConfig, archives?: IArchiveTypeDisplayMap) {
    const fileMatter = matter(
      await ContentCache.getContent(config, this.path),
      {}
    );

    const fileData = JSON.parse(
      ejs.render(
        JSON.stringify(fileMatter.data),
        { model: fileMatter.data, config: config },
        {
          rmWhitespace: true,
        }
      )
    );

    Object.assign(this, fileData as IContentData, {
      rawContent: fileMatter.content,
    });

    if (
      config.notAdded?.indexOf(`${this.path}`) < 0 &&
      !this.modifiedDate &&
      !this.createdDate
    ) {
      const log = await git.log({
        file: `${config.folders.content.path}/${this.path}`,
      });

      this.createdDate = new Date(
        log.all.slice(-1)[0].date
      ).toLocaleDateString();

      this.modifiedDate = new Date(log.latest.date).toLocaleDateString();
    }

    this.createdDate = this.createdDate ?? new Date().toUTCString();

    this.modifiedDate = this.modifiedDate ?? this.createdDate;

    this.slug = pathUtil.pathPretty(this.path);

    if (
      config.removeFolderPrefix.some((folderPrefix) =>
        this.slug?.startsWith(folderPrefix)
      )
    ) {
      this.slug = this.slug.slice(this.slug.indexOf("/") + 1, this.slug.length);
    }

    if (!this.canonical) {
      this.canonical = `${config.environment.domain}/${
        this.slug ? this.slug + "/" : ""
      }`;
    }

    this.layout = this.layout ?? "base";

    this.template = this.template ?? "index";

    this.renderPath = pathUtil.getRenderPath(config, this.path);

    if (this.data || this.pagination) {
      await this.hydrateData(config, this, archives as IArchiveTypeDisplayMap);
    }

    if (!this.pagination) {
      const model = {
        ...this,
        archives: archives,
      };

      this.content = ejs.render(
        this.rawContent as string,
        {
          model: model,
          config: config,
        },
        { filename: this.path, rmWhitespace: true }
      );

      if (this.path.endsWith(".md")) {
        this.content = markdown.render(this.content);
      }

      if (config.environment.minifyHtml) {
        this.content = htmlMinify(this.content, {
          collapseWhitespace: true,
          removeComments: true,
          minifyJS: true,
          minifyCSS: true,
        });
      }
    }
  }

  async hydrateData(
    config: IConfig,
    model: Partial<IContentData> | Partial<Content>,
    archives: IArchiveTypeDisplayMap
  ) {
    let dataKeys: string[];

    if (model.pagination?.data) {
      dataKeys = [model.pagination.data];
    } else if (model.pagination) {
      dataKeys = ["posts"];
    } else {
      dataKeys = (Array.isArray(model.data)
        ? model.data
        : [model.data]) as string[];
    }

    this.data = await dataKeys?.reduce(
      async (
        data: { [index: string]: {}[] } | Promise<{ [index: string]: {}[] }>,
        source: string
      ) => {
        data = await data;
        return {
          ...data,
          [source]:
            source == "posts"
              ? await this.hydratePostData(
                  config,
                  await pathUtil.getPostPaths(config),
                  archives
                )
              : await DataCache.getData(config, `${source}.json`),
        };
      },
      Promise.resolve({})
    );
  }

  async hydratePostData(
    config: IConfig,
    paths: string[],
    archives: IArchiveTypeDisplayMap
  ) {
    const posts = [];
    for (const postPaths of siteUtil.chunkItems(paths)) {
      posts.push(
        ...(await Promise.all(
          postPaths.map(async (contentPath: string) => {
            const contentModel = new Content({
              path: contentPath,
            });
            await contentModel.build(config, archives);
            const {
              path,
              layout,
              template,
              renderPath,
              rawContent,
              ...keep
            } = contentModel;
            return keep;
          })
        ))
      );
    }

    posts.sort(
      (first: Partial<Content>, second: Partial<Content>) =>
        new Date(second.createdDate as string).getTime() -
        new Date(first.createdDate as string).getTime()
    );

    return posts;
  }
}
