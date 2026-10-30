import type { DeviceView } from "@/lib/device";

/** 記録先の端末（FR-P02）。端末IDは匿名化したものだけを出す */
export function DeviceCard({ device }: { device: DeviceView | null }) {
  if (!device) {
    return (
      <section
        role="alert"
        className="rounded-lg border border-danger/30 bg-danger-soft px-5 py-4 text-danger"
      >
        <p className="font-semibold">記録先の端末を取得できません</p>
        <p className="mt-1 text-sm">時間をおいてページを再読み込みしてください。このままでは送信できません。</p>
      </section>
    );
  }
  return (
    <section
      aria-labelledby="device-heading"
      className="flex items-center justify-between rounded-lg border border-line bg-surface px-5 py-4"
    >
      <div>
        <h2 id="device-heading" className="text-xs font-semibold tracking-wide text-ink-soft">
          記録先の端末
        </h2>
        <p className="mt-0.5 font-semibold" data-testid="device-name">
          {device.displayName}
        </p>
      </div>
      <p className="font-mono text-sm text-ink-soft" data-testid="device-id">
        {device.deviceId}
      </p>
    </section>
  );
}
