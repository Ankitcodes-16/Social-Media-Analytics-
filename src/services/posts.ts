import type { Paginated, PostQuery, SocialPost } from "@/types";
import { queryPost, queryPosts } from "@/data/mock/queries";
import { ApiError, apiFetch } from "./http";
import { isApiBacked } from "./config";
import { mockCall } from "./mock";

/** GET /api/posts?q=&platform=&topicId=&sentiment=&rangeHours=&sort=&page=&pageSize= */
export async function getPosts(query: PostQuery = {}): Promise<Paginated<SocialPost>> {
  if (isApiBacked("posts")) {
    return apiFetch<Paginated<SocialPost>>("/api/posts", { query: { ...query } });
  }
  return mockCall(() => queryPosts(query));
}

/** GET /api/posts/{id} — resolves to null when the post does not exist. */
export async function getPost(id: string): Promise<SocialPost | null> {
  if (isApiBacked("posts")) {
    try {
      return await apiFetch<SocialPost>(`/api/posts/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }
  return mockCall(() => queryPost(id));
}
