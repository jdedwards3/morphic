import fs from "fs-extra";
import { pathUtil } from "../utils/pathUtil.js";
import IPagination from "../interfaces/IPagination.js";
import htmlMinifier from "html-minifier";
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
import GitLogCache from "./gitLogCache.js";

const htmlMinify = htmlMinifier.minify;

export default class Content {
  path: string;
  renderPath?: string;
  rawContent?: string;
  rawExcerpt?: string;
  content?: string;
  excerpt?: string;
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
    rawExcerpt?: string;
    content?: string;
    excerpt?: string;
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
    serviceWorkerRegistration: string,
    archives: IArchiveTypeDisplayMap
  ): Promise<void | string> {
    await pathUtil.createOutputFolders(this.path as string, config);

    const model = {
      ...this,
      styles: styles,
      serviceWorkerRegistration: serviceWorkerRegistration,
      archives: archives,
    };

    const renderedFile = await ejs.renderFile(
      `${config.folders.templates.path}/${this.template}.ejs`,
      {
        model: model,
        config: config,
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
        rawExcerpt,
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
      { excerpt_separator: "<!-- end -->" }
    );

    const fileData = JSON.parse(
      ejs.render(JSON.stringify(fileMatter.data), {
        model: fileMatter.data,
        config: config,
      })
    );

    Object.assign(this, fileData as IContentData, {
      rawContent: fileMatter.content,
      rawExcerpt: fileMatter.excerpt,
    });

    if (
      config.notAdded?.indexOf(`${this.path}`) < 0 &&
      !this.modifiedDate &&
      !this.createdDate
    ) {
      const log = await GitLogCache.getLog(config, this.path);

      const firstLogEntry = log.all.slice(-1)[0];

      if (firstLogEntry) {
        this.createdDate = new Date(firstLogEntry.date).toLocaleDateString();
      }

      const latestLogEntry = log.latest;
      if (latestLogEntry) {
        this.modifiedDate = new Date(latestLogEntry.date).toLocaleDateString();
      }
    }

    this.createdDate = this.createdDate ?? new Date().toLocaleDateString();

    this.modifiedDate = this.modifiedDate ?? this.createdDate;

    this.slug = pathUtil.pathPretty(pathUtil.getRenderPath(config, this.path));

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

      if (this.rawExcerpt) {
        this.excerpt = ejs.render(
          this.rawExcerpt as string,
          {
            model: model,
            config: config,
          },
          { filename: this.path }
        );

        if (this.path.endsWith(".md")) {
          if (this.excerpt) {
            this.excerpt = markdown.render(this.excerpt);
          }
        }
        model.excerpt = this.excerpt;
      }

      this.content = ejs.render(
        this.rawContent as string,
        {
          model: model,
          config: config,
        },
        { filename: this.path }
      );

      if (this.path.endsWith(".md")) {
        this.content = markdown.render(
          this.content.indexOf("<!-- end -->") == -1
            ? this.content
            : this.content.split("<!-- end -->")[1]
        );
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
      dataKeys = (
        Array.isArray(model.data) ? model.data : [model.data]
      ) as string[];
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
            const { path, layout, template, renderPath, rawContent, ...keep } =
              contentModel;
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
