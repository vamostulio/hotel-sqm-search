/**
 * sqmExtractor.js
 * 客室テキストから平米数（㎡）を抽出するコアロジック
 *
 * 対応パターン:
 *   「35㎡」「35平米」「35m²」「35 平方メートル」「約35.5平米」
 *   「35sqm」「35 sq.m」「35平米以上」「客室面積：35㎡」
 *   「広さ約35㎡」「35〜40㎡」（範囲表記 → 小さい方を採用）
 */

'use strict';

// ── パターン定義（優先度順） ──────────────────────────────────────

const PATTERNS = [
  // 範囲表記: 35〜40㎡ → 35 を採用
  {
    re: /(\d+(?:\.\d+)?)\s*[〜~～]\s*\d+(?:\.\d+)?\s*(?:㎡|m²|平米|平方メートル)/i,
    group: 1,
    label: 'range',
  },
  // プラン名に多い: 「スーペリア35㎡」「35㎡禁煙」
  {
    re: /(\d+(?:\.\d+)?)\s*(?:㎡|m²|平米|平方メートル)/i,
    group: 1,
    label: 'direct',
  },
  // 英語: 35sqm / 35 sq.m / 35SQM
  {
    re: /(\d+(?:\.\d+)?)\s*(?:sq\.?\s*m|sqm)/i,
    group: 1,
    label: 'english',
  },
  // 「広さ：35㎡」「客室面積 約35㎡」
  {
    re: /(?:広さ|面積|客室|部屋)\s*[:：]?\s*約?\s*(\d+(?:\.\d+)?)\s*(?:㎡|平米|m²)/i,
    group: 1,
    label: 'prefixed',
  },
  // 「35平米以上」
  {
    re: /(\d+(?:\.\d+)?)\s*平米以上/,
    group: 1,
    label: 'minimum',
  },
];

// 現実的な客室サイズの範囲（カプセルホテル〜超大型スイート）
const MIN_VALID = 6;
const MAX_VALID = 600;

/**
 * テキストから最初に見つかった平米数を返す
 * @param {string|null|undefined} text
 * @returns {number|null}
 */
function extractSqm(text) {
  if (!text || typeof text !== 'string') return null;

  for (const { re, group } of PATTERNS) {
    const m = text.match(re);
    if (m) {
      const value = parseFloat(m[group]);
      if (value >= MIN_VALID && value <= MAX_VALID) return value;
    }
  }
  return null;
}

/**
 * 複数テキストソースから順番に試み、最初に見つかった値を返す
 * @param {(string|null|undefined)[]} texts - 優先度順の配列
 * @returns {number|null}
 */
function extractSqmFromMultiple(texts) {
  for (const text of texts) {
    const result = extractSqm(text);
    if (result !== null) return result;
  }
  return null;
}

/**
 * 楽天トラベルAPIの実レスポンス構造から平米数を抽出する
 *
 * 楽天APIの VacantHotelSearch レスポンスは以下の構造:
 * hotels[].hotel[0].hotelBasicInfo  — ホテル基本情報
 * hotels[].hotel[1].roomInfo[].dailyCharge[].chargeInfo — プラン・料金
 * hotels[].hotel[1].roomInfo[].roomInfo  — 客室情報（planContents等）
 *
 * @param {Object} chargeInfo - chargeInfo オブジェクト
 * @param {Object} roomInfo   - roomInfo オブジェクト
 * @param {Object} hotelBasicInfo - hotelBasicInfo オブジェクト
 * @returns {number|null}
 */
function extractSqmFromRakutenResponse(chargeInfo = {}, roomInfo = {}, hotelBasicInfo = {}) {
  const candidates = [
    chargeInfo.planName,        // プラン名（最も平米記載が多い）
    chargeInfo.planContents,    // プラン内容テキスト
    roomInfo.roomName,          // 客室タイプ名
    roomInfo.roomContents,      // 客室説明文
    roomInfo.note,              // 備考
    hotelBasicInfo.hotelSpecial,// ホテル特徴テキスト
    hotelBasicInfo.access,      // アクセス（稀に記載あり）
  ];
  return extractSqmFromMultiple(candidates);
}

module.exports = {
  extractSqm,
  extractSqmFromMultiple,
  extractSqmFromRakutenResponse,
};

// ── 自己テスト（node sqmExtractor.js で実行） ────────────────────
if (require.main === module) {
  const cases = [
    // [入力テキスト, 期待値]
    ['スーペリアダブル 35㎡ 禁煙', 35],
    ['デラックスツイン（52平米）朝食付き', 52],
    ['広さ約38平方メートルの客室', 38],
    ['スイートルーム 110m² バスタブ付き', 110],
    ['シングルルーム 24sqm', 24],
    ['プレミアムスイート 65 sq.m 眺望', 65],
    ['客室面積：45㎡以上確約', 45],
    ['35〜40㎡のお部屋', 35],          // 範囲 → 小さい方
    ['35~45㎡スタンダードルーム', 35],
    ['45平米以上確約プラン', 45],
    ['朝食付きプラン（通常）', null],   // 平米数なし
    ['広さ3㎡の部屋', null],           // 範囲外
    ['1000㎡のお部屋', null],          // 非現実的 → null
    [null, null],
    [undefined, null],
    ['', null],
  ];

  let pass = 0;
  console.log('=== sqmExtractor テスト ===\n');
  cases.forEach(([input, expected]) => {
    const result = extractSqm(input);
    const ok = result === expected;
    if (ok) pass++;
    console.log(`${ok ? '✅' : '❌'} ${JSON.stringify(input)}`);
    if (!ok) console.log(`   期待値: ${expected}　実際: ${result}`);
  });
  console.log(`\n結果: ${pass}/${cases.length} passed`);
}
