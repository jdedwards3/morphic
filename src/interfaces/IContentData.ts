import IPagination from "./IPagination.js";

export default interface IContentData {
  title: string;
  guid: string;
  author?: string;
  tags?: string | string[];
  layout?: string;
  template?: string;
  metaDescription?: string;
  data?: string | string[];
  pagination?: IPagination;
  createdDate?: string;
  modifiedDate?: string;
}
