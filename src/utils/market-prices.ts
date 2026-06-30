import { MarketPrice, KalimatiApiResponse } from '../types/market-prices.js';
import { VendorCategory } from '../types/auth.js';

// ─── Kalimati API ─────────────────────────────────────────────────────────────

const KALIMATI_URL = 'https://kalimatimarket.gov.np/api/daily-prices/en';

/** In-memory cache for the Kalimati response (refreshes daily) */
let kalimatiCache: { prices: MarketPrice[]; date: string; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 23 * 60 * 60 * 1000; // 23 h

// ─── Commodity → image map (verified Wikimedia Commons URLs) ─────────────────
// More-specific substrings first so "sweet potato" wins over "potato".
const COMMODITY_IMAGES: Record<string, string> = {
  // Vegetables
  'sweet potato': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Ipomoea_batatas_006.jpg/120px-Ipomoea_batatas_006.jpg',
  cauliflower:  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/KBlumenkohlCutted.jpg/120px-KBlumenkohlCutted.jpg',
  bitter:       'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Momordica_charantia_kerala.jpg/120px-Momordica_charantia_kerala.jpg',
  drumstick:    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Moringa_oleifera_fruits.jpg/120px-Moringa_oleifera_fruits.jpg',
  tomato:       'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/120px-Tomato_je.jpg',
  potato:       'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Potato_%28Solanum_tuberosum%29.jpg/120px-Potato_%28Solanum_tuberosum%29.jpg',
  onion:        'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Onion_on_White.JPG/120px-Onion_on_White.JPG',
  carrot:       'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Vegetable-Carrot-Bundle-wStalks.jpg/120px-Vegetable-Carrot-Bundle-wStalks.jpg',
  cabbage:      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Cabbage_and_cross_section_on_white.jpg/120px-Cabbage_and_cross_section_on_white.jpg',
  cauli:        'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/KBlumenkohlCutted.jpg/120px-KBlumenkohlCutted.jpg',
  broccoli:     'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Fresh_broccoli_head_2272.jpg/120px-Fresh_broccoli_head_2272.jpg',
  spinach:      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Spinach_leaves.jpg/120px-Spinach_leaves.jpg',
  cucumber:     'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Cucumbers.jpg/120px-Cucumbers.jpg',
  pumpkin:      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/FrenchTournipPumpkin.jpg/120px-FrenchTournipPumpkin.jpg',
  okra:         'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Okra_-_Abelmoschus_esculentus.jpg/120px-Okra_-_Abelmoschus_esculentus.jpg',
  mushroom:     'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Agaricus_bisporus_%28brown%29.jpg/120px-Agaricus_bisporus_%28brown%29.jpg',
  ginger:       'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Ginger.jpg/120px-Ginger.jpg',
  garlic:       'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Roasted-Garlic.jpg/120px-Roasted-Garlic.jpg',
  chilli:       'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Pimentoes.jpg/120px-Pimentoes.jpg',
  capsicum:     'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Capsicum_and_cross_section.jpg/120px-Capsicum_and_cross_section.jpg',
  coriander:    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Coriander.jpg/120px-Coriander.jpg',
  brinjal:      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Solanum_melongena_71048.jpg/120px-Solanum_melongena_71048.jpg',
  eggplant:     'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Solanum_melongena_71048.jpg/120px-Solanum_melongena_71048.jpg',
  radish:       'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Radish_ps10.jpg/120px-Radish_ps10.jpg',
  raddish:      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Radish_ps10.jpg/120px-Radish_ps10.jpg',
  pea:          'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Peas_in_pods_-_Studio.jpg/120px-Peas_in_pods_-_Studio.jpg',
  gourd:        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Pumpkin_CXC_3.jpg/120px-Pumpkin_CXC_3.jpg',
  lettuce:      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Salad_garden.jpg/120px-Salad_garden.jpg',
  mint:         'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Mint-2079.jpg/120px-Mint-2079.jpg',
  coconut:      'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Coconut_on_white_background.jpg/120px-Coconut_on_white_background.jpg',
  jackfruit:    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Jackfruit_Bangladesh.jpg/120px-Jackfruit_Bangladesh.jpg',
  turnip:       'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Turnip_2622027.jpg/120px-Turnip_2622027.jpg',
  beetroot:     'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Betterave_rouge_2.jpg/120px-Betterave_rouge_2.jpg',
  asparagus:    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Asparagus_officinalis.jpg/120px-Asparagus_officinalis.jpg',
  bean:         'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Phaseolus_vulgaris.jpg/120px-Phaseolus_vulgaris.jpg',
  leek:         'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Leek_Varieties.jpg/120px-Leek_Varieties.jpg',
  taro:         'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Colocasia_esculenta%2C_taro_%28Raiatea%2C_French_Polynesia%29.jpg/120px-Colocasia_esculenta%2C_taro_%28Raiatea%2C_French_Polynesia%29.jpg',
  yam:          'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Igname_dioscorea.jpg/120px-Igname_dioscorea.jpg',
  celery:       'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Celery_cross_section.jpg/120px-Celery_cross_section.jpg',
  // Fruits
  pomegranate:  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Garnet_pomegranate.jpg/120px-Garnet_pomegranate.jpg',
  pineapple:    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Pineapple_and_cross_section.jpg/120px-Pineapple_and_cross_section.jpg',
  watermelon:   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Watermelon_seedless_%28whole_and_halved%29.jpg/120px-Watermelon_seedless_%28whole_and_halved%29.jpg',
  strawberry:   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/PerfectStrawberry.jpg/120px-PerfectStrawberry.jpg',
  papaya:       'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Papaia_%28Carica_papaya%29.jpg/120px-Papaia_%28Carica_papaya%29.jpg',
  mango:        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Mango_Aam_Fruit_Tropical.jpg/120px-Mango_Aam_Fruit_Tropical.jpg',
  banana:       'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Banana-Whole-and-Split.jpg/120px-Banana-Whole-and-Split.jpg',
  orange:       'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Oranges_and_orange_juice.jpg/120px-Oranges_and_orange_juice.jpg',
  apple:        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Red_Apple.jpg/120px-Red_Apple.jpg',
  grape:        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Table_grapes_on_white.jpg/120px-Table_grapes_on_white.jpg',
  guava:        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Guava_ID.jpg/120px-Guava_ID.jpg',
  kiwi:         'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Kiwi_-_Whole_and_Split.jpg/120px-Kiwi_-_Whole_and_Split.jpg',
  peach:        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Georgia_peach_PPW.jpg/120px-Georgia_peach_PPW.jpg',
  pear:         'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Pear_hjl.jpg/120px-Pear_hjl.jpg',
  plum:         'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Plums.jpg/120px-Plums.jpg',
  lemon:        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/The_Whole_Lemon.jpg/120px-The_Whole_Lemon.jpg',
  lime:         'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/The_Whole_Lemon.jpg/120px-The_Whole_Lemon.jpg',
  fish:         'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Fish_on_a_cutting_board.jpg/120px-Fish_on_a_cutting_board.jpg',
};

const CATEGORY_FALLBACK: Record<string, string> = {
  'Vegetables and Fruits': 'https://placehold.co/120x120/22c55e/white?text=VEG',
  'Non Veg':               'https://placehold.co/120x120/ef4444/white?text=MEAT',
  'Grocery':               'https://placehold.co/120x120/f59e0b/white?text=GROC',
  'Spices':                'https://placehold.co/120x120/f97316/white?text=SPICE',
  'Beverages':             'https://placehold.co/120x120/3b82f6/white?text=BEV',
};

function imageForCommodity(name: string, category: VendorCategory): string {
  const lower = name.toLowerCase();
  for (const [key, url] of Object.entries(COMMODITY_IMAGES)) {
    if (lower.includes(key)) return url;
  }
  return CATEGORY_FALLBACK[category] ?? 'https://placehold.co/120x120/94a3b8/white?text=ITEM';
}

async function fetchKalimatiPrices(): Promise<MarketPrice[]> {
  const now = Date.now();
  if (kalimatiCache && now - kalimatiCache.fetchedAt < CACHE_TTL_MS) {
    return kalimatiCache.prices;
  }

  const res = await fetch(KALIMATI_URL);
  if (!res.ok) throw new Error(`Kalimati API error: ${res.status}`);
  const json: KalimatiApiResponse = await res.json() as KalimatiApiResponse;

  const prices: MarketPrice[] = json.prices.map((item, idx) => ({
    id: `kal-${idx}`,
    name: item.commodityname,
    unit: item.commodityunit,
    minPrice: parseFloat(item.minprice),
    maxPrice: parseFloat(item.maxprice),
    avgPrice: parseFloat(item.avgprice),
    category: 'Vegetables and Fruits',
    imageUrl: imageForCommodity(item.commodityname, 'Vegetables and Fruits'),
    source: 'kalimati',
    date: json.date,
  }));

  kalimatiCache = { prices, date: json.date, fetchedAt: now };
  return prices;
}

// ─── Seed data — Nepal market reference rates ─────────────────────────────────

const today = new Date().toISOString().slice(0, 10);

const NON_VEG_PRICES: MarketPrice[] = [
  { id: 'nv-1',  name: 'Buffalo Meat',          unit: 'KG',    minPrice: 420,  maxPrice: 500,  avgPrice: 460,  category: 'Non Veg', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Beef_cuts.jpg/120px-Beef_cuts.jpg' },
  { id: 'nv-2',  name: 'Goat Meat (Khasi)',      unit: 'KG',    minPrice: 780,  maxPrice: 900,  avgPrice: 840,  category: 'Non Veg', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Mountain_Goat_USFWS.jpg/120px-Mountain_Goat_USFWS.jpg' },
  { id: 'nv-3',  name: 'Chicken Broiler (Live)', unit: 'KG',    minPrice: 170,  maxPrice: 200,  avgPrice: 185,  category: 'Non Veg', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Rooster_on_a_fence.jpg/120px-Rooster_on_a_fence.jpg' },
  { id: 'nv-4',  name: 'Chicken (Dressed)',      unit: 'KG',    minPrice: 270,  maxPrice: 320,  avgPrice: 295,  category: 'Non Veg', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Chicken_Fried_Steak_001.jpg/120px-Chicken_Fried_Steak_001.jpg' },
  { id: 'nv-5',  name: 'Pork',                   unit: 'KG',    minPrice: 360,  maxPrice: 420,  avgPrice: 390,  category: 'Non Veg', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Roast_pork.jpg/120px-Roast_pork.jpg' },
  { id: 'nv-6',  name: 'Duck',                   unit: 'KG',    minPrice: 380,  maxPrice: 450,  avgPrice: 415,  category: 'Non Veg', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Roast_duck.jpg/120px-Roast_duck.jpg' },
  { id: 'nv-7',  name: 'Mutton (Sheep)',          unit: 'KG',    minPrice: 850,  maxPrice: 1000, avgPrice: 925,  category: 'Non Veg', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Pair_of_Merino_sheep.jpg/120px-Pair_of_Merino_sheep.jpg' },
  { id: 'nv-8',  name: 'Fish (Rahu Fresh)',       unit: 'KG',    minPrice: 310,  maxPrice: 340,  avgPrice: 325,  category: 'Non Veg', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Fish_on_a_cutting_board.jpg/120px-Fish_on_a_cutting_board.jpg' },
  { id: 'nv-9',  name: 'Fish (Singi Fresh)',      unit: 'KG',    minPrice: 350,  maxPrice: 400,  avgPrice: 375,  category: 'Non Veg', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Fish_on_a_cutting_board.jpg/120px-Fish_on_a_cutting_board.jpg' },
  { id: 'nv-10', name: 'Prawn',                   unit: 'KG',    minPrice: 600,  maxPrice: 750,  avgPrice: 675,  category: 'Non Veg', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Shrimps.jpg/120px-Shrimps.jpg' },
  { id: 'nv-11', name: 'Egg (Chicken)',            unit: 'Dozen', minPrice: 170,  maxPrice: 200,  avgPrice: 185,  category: 'Non Veg', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Eier.jpg/120px-Eier.jpg' },
  { id: 'nv-12', name: 'Egg (Duck)',               unit: 'Dozen', minPrice: 200,  maxPrice: 240,  avgPrice: 220,  category: 'Non Veg', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Eier.jpg/120px-Eier.jpg' },
];

const GROCERY_PRICES: MarketPrice[] = [
  { id: 'gr-1',  name: 'Rice Basmati',           unit: 'KG',    minPrice: 100,  maxPrice: 130,  avgPrice: 115,  category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/White_rice_1.jpg/120px-White_rice_1.jpg' },
  { id: 'gr-2',  name: 'Rice Arwa (Common)',      unit: 'KG',    minPrice: 58,   maxPrice: 72,   avgPrice: 65,   category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/White_rice_1.jpg/120px-White_rice_1.jpg' },
  { id: 'gr-3',  name: 'Rice Chiura (Beaten)',    unit: 'KG',    minPrice: 80,   maxPrice: 110,  avgPrice: 95,   category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/White_rice_1.jpg/120px-White_rice_1.jpg' },
  { id: 'gr-4',  name: 'Lentil Masur Dal',        unit: 'KG',    minPrice: 115,  maxPrice: 140,  avgPrice: 128,  category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Lentil_%28Lens_culinaris%29_de_seeds.jpg/120px-Lentil_%28Lens_culinaris%29_de_seeds.jpg' },
  { id: 'gr-5',  name: 'Lentil Moong Dal',        unit: 'KG',    minPrice: 95,   maxPrice: 120,  avgPrice: 108,  category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Lentil_%28Lens_culinaris%29_de_seeds.jpg/120px-Lentil_%28Lens_culinaris%29_de_seeds.jpg' },
  { id: 'gr-6',  name: 'Chana Dal (Chickpea)',    unit: 'KG',    minPrice: 85,   maxPrice: 110,  avgPrice: 98,   category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Chickpeas.jpg/120px-Chickpeas.jpg' },
  { id: 'gr-7',  name: 'Wheat Flour (Maida)',     unit: 'KG',    minPrice: 52,   maxPrice: 65,   avgPrice: 58,   category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Wheat_flour.jpg/120px-Wheat_flour.jpg' },
  { id: 'gr-8',  name: 'Whole Wheat (Aata)',      unit: 'KG',    minPrice: 42,   maxPrice: 55,   avgPrice: 48,   category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Wheat_flour.jpg/120px-Wheat_flour.jpg' },
  { id: 'gr-9',  name: 'Cooking Oil (Sunflower)', unit: 'Liter', minPrice: 175,  maxPrice: 210,  avgPrice: 192,  category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Sunflower_oil_and_sunflower.jpg/120px-Sunflower_oil_and_sunflower.jpg' },
  { id: 'gr-10', name: 'Mustard Oil',             unit: 'Liter', minPrice: 195,  maxPrice: 230,  avgPrice: 212,  category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Sunflower_oil_and_sunflower.jpg/120px-Sunflower_oil_and_sunflower.jpg' },
  { id: 'gr-11', name: 'Sugar',                   unit: 'KG',    minPrice: 68,   maxPrice: 82,   avgPrice: 75,   category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/White_sugar_closeup.jpg/120px-White_sugar_closeup.jpg' },
  { id: 'gr-12', name: 'Salt (Iodised)',           unit: 'KG',    minPrice: 18,   maxPrice: 25,   avgPrice: 22,   category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Salt_shaker_on_white_background.jpg/120px-Salt_shaker_on_white_background.jpg' },
  { id: 'gr-13', name: 'Soybean Oil',             unit: 'Liter', minPrice: 160,  maxPrice: 195,  avgPrice: 178,  category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Sunflower_oil_and_sunflower.jpg/120px-Sunflower_oil_and_sunflower.jpg' },
  { id: 'gr-14', name: 'Ghee (Cow)',              unit: 'KG',    minPrice: 950,  maxPrice: 1100, avgPrice: 1025, category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Ghee_%28Indian_clarified_butter%29.jpg/120px-Ghee_%28Indian_clarified_butter%29.jpg' },
  { id: 'gr-15', name: 'Milk (Cow Fresh)',         unit: 'Liter', minPrice: 90,   maxPrice: 110,  avgPrice: 100,  category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Milk_glass.jpg/120px-Milk_glass.jpg' },
  { id: 'gr-16', name: 'Curd (Dahi)',              unit: 'KG',    minPrice: 110,  maxPrice: 140,  avgPrice: 125,  category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Lait_ribot.jpg/120px-Lait_ribot.jpg' },
  { id: 'gr-17', name: 'Corn Flour (Makai)',       unit: 'KG',    minPrice: 45,   maxPrice: 60,   avgPrice: 52,   category: 'Grocery', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Corn_maize_starch_-_cornflour.jpg/120px-Corn_maize_starch_-_cornflour.jpg' },
];

const SPICES_PRICES: MarketPrice[] = [
  { id: 'sp-1',  name: 'Turmeric Powder (Besar)', unit: 'KG',   minPrice: 200,  maxPrice: 260,  avgPrice: 230,  category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Curcuma_longa_roots.jpg/120px-Curcuma_longa_roots.jpg' },
  { id: 'sp-2',  name: 'Cumin Seeds (Jeera)',      unit: 'KG',   minPrice: 380,  maxPrice: 460,  avgPrice: 420,  category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cumin-seeds.jpg/120px-Cumin-seeds.jpg' },
  { id: 'sp-3',  name: 'Coriander Powder',         unit: 'KG',   minPrice: 160,  maxPrice: 210,  avgPrice: 185,  category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Coriander.jpg/120px-Coriander.jpg' },
  { id: 'sp-4',  name: 'Fenugreek (Methi Dana)',   unit: 'KG',   minPrice: 140,  maxPrice: 180,  avgPrice: 160,  category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Fenugreek_seeds.jpg/120px-Fenugreek_seeds.jpg' },
  { id: 'sp-5',  name: 'Cardamom (Elaichi Small)', unit: 'KG',   minPrice: 2200, maxPrice: 3000, avgPrice: 2600, category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Ground_cardamom.jpg/120px-Ground_cardamom.jpg' },
  { id: 'sp-6',  name: 'Cardamom (Alainchi Large)',unit: 'KG',   minPrice: 1200, maxPrice: 1600, avgPrice: 1400, category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Ground_cardamom.jpg/120px-Ground_cardamom.jpg' },
  { id: 'sp-7',  name: 'Cinnamon (Dalchini)',       unit: 'KG',   minPrice: 550,  maxPrice: 720,  avgPrice: 635,  category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Cinnamon-other.jpg/120px-Cinnamon-other.jpg' },
  { id: 'sp-8',  name: 'Black Pepper',              unit: 'KG',   minPrice: 650,  maxPrice: 820,  avgPrice: 735,  category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Black_pepper_01.jpg/120px-Black_pepper_01.jpg' },
  { id: 'sp-9',  name: 'Bay Leaf (Tejpat)',         unit: 'KG',   minPrice: 280,  maxPrice: 360,  avgPrice: 320,  category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Bay_leaf.jpg/120px-Bay_leaf.jpg' },
  { id: 'sp-10', name: 'Mustard Seeds (Rai)',       unit: 'KG',   minPrice: 130,  maxPrice: 180,  avgPrice: 155,  category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Mustard-Seed.jpg/120px-Mustard-Seed.jpg' },
  { id: 'sp-11', name: 'Chilli Powder (Khursani)', unit: 'KG',   minPrice: 400,  maxPrice: 520,  avgPrice: 460,  category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Pimentoes.jpg/120px-Pimentoes.jpg' },
  { id: 'sp-12', name: 'Garam Masala',              unit: 'KG',   minPrice: 350,  maxPrice: 480,  avgPrice: 415,  category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Masala_2_colours.jpg/120px-Masala_2_colours.jpg' },
  { id: 'sp-13', name: 'Cloves (Lwang)',            unit: 'KG',   minPrice: 1400, maxPrice: 1800, avgPrice: 1600, category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Cloves.jpg/120px-Cloves.jpg' },
  { id: 'sp-14', name: 'Asafoetida (Hing)',         unit: '100g', minPrice: 350,  maxPrice: 500,  avgPrice: 425,  category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Masala_2_colours.jpg/120px-Masala_2_colours.jpg' },
  { id: 'sp-15', name: 'Dry Ginger Powder',         unit: 'KG',   minPrice: 280,  maxPrice: 380,  avgPrice: 330,  category: 'Spices', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Ginger.jpg/120px-Ginger.jpg' },
];

const BEVERAGES_PRICES: MarketPrice[] = [
  { id: 'bv-1',  name: 'Tea Leaves CTC',           unit: 'KG',     minPrice: 380,  maxPrice: 520,  avgPrice: 450,  category: 'Beverages', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Tea_leaves.jpg/120px-Tea_leaves.jpg' },
  { id: 'bv-2',  name: 'Green Tea Leaves',          unit: 'KG',     minPrice: 580,  maxPrice: 720,  avgPrice: 650,  category: 'Beverages', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Tea_leaves.jpg/120px-Tea_leaves.jpg' },
  { id: 'bv-3',  name: 'Coffee Powder',             unit: 'KG',     minPrice: 950,  maxPrice: 1250, avgPrice: 1100, category: 'Beverages', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Roasted_coffee_beans.jpg/120px-Roasted_coffee_beans.jpg' },
  { id: 'bv-4',  name: 'Mineral Water (1L)',        unit: 'Bottle', minPrice: 18,   maxPrice: 28,   avgPrice: 23,   category: 'Beverages', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Water_bottle_closed.jpg/120px-Water_bottle_closed.jpg' },
  { id: 'bv-5',  name: 'Orange Juice (1L)',         unit: 'Liter',  minPrice: 140,  maxPrice: 200,  avgPrice: 170,  category: 'Beverages', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Oranges_and_orange_juice.jpg/120px-Oranges_and_orange_juice.jpg' },
  { id: 'bv-6',  name: 'Soft Drink (Cola 1.5L)',   unit: 'Bottle', minPrice: 85,   maxPrice: 100,  avgPrice: 92,   category: 'Beverages', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Coca-Cola_can_%282021%29.jpg/120px-Coca-Cola_can_%282021%29.jpg' },
  { id: 'bv-7',  name: 'Lassi (per Litre)',         unit: 'Liter',  minPrice: 80,   maxPrice: 120,  avgPrice: 100,  category: 'Beverages', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Milk_glass.jpg/120px-Milk_glass.jpg' },
  { id: 'bv-8',  name: 'Sugarcane Juice (per L)',   unit: 'Liter',  minPrice: 40,   maxPrice: 60,   avgPrice: 50,   category: 'Beverages', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Sugarcane_in_field.jpg/120px-Sugarcane_in_field.jpg' },
  { id: 'bv-9',  name: 'Mango Juice (1L)',          unit: 'Liter',  minPrice: 150,  maxPrice: 200,  avgPrice: 175,  category: 'Beverages', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Mango_Aam_Fruit_Tropical.jpg/120px-Mango_Aam_Fruit_Tropical.jpg' },
  { id: 'bv-10', name: 'Coconut Water (per Nut)',   unit: 'Piece',  minPrice: 50,   maxPrice: 80,   avgPrice: 65,   category: 'Beverages', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Coconut_on_white_background.jpg/120px-Coconut_on_white_background.jpg' },
  { id: 'bv-11', name: 'Yogurt Drink (Lassi 500ml)',unit: '500ml',  minPrice: 45,   maxPrice: 65,   avgPrice: 55,   category: 'Beverages', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Milk_glass.jpg/120px-Milk_glass.jpg' },
  { id: 'bv-12', name: 'Milk Tea (per Kg leaf)',    unit: 'KG',     minPrice: 360,  maxPrice: 480,  avgPrice: 420,  category: 'Beverages', source: 'seed', date: today, imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Tea_leaves.jpg/120px-Tea_leaves.jpg' },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getMarketPrices(category?: VendorCategory): Promise<MarketPrice[]> {
  const vegAndFruits = await fetchKalimatiPrices();
  const all: MarketPrice[] = [
    ...vegAndFruits,
    ...NON_VEG_PRICES,
    ...GROCERY_PRICES,
    ...SPICES_PRICES,
    ...BEVERAGES_PRICES,
  ];
  if (!category) return all;
  return all.filter((p) => p.category === category);
}

export async function lookupMarketPrice(productName: string, category: VendorCategory): Promise<number | null> {
  const prices = await getMarketPrices(category);
  const lower = productName.toLowerCase();
  const match = prices.find(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      lower.includes(p.name.toLowerCase().split('(')[0].trim())
  );
  return match ? match.avgPrice : null;
}
