import type { Metadata } from "next";
import { ETHERSCAN_TX_BASE, getPollingConfig } from "@/config";
import { toDeviceView } from "@/lib/device";
import type { TargetDevice } from "@/lib/device-session";
import { getGoClient } from "@/lib/go-client";
import { getDeviceTarget, getSessionToken } from "@/lib/session";
import { RecordFlow } from "./record-flow";

export const metadata: Metadata = { title: "整備記録を書く | SmaPass 事業者向け" };

export default async function NewRecordPage() {
  const device = await loadTarget();

  return (
    <>
      <h1 className="text-2xl font-bold">整備記録を書く</h1>
      <p className="mt-1 text-sm text-ink-soft">
        送信した記録はチェーンに残り、あとから消せません。訂正は別の記録として追加します。
      </p>
      <RecordFlow
        initialDevice={device}
        polling={getPollingConfig()}
        etherscanTxBase={ETHERSCAN_TX_BASE}
      />
    </>
  );
}

/**
 * 記録先を決める。コードで指定した端末（FR-P03）が残っていればそれ、なければ段階1のデモ端末（FR-P02）。
 * どちらも取れなければ null（送信できなくする）
 */
async function loadTarget(): Promise<TargetDevice | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const byCode = await getDeviceTarget();
  if (byCode) return byCode;
  try {
    return { ...toDeviceView(await (await getGoClient()).getDemoDevice(token)), writableUntil: null };
  } catch {
    return null;
  }
}
