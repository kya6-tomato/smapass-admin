import { GoApiError } from "./errors";
import type {
  Device,
  GoClient,
  LoginResponse,
  MaintenanceRecordAccepted,
  MaintenanceRecordStatus,
  Me,
} from "./types";

const TIMEOUT_MS = 10_000;

/** 本物のGoを呼ぶクライアント。Next.jsのサーバー側でだけ使う */
export function createHttpClient(baseUrl: string): GoClient {
  const root = `${baseUrl.replace(/\/$/, "")}/partner/v1`;

  async function call<T>(
    path: string,
    init: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json", ...init.headers };
    if (init.token) headers.Authorization = `Bearer ${init.token}`;
    if (init.body !== undefined) headers["Content-Type"] = "application/json";

    let res: Response;
    try {
      res = await fetch(`${root}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new GoApiError(0, "network_error");
    }

    if (!res.ok) {
      let code = "unknown_error";
      try {
        const body = (await res.json()) as { code?: unknown };
        if (typeof body.code === "string") code = body.code;
      } catch {
        // 本文がJSONでないときは unknown_error のまま
      }
      throw new GoApiError(res.status, code);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    login: (req) => call<LoginResponse>("/auth/login", { method: "POST", body: req }),
    logout: (token) => call<void>("/auth/logout", { method: "POST", token }),
    getMe: (token) => call<Me>("/me", { token }),
    getDemoDevice: (token) => call<Device>("/devices/demo", { token }),
    createRecord: (token, req, idempotencyKey) =>
      call<MaintenanceRecordAccepted>("/maintenance-records", {
        method: "POST",
        token,
        body: req,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    getRecordStatus: (token, recordId) =>
      call<MaintenanceRecordStatus>(`/maintenance-records/${encodeURIComponent(recordId)}`, { token }),
  };
}
