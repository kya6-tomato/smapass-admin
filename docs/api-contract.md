# API契約（案）

**状態：案（Go担当と未合意）**。正はGoのリポジトリ。合意したらこの行を「合意済み（日付）」に変える。

Goが OpenAPI を出せるなら、`openapi-typescript` などで型を生成し、このファイルは参照先だけを書く形にする。出せない場合はこのファイルを手で同期する。

ここに書かれていないAPIは存在しないものとして扱い、必要なら質問すること。

コード上の型は `src/lib/go-client/types.ts`、モックは `src/lib/go-client/mock.ts`。このファイルを変えたら両方を直す。

モック独自のエラーコード：`record_not_found`（404）、`chain_submit_failed`（記録の `error.code`）、`network_error`（通信できなかったとき。サイト側で付ける）。Go側でも同じ名前にするか確認する。

## 一覧

ベースURLは `GO_API_BASE_URL`。すべてNext.jsのサーバー側から呼ぶ。

| メソッド | パス | 使う機能 | 成功時 |
| --- | --- | --- | --- |
| POST | `/partner/v1/auth/login` | FR-P01 | 200 |
| POST | `/partner/v1/auth/logout` | FR-P01 | 204 |
| GET | `/partner/v1/me` | FR-P01 | 200 |
| GET | `/partner/v1/devices/demo` | FR-P02 | 200 |
| POST | `/partner/v1/device-sessions` | FR-P03 | 201 |
| POST | `/partner/v1/maintenance-records` | FR-P04・P05 | 202 |
| GET | `/partner/v1/maintenance-records/{id}` | FR-P05 | 200 |

ログイン後のリクエストは `Authorization: Bearer <token>` を付ける（トークンはCookieから取り出す）。

## 型（TypeScript）

```ts
// 共通
type PartnerType = "manufacturer" | "repair_shop" | "used_shop";

type ApiError = {
  code: string;      // 例: "invalid_credentials", "code_expired"
  message: string;   // 開発者向け。画面にはそのまま出さない
};

// POST /auth/login
type LoginRequest = { partnerId: string; password: string };
type LoginResponse = { token: string; expiresAt: string };

// GET /me
type Me = {
  partnerId: string;
  name: string;
  type: PartnerType;
  hasRegistrationNumber: boolean; // 登録修理業者番号の有無（表示のみ）
};

// GET /devices/demo
type Device = {
  deviceId: string;    // 匿名化した端末ID
  displayName: string; // 例: "デモ端末"
};

// POST /device-sessions（FR-P03）
type DeviceSessionRequest = { code: string };
type DeviceSessionResponse = {
  deviceId: string;
  writableUntil: string; // UTC・Z付き
};

// POST /maintenance-records
// ヘッダー: Idempotency-Key: <UUID>
type RecordType = "repair" | "part_replacement" | "inspection";
// 訂正（correction）・取り消し（revocation）はGo側の形式にあるが、このサイトでは送らない

type MaintenanceRecordRequest = {
  deviceId: string;
  recordType: RecordType;
  workedAt: string; // UTC・Z付き・秒まで 例 "2026-11-10T05:30:00Z"
  content: {
    repairArea?: string;
    parts?: { name: string; origin: "genuine" | "compatible" }[];
    inspectionResult?: string;
    memo?: string;
  };
};
// 記録ID・記録者・ソルト・参照先はGoが付ける。送らない

type MaintenanceRecordAccepted = {
  recordId: string;
  status: "pending";
};

// GET /maintenance-records/{id}
type RecordStatus = "pending" | "submitted" | "confirmed" | "failed";

type MaintenanceRecordStatus = {
  recordId: string;
  status: RecordStatus;
  txHash?: string;        // submitted以降
  signerAddress?: string; // 署名者アドレス（残し方は未決）
  error?: ApiError;       // failedのとき
};
```

## 状態の意味

| status | 意味 | 画面の表示（FR-P05） |
| --- | --- | --- |
| `pending` | Goが受け付けた | 受付済み |
| `submitted` | チェーンに送信した（確定待ち） | 受付済み |
| `confirmed` | チェーンに記録された | チェーン記録済み |
| `failed` | 失敗した | 失敗 |

## エラーコード（案）

| HTTP | code | 場面 | 画面の表示 |
| --- | --- | --- | --- |
| 401 | `invalid_credentials` | ログイン | IDまたはパスワードが違います |
| 401 | `unauthenticated` | ログイン後のAPI | ログイン画面に移る |
| 404 | `device_not_found` | 端末の取得 | 記録先の端末を取得できません |
| 400 | `code_invalid` | コード入力 | コードが正しくありません |
| 410 | `code_expired` | コード入力 | コードの有効期限が切れています |
| 409 | `code_used` | コード入力 | このコードはすでに使われています |
| 429 | `too_many_attempts` | コード入力 | 入力回数の上限に達しました。アプリで新しいコードを表示してください |
| 403 | `device_session_expired` | 記録の送信 | 書き込みできる時間が終わりました |
| 422 | `validation_failed` | 記録の送信 | 項目ごとのエラーを表示 |
| 409 | `idempotency_conflict` | 記録の送信 | 同じ送信を二重に処理しない（既存の記録IDを返す想定） |
