import IArchiveData from "./IArchiveData.js";
import IEnvironment from "./IEnvironment.js";
import IFolder from "./IFolder.js";

export default interface IConfig {
  typescript: {
    enabled: boolean;
    versionOutputFolderPath: boolean;
    ignoreGlobs: string[];
  };
  sass: {
    enabled: boolean;
    versionOutputFolderPath: boolean;
  };
  saveContentGuid: { enabled: boolean };
  folders: {
    [index: string]: IFolder;
    public: IFolder;
    src: IFolder & {
      typescript: IFolder & { outputFolder: string };
      sass: IFolder & { outputFolder: string };
    };
    content: IFolder;
    data: IFolder;
    templates: IFolder;
    layouts: IFolder;
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
