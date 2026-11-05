import { describe, expect, it } from "vitest";
import { GoApiError } from "./errors";
import { createMockClient, MOCK_DEMO_ACCOUNT, parseMockScenario } from "./mock";
import type { MaintenanceRecordRequest } from "./types";

const freshStore = () => ({ tokens: new Set<string>(), records: new Map(), idempotency: new Map() });
const req: MaintenanceRecordRequest = {
  deviceId: "dev_7f3a9c21",
  recordType: "inspection",
  workedAt: "2026-11-10T05:30:00Z",
  content: { inspectionResult: "ok" },
};

describe("Goのモック（T-02）", () => {
  it("デモアカウント以外ではログインできない", async () => {
    const client = createMockClient("default", freshStore());
    await expect(client.login({ partnerId: "demo-repair", password: "x" })).rejects.toMatchObject({
      code: "invalid_credentials",
    });
  });

  it("トークンがなければ unauthenticated", async () => {
    const client = createMockClient("default", freshStore());
    await expect(client.getMe("nope")).rejects.toBeInstanceOf(GoApiError);
  });

  it("同じ冪等キーで2回送っても記録は1件", async () => {
    const store = freshStore();
    const client = createMockClient("default", store);
    const { token } = await client.login(MOCK_DEMO_ACCOUNT);
    const a = await client.createRecord(token, req, "key-1");
    const b = await client.createRecord(token, req, "key-1");
    expect(a.recordId).toBe(b.recordId);
    expect(store.records.size).toBe(1);
  });

  it("問い合わせのたびに pending → submitted → confirmed と進む", async () => {
    const client = createMockClient("default", freshStore());
    const { token } = await client.login(MOCK_DEMO_ACCOUNT);
    const { recordId } = await client.createRecord(token, req, "key-1");
    expect((await client.getRecordStatus(token, recordId)).status).toBe("submitted");
    const done = await client.getRecordStatus(token, recordId);
    expect(done.status).toBe("confirmed");
    expect(done.txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("知らないシナリオ名は default として扱う", () => {
    expect(parseMockScenario("drop_database")).toBe("default");
    expect(parseMockScenario(undefined)).toBe("default");
    expect(parseMockScenario("status_failed")).toBe("status_failed");
  });
});
