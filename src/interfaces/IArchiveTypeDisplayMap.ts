export default interface IArchiveTypeDisplayMap {
  [type: string]: {
    [archive: string]: string | { name: string; slug: string };
  }[];
}
