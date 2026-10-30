import "server-only";
import { cookies } from "next/headers";
import { isMockEnabled } from "@/config";
import { createHttpClient } from "./http";
import { createMockClient, parseMockScenario } from "./mock";
import type { GoClient } from "./types";

export { GoApiError, isGoApiError } from "./errors";
export type * from "./types";

/**
 * Goのクライアントを返す。USE_API_MOCK=true ならモック、それ以外は GO_API_BASE_URL の本物。
 * サーバー側専用（"server-only" でブラウザ側から読み込むとビルドが失敗する）。
 */
export async function getGoClient(): Promise<GoClient> {
  if (isMockEnabled()) {
    const scenario = parseMockScenario((await cookies()).get("mock_scenario")?.value);
    return createMockClient(scenario);
  }
  const baseUrl = process.env.GO_API_BASE_URL;
  if (!baseUrl) throw new Error("GO_API_BASE_URL is not set");
  return createHttpClient(baseUrl);
}
