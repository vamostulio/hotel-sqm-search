/**
 * server.js — 広さで選ぶホテル検索 バックエンドAPI
 *
 * 起動:
 *   cp .env.example .env   # APIキーを記入
 *   npm install
 *   npm start              # 本番
 *   npm run dev            # 開発（nodemon）
 */

'use strict';

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const axios      = require('axios');
const rateLimit  = require('express-rate-limit');
const { extractSqmFromRakutenResponse } = require('./sqmExtractor');

const app  = express();
const PORT = process.env.PORT || 3001;

const RAKUTEN_APP_ID       = process.env.RAKUTEN_APP_ID       || '';
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID || '';
const FRONTEND_ORIGIN      = process.env.FRONTEND_ORIGIN      || 'http://localhost:3000';

// ── ミドルウェア ─────────────────────────────────────────────────
app.use(cors({ origin: [FRONTEND_ORIGIN, 'null', /^file:\/\//] }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 30, message: { error: 'リクエスト数が上限を超えました。1分後にお試しください。' } }));

// ── 楽天トラベル 都道府県コード対応表 ──────────────────────────────
// https://webservice.rakuten.co.jp/documentation/prefecture-code
const PREF_MAP = {
  '北海道': '010000', '青森': '020000', '岩手': '030000', '宮城': '040000',
  '秋田': '050000', '山形': '060000', '福島': '070000', '茨城': '080000',
  '栃木': '090000', '群馬': '100000', '埼玉': '110000', '千葉': '120000',
  '東京': '130000', '神奈川': '140000', '新潟': '150000', '富山': '160000',
  '石川': '170000', '福井': '180000', '山梨': '190000', '長野': '200000',
  '岐阜': '210000', '静岡': '220000', '愛知': '230000', '三重': '240000',
  '滋賀': '250000', '京都': '260000', '大阪': '270000', '兵庫': '280000',
  '奈良': '290000', '和歌山': '300000', '鳥取': '310000', '島根': '320000',
  '岡山': '330000', '広島': '340000', '山口': '350000', '徳島': '360000',
  '香川': '370000', '愛媛': '380000', '高知': '390000', '福岡': '400000',
  '佐賀': '410000', '長崎': '420000', '熊本': '430000', '大分': '440000',
  '宮崎': '450000', '鹿児島': '460000', '沖縄': '470000',
};

function getPrefCode(areaName) {
  for (const [key, code] of Object.entries(PREF_MAP)) {
    if (areaName.includes(key)) return code;
  }
  return '130000'; // デフォルト: 東京
}

// ── 楽天API呼び出し共通関数 ─────────────────────────────────────
async function callRakutenTravel(endpoint, params) {
  const url = `https://app.rakuten.co.jp/services/api/Travel/${endpoint}`;
  const res = await axios.get(url, {
    params: { applicationId: RAKUTEN_APP_ID, format: 'json', formatVersion: 2, ...params },
    timeout: 10_000,
  });
  return res.data;
}

// ── アフィリエイトURL生成 ────────────────────────────────────────
function buildReserveUrl(hotelNo, planId, checkin, checkout, guests) {
  const base = `https://travel.rakuten.co.jp/HOTEL/${hotelNo}/plan.html`;
  const params = new URLSearchParams({
    f_no: hotelNo,
    f_planid: planId,
    f_hi1: checkin.replace(/-/g, ''),
    f_hi2: checkout.replace(/-/g, ''),
    f_adult_su: guests,
  });

  if (RAKUTEN_AFFILIATE_ID) {
    // アフィリエイトリンク形式
    return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFILIATE_ID}/?pc=${encodeURIComponent(`${base}?${params}`)}`;
  }
  return `${base}?${params}`;
}

// ── 楽天APIレスポンスのパース ────────────────────────────────────
/**
 * 楽天 VacantHotelSearch レスポンスを
 * フロントエンド用の統一フォーマットに変換する
 *
 * 実際のレスポンス構造:
 * {
 *   hotels: [
 *     {
 *       hotel: [
 *         { hotelBasicInfo: { hotelNo, hotelName, address1, address2, ... } },
 *         { roomInfo: [
 *             {
 *               roomBasicInfo: { roomName, ... },
 *               dailyCharge: [
 *                 { stayDate, rakutenCharge, total, chargeFlag,
 *                   planId, planName, planContents, ... }
 *               ]
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
function parseRakutenResponse(apiData, { minSqm, guests, checkin, checkout }) {
  const results = [];
  const hotels  = apiData.hotels || [];

  for (const hotelWrapper of hotels) {
    const hotelArr = hotelWrapper.hotel || [];

    // hotel[0] = hotelBasicInfo, hotel[1] = roomInfo配列
    const hotelBasicInfo = hotelArr[0]?.hotelBasicInfo || {};
    const roomInfoArr    = hotelArr[1]?.roomInfo       || [];

    for (const roomWrapper of roomInfoArr) {
      const roomBasicInfo = roomWrapper.roomBasicInfo || {};
      const dailyCharges  = roomWrapper.dailyCharge   || [];

      // プランごとに処理
      for (const charge of dailyCharges) {
        // 平米数抽出（プラン名 → プラン内容 → 客室名 → ホテル特徴の優先順）
        const sqm = extractSqmFromRakutenResponse(
          {
            planName:     charge.planName,
            planContents: charge.planContents,
          },
          {
            roomName:     roomBasicInfo.roomName,
            roomContents: roomBasicInfo.roomContents,
            note:         roomBasicInfo.note,
          },
          {
            hotelSpecial: hotelBasicInfo.hotelSpecial,
            access:       hotelBasicInfo.access,
          }
        );

        // 平米数不明 or 指定未満はスキップ
        if (sqm === null || sqm < minSqm) continue;

        const price = charge.total ?? charge.rakutenCharge ?? 0;

        results.push({
          // ホテル情報
          hotelNo:        hotelBasicInfo.hotelNo,
          hotelName:      hotelBasicInfo.hotelName,
          hotelKanaName:  hotelBasicInfo.hotelKanaName,
          address:        `${hotelBasicInfo.address1 || ''}${hotelBasicInfo.address2 || ''}`,
          access:         hotelBasicInfo.access,
          nearestStation: hotelBasicInfo.nearestStation,
          hotelImageUrl:  hotelBasicInfo.hotelImageUrl,
          reviewAverage:  hotelBasicInfo.reviewAverage,
          reviewCount:    hotelBasicInfo.reviewCount,
          hotelInfoUrl:   hotelBasicInfo.hotelInformationUrl,

          // プラン情報
          planId:         charge.planId,
          planName:       charge.planName,
          planContents:   charge.planContents,
          roomName:       roomBasicInfo.roomName,
          mealType:       charge.mealFlag, // 0:素泊 1:朝食 2:朝夕食 3:夕食 4:その他

          // 料金
          price,
          pricePerPerson: Math.round(price / guests),

          // 広さ
          sqm,
          perPersonSqm: parseFloat((sqm / guests).toFixed(1)),

          // 予約URL（アフィリエイト対応）
          reserveUrl: buildReserveUrl(
            hotelBasicInfo.hotelNo,
            charge.planId,
            checkin, checkout, guests
          ),
        });
      }
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════
//  APIエンドポイント
// ══════════════════════════════════════════════════════════════════

/**
 * GET /api/search
 * 空室検索 + 平米フィルタリング
 *
 * クエリパラメータ:
 *   area     {string}  エリア名（都道府県名を含む文字列）必須
 *   checkin  {string}  YYYY-MM-DD  必須
 *   checkout {string}  YYYY-MM-DD  必須
 *   guests   {number}  人数（1〜9）デフォルト: 2
 *   minSqm   {number}  最小客室面積㎡ デフォルト: 20
 *   page     {number}  ページ番号 デフォルト: 1
 *   hits     {number}  1ページの取得件数（最大30）デフォルト: 30
 *   sort     {string}  '-price'=料金安順 '+price'=高順 '-sqm'=広い順 デフォルト: -sqm
 */
app.get('/api/search', async (req, res) => {
  // APIキーチェック
  if (!RAKUTEN_APP_ID) {
    return res.status(500).json({
      error: 'RAKUTEN_APP_ID が設定されていません。.env ファイルを確認してください。',
      setup: 'https://webservice.rakuten.co.jp/',
    });
  }

  const {
    area    = '東京',
    checkin,
    checkout,
    guests  = '2',
    minSqm  = '20',
    page    = '1',
    hits    = '30',
    sort    = '-sqm',
  } = req.query;

  // バリデーション
  if (!checkin || !checkout) {
    return res.status(400).json({ error: 'checkin と checkout は必須です（YYYY-MM-DD形式）' });
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(checkin) || !dateRe.test(checkout)) {
    return res.status(400).json({ error: '日付形式が不正です（YYYY-MM-DD）' });
  }
  if (new Date(checkin) >= new Date(checkout)) {
    return res.status(400).json({ error: 'checkout は checkin より後の日付を指定してください' });
  }

  const guestsNum = Math.min(Math.max(parseInt(guests) || 2, 1), 9);
  const minSqmNum = Math.max(parseFloat(minSqm) || 20, 0);
  const prefCode  = getPrefCode(area);

  try {
    // 楽天トラベル VacantHotelSearch API 呼び出し
    // 公式ドキュメント: https://webservice.rakuten.co.jp/documentation/vacant-hotel-search
    const apiData = await callRakutenTravel('VacantHotelSearch/20170426', {
      middleClassCode: 'japan',
      smallClassCode:  prefCode,
      checkinDate:     checkin.replace(/-/g, ''),
      checkoutDate:    checkout.replace(/-/g, ''),
      adultNum:        guestsNum,
      hits:            Math.min(parseInt(hits) || 30, 30),
      page:            parseInt(page) || 1,
      searchField:     0,      // 0: 全フィールド検索
    });

    if (apiData.error) {
      return res.status(502).json({
        error: `楽天トラベルAPIエラー: ${apiData.error}`,
        description: apiData.error_description,
      });
    }

    // レスポンスをパースして平米フィルタ
    let results = parseRakutenResponse(apiData, {
      minSqm:   minSqmNum,
      guests:   guestsNum,
      checkin,
      checkout,
    });

    // ソート
    const sortFn = {
      '-sqm':    (a, b) => b.sqm - a.sqm,
      '+sqm':    (a, b) => a.sqm - b.sqm,
      '-price':  (a, b) => a.price - b.price,  // 安い順
      '+price':  (a, b) => b.price - a.price,  // 高い順
      '-review': (a, b) => (b.reviewAverage || 0) - (a.reviewAverage || 0),
    }[sort] || ((a, b) => b.sqm - a.sqm);
    results.sort(sortFn);

    res.json({
      ok:       true,
      total:    results.length,
      page:     parseInt(page) || 1,
      minSqm:   minSqmNum,
      area,
      prefCode,
      checkin,
      checkout,
      guests:   guestsNum,
      results,
    });

  } catch (err) {
    // axios エラーの場合は楽天API側のメッセージを返す
    if (err.response?.data) {
      return res.status(502).json({
        error: '楽天トラベルAPIエラー',
        detail: err.response.data,
      });
    }
    console.error('[/api/search] error:', err.message);
    res.status(500).json({ error: `サーバーエラー: ${err.message}` });
  }
});

/**
 * GET /api/areas
 * 対応エリア一覧を返す（フロントのサジェスト用）
 */
app.get('/api/areas', (_req, res) => {
  res.json(Object.keys(PREF_MAP).map(name => ({ name, code: PREF_MAP[name] })));
});

/**
 * GET /health
 * ヘルスチェック
 */
app.get('/health', (_req, res) => {
  res.json({
    status:      'ok',
    hasApiKey:   !!RAKUTEN_APP_ID,
    hasAffId:    !!RAKUTEN_AFFILIATE_ID,
    timestamp:   new Date().toISOString(),
  });
});

// ── 起動 ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏨 広さで選ぶホテル検索 — バックエンドAPI`);
  console.log(`   URL        : http://localhost:${PORT}`);
  console.log(`   楽天APIキー: ${RAKUTEN_APP_ID  ? '✅ 設定済み' : '❌ 未設定（.env に RAKUTEN_APP_ID を設定）'}`);
  console.log(`   アフィリID : ${RAKUTEN_AFFILIATE_ID ? '✅ 設定済み' : '⚠️  未設定（省略可）'}`);
  console.log(`\n📡 エンドポイント:`);
  console.log(`   GET /api/search?area=東京&checkin=2025-01-01&checkout=2025-01-02&guests=2&minSqm=30`);
  console.log(`   GET /api/areas`);
  console.log(`   GET /health\n`);
});

module.exports = app;
