import IArchiveData from "./IArchiveData.js";
import IEnvironment from "./IEnvironment.js";
import IFolder from "./IFolder.js";

export default interface IConfig {
  typescript: {
    enabled: boolean;
    ignoreGlobs: string[];
  };
  sass: {
    enabled: boolean;
  };
  saveContentGuid: { enabled: boolean };
  folders: {
    [index: string]: IFolder;
    rootFiles: IFolder;
    content: IFolder;
    data: IFolder;
    templates: IFolder;
    layouts: IFolder;
    assets: IFolder;
    images: IFolder;
    scripts: IFolder;
    styles: IFolder;
    output: IFolder;
    site: IFolder;
  };
  removeFolderPrefix: string[];
  environment: IEnvironment;
  version: string;
  siteName: string;
  siteDescription: string;
  notAdded: string[];
  archiveData: IArchiveData[];
}
