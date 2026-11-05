import { z } from "zod";
import { DEVICE_CODE_MAX_LENGTH } from "@/config";
import type { DeviceView } from "./device";
import type { DeviceSessionResponse } from "./go-client/types";
import { remainingMs } from "./time";

/** 記録先の端末。writableUntil があるのはコードで指定した端末（デモ端末は null＝期限なし） */
export type TargetDevice = DeviceView & { writableUntil: string | null };

/** Goが表示名を返さなかったときの名前 */
export const DEFAULT_CODE_DEVICE_NAME = "指定した端末";

export type CodeCheck = { ok: true; code: string } | { ok: false; reason: "empty" | "too_long" };

/**
 * 入力欄の中身 → Goに送るコード。前後の空白を除き、空と長すぎる入力だけ弾く。
 * 形式（桁数・文字の種類）は判定しない。Goが判定する。
 */
export function checkCode(raw: unknown): CodeCheck {
  const code = typeof raw === "string" ? raw.trim() : "";
  if (!code) return { ok: false, reason: "empty" };
  if (code.length > DEVICE_CODE_MAX_LENGTH) return { ok: false, reason: "too_long" };
  return { ok: true, code };
}

/** 表示用の端末情報にはIDと名前と期限だけを残す（FR-P02 基準2と同じ考え方） */
export function toTargetDevice(res: DeviceSessionResponse): TargetDevice {
  return {
    deviceId: res.deviceId,
    displayName: res.displayName?.trim() || DEFAULT_CODE_DEVICE_NAME,
    writableUntil: res.writableUntil,
  };
}

/** 書き込みできる時間が終わっているか（基準4）。期限が読めないときも終わったものとして扱う */
export function isWriteWindowClosed(
  target: TargetDevice | null,
  nowMs: number,
  forcedExpired = false,
): boolean {
  if (!target || target.writableUntil === null) return false;
  if (forcedExpired) return true;
  const left = remainingMs(target.writableUntil, nowMs);
  return left === null || left <= 0;
}

// --- 記録先を画面の開き直しでも覚えるCookie（httpOnly。トークンではなく端末IDと期限だけを入れる） ---

const cookieSchema = z.object({
  deviceId: z.string().min(1),
  displayName: z.string().min(1),
  writableUntil: z.string().min(1),
});

export function serializeTarget(target: TargetDevice): string {
  return JSON.stringify({
    deviceId: target.deviceId,
    displayName: target.displayName,
    writableUntil: target.writableUntil,
  });
}

/** Cookieの値 → 記録先。壊れている・期限が過ぎているときは null */
export function parseTargetCookie(raw: string | undefined, nowMs: number): TargetDevice | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = cookieSchema.safeParse(json);
  if (!parsed.success) return null;
  const target: TargetDevice = parsed.data;
  return isWriteWindowClosed(target, nowMs) ? null : target;
}
