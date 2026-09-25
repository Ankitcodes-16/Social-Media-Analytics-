/** Trend ids are derived from topic ids so the two can always be mapped. */
export const trendIdOf = (topicId: string): string => topicId.replace(/^t-/, "tr-");
export const topicIdOfTrend = (trendId: string): string => trendId.replace(/^tr-/, "t-");
