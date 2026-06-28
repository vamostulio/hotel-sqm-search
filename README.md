# 広さで選ぶホテル検索 MVP

客室の広さ（㎡）を第一条件に宿泊先を検索・比較できるWebアプリのMVP実装です。

---

## 構成

```
hotel-sqm-search/
├── README.md
├── backend/
│   ├── package.json        # 依存パッケージ定義
│   ├── .env.example        # 環境変数テンプレート
│   ├── server.js           # Express APIサーバー（楽天API連携）
│   └── sqmExtractor.js     # 平米数抽出ロジック（コアモジュール）
└── frontend/
    └── index.html          # スタンドアロン版フロントエンド
```

---

## セットアップ手順

### 1. 楽天APIキーの取得

1. https://webservice.rakuten.co.jp/ にアクセス
2. 「アプリ登録」→「アプリIDを取得」
3. 「楽天トラベル/空室検索API」の利用申請

アフィリエイトIDは任意ですが、設定すると予約リンクから収益が発生します。
- https://affiliate.rakuten.co.jp/

### 2. バックエンドのセットアップ

```bash
cd backend

# 依存パッケージをインストール
npm install

# 環境変数ファイルを作成
cp .env.example .env
```

`.env` を編集してAPIキーを設定：

```env
RAKUTEN_APP_ID=xxxxxxxxxxxxxxxxxxxxxx
RAKUTEN_AFFILIATE_ID=xxxxxxxx.xxxxxxxx   # 任意
PORT=3001
FRONTEND_ORIGIN=http://localhost:3000
```

### 3. バックエンド起動

```bash
# 本番
npm start

# 開発（ファイル変更を自動検知）
npm run dev
```

起動すると以下のように表示されます：

```
🏨 広さで選ぶホテル検索 — バックエンドAPI
   URL        : http://localhost:3001
   楽天APIキー: ✅ 設定済み
   アフィリID : ✅ 設定済み
```

### 4. フロントエンドを開く

```bash
# frontend/index.html をブラウザで直接開く
open frontend/index.html

# または http-serverで配信
npx http-server frontend -p 3000
```

---

## APIリファレンス

### GET /api/search — 空室検索

```
GET http://localhost:3001/api/search
```

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 | デフォルト |
|---|---|---|---|---|
| area | string | ✅ | 都道府県名（例: 東京、大阪） | 東京 |
| checkin | string | ✅ | チェックイン日 YYYY-MM-DD | — |
| checkout | string | ✅ | チェックアウト日 YYYY-MM-DD | — |
| guests | number | | 宿泊人数（1〜9） | 2 |
| minSqm | number | | 最小客室面積（㎡） | 20 |
| sort | string | | ソート順（下記参照） | -sqm |
| hits | number | | 取得件数（最大30） | 30 |
| page | number | | ページ番号 | 1 |

**sort の値**

| 値 | 意味 |
|---|---|
| `-sqm` | 広い順（デフォルト） |
| `+sqm` | 狭い順 |
| `-price` | 料金が安い順 |
| `+review` | 評価が高い順 |

**レスポンス例**

```json
{
  "ok": true,
  "total": 5,
  "minSqm": 30,
  "area": "東京",
  "checkin": "2025-08-01",
  "checkout": "2025-08-02",
  "guests": 2,
  "results": [
    {
      "hotelNo": "134829",
      "hotelName": "〇〇ホテル東京",
      "address": "東京都千代田区...",
      "reviewAverage": 4.5,
      "reviewCount": 210,
      "planId": "9876543",
      "planName": "スーペリアダブル 38㎡ 朝食付き",
      "mealType": "1",
      "price": 25000,
      "pricePerPerson": 12500,
      "sqm": 38,
      "perPersonSqm": 19.0,
      "reserveUrl": "https://travel.rakuten.co.jp/HOTEL/..."
    }
  ]
}
```

### GET /api/areas — エリア一覧

```
GET http://localhost:3001/api/areas
```

### GET /health — ヘルスチェック

```
GET http://localhost:3001/health
```

---

## 平米数抽出ロジック（sqmExtractor.js）

客室テキストから以下のパターンを自動認識します：

| パターン例 | 認識 |
|---|---|
| `スーペリアダブル 35㎡ 禁煙` | 35 |
| `デラックスツイン（52平米）` | 52 |
| `広さ約38平方メートル` | 38 |
| `スイート 110m²` | 110 |
| `24sqm` / `65 sq.m` | 24 / 65 |
| `客室面積：45㎡以上確約` | 45 |
| `35〜40㎡のお部屋` | 35（小さい方を採用） |
| `朝食付きプラン` | null（平米記載なし） |

テスト実行：

```bash
cd backend
node sqmExtractor.js
```

---

## 今後の拡張案

- [ ] 地図表示（Google Maps API連携）
- [ ] お気に入り保存（localStorage）
- [ ] 複数エリア横断検索
- [ ] 「1人あたり◯㎡以上」での検索モード
- [ ] Next.js + Tailwind CSSへの移行
- [ ] ホテル画像の表示（楽天APIの画像URLを使用）
- [ ] 料金カレンダー表示（日付別最安値）
