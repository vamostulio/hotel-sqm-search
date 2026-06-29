/**
 * server.js — 広さで選ぶホテル検索 バックエンドAPI
 * 楽天API 2026年2月移行対応版
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
const FRONTEND_ORIGIN      = process.env.FRONTEND_ORIGIN      || 'https://hotel-sqm-search-1.onrender.com';

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(rateLimit({
  windowMs: 60_000, max: 30,
  message: { error: 'リクエスト数が上限を超えました。1分後にお試しください。' }
}));

// ── 都道府県コード（楽天API用・英語名） ──────────────────────────
const PREF_MAP = {
  '北海道': 'hokkaido', '青森': 'aomori',   '岩手': 'iwate',     '宮城': 'miyagi',
  '秋田':   'akita',    '山形': 'yamagata', '福島': 'fukushima', '茨城': 'ibaraki',
  '栃木':   'tochigi',  '群馬': 'gunma',    '埼玉': 'saitama',   '千葉': 'chiba',
  '東京':   'tokyo',    '神奈川':'kanagawa', '新潟': 'niigata',   '富山': 'toyama',
  '石川':   'ishikawa', '福井': 'fukui',    '山梨': 'yamanashi', '長野': 'nagano',
  '岐阜':   'gifu',     '静岡': 'shizuoka', '愛知': 'aichi',     '三重': 'mie',
  '滋賀':   'shiga',    '京都': 'kyoto',    '大阪': 'osaka',     '兵庫': 'hyogo',
  '奈良':   'nara',     '和歌山':'wakayama', '鳥取': 'tottori',   '島根': 'shimane',
  '岡山':   'okayama',  '広島': 'hiroshima','山口': 'yamaguchi', '徳島': 'tokushima',
  '香川':   'kagawa',   '愛媛': 'ehime',    '高知': 'kochi',     '福岡': 'fukuoka',
  '佐賀':   'saga',     '長崎': 'nagasaki', '熊本': 'kumamoto',  '大分': 'oita',
  '宮崎':   'miyazaki', '鹿児島':'kagoshima','沖縄': 'okinawa',
};

function getPrefCode(areaName) {
  for (const [key, code] of Object.entries(PREF_MAP)) {
    if (areaName.includes(key)) return code;
  }
  return 'tokyo'; // デフォルト: 東京
}

// ── 楽天API呼び出し（2026年移行対応版） ──────────────────────────
async function callRakutenTravel(endpoint, params) {
  const url = `https://openapi.rakuten.co.jp/engine/api/Travel/${endpoint}`;
  const res = await axios.get(url, {
    params: {
      applicationId: RAKUTEN_APP_ID,
      accessKey:     RAKUTEN_ACCESS_KEY,
      format:        'json',
      formatVersion: 2,
      ...params,
    },
    headers: {
      'Referer': FRONTEND_ORIGIN,
      'Origin':  FRONTEND_ORIGIN,
    },
    timeout: 10_000,
  });
  return res.data;
}

// ── アフィリエイトURL生成 ────────────────────────────────────────
function buildReserveUrl(hotelNo, planId, checkin, checkout, guests) {
  const base   = `https://travel.rakuten.co.jp/HOTEL/${hotelNo}/plan.html`;
  const params = new URLSearchParams({
    f_no:       hotelNo,
    f_planid:   planId,
    f_hi1:      checkin,
    f_hi2:      checkout,
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
    const roomInfoArr   = hotelArr[1]?.roomInfo         || [];

    for (const roomWrapper of roomInfoArr) {
      const roomBasicInfo = roomInfoArr[0]?.roomBasicInfo  || {};
      const dailyCharge   = roomInfoArr[1]?.dailyCharge    || {};

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
    return res.status(500).json({ error: 'RAKUTEN_APP_ID または RAKUTEN_ACCESS_KEY が未設定です。' });
  }

  const { area = '東京', checkin, checkout, guests = '2', minSqm = '20', page = '1', hits = '30', sort = '-sqm' } = req.query;

  if (!checkin || !checkout) return res.status(400).json({ error: 'checkin と checkout は必須です' });
  if (new Date(checkin) >= new Date(checkout)) return res.status(400).json({ error: 'checkout は checkin より後の日付を指定してください' });

  const guestsNum = Math.min(Math.max(parseInt(guests) || 2, 1), 9);
  const minSqmNum = Math.max(parseFloat(minSqm) || 20, 0);
  const prefCode  = getPrefCode(area);

  try {
    const apiData = await callRakutenTravel('VacantHotelSearch/20170426', {
      latitude:     35.6812,
      longitude:    139.7671,
      searchRadius: 3,
      datumType:    1,
      checkinDate:     checkin,
      checkoutDate:    checkout,
      adultNum:        guestsNum,
      hits:            Math.min(parseInt(hits) || 30, 30),
      page:            parseInt(page) || 1,
    });

    if (apiData.error) {
      return res.status(502).json({ error: `楽天APIエラー: ${apiData.error}`, description: apiData.error_description });
    }

  console.log('RAW API:', JSON.stringify(apiData.hotels?.[0]));
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
    status:       'ok',
    hasApiKey:    !!RAKUTEN_APP_ID,
    hasAccessKey: !!RAKUTEN_ACCESS_KEY,
    hasAffId:     !!RAKUTEN_AFFILIATE_ID,
    timestamp:    new Date().toISOString(),
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
