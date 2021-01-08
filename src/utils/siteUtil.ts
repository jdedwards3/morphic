import { pathUtil } from "./pathUtil.js";
import fs from "fs-extra";
import xml from "xml";
import cheerio from "cheerio";
import htmlMinifier from "html-minifier";
import Content from "../models/content.js";
import IConfig from "../interfaces/IConfig";
import IArchiveType from "../interfaces/IArchiveType.js";
import { slugUtil } from "./slugUtil.js";
import PathsCache from "../models/pathsCache.js";
import IArchiveTypeDisplayMap from "../interfaces/IArchiveTypeDisplayMap.js";

const htmlMinify = htmlMinifier.minify;

async function createRssFeed(
  config: IConfig,
  contentPaths: string[],
  archives: IArchiveTypeDisplayMap
) {
  const feedObject = {
    rss: [
      {
        _attr: {
          version: "2.0",
          "xmlns:atom": "http://www.w3.org/2005/Atom",
        },
      },
      {
        channel: [
          {
            "atom:link": {
              _attr: {
                href: `${config.environment.domain}/feed.rss`,
                rel: "self",
                type: "application/rss+xml",
              },
            },
          },
          {
            title: config.siteName,
          },
          {
            link: `${config.environment.domain}/`,
          },
          { description: `${config.siteDescription}` },
          { language: "en-US" },
          ...(await buildFeed(config, contentPaths, archives)),
        ],
      },
    ],
  };

  const feed = '<?xml version="1.0" encoding="UTF-8"?>' + xml(feedObject);

  const feedFilePath = `${config.folders.output.path}/feed.rss`;

  await fs.writeFile(feedFilePath, feed, "utf8");

  PathsCache.clearOutputPath(feedFilePath);
}

async function buildFeed(
  config: IConfig,
  paths: string[],
  archives: IArchiveTypeDisplayMap
) {
  const feedItemSort = (
    first: { item: [{ pubDate: string }] },
    second: { item: [{ pubDate: string }] }
  ) =>
    new Date(
      Object.values(
        second.item.find((o) => Object.keys(o)[0] == "pubDate") as {}
      )[0] as string
    ).getTime() -
    new Date(
      Object.values(
        first.item.find((o) => Object.keys(o)[0] == "pubDate") as {}
      )[0] as string
    ).getTime();

  const feedItems = [];

  for (const contentPaths of siteUtil.chunkItems(paths)) {
    feedItems.push(
      ...(await contentPaths.reduce(
        async (
          latestPosts:
            | { item: [{ pubDate: string }] }[]
            | Promise<{ item: [{ pubDate: string }] }[]>,
          path: string
        ) => {
          if (!pathUtil.isPost(path)) {
            latestPosts = await latestPosts;
            return latestPosts;
          } else {
            latestPosts = await latestPosts;
          }

          const model = new Content({ path: path });

          await model.build(config, archives);

          const $ = cheerio.load(model.content as string, {
            decodeEntities: false,
          });

          $.root()
            .find("a[href^='/']")
            .each(function (this: cheerio.Element) {
              const $this = $(this);
              $this.attr(
                "href",
                `${config.environment.domain}${$this.attr("href")}`
              );
            });

          const description = $.root().find("body").html() as string;

          const feedItem = {
            item: [
              { title: model.title },
              {
                pubDate: new Date(model.createdDate as string).toUTCString(),
              },
              {
                link: `${config.environment.domain}/${model.slug}/`,
              },
              {
                guid: [
                  { _attr: { isPermaLink: true } },
                  `${config.environment.domain}/${model.slug}/`,
                ],
              },
              {
                description: {
                  _cdata: htmlMinify(description, {
                    collapseWhitespace: true,
                    removeComments: true,
                    minifyJS: true,
                    minifyCSS: true,
                  }),
                },
              },
            ],
          };

          if (
            latestPosts.length < 30 ||
            (latestPosts as { item: [{ pubDate: string }] }[]).some(
              (accItem) =>
                new Date(
                  Object.values(
                    accItem.item.find(
                      (o) => Object.keys(o)[0] == "pubDate"
                    ) as {}
                  )[0] as string
                ).getTime() <
                new Date(
                  Object.values(
                    feedItem.item.find(
                      (o) => Object.keys(o)[0] == "pubDate"
                    ) as {}
                  )[0] as string
                ).getTime()
            )
          ) {
            (latestPosts as { item: [{ pubDate: string }] }[]).push(
              feedItem as { item: [{ pubDate: string }] }
            );
          }
          return latestPosts.sort(feedItemSort).slice(0, 30);
        },
        Promise.resolve([])
      ))
    );
  }

  return feedItems.sort(feedItemSort).slice(0, 30);
}

async function createSitemap(
  config: IConfig,
  contentPaths: string[],
  archiveTypeContentPaths: IArchiveType,
  archives: IArchiveTypeDisplayMap
) {
  const archiveItems = (
    await Promise.all(
      Object.keys(archiveTypeContentPaths ?? {}).map(async (type: string) => {
        return await Promise.all(
          Object.keys(archiveTypeContentPaths[type]).map(
            async (archive: string) => ({
              url: [
                {
                  loc: `${config.environment.domain}/${
                    type.endsWith("s") ? type.slice(0, -1) : type
                  }/${slugUtil.slugClean(archive)}/`,
                },
                {
                  lastmod: new Date(
                    Math.max.apply(
                      null,
                      await Promise.all(
                        archiveTypeContentPaths[type][archive].map(
                          async (path) => {
                            const content = new Content({ path });
                            await content.build(config, archives);
                            return (new Date(
                              (content.modifiedDate ??
                                content.createdDate) as string
                            ) as unknown) as number;
                          }
                        )
                      )
                    )
                  )
                    .toISOString()
                    .split("T")[0],
                },
              ],
            })
          )
        );
      })
    )
  ).flat();

  const contentItems = await contentPaths.reduce(
    async (
      contentItems:
        | { url: [{ loc: string }, { lastmod: string }] }[]
        | Promise<{ url: [{ loc: string }, { lastmod: string }] }[]>,
      path
    ) => {
      if (!pathUtil.is404(path) && !pathUtil.isIndex(path)) {
        contentItems = await contentItems;
        const contentModel = new Content({ path });
        await contentModel.build(config, archives);
        contentItems.push({
          url: [
            {
              loc: `${config.environment.domain}/${
                contentModel.slug ? `${contentModel.slug}/` : ""
              }`,
            },
            {
              lastmod: new Date(
                (contentModel.modifiedDate ??
                  contentModel.createdDate) as string
              )
                .toISOString()
                .split("T")[0],
            },
          ],
        });
      } else {
        contentItems = await contentItems;
      }
      return contentItems;
    },
    Promise.resolve([])
  );

  const indexItem = {
    url: [
      {
        loc: `${config.environment.domain}/`,
      },
      {
        lastmod: new Date(
          Math.max.apply(
            null,
            await Promise.all(
              contentPaths.map(async (path) => {
                const content = new Content({ path: path });
                await content.build(config, archives);
                return (new Date(
                  (content.modifiedDate ?? content.createdDate) as string
                ) as unknown) as number;
              })
            )
          )
        )
          .toISOString()
          .split("T")[0],
      },
      { changefreq: "daily" },
      { priority: "1.0" },
    ],
  };

  const sitemapObject = {
    urlset: [
      {
        _attr: {
          xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
        },
      },
      indexItem,
      ...contentItems,
      ...archiveItems,
    ],
  };

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>${xml(sitemapObject)}`;

  const sitemapFilePath = `${config.folders.output.path}/sitemap.xml`;

  await fs.writeFile(sitemapFilePath, sitemap, "utf8");

  PathsCache.clearOutputPath(sitemapFilePath);
}

async function cleanOldOutputFiles(config: IConfig) {
  const outputFolders = await PathsCache.getOutputPaths().reduce(
    async (folders: string[] | Promise<string[]>, file) => {
      folders = await folders;

      const item = file.split(`${config.folders.output.path}/`)[1];

      const itemPath = item.slice(
        0,
        item.lastIndexOf("/") == -1 ? item.length : item.lastIndexOf("/")
      );

      if (item.includes("/") && folders.indexOf(itemPath) == -1) {
        folders.push(itemPath);
      }

      await fs.remove(file);

      return folders;
    },
    Promise.resolve([])
  );

  let baseFolders: string[] = [];

  const parentFolders = outputFolders.reduce((items: string[], item) => {
    const parentFolder = item.slice(
      0,
      item.lastIndexOf("/") == -1 ? item.length : item.lastIndexOf("/")
    );

    if (
      !items.includes(parentFolder) &&
      parentFolder.includes("/") &&
      !baseFolders.includes(parentFolder)
    ) {
      items.push(parentFolder);
    }

    if (
      !items.includes(item) &&
      !parentFolder.includes("/") &&
      item.includes("/")
    ) {
      items.push(item);
    }

    if (
      !parentFolder.includes("/") &&
      item.includes("/") &&
      !baseFolders.includes(parentFolder)
    ) {
      baseFolders.push(parentFolder);
    }

    if (!item.includes("/") && !baseFolders.includes(item)) {
      baseFolders.push(item);
    }

    return items;
  }, []);

  await Promise.all(
    parentFolders.map(
      async (item) => await fs.remove(`${config.folders.output.path}/${item}`)
    )
  );

  await Promise.all(
    baseFolders.map(async (item) => {
      const outputPath = `${config.folders.output.path}/${item}`;
      if (!(await fs.readdir(outputPath)).length) {
        await fs.remove(outputPath);
      }
    })
  );
}

const chunkItems = <T>(items: T[]) =>
  items.length > 1024
    ? items.reduce((chunks: T[][], item: T, index) => {
        const chunk = Math.floor(index / 512);
        chunks[chunk] = ([] as T[]).concat(chunks[chunk] || [], item);
        return chunks;
      }, [])
    : [items];

const siteUtil = {
  createSitemap,
  createRssFeed,
  chunkItems,
  cleanOldOutputFiles,
};

export { siteUtil };
