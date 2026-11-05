"use server";

import { checkCode, toTargetDevice, type TargetDevice } from "@/lib/device-session";
import { getGoClient, isGoApiError } from "@/lib/go-client";
import { CODE_REQUIRED_MESSAGE, messageForCode } from "@/lib/messages";
import { toApiRequest, validateRecordForm, type FieldErrors } from "@/lib/schemas/record";
import { getSessionToken, setDeviceTarget } from "@/lib/session";

export type SubmitResult =
  | { ok: true; recordId: string }
  | { ok: false; kind: "validation"; fieldErrors: FieldErrors }
  | { ok: false; kind: "unauthenticated" }
  | { ok: false; kind: "session_expired"; message: string }
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
    // FR-P03 基準4：書き込みできる時間が終わっていた。コードの再入力を促す
    if (isGoApiError(e, "device_session_expired")) {
      return { ok: false, kind: "session_expired", message: messageForCode("device_session_expired") };
    }
    const code = isGoApiError(e) ? e.code : undefined;
    return { ok: false, kind: "error", message: messageForCode(code) };
  }
}

export type DeviceCodeResult =
  | { ok: true; target: TargetDevice }
  | { ok: false; kind: "unauthenticated" }
  | { ok: false; kind: "error"; message: string };

/**
 * 手入力コードで記録先の端末を指定する（FR-P03）。
 * コードの形式と誤入力の回数制限はGoが判定する。サイトは空かどうかしか見ず、回数も数えない。コードはログに出さない。
 */
export async function enterDeviceCode(rawCode: string): Promise<DeviceCodeResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, kind: "unauthenticated" };
  const checked = checkCode(rawCode);
  if (!checked.ok) {
    const message = checked.reason === "empty" ? CODE_REQUIRED_MESSAGE : messageForCode("code_invalid");
    return { ok: false, kind: "error", message };
  }
  const code = checked.code;

  try {
    const res = await (await getGoClient()).createDeviceSession(token, { code });
    const target = toTargetDevice(res);
    await setDeviceTarget(target);
    return { ok: true, target };
  } catch (e) {
    if (isGoApiError(e, "unauthenticated")) return { ok: false, kind: "unauthenticated" };
    return { ok: false, kind: "error", message: messageForCode(isGoApiError(e) ? e.code : undefined) };
  }
}
