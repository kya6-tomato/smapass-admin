"use client";

import { useEffect, useRef, useState } from "react";
import { QR_SCAN_INTERVAL_MS, QR_SCAN_TIMEOUT_MS } from "@/config";
import {
  CAMERA_UNSUPPORTED_MESSAGE,
  describeCameraError,
  QR_NOT_FOUND_MESSAGE,
} from "@/lib/qr";
import { createQrDecoder } from "@/lib/qr-reader";

type Props = {
  /** QRから文字列を読めたとき。呼ばれる前にカメラは止めてある */
  onDecoded: (text: string) => void;
  onClose: () => void;
};

type Phase = { kind: "starting" } | { kind: "scanning" } | { kind: "failed"; message: string };

/**
 * カメラを開いてQRを読む（FR-P03 基準5）。表示している間だけカメラを使い、
 * 読めたとき・閉じたとき・画面を離れたときに必ず止める。
 * 失敗してもここは案内を出すだけで、手入力の欄は常に使える（CodeEntry 側は何も止めない）。
 */
export function QrScanner({ onDecoded, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  // 親が毎回新しい関数を渡しても、カメラを開き直さない
  const onDecodedRef = useRef(onDecoded);
  useEffect(() => {
    onDecodedRef.current = onDecoded;
  });

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function stop() {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
    }

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setPhase({ kind: "failed", message: CAMERA_UNSUPPORTED_MESSAGE });
        return;
      }
      try {
        // 背面カメラがあればそれを、なければ（PCのカメラなど）どのカメラでもよい
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (!video) {
          stop();
          return;
        }
        video.srcObject = s;
        await video.play().catch(() => undefined);
        const decode = await createQrDecoder();
        if (cancelled) return;
        setPhase({ kind: "scanning" });

        const startedAt = Date.now();
        const tick = async () => {
          if (cancelled) return;
          let text: string | null = null;
          try {
            text = await decode(video);
          } catch {
            text = null; // 1コマ読めなかっただけ。次のコマで続ける
          }
          if (cancelled) return;
          if (text) {
            stop();
            onDecodedRef.current(text);
            return;
          }
          if (Date.now() - startedAt >= QR_SCAN_TIMEOUT_MS) {
            stop();
            setPhase({ kind: "failed", message: QR_NOT_FOUND_MESSAGE });
            return;
          }
          timer = setTimeout(tick, QR_SCAN_INTERVAL_MS);
        };
        void tick();
      } catch (e) {
        if (cancelled) return;
        stop();
        setPhase({ kind: "failed", message: describeCameraError(e) });
      }
    }

    void start();
    return stop;
  }, []);

  return (
    <div className="mt-3 rounded-md border border-line bg-canvas p-3" data-testid="qr-scanner">
      {phase.kind !== "failed" && (
        <>
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="カメラの映像"
            className="mx-auto max-h-64 w-full rounded bg-black object-contain"
          />
          <p role="status" className="mt-2 text-sm text-ink-soft">
            {phase.kind === "starting"
              ? "カメラを起動しています。許可を求められたら許可してください"
              : "アプリに表示されたQRをカメラに映してください"}
          </p>
        </>
      )}
      {phase.kind === "failed" && (
        <p role="alert" data-testid="qr-error" className="text-sm text-danger">
          {phase.message}
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-2 rounded-md border border-line bg-surface px-4 py-1.5 text-sm hover:bg-canvas"
      >
        カメラを閉じる
      </button>
    </div>
  );
}
