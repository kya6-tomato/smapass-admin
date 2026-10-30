import type { Device } from "./go-client/types";

export type DeviceView = { deviceId: string; displayName: string };

/**
 * 画面に渡す端末情報を、表示してよい項目だけに絞る（FR-P02 受け入れ基準2）。
 * Goが将来IMEIなどを返すようになっても、ブラウザには送らない。
 */
export function toDeviceView(device: Device): DeviceView {
  return { deviceId: device.deviceId, displayName: device.displayName };
}
