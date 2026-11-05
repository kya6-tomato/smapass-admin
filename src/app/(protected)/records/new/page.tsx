import type { Metadata } from "next";
import { ETHERSCAN_TX_BASE, getPollingConfig } from "@/config";
import { toDeviceView, type DeviceView } from "@/lib/device";
import { getGoClient } from "@/lib/go-client";
import { getSessionToken } from "@/lib/session";
import { RecordFlow } from "./record-flow";

export const metadata: Metadata = { title: "整備記録を書く | SmaPass 事業者向け" };

export default async function NewRecordPage() {
  const device = await loadDemoDevice();

  return (
    <>
      <h1 className="text-2xl font-bold">整備記録を書く</h1>
      <p className="mt-1 text-sm text-ink-soft">
        送信した記録はチェーンに残り、あとから消せません。訂正は別の記録として追加します。
      </p>
      <RecordFlow
        device={device}
        polling={getPollingConfig()}
        etherscanTxBase={ETHERSCAN_TX_BASE}
      />
    </>
  );
}

/** FR-P02：段階1では記録先をデモ端末に固定する。取れなければ null（送信できなくする） */
async function loadDemoDevice(): Promise<DeviceView | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return toDeviceView(await (await getGoClient()).getDemoDevice(token));
  } catch {
    return null;
  }
}
