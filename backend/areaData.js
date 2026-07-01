/**
 * areaData.js
 * 楽天トラベル地区コード対応表
 * 出典: 楽天トラベル地区コードAPI (GetAreaClass)
 *
 * 構造: 都道府県(middle) > エリア(small) > 小エリア(detail)
 * detailClassCode が存在しないエリアは detail: null
 */

const AREA_DATA = {
  hokkaido: {
    name: '北海道',
    smalls: {
      sapporo:  { name: '札幌',           details: { A:'札幌・新札幌・琴似', B:'大通公園・時計台・狸小路', C:'すすきの・中島公園' } },
      jozankei: { name: '定山渓',         details: null },
      wakkanai: { name: '稚内・留萌・利尻・礼文', details: null },
      abashiri: { name: '網走・紋別・北見・知床', details: null },
      kushiro:  { name: '釧路・阿寒・川湯・根室', details: null },
      obihiro:  { name: '帯広・十勝',     details: null },
      hakodate: { name: '函館・大沼・松前', details: null },
      niseko:   { name: 'ニセコ・留寿都・ルスツ', details: null },
      noboribetsu: { name: '登別・室蘭・苫小牧・支笏・洞爺', details: null },
      asahikawa: { name: '旭川・富良野・美瑛・トマム', details: null },
    }
  },
  aomori: {
    name: '青森県',
    smalls: {
      aomori:  { name: '青森',     details: null },
      hirosaki: { name: '弘前・黒石', details: null },
      hachinohe: { name: '八戸・三沢・十和田', details: null },
    }
  },
  iwate: {
    name: '岩手県',
    smalls: {
      morioka: { name: '盛岡',       details: null },
      hiraizumi: { name: '平泉・一関', details: null },
      hanamaki: { name: '花巻・北上・遠野', details: null },
    }
  },
  miyagi: {
    name: '宮城県',
    smalls: {
      sendai:   { name: '仙台',         details: { A:'仙台駅周辺', B:'仙台・国分町・一番町' } },
      matsushima: { name: '松島・塩釜・石巻', details: null },
      zao:      { name: '蔵王・遠刈田・白石', details: null },
    }
  },
  akita: {
    name: '秋田県',
    smalls: {
      akita:    { name: '秋田',     details: null },
      kakunodate: { name: '角館・田沢湖・横手', details: null },
    }
  },
  yamagata: {
    name: '山形県',
    smalls: {
      yamagata: { name: '山形・上山', details: null },
      zao2:     { name: '蔵王・米沢', details: null },
      sakata:   { name: '酒田・鶴岡', details: null },
    }
  },
  fukushima: {
    name: '福島県',
    smalls: {
      koriyama: { name: '郡山・二本松', details: null },
      aizu:     { name: '会津若松・猪苗代', details: null },
      fukushima: { name: '福島・二本松', details: null },
    }
  },
  ibaraki: {
    name: '茨城県',
    smalls: {
      mito:     { name: '水戸・笠間', details: null },
      tsukuba:  { name: 'つくば・土浦', details: null },
    }
  },
  tochigi: {
    name: '栃木県',
    smalls: {
      utsunomiya: { name: '宇都宮・日光・鬼怒川', details: null },
      nasu:     { name: '那須・塩原', details: null },
    }
  },
  gunma: {
    name: '群馬県',
    smalls: {
      maebashi: { name: '前橋・高崎・伊香保', details: null },
      kusatsu:  { name: '草津・万座・嬬恋', details: null },
      minakami: { name: '水上・猿ヶ京・沼田', details: null },
    }
  },
  saitama: {
    name: '埼玉県',
    smalls: {
      saitama:  { name: '大宮・浦和・川越', details: null },
    }
  },
  chiba: {
    name: '千葉県',
    smalls: {
      chiba:    { name: '千葉・幕張・舞浜', details: null },
      narita:   { name: '成田',     details: null },
      tateyama: { name: '館山・南房総', details: null },
      katsuura: { name: '勝浦・鴨川', details: null },
    }
  },
  tokyo: {
    name: '東京都',
    smalls: {
      tokyo: {
        name: '東京２３区内',
        details: {
          A: '東京駅・銀座・秋葉原・東陽町・葛西',
          B: '新橋・汐留・浜松町・お台場',
          C: '赤坂・六本木・霞ヶ関・永田町',
          D: '渋谷・恵比寿・目黒・二子玉川',
          E: '品川・大井町・蒲田・羽田空港',
          F: '新宿・中野・荻窪・四谷',
          G: '池袋・赤羽・巣鴨・大塚',
          H: '上野・浅草・両国・錦糸町',
        }
      },
      tama: { name: '多摩・八王子',  details: null },
      okutama: { name: '奥多摩・青梅', details: null },
    }
  },
  kanagawa: {
    name: '神奈川県',
    smalls: {
      yokohama: { name: '横浜',     details: { A:'横浜駅・みなとみらい', B:'関内・中華街・山下公園' } },
      kawasaki: { name: '川崎',     details: null },
      kamakura: { name: '鎌倉・逗子・葉山', details: null },
      odawara:  { name: '小田原・箱根・湯河原', details: null },
    }
  },
  niigata: {
    name: '新潟県',
    smalls: {
      niigata:  { name: '新潟・燕三条', details: null },
      yuzawa:   { name: '湯沢・苗場・六日町', details: null },
    }
  },
  toyama: {
    name: '富山県',
    smalls: {
      toyama:   { name: '富山',     details: null },
      tateyama: { name: '立山・黒部', details: null },
    }
  },
  ishikawa: {
    name: '石川県',
    smalls: {
      kanazawa: { name: '金沢',     details: { A:'金沢駅周辺', B:'ひがし茶屋街・兼六園周辺' } },
      kaga:     { name: '加賀・山中温泉', details: null },
      noto:     { name: '能登・和倉温泉', details: null },
    }
  },
  fukui: {
    name: '福井県',
    smalls: {
      fukui:    { name: '福井',     details: null },
      awara:    { name: 'あわら・三国', details: null },
    }
  },
  yamanashi: {
    name: '山梨県',
    smalls: {
      kofu:     { name: '甲府・昇仙峡', details: null },
      fujisan:  { name: '富士山・富士五湖', details: null },
      kiyosato: { name: '清里・小淵沢', details: null },
    }
  },
  nagano: {
    name: '長野県',
    smalls: {
      nagano:   { name: '長野・善光寺', details: null },
      matsumoto: { name: '松本・白馬・安曇野', details: null },
      karuizawa: { name: '軽井沢・佐久・小諸', details: null },
      suwa:     { name: '諏訪・松本・塩尻', details: null },
    }
  },
  gifu: {
    name: '岐阜県',
    smalls: {
      gifu:     { name: '岐阜・各務原', details: null },
      takayama: { name: '高山・飛騨・下呂', details: null },
      gero:     { name: '下呂・郡上', details: null },
    }
  },
  shizuoka: {
    name: '静岡県',
    smalls: {
      shizuoka: { name: '静岡・焼津・藤枝', details: null },
      hamamatsu: { name: '浜松・浜名湖', details: null },
      atami:    { name: '熱海・伊東・修善寺', details: null },
      shimoda:  { name: '下田・南伊豆', details: null },
    }
  },
  aichi: {
    name: '愛知県',
    smalls: {
      nagoya:   { name: '名古屋',   details: { A:'名古屋駅・栄・伏見', B:'金山・熱田・常滑' } },
      chita:    { name: '知多・常滑・セントレア', details: null },
    }
  },
  mie: {
    name: '三重県',
    smalls: {
      tsu:      { name: '津・松阪・伊賀', details: null },
      ise:      { name: '伊勢・鳥羽・志摩', details: null },
    }
  },
  shiga: {
    name: '滋賀県',
    smalls: {
      otsu:     { name: '大津・雄琴', details: null },
      biwako:   { name: '彦根・長浜・びわ湖東岸', details: null },
    }
  },
  kyoto: {
    name: '京都府',
    smalls: {
      shi:      { name: '京都市内', details: { A:'京都駅周辺・東寺・伏見稲荷', B:'四条・烏丸・大宮', C:'嵐山・太秦・桂', D:'二条城・西陣・鷹ヶ峰', E:'河原町・祇園・東山', F:'岡崎・平安神宮・銀閣寺', G:'紫野・北野天満宮・金閣寺', H:'上賀茂・下鴨・宝ヶ池' } },
      arashiyama: { name: '嵐山・亀岡', details: null },
      tango:    { name: '天橋立・舞鶴・京丹後', details: null },
    }
  },
  osaka: {
    name: '大阪府',
    smalls: {
      osaka:    { name: '大阪市内', details: { A:'梅田・大阪駅・福島', B:'心斎橋・難波・天王寺', C:'新大阪・江坂・淡路', D:'天満・大阪城・京橋', E:'USJ・此花・桜島', F:'堺・岸和田・関西空港' } },
      sennan:   { name: '堺・岸和田・関西空港', details: null },
    }
  },
  hyogo: {
    name: '兵庫県',
    smalls: {
      kobe:     { name: '神戸',     details: { A:'三宮・元町・神戸港', B:'ポートアイランド・六甲アイランド', C:'有馬温泉' } },
      himeji:   { name: '姫路・赤穂・龍野', details: null },
      kinosaki: { name: '城崎・出石・豊岡', details: null },
      awaji:    { name: '淡路島',   details: null },
    }
  },
  nara: {
    name: '奈良県',
    smalls: {
      nara:     { name: '奈良市内', details: null },
      yoshino:  { name: '吉野・十津川・洞川', details: null },
    }
  },
  wakayama: {
    name: '和歌山県',
    smalls: {
      wakayama: { name: '和歌山・加太', details: null },
      shirahama: { name: '白浜・勝浦・串本', details: null },
      koyasan:  { name: '高野山・橋本', details: null },
    }
  },
  tottori: {
    name: '鳥取県',
    smalls: {
      tottori:  { name: '鳥取・岩美', details: null },
      kurayoshi: { name: '倉吉・三朝・湯梨浜', details: null },
      yonago:   { name: '米子・皆生温泉', details: null },
    }
  },
  shimane: {
    name: '島根県',
    smalls: {
      matsue:   { name: '松江・玉造', details: null },
      izumo:    { name: '出雲・石見銀山', details: null },
    }
  },
  okayama: {
    name: '岡山県',
    smalls: {
      okayama:  { name: '岡山',     details: null },
      kurashiki: { name: '倉敷・総社', details: null },
    }
  },
  hiroshima: {
    name: '広島県',
    smalls: {
      hiroshima: { name: '広島市内', details: { A:'広島駅周辺', B:'平和公園・中区' } },
      miyajima: { name: '宮島・廿日市', details: null },
      fukuyama: { name: '福山・尾道・三原', details: null },
    }
  },
  yamaguchi: {
    name: '山口県',
    smalls: {
      yamaguchi: { name: '山口・防府', details: null },
      hagi:     { name: '萩・長門・秋吉台', details: null },
      shimonoseki: { name: '下関・宇部', details: null },
    }
  },
  tokushima: {
    name: '徳島県',
    smalls: {
      tokushima: { name: '徳島',    details: null },
      naruto:   { name: '鳴門・大塚国際美術館', details: null },
    }
  },
  kagawa: {
    name: '香川県',
    smalls: {
      takamatsu: { name: '高松',    details: null },
      kotohira: { name: 'ことひら・丸亀', details: null },
    }
  },
  ehime: {
    name: '愛媛県',
    smalls: {
      matsuyama: { name: '松山・道後温泉', details: null },
      imabari:  { name: '今治・しまなみ海道', details: null },
    }
  },
  kochi: {
    name: '高知県',
    smalls: {
      kochi:    { name: '高知',     details: null },
      shimanto: { name: '四万十・足摺', details: null },
    }
  },
  fukuoka: {
    name: '福岡県',
    smalls: {
      fukuoka:  { name: '福岡市内', details: { A:'博多駅周辺・キャナルシティ', B:'天神・大濠公園・薬院', C:'中洲・川端・祇園', D:'糸島・福岡空港' } },
      kitakyushu: { name: '北九州・直方・飯塚', details: null },
      dazaifu:  { name: '太宰府・久留米・柳川', details: null },
    }
  },
  saga: {
    name: '佐賀県',
    smalls: {
      saga:     { name: '佐賀・吉野ヶ里', details: null },
      karatsu:  { name: '唐津・伊万里・有田', details: null },
    }
  },
  nagasaki: {
    name: '長崎県',
    smalls: {
      nagasaki: { name: '長崎市内', details: null },
      sasebo:   { name: '佐世保・ハウステンボス', details: null },
      shimabara: { name: '島原・雲仙', details: null },
    }
  },
  kumamoto: {
    name: '熊本県',
    smalls: {
      kumamoto: { name: '熊本市内', details: null },
      aso:      { name: '阿蘇',     details: null },
      amakusa:  { name: '天草',     details: null },
    }
  },
  oita: {
    name: '大分県',
    smalls: {
      oita:     { name: '大分・別府', details: null },
      yufuin:   { name: '由布院・湯布院・玖珠', details: null },
    }
  },
  miyazaki: {
    name: '宮崎県',
    smalls: {
      miyazaki: { name: '宮崎市内・青島・日南', details: null },
      kirishima: { name: '霧島・えびの', details: null },
    }
  },
  kagoshima: {
    name: '鹿児島県',
    smalls: {
      kagoshima: { name: '鹿児島市内・桜島', details: null },
      ibusuki:  { name: '指宿・知覧', details: null },
      amami:    { name: '奄美大島',  details: null },
    }
  },
  okinawa: {
    name: '沖縄県',
    smalls: {
      nahashi:  { name: '那覇',     details: { A:'那覇市内', B:'国際通り周辺' } },
      hokubu:   { name: '恩納・名護・本部・今帰仁', details: null },
      chubu:    { name: '宜野湾・北谷・読谷・沖縄市・うるま', details: null },
      nanbu:    { name: '糸満・豊見城・南城', details: null },
      kerama:   { name: '慶良間・渡嘉敷・座間味・阿嘉', details: null },
      miyako:   { name: '宮古島・伊良部島', details: null },
      ritou:    { name: '石垣・西表・小浜島', details: null },
    }
  },
};

module.exports = AREA_DATA;
