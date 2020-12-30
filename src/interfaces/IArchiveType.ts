export default interface IArchiveType {
  [type: string]: {
    [archiveKey: string]: string[];
  };
}
