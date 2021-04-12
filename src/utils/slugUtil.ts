const slugClean = (slug: string) =>
  slug
    .split(" ")
    .join("")
    .split(".")
    .join("")
    .split("/")
    .join("")
    .toLowerCase();

const makeSingular = (item: string) =>
  item.endsWith("s") ? item.slice(0, -1) : item;

const slugUtil = { slugClean, makeSingular };

export { slugUtil };
