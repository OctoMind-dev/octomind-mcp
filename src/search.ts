import axios from "axios";
import { SearchResult } from "./types";
import { logger } from "./logger";

// see https://mintlify.com/docs/api-reference/introduction#assistant-api-key
const PUBLIC_MINTLIFY_API_KEY = "mint_dsc_3ZNWe13kDZKPFdidzxsnQFyU";
const MINT_SUBDOMAIN = "octomind";
const MINT_SERVER_URL = "https://leaves.mintlify.com";
const DEFAULT_BASE_URL = "https://api.mintlifytrieve.com";
const DOC_BASE_URL = "https://octomind.dev/docs";

const searchFetchPath = `${DEFAULT_BASE_URL}/api/chunk/autocomplete`;

type TrieveData = {
  name: string;
  trieveDatasetId: string; // trieve dataset id
  trieveApiKey: string; // trieve api key
  openApiUrls: string[]; // openapi urls for trieve
};

const trieveFetcher = async (trieve: TrieveData, query: string) => {
  try {
    const response = await axios.post(
      searchFetchPath,
      {
        page_size: 10,
        query,
        search_type: "fulltext",
        extend_results: true,
        score_threshold: 1,
      },
      {
        timeout: 3000,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${trieve.trieveApiKey}`,
          "TR-Dataset": trieve.trieveDatasetId,
          "X-API-VERSION": "V2",
        },
      },
    );
    return response.data;
  } catch (error) {
    logger.error("Error fetching trieve data:", error);
    throw new Error("Error fetching trieve data");
  }
};

export const trieveConfig = async (): Promise<TrieveData | null> => {
  try {
    // https://leaves.mintlify.com/api/mcp/config/octomind
    const { data } = await axios.get(
      `${MINT_SERVER_URL}/api/mcp/config/${MINT_SUBDOMAIN}`,
      {
        timeout: 3000,
        headers: {
          "X-API-Key": `${PUBLIC_MINTLIFY_API_KEY}`,
        },
      },
    );
    //logger.debug("Trieve config:", data);
    return data;
  } catch (error) {
    logger.error("Error fetching trieve result data:", error);
    return null;
  }
};

export const search = async (
  query: string,
  trieve: TrieveData,
): Promise<SearchResult[]> => {
  const data = await trieveFetcher(trieve, query);
  if (data.chunks === undefined || data.chunks.length === 0) {
    throw new Error("No results found");
  }
  return data.chunks.map((result: any) => {
    const { chunk } = result;
    return {
      title: chunk.metadata.title,
      content: chunk.chunk_html,
      link: `${DOC_BASE_URL}/${chunk.link}`,
    };
  });
};
