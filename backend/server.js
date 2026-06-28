/**
 * server.js — 広さで選ぶホテル検索 バックエンドAPI
 * 楽天API 2026年2月移行対応版
 *
 * 変更点:
 *   - エンドポイント: app.rakuten.co.jp → openapi.rakuten.co.jp
 *   - 認証: applicationId + accessKey の両方が必須
 *   - Refererヘッダーを付与
 */

'use strict';

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const axios     = require('axios');
const rateLimit = require('express-rate-limit');
const { extractSqmFromRakutenResponse } = require('./sqmExtractor');

const app  = express();
const PORT = process.env.PORT || 3001;

const RAKUTEN_APP_ID       = process.env.RAKUTEN_APP_ID       || '';
const RAKUTEN_ACCESS_KEY   = process.env.RAKUTEN_ACCESS_KEY   || '';
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID || '';
const FRONTEND_ORIGIN      = process.env.FRONTEND_ORIGIN      || '*';

// ── ミドルウェア ─────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(rateLimit({
  windowMs: 60_000, max: 30,
  message: { error: 'リクエスト数が上限を超えました。1分後にお試しください。' }
}));

// ── 楽天トラベル 都道府県コード対応表 ──────────────────────────────
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

// ── 楽天API呼び出し（2026年移行対応版） ──────────────────────────
async function callRakutenTravel(endpoint, params) {
  // 新ドメイン: openapi.rakuten.co.jp
  const url = `https://openapi.rakuten.co.jp/engine/api/Travel/${endpoint}`;

  const res = await axios.get(url, {
    params: {
      applicationId: RAKUTEN_APP_ID,
      accessKey:     RAKUTEN_ACCESS_KEY,  // 2026年移行で必須追加
      format:        'json',
      formatVersion: 2,
      ...params,
    },
    headers: {
      // 2026年移行でReferer/Originヘッダーが必須
      'Referer': FRONTEND_ORIGIN === '*' ? 'https://hotel-sqm-search-1.onrender.com' : FRONTEND_ORIGIN,
      'Origin':  FRONTEND_ORIGIN === '*' ? 'https://hotel-sqm-search-1.onrender.com' : FRONTEND_ORIGIN,
    },
    timeout: 10_000,
  });
  return res.data;
}

// ── アフィリエイトURL生成 ────────────────────────────────────────
function buildReserveUrl(hotelNo, planId, checkin, checkout, guests) {
  const base   = `https://travel.rakuten.co.jp/HOTEL/${hotelNo}/plan.html`;
  const params = new URLSearchParams({
    f_no:      hotelNo,
    f_planid:  planId,
    f_hi1:     checkin.replace(/-/g, ''),
    f_hi2:     checkout.replace(/-/g, ''),
    f_adult_su: guests,
  });
  if (RAKUTEN_AFFILIATE_ID) {
    return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFILIATE_ID}/?pc=${encodeURIComponent(`${base}?${params}`)}`;
  }
  return `${base}?${params}`;
}

// ── 楽天APIレスポンスのパース ────────────────────────────────────
function parseRakutenResponse(apiData, { minSqm, guests, checkin, checkout }) {
  const results = [];
  const hotels  = apiData.hotels || [];

  for (const hotelWrapper of hotels) {
    const hotelArr       = hotelWrapper.hotel || [];
    const hotelBasicInfo = hotelArr[0]?.hotelBasicInfo || {};
    const roomInfoArr    = hotelArr[1]?.roomInfo       || [];

    for (const roomWrapper of roomInfoArr) {
      const roomBasicInfo = roomWrapper.roomBasicInfo || {};
      const dailyCharges  = roomWrapper.dailyCharge   || [];

      for (const charge of dailyCharges) {
        const sqm = extractSqmFromRakutenResponse(
          { planName: charge.planName, planContents: charge.planContents },
          { roomName: roomBasicInfo.roomName, roomContents: roomBasicInfo.roomContents },
          { hotelSpecial: hotelBasicInfo.hotelSpecial }
        );

        if (sqm === null || sqm < minSqm) continue;

        const price = charge.total ?? charge.rakutenCharge ?? 0;

        results.push({
          hotelNo:        hotelBasicInfo.hotelNo,
          hotelName:      hotelBasicInfo.hotelName,
          address:        `${hotelBasicInfo.address1 || ''}${hotelBasicInfo.address2 || ''}`,
          nearestStation: hotelBasicInfo.nearestStation,
          hotelImageUrl:  hotelBasicInfo.hotelImageUrl,
          reviewAverage:  hotelBasicInfo.reviewAverage,
          reviewCount:    hotelBasicInfo.reviewCount,
          planId:         charge.planId,
          planName:       charge.planName,
          roomName:       roomBasicInfo.roomName,
          mealType:       charge.mealFlag,
          price,
          pricePerPerson: Math.round(price / guests),
          sqm,
          perPersonSqm:   parseFloat((sqm / guests).toFixed(1)),
          reserveUrl:     buildReserveUrl(hotelBasicInfo.hotelNo, charge.planId, checkin, checkout, guests),
        });
      }
    }
  }
  return results;
}

// ══════════════════════════════════════════════════════════════════
//  APIエンドポイント
// ══════════════════════════════════════════════════════════════════

app.get('/api/search', async (req, res) => {
  if (!RAKUTEN_APP_ID || !RAKUTEN_ACCESS_KEY) {
    return res.status(500).json({
      error: 'RAKUTEN_APP_ID または RAKUTEN_ACCESS_KEY が設定されていません。',
    });
  }

  const { area = '東京', checkin, checkout, guests = '2', minSqm = '20', page = '1', hits = '30', sort = '-sqm' } = req.query;

  if (!checkin || !checkout) return res.status(400).json({ error: 'checkin と checkout は必須です' });
  if (new Date(checkin) >= new Date(checkout)) return res.status(400).json({ error: 'checkout は checkin より後の日付を指定してください' });

  const guestsNum = Math.min(Math.max(parseInt(guests) || 2, 1), 9);
  const minSqmNum = Math.max(parseFloat(minSqm) || 20, 0);
  const prefCode  = getPrefCode(area);

  try {
    const apiData = await callRakutenTravel('VacantHotelSearch/20170426', {
      middleClassCode: 'japan',
      smallClassCode:  prefCode,
      checkinDate:     checkin.replace(/-/g, ''),
      checkoutDate:    checkout.replace(/-/g, ''),
      adultNum:        guestsNum,
      hits:            Math.min(parseInt(hits) || 30, 30),
      page:            parseInt(page) || 1,
    });

    if (apiData.error) {
      return res.status(502).json({ error: `楽天APIエラー: ${apiData.error}`, description: apiData.error_description });
    }

    let results = parseRakutenResponse(apiData, { minSqm: minSqmNum, guests: guestsNum, checkin, checkout });

    const sortFn = {
      '-sqm':    (a, b) => b.sqm - a.sqm,
      '+sqm':    (a, b) => a.sqm - b.sqm,
      '-price':  (a, b) => a.price - b.price,
      '+review': (a, b) => (b.reviewAverage || 0) - (a.reviewAverage || 0),
    }[sort] || ((a, b) => b.sqm - a.sqm);
    results.sort(sortFn);

    res.json({ ok: true, total: results.length, minSqm: minSqmNum, area, checkin, checkout, guests: guestsNum, results });

  } catch (err) {
    if (err.response?.data) return res.status(502).json({ error: '楽天APIエラー', detail: err.response.data });
    console.error('[/api/search] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/areas', (_req, res) => {
  res.json(Object.keys(PREF_MAP).map(name => ({ name, code: PREF_MAP[name] })));
});

app.get('/health', (_req, res) => {
  res.json({
    status:        'ok',
    hasApiKey:     !!RAKUTEN_APP_ID,
    hasAccessKey:  !!RAKUTEN_ACCESS_KEY,
    hasAffId:      !!RAKUTEN_AFFILIATE_ID,
    timestamp:     new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`\n🏨 広さで選ぶホテル検索 — バックエンドAPI（2026年移行対応版）`);
  console.log(`   URL          : http://localhost:${PORT}`);
  console.log(`   楽天APIキー  : ${RAKUTEN_APP_ID    ? '✅ 設定済み' : '❌ 未設定'}`);
  console.log(`   アクセスキー : ${RAKUTEN_ACCESS_KEY ? '✅ 設定済み' : '❌ 未設定'}`);
  console.log(`   アフィリID   : ${RAKUTEN_AFFILIATE_ID ? '✅ 設定済み' : '⚠️  未設定（省略可）'}`);
});

module.exports = app;