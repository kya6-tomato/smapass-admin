import { getGoClient, isGoApiError } from "@/lib/go-client";
import { messageForCode } from "@/lib/messages";
import { getSessionToken } from "@/lib/session";

export type RecordStatusResponse = {
  status: "pending" | "submitted" | "confirmed" | "failed";
  txHash?: string;
  errorMessage?: string;
};

/** 送信した記録の状態を返すBFF（FR-P05 受け入れ基準4）。ブラウザはGoを直接呼ばない */
export async function GET(_req: Request, ctx: RouteContext<"/api/records/[id]">) {
  const { id } = await ctx.params;
  const token = await getSessionToken();
  if (!token) return Response.json({ code: "unauthenticated" }, { status: 401 });

  try {
    const s = await (await getGoClient()).getRecordStatus(token, id);
    const body: RecordStatusResponse = { status: s.status };
    if (s.txHash) body.txHash = s.txHash;
    if (s.status === "failed") body.errorMessage = messageForCode(s.error?.code);
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (isGoApiError(e, "unauthenticated")) {
      return Response.json({ code: "unauthenticated" }, { status: 401 });
    }
    return Response.json({ code: "upstream_error" }, { status: 502 });
  }
}
