# SmaPass 事業者向けサイト

修理業者・メーカー・中古店が、端末の整備記録（修理箇所、使用パーツ、点検結果など）を書き込むサイトです。記録はGoバックエンドが署名し、Ethereum Sepoliaにハッシュを記録します。

- 要件：[docs/requirements.md](docs/requirements.md)
- 構成：[docs/architecture.md](docs/architecture.md)
- 作業の進め方（AI向けのルールを含む）：[CLAUDE.md](CLAUDE.md)

## 動かし方

Node.js 22以上が必要です。

```bash
npm ci
cp .env.example .env.local   # 最初はモック（USE_API_MOCK=true）で動きます
npm run dev
```

http://localhost:3000 を開き、モックのデモアカウント `demo-repair` / `demo-password` でログインします。

Goにつなぐときは、`.env.local` を `USE_API_MOCK=false` にして `GO_API_BASE_URL` を設定します。

## テスト

```bash
npm run lint       # ESLint
npm run typecheck  # 型チェック
npm run test       # 単体テスト（Vitest）
npm run e2e        # E2Eテスト（Playwright。本番ビルドをモックで起動して確かめる）
```

E2Eを初めて動かすときは、先に `npx playwright install chromium` を実行してください。

## 進み具合

段階1（T-01〜T-06）をモックで実装済みです。Goの実APIとの結合（T-07）は、Go側の実装を待っています。詳しくは [docs/tasks.md](docs/tasks.md) を見てください。
