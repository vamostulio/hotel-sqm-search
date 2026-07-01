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
// 都道府県ごとの middleClassCode + smallClassCode + detailClassCode の対応表
const PREF_MAP = {
  '北海道': { middle: 'hokkaido',   small: 'sapporo',    detail: 'A' },
  '青森':   { middle: 'aomori',     small: 'aomori',     detail: 'A' },
  '岩手':   { middle: 'iwate',      small: 'morioka',    detail: 'A' },
  '宮城':   { middle: 'miyagi',     small: 'sendai',     detail: 'A' },
  '秋田':   { middle: 'akita',      small: 'akita',      detail: 'A' },
  '山形':   { middle: 'yamagata',   small: 'yamagata',   detail: 'A' },
  '福島':   { middle: 'fukushima',  small: 'koriyama',   detail: 'A' },
  '茨城':   { middle: 'ibaraki',    small: 'mito',       detail: 'A' },
  '栃木':   { middle: 'tochigi',    small: 'utsunomiya', detail: 'A' },
  '群馬':   { middle: 'gunma',      small: 'maebashi',   detail: 'A' },
  '埼玉':   { middle: 'saitama',    small: 'saitama',    detail: 'A' },
  '千葉':   { middle: 'chiba',      small: 'chiba',      detail: 'A' },
  '東京':   { middle: 'tokyo',      small: 'tokyo',      detail: 'A' },
  '神奈川': { middle: 'kanagawa',   small: 'yokohama',   detail: 'A' },
  '新潟':   { middle: 'niigata',    small: 'niigata',    detail: 'A' },
  '富山':   { middle: 'toyama',     small: 'toyama',     detail: 'A' },
  '石川':   { middle: 'ishikawa',   small: 'kanazawa',   detail: 'A' },
  '福井':   { middle: 'fukui',      small: 'fukui',      detail: 'A' },
  '山梨':   { middle: 'yamanashi',  small: 'kofu',       detail: 'A' },
  '長野':   { middle: 'nagano',     small: 'nagano',     detail: 'A' },
  '岐阜':   { middle: 'gifu',       small: 'gifu',       detail: 'A' },
  '静岡':   { middle: 'shizuoka',   small: 'shizuoka',   detail: 'A' },
  '愛知':   { middle: 'aichi',      small: 'nagoya',     detail: 'A' },
  '三重':   { middle: 'mie',        small: 'tsu',        detail: 'A' },
  '滋賀':   { middle: 'shiga',      small: 'otsu',       detail: 'A' },
  '京都':   { middle: 'kyoto',      small: 'shi',        detail: 'A' },
  '大阪':   { middle: 'osaka',      small: 'osaka',      detail: 'A' },
  '兵庫':   { middle: 'hyogo',      small: 'kobe',       detail: 'A' },
  '奈良':   { middle: 'nara',       small: 'nara',       detail: 'A' },
  '和歌山': { middle: 'wakayama',   small: 'wakayama',   detail: 'A' },
  '鳥取':   { middle: 'tottori',    small: 'tottori',    detail: 'A' },
  '島根':   { middle: 'shimane',    small: 'matsue',     detail: 'A' },
  '岡山':   { middle: 'okayama',    small: 'okayama',    detail: 'A' },
  '広島':   { middle: 'hiroshima',  small: 'hiroshima',  detail: 'A' },
  '山口':   { middle: 'yamaguchi',  small: 'yamaguchi',  detail: 'A' },
  '徳島':   { middle: 'tokushima',  small: 'tokushima',  detail: 'A' },
  '香川':   { middle: 'kagawa',     small: 'takamatsu',  detail: 'A' },
  '愛媛':   { middle: 'ehime',      small: 'matsuyama',  detail: 'A' },
  '高知':   { middle: 'kochi',      small: 'kochi',      detail: 'A' },
  '福岡':   { middle: 'fukuoka',    small: 'fukuoka',    detail: 'A' },
  '佐賀':   { middle: 'saga',       small: 'saga',       detail: 'A' },
  '長崎':   { middle: 'nagasaki',   small: 'nagasaki',   detail: 'A' },
  '熊本':   { middle: 'kumamoto',   small: 'kumamoto',   detail: 'A' },
  '大分':   { middle: 'oita',       small: 'oita',       detail: 'A' },
  '宮崎':   { middle: 'miyazaki',   small: 'miyazaki',   detail: 'A' },
  '鹿児島': { middle: 'kagoshima',  small: 'kagoshima',  detail: 'A' },
  '沖縄':   { middle: 'okinawa',    small: 'nahashi',    detail: 'A' },
};

function getPrefCode(areaName) {
  for (const [key, val] of Object.entries(PREF_MAP)) {
    if (areaName.includes(key)) return val;
  }
  return { middle: 'tokyo', small: 'tokyo', detail: 'A' };
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
    f_hi1:      checkin.replace(/-/g, ''),
    f_hi2:      checkout.replace(/-/g, ''),
    f_adult_su: guests,
  });
  if (RAKUTEN_AFFILIATE_ID) {
    return `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFILIATE_ID}/?pc=${encodeURIComponent(`${base}?${params}`)}`;
  }
  return `${base}?${params}`;
}

// ── 楽天APIレスポンスのパース ────────────────────────────────────
// 実際のレスポンス構造:
// hotel[1].roomInfo = [
//   { roomBasicInfo: { roomClass, roomName, planId, planName, reserveUrl, ... } },
//   { dailyCharge: { stayDate, rakutenCharge, total, chargeFlag } }
// ]
function parseRakutenResponse(apiData, { minSqm, guests, checkin, checkout }) {
  const results = [];
  const hotels  = apiData.hotels || [];

    console.log('hotels length:', hotels.length);
    if (hotels.length > 0) console.log('first hotel keys:', JSON.stringify(Object.keys(hotels[0])));
  
  for (const hotelWrapper of hotels) {
    const hotelArr       = Array.isArray(hotelWrapper) ? hotelWrapper : (hotelWrapper.hotel || []);
    const hotelBasicInfo = hotelArr[0]?.hotelBasicInfo || {};
    const roomInfoArr    = hotelArr[1]?.roomInfo       || [];

    // roomInfoArr[0] = roomBasicInfo, roomInfoArr[1] = dailyCharge
    const roomBasicInfo = roomInfoArr[0]?.roomBasicInfo || {};
    const dailyCharge   = roomInfoArr[1]?.dailyCharge   || {};

    const sqm = extractSqmFromRakutenResponse(
      { planName: roomBasicInfo.planName, planContents: roomBasicInfo.roomName },
      { roomName: roomBasicInfo.roomName },
      { hotelSpecial: hotelBasicInfo.hotelSpecial }
    );

    if (sqm === null || sqm < minSqm) continue;

    const price = dailyCharge.total ?? dailyCharge.rakutenCharge ?? 0;

    results.push({
      hotelNo:        hotelBasicInfo.hotelNo,
      hotelName:      hotelBasicInfo.hotelName,
      address:        `${hotelBasicInfo.address1 || ''}${hotelBasicInfo.address2 || ''}`,
      nearestStation: hotelBasicInfo.nearestStation,
      hotelImageUrl:  hotelBasicInfo.hotelImageUrl,
      reviewAverage:  hotelBasicInfo.reviewAverage,
      reviewCount:    hotelBasicInfo.reviewCount,
      planId:         roomBasicInfo.planId,
      planName:       roomBasicInfo.planName,
      roomName:       roomBasicInfo.roomName,
      mealType:       roomBasicInfo.withBreakfastFlag,
      price,
      pricePerPerson: Math.round(price / guests),
      sqm,
      perPersonSqm:   parseFloat((sqm / guests).toFixed(1)),
      reserveUrl:     roomBasicInfo.reserveUrl || buildReserveUrl(hotelBasicInfo.hotelNo, roomBasicInfo.planId, checkin, checkout, guests),
    });
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
  const minSqmNum = parseFloat(minSqm) || 0;
  const prefCode  = getPrefCode(area);

  try {
    const apiData = await callRakutenTravel('VacantHotelSearch/20170426', {
      largeClassCode:  'japan',
      middleClassCode: prefCode.middle,
      smallClassCode:  prefCode.small,
      detailClassCode: prefCode.detail,
      checkinDate:     checkin,
      checkoutDate:    checkout,
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
