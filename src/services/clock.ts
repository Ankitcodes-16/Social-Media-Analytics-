import { mockNow } from "@/data/mock/scenario";
import { isApiBacked } from "./config";

/** "Now" as the dataset sees it — used for relative times such as "5h ago". */
export const getNow = (): number => (isApiBacked("overview") ? Date.now() : mockNow());
