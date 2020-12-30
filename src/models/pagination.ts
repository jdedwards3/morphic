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
  pages: IPage[];
  private contentModel: Partial<Content>;
  private path: string;
  private template: string;
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
    this.template = init.template;
    this.pages = this.buildPages(init.path, init.data, init.pageSize);
    this.paginationPages = this.buildPagination();
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
              ...{ pagination: this.paginationPages[page.number] },
            },
            styles: styles,
            archives: archives,
          };

          if (model.rawContent) {
            model.content = ejs.render(model.rawContent as string, {
              model: model,
              config: config,
            });

            if (this.path.endsWith(".md")) {
              model.content = markdown.render(model.content);
            }
          }

          let paginationPage = await ejs.renderFile(
            `${config.folders.templates.path}/${this.template}.ejs`,
            {
              model: model,
              config: config,
            }
          );

          const filePath = page.slug
            ? page.slug.startsWith("/")
              ? page.slug
              : "/" + page.slug
            : page.slug;

          const pagePath = `${config.folders.output.path}${filePath}/index.html`;

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
              modifiedDate,
              template,
              layout,
              data,
              guid,
              ...apiModel
            } = this.contentModel;

            const apiPagePath = `${config.folders.output.path}/api/${page.slug}/index.json`;

            await fs.writeFile(apiPagePath, JSON.stringify(apiModel), "utf8");

            PathsCache.clearOutputPath(apiPagePath);
          }
        })
      );
    }
  }

  private buildPagination() {
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

  private buildPages(path: string, data: {}[], pageSize: number): IPage[] {
    pageSize = pageSize ?? -1;
    if (pageSize == -1) {
      pageSize = data.length;
    }
    return Array.from(Array(Math.ceil(data.length / pageSize)), (_, index) => ({
      slug: index
        ? `${pathUtil.pathPretty(path)}/page/${index + 1}`
        : `${pathUtil.pathPretty(path)}`,
      number: index + 1,
      pageData: data.slice(
        index ? pageSize * index : 0,
        index ? pageSize * (index + 1) : pageSize
      ),
    }));
  }
}
