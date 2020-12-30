export default interface IArchiveData {
  type: string;
  descriptionPrefix: string;
  pagination: { pageSize: number; data: string };
}
