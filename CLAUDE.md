# CLAUDE.md — 事業者向けサイト

修理業者・メーカー・中古店が、端末の整備記録を書き込むためのサイト。Next.js（App Router）で作り、Goバックエンドとだけ通信する。

## 最初に読むもの

- 作業前に `docs/requirements.md` を読む
- 担当タスクは `docs/tasks.md` で確認し、対応する `docs/specs/FR-P0x.md` の受け入れ基準を満たすまでを1つの作業とする
- Goとの通信を書くときは `docs/api-contract.md` の型（`src/lib/go-client/types.ts`）だけを使う。書かれていないAPIを推測で作らない
- Next.js 16は学習データと違う点が多い。書く前に `node_modules/next/dist/docs/` で確かめる（`AGENTS.md`）。例：`middleware.ts` は `proxy.ts` に改名、Cache Components が有効なので Cookie を読む部品は `<Suspense>` の中に置く

## 作業のルール

- 1回の作業は1タスクだけ。受け入れ基準をすべて満たし、テストが通ったら止まって報告する
- 仕様に書かれていないこと、矛盾していることに気づいたら、実装せずに質問する
- 受け入れ基準1つにつきテストを1本以上書く（E2Eは `e2e/` にPlaywright、それ以外は `src/**/*.test.ts` にVitest）。テスト名に「基準n」を入れる
- パッケージを追加するときは理由を書き、`package.json` にバージョンを固定する（`^` や `~` を付けない）
- 既存のテストを消したり、通すためだけに書き換えたりしない
- 「案」の数値は `src/config.ts` にだけ置く

## 作らないもの（頼まれても実装前に確認する）

- 記録の一覧（FR-P06）、訂正・取り消しの画面（FR-P07）
- 未登録事業者への警告（段階3）
- 新規登録、パスワード再設定、複数アカウント、権限管理
- 事業者自身のウォレット接続（MetaMaskなど）
- 証明書や整備記録の表示画面（Webフロントの担当）
- スマホ向けの作り込み、多言語対応

## 絶対に守ること

- ハッシュ計算、ソルト生成、署名、チェーンへの送信はこのサイトで行わない。すべてGoの仕事
- 秘密鍵をコード、環境変数、ログのどこにも置かない
- ブラウザから直接Goを呼ばない。Next.jsのサーバー側（Route Handler／Server Action）経由にする（BFF構成）。Goを呼ぶのは `src/lib/go-client/` だけ
- 認証トークンはhttpOnly Cookieに入れ、JavaScriptから読める場所（localStorageなど）に置かない
- 整備記録の入力内容をログに出さない（個人情報が混ざる可能性があるため）
- 日時は必ずUTCの `Z` 付きISO 8601（例 `2026-11-10T05:30:00Z`）でGoに送る。変換は `src/lib/time.ts` の関数だけで行う。ハッシュの一致に関わる

## コマンド

```bash
npm run dev        # 開発サーバー（http://localhost:3000）
npm run lint       # ESLint
npm run typecheck  # 型チェック
npm run test       # 単体テスト（Vitest）
npm run e2e        # E2Eテスト（Playwright。本番ビルドをモックで起動する）
```

## 環境変数

`.env.example` を正とする。値は `.env.local` に入れ、リポジトリには入れない。

| 名前 | 用途 |
| --- | --- |
| `GO_API_BASE_URL` | GoバックエンドのURL（サーバー側でだけ使う。`NEXT_PUBLIC_` を付けない） |
| `USE_API_MOCK` | `true` ならGoの代わりにモック（`src/lib/go-client/mock.ts`）を使う |
| `SESSION_COOKIE_NAME` | ログインCookieの名前（既定 `partner_session`） |
| `POLL_INTERVAL_MS` / `POLL_TIMEOUT_MS` | 状態の問い合わせ間隔と上限。E2Eでだけ短くする |

デモアカウントのIDとパスワードはGo側で持つ。このサイトの環境変数には入れない（モックだけは `demo-repair` / `demo-password` を持つ）。

## モック

- `USE_API_MOCK=true` のときだけ有効。画面右上に「モック接続」と出る
- cookie `mock_scenario` で振る舞いを変えられる（E2Eで使う）：`device_missing`、`submit_error`、`status_slow`、`status_failed`、`status_stuck`
