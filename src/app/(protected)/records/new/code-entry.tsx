"use client";

import { useState } from "react";
import { DEVICE_CODE_MAX_LENGTH } from "@/config";
import { checkCode, type TargetDevice } from "@/lib/device-session";
import { CODE_REQUIRED_MESSAGE } from "@/lib/messages";
import { extractCodeFromQrText, QR_NO_CODE_MESSAGE } from "@/lib/qr";
import { enterDeviceCode } from "./actions";
import { QrScanner } from "./qr-scanner";

type Props = {
  /** 書き込みできる時間が終わっているとき true（再入力を促す見出しにする） */
  expired: boolean;
  onEntered: (target: TargetDevice) => void;
  onUnauthenticated: () => void;
};

/**
 * アプリに表示された手入力コードで記録先の端末を指定する（FR-P03 基準1〜3）。
 * コードの形式と誤入力の回数制限はGoが判定する。ここでは空かどうかしか見ず、回数も数えない。
 * QRを読み取った結果（基準5）も、手入力と同じ submitCode に渡す。カメラが使えなくても手入力はいつでも使える。
 */
export function CodeEntry({ expired, onEntered, onUnauthenticated }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [scanning, setScanning] = useState(false);

  /** 手入力もQRも、ここを通ってGoに送る */
  async function submitCode(raw: string) {
    if (pending) return;
    const checked = checkCode(raw);
    if (!checked.ok && checked.reason === "empty") {
      setError(CODE_REQUIRED_MESSAGE);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await enterDeviceCode(raw);
      if (res.ok) {
        setCode("");
        onEntered(res.target);
      } else if (res.kind === "unauthenticated") {
        onUnauthenticated();
      } else {
        setError(res.message);
      }
    } catch {
      setError("サーバーと通信できませんでした");
    } finally {
      setPending(false);
    }
  }

  function onQrDecoded(text: string) {
    setScanning(false);
    const extracted = extractCodeFromQrText(text);
    if (extracted === null) {
      setError(QR_NO_CODE_MESSAGE);
      return;
    }
    setCode(extracted); // 失敗したときに、読み取れたコードを見て直せるようにする
    void submitCode(extracted);
  }

  return (
    <section
      aria-labelledby="code-heading"
      className={`rounded-lg border bg-surface px-5 py-4 ${expired ? "border-danger/40" : "border-line"}`}
    >
      <h2 id="code-heading" className="text-sm font-semibold">
        {expired ? "コードを入力し直してください" : "コードで端末を指定"}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        持ち主の端末のアプリに表示された、期限付きのコードを入力します。
      </p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submitCode(code);
        }}
        className="mt-3 flex items-start gap-2"
      >
        <div className="flex-1">
          <label htmlFor="device-code" className="sr-only">
            端末のコード
          </label>
          <input
            id="device-code"
            type="text"
            value={code}
            maxLength={DEVICE_CODE_MAX_LENGTH}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="アプリに表示されたコード"
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? "device-code-error" : undefined}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 font-mono aria-[invalid=true]:border-danger"
          />
          {error && (
            <p id="device-code-error" role="alert" className="mt-1 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-brand px-5 py-2 font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          このコードで指定する
        </button>
        <button
          type="button"
          onClick={() => setScanning((v) => !v)}
          aria-expanded={scanning}
          className="rounded-md border border-brand px-5 py-2 font-semibold text-brand hover:bg-canvas"
        >
          QRを読み取る
        </button>
      </form>
      {scanning && <QrScanner onDecoded={onQrDecoded} onClose={() => setScanning(false)} />}
    </section>
  );
}
