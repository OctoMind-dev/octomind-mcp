import {  search, trieveConfig } from "./api";

const foo = async () => {
  const trieve = await trieveConfig();
  const r = await search("discovery", trieve);
  console.log(r);
};

foo()
  .then(() => {
    console.error("done");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
