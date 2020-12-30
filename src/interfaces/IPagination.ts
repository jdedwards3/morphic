import IPage from "./IPage.js";

export default interface IPagination {
  data: string;
  pageSize: number;
  first?: Partial<IPage>;
  last?: Partial<IPage>;
  current?: Partial<IPage>;
  previous?: Partial<IPage>;
  next?: Partial<IPage>;
  pageData?: {}[];
}
