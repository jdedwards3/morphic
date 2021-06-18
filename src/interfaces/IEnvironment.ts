export default interface IEnvironment {
  domain: string;
  minifyHtml: boolean;
  minifyTypescriptOutput: boolean;
  inlineSassOutput: boolean;
  jsonApi: boolean;
  rssFeed: boolean;
  sitemap: boolean;
  serviceWorker: { enabled: boolean };
}
