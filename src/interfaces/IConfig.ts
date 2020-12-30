import IArchiveData from "./IArchiveData.js";
import IEnvironment from "./IEnvironment.js";

export default interface IConfig {
  typescript: {
    enabled: boolean;
  };
  sass: {
    enabled: boolean;
  };
  saveContentGuid: { enabled: boolean };
  folders: {
    [index: string]:
      | { path: string }
      | { path: string; copyToOutput?: boolean }
      | { path: string; copyToOutput?: boolean; cacheBust?: boolean };
    content: { path: string };
    data: { path: string };
    templates: { path: string };
    layouts: { path: string };
    assets: { path: string; copyToOutput: boolean };
    images: { path: string; copyToOutput: boolean };
    scripts: { path: string; copyToOutput: boolean; cacheBust: boolean };
    styles: { path: string; copyToOutput: boolean; cacheBust: boolean };
    output: { path: string };
    site: { path: string };
  };
  removeFolderPrefix: string[];
  environment: IEnvironment;
  version: string;
  siteName: string;
  siteDescription: string;
  notAdded: string[];
  archiveData: IArchiveData[];
}
