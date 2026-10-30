"use server";

import { getGoClient, isGoApiError } from "@/lib/go-client";
import { messageForCode } from "@/lib/messages";
import { toApiRequest, validateRecordForm, type FieldErrors } from "@/lib/schemas/record";
import { getSessionToken } from "@/lib/session";

export type SubmitResult =
  | { ok: true; recordId: string }
  | { ok: false; kind: "validation"; fieldErrors: FieldErrors }
  | { ok: false; kind: "unauthenticated" }
  | { ok: false; kind: "error"; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 整備記録をGoに送る（FR-P05）。画面と同じスキーマでサーバー側でも検証する（FR-P04 受け入れ基準7）。
 * 入力内容はログに出さない。
 */
export async function submitRecord(
  deviceId: string,
  form: unknown,
  idempotencyKey: string,
): Promise<SubmitResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, kind: "unauthenticated" };
  if (typeof deviceId !== "string" || !deviceId || !UUID.test(idempotencyKey)) {
    return { ok: false, kind: "error", message: messageForCode(undefined) };
  }

  const validated = validateRecordForm(form);
  if (!validated.ok) return { ok: false, kind: "validation", fieldErrors: validated.fieldErrors };

  try {
    const client = await getGoClient();
    const res = await client.createRecord(token, toApiRequest(deviceId, validated.data), idempotencyKey);
    return { ok: true, recordId: res.recordId };
  } catch (e) {
    if (isGoApiError(e, "unauthenticated")) return { ok: false, kind: "unauthenticated" };
    const code = isGoApiError(e) ? e.code : undefined;
    return { ok: false, kind: "error", message: messageForCode(code) };
  }
}
