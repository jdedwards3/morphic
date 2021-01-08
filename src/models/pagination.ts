import { pathUtil } from "../utils/pathUtil.js";
import fs from "fs-extra";
import htmlMinifier from "html-minifier";
import IPage from "../interfaces/IPage.js";
import Content from "./content.js";
import IConfig from "../interfaces/IConfig.js";
import IArchiveTypeDisplayMap from "../interfaces/IArchiveTypeDisplayMap.js";
import { siteUtil } from "../utils/siteUtil.js";
import ejs from "ejs";
import { markdown } from "../utils/markdownUtil.js";
import IPagination from "../interfaces/IPagination.js";
import PathsCache from "./pathsCache.js";

const htmlMinify = htmlMinifier.minify;

export default class Pagination {
  private pages: IPage[];
  private contentModel: Partial<Content>;
  private path: string;
  private template: string;
  private data: {}[];
  private pageSize: number;
  private paginationPages: { [pageNumber: number]: IPagination };

  constructor(init: {
    path: string;
    data: {}[];
    pageSize: number;
    template: string;
    contentModel: Partial<Content>;
  }) {
    this.contentModel = init.contentModel;
    this.path = init.path;
    this.data = init.data;
    this.template = init.template;
    this.pageSize = init.pageSize ?? -1;
    if (this.pageSize == -1) {
      this.pageSize = this.data.length;
    }
    this.pages = [];
    this.paginationPages = {};
  }

  async render(
    config: IConfig,
    styles: string,
    archives: IArchiveTypeDisplayMap
  ) {
    for (const pageChunk of siteUtil.chunkItems(this.pages)) {
      await Promise.all(
        pageChunk.map(async (page: IPage) => {
          await pathUtil.createOutputFolders(page.slug, config);

          const model = {
            ...{
              ...this.contentModel,
              ...{
                slug: page.slug,
                pagination: this.paginationPages[page.number],
                canonical: `${config.environment.domain}/${
                  page.slug ? page.slug + "/" : ""
                }`,
              },
            },
            styles: styles,
            archives: archives,
          };

          if (model.rawContent) {
            model.content = ejs.render(
              model.rawContent as string,
              {
                model: model,
                config: config,
              },
              { filename: this.contentModel.layout }
            );

            if (this.path.endsWith(".md")) {
              model.content = markdown.render(model.content);
            }
          }

          const paginationPage = await ejs.renderFile(
            `${config.folders.templates.path}/${this.template}.ejs`,
            {
              model: model,
              config: config,
            }
          );

          const pageRenderPath = pathUtil.getRenderPath(config, page.slug);

          const filePath = pageRenderPath
            ? pageRenderPath.startsWith("/")
              ? pageRenderPath
              : "/" + pageRenderPath
            : "";

          const pagePath = `${config.folders.output.path}${filePath}.html`;

          await fs.writeFile(
            pagePath,
            config.environment.minifyHtml
              ? htmlMinify(paginationPage, {
                  collapseWhitespace: true,
                  removeComments: true,
                  minifyJS: true,
                  minifyCSS: true,
                })
              : paginationPage,
            "utf8"
          );

          PathsCache.clearOutputPath(pagePath);

          if (config.environment.jsonApi) {
            const {
              path,
              slug,
              rawContent,
              createdDate,
              renderPath,
              modifiedDate,
              template,
              layout,
              data,
              guid,
              styles,
              archives,
              ...apiModel
            } = model;

            const apiPagePath = `${config.folders.output.path}/api/${filePath}.json`;

            await fs.writeFile(apiPagePath, JSON.stringify(apiModel), "utf8");

            PathsCache.clearOutputPath(apiPagePath);
          }
        })
      );
    }
  }

  private buildPages() {
    const paginationPages: { [index: number]: IPagination } = {};

    for (const pageChunk of siteUtil.chunkItems(this.pages)) {
      pageChunk.forEach((page) => {
        paginationPages[page.number] = {} as IPagination;

        const { pageData, ...current } = this.pages[page.number - 1];

        paginationPages[page.number].current = current;

        if (
          paginationPages[page.number].current!.number == this.pages[0].number
        ) {
          delete paginationPages[page.number]!.first;
        } else {
          const { pageData, ...first } = this.pages[0];
          paginationPages[page.number].first = first;
        }

        if (
          paginationPages[page.number].current!.number ==
          this.pages.slice(-1)[0].number
        ) {
          delete paginationPages[page.number].last;
        } else {
          const { pageData, ...last } = this.pages.slice(-1)[0];
          paginationPages[page.number].last = last;
        }

        if (
          page.number > 2 &&
          paginationPages[page.number].current!.number !=
            this.pages[page.number - 2].number
        ) {
          const { pageData, ...previous } = this.pages[page.number - 2];
          paginationPages[page.number].previous = previous;
        } else {
          delete paginationPages[page.number].previous;
        }

        if (
          page.number < this.pages.length - 1 &&
          paginationPages[page.number].current!.number !=
            this.pages[page.number].number
        ) {
          const { pageData, ...next } = this.pages[page.number];
          paginationPages[page.number].next = next;
        } else {
          delete paginationPages[page.number].next;
        }

        paginationPages[page.number].pageData = this.pages[
          page.number - 1
        ].pageData;
      });
    }

    return paginationPages;
  }

  build(config: IConfig) {
    this.pages = Array.from(
      Array(Math.ceil(this.data.length / this.pageSize)),
      (_, index) => {
        const slug = index
          ? `${pathUtil.pathPretty(
              pathUtil.getRenderPath(config, this.path)
            )}/page/${index + 1}`
          : `${pathUtil.pathPretty(pathUtil.getRenderPath(config, this.path))}`;

        return {
          slug: slug
            ? slug.startsWith("/")
              ? slug.slice(1, slug.length)
              : slug
            : "",
          number: index + 1,
          pageData: this.data.slice(
            index ? this.pageSize * index : 0,
            index ? this.pageSize * (index + 1) : this.pageSize
          ),
        };
      }
    );
    this.paginationPages = this.buildPages();
  }
}
