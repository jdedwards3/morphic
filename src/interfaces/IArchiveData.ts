export default interface IArchiveData {
  type: string;
  layout?: string;
  descriptionPrefix: string;
  pagination: { pageSize: number; data: string };
}
