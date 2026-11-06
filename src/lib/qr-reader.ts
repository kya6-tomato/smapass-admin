import { QR_FRAME_MAX_WIDTH } from "@/config";

/** カメラ映像の1コマからQRを読む。見つからなければ null */
export type QrDecoder = (video: HTMLVideoElement) => Promise<string | null>;

type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
};
type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

/**
 * QRの読み取り方を選ぶ（FR-P03 基準5・T-10）。
 * ブラウザ標準の BarcodeDetector があればそれを使う。Windows版のChrome/Edgeでは使えないことが多いので、
 * ないときは jsQR（純JS）で読む。jsQR はここで初めて読み込む（カメラを開かない限りバンドルを読まない）。
 * 読み取った文字列はログに出さない。
 */
export async function createQrDecoder(): Promise<QrDecoder> {
  const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (typeof Ctor === "function") {
    try {
      const formats = (await Ctor.getSupportedFormats?.()) ?? ["qr_code"];
      if (formats.includes("qr_code")) {
        const detector = new Ctor({ formats: ["qr_code"] });
        let fallback: QrDecoder | null = null;
        return async (video) => {
          if (fallback) return fallback(video);
          try {
            const found = await detector.detect(video);
            return found[0]?.rawValue ?? null;
          } catch {
            // 標準APIが途中で使えなくなったら、jsQRに切り替える
            fallback = await createJsQrDecoder();
            return fallback(video);
          }
        };
      }
    } catch {
      // 標準APIを使えない。jsQRで読む
    }
  }
  return createJsQrDecoder();
}

async function createJsQrDecoder(): Promise<QrDecoder> {
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const scale = Math.min(1, QR_FRAME_MAX_WIDTH / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);
    const image = ctx.getImageData(0, 0, width, height);
    return jsQR(image.data, width, height, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}
