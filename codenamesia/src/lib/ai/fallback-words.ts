import { secureShuffle } from "@/lib/game-engine/create-board";
import { normalizeWord } from "@/lib/game-engine/game-rules";
import type { GeneratedWord, Language } from "@/lib/game-engine/types";

/**
 * DEMO-MODE FALLBACK ONLY.
 * Used exclusively when GROQ_API_KEY is not configured, so the app remains
 * playable for evaluation. The UI always shows a "Demo mode" banner in this
 * case. With a Groq key set, boards are 100% AI-generated (spec §6).
 */
const LEXICON: Record<string, Partial<Record<Language, string[]>>> = {
  "artificial intelligence": {
    en: ["NEURON", "MODEL", "TRAINING", "ROBOT", "ALGORITHM", "PROMPT", "TOKEN", "NETWORK", "LEARNING", "VISION", "CHATBOT", "DATA", "AGENT", "INFERENCE", "EMBEDDING"],
    fr: ["NEURONE", "MODÈLE", "ROBOT", "ALGORITHME", "RÉSEAU", "VISION", "AGENT", "DONNÉES", "APPRENTISSAGE", "INFÉRENCE"],
    ar: ["روبوت", "نموذج", "شبكة", "بيانات", "تعلم", "خوارزمية", "رؤية", "وكيل", "تدريب", "استدلال"],
  },
  "data science": {
    en: ["REGRESSION", "CLUSTER", "DATASET", "PANDAS", "CHART", "OUTLIER", "MEDIAN", "VARIANCE", "PIPELINE", "FEATURE", "SAMPLE", "CORRELATION"],
    fr: ["RÉGRESSION", "GRAPHIQUE", "ÉCHANTILLON", "MÉDIANE", "VARIANCE", "CORRÉLATION", "DONNÉES", "MODÈLE"],
    ar: ["انحدار", "رسم", "عينة", "وسيط", "تباين", "ارتباط", "مجموعة", "تحليل"],
  },
  football: {
    en: ["STRIKER", "PENALTY", "GOALKEEPER", "OFFSIDE", "DRIBBLE", "STADIUM", "TROPHY", "REFEREE", "LEAGUE", "CAPTAIN", "CORNER", "HEADER"],
    fr: ["ATTAQUANT", "PENALTY", "GARDIEN", "STADE", "TROPHÉE", "ARBITRE", "CAPITAINE", "CORNER", "LIGUE", "DRIBBLE"],
    ar: ["مهاجم", "حارس", "ملعب", "بطولة", "حكم", "قائد", "هدف", "دوري", "ركنية", "تسلل"],
  },
  Morocco: {
    en: ["Casablanca", "Marrakech", "SAHARA", "ATLAS", "TAGINE", "MEDINA", "FEZ", "Rabat", "COUSCOUS", "SOUK", "HASSAN", "OCEAN"],
    fr: ["Casablanca", "Marrakech", "SAHARA", "ATLAS", "TAJINE", "MÉDINA", "FÈS", "Rabat", "COUSCOUS", "SOUK"],
    ar: ["الدار البيضاء", "مراكش", "الصحراء", "الأطلس", "طاجين", "فاس", "الرباط", "كسكس", "سوق", "مدينة"],
  },
  technology: {
    en: ["SERVER", "CLOUD", "CHIP", "BROWSER", "KEYBOARD", "SOFTWARE", "DATABASE", "MOBILE", "ROBOT", "SENSOR", "BATTERY", "SCREEN"],
    fr: ["SERVEUR", "NUAGE", "PUCE", "NAVIGATEUR", "CLAVIER", "LOGICIEL", "MOBILE", "ÉCRAN", "BATTERIE", "CAPTEUR"],
    ar: ["خادم", "سحابة", "شريحة", "متصفح", "برنامج", "هاتف", "شاشة", "بطارية", "قاعدة", "لوحة"],
  },
  history: {
    en: ["EMPIRE", "REVOLUTION", "MONARCH", "ANCIENT", "COLONY", "TREATY", "PYRAMID", "KNIGHT", "DYNASTY", "ARCHIVE", "BATTLE", "CENTURY"],
    fr: ["EMPIRE", "RÉVOLUTION", "ROYAUME", "PYRAMIDE", "CHEVALIER", "BATAILLE", "SIÈCLE", "TRAITÉ", "DYNASTIE", "ARCHIVE"],
    ar: ["إمبراطورية", "ثورة", "مملكة", "هرم", "فارس", "معركة", "قرن", "معاهدة", "سلالة", "أرشيف"],
  },
  movies: {
    en: ["DIRECTOR", "SEQUEL", "OSCAR", "TRAILER", "VILLAIN", "SOUNDTRACK", "CINEMA", "ACTOR", "SCRIPT", "PREMIERE", "GENRE", "STUDIO"],
    fr: ["RÉALISATEUR", "OSCAR", "CINÉMA", "ACTEUR", "SCÉNARIO", "STUDIO", "GENRE", "BANDE-ANNONCE", "SUITE", "MÉCHANT"],
    ar: ["مخرج", "أوسكار", "سينما", "ممثل", "نص", "استوديو", "شرير", "عرض", "فيلم", "بطولة"],
  },
  music: {
    en: ["GUITAR", "RHYTHM", "CONCERT", "MELODY", "PIANO", "ALBUM", "LYRICS", "DRUMS", "VIOLIN", "CHORUS", "TEMPO", "SINGER"],
    fr: ["GUITARE", "RYTHME", "CONCERT", "MÉLODIE", "PIANO", "ALBUM", "PAROLES", "VIOLON", "CHANTEUR", "TEMPO"],
    ar: ["قيثارة", "إيقاع", "حفل", "لحن", "بيانو", "ألبوم", "كلمات", "كمان", "مغني", "طبول"],
  },
};

const GENERIC: Record<Language, string[]> = {
  en: ["BRIDGE", "RIVER", "MOUNTAIN", "GARDEN", "WINDOW", "MIRROR", "CASTLE", "FOREST", "ISLAND", "HARBOUR", "MARKET", "LIBRARY", "JOURNEY", "SEASON", "GOLDEN", "CRYSTAL", "VELVET", "THUNDER", "HORIZON", "COMPASS", "LANTERN", "PYRAMID", "OCEAN", "DESERT", "VALLEY", "MEADOW", "CANDLE", "MARBLE", "FEATHER", "ANCHOR"],
  fr: ["Pont", "RIVIÈRE", "MONTAGNE", "JARDIN", "FENÊTRE", "MIROIR", "CHÂTEAU", "FORÊT", "ÎLE", "PORT", "MARCHÉ", "BIBLIOTHÈQUE", "VOYAGE", "SAISON", "CRISTAL", "TONNERRE", "HORIZON", "BOUSSOLE", "LANTERNE", "OCÉAN", "DÉSERT", "VALLÉE", "BOUGIE", "MARBRE", "PLUME"],
  ar: ["جسر", "نهر", "جبل", "حديقة", "نافذة", "مرآة", "قلعة", "غابة", "جزيرة", "ميناء", "سوق", "مكتبة", "رحلة", "موسم", "بلور", "رعد", "أفق", "بوصلة", "فانوس", "محيط", "صحراء", "وادي", "شمعة", "رخام", "ريشة"],
};

function wordsForCategory(category: string, language: Language): string[] {
  const norm = normalizeWord(category);
  for (const [key, byLang] of Object.entries(LEXICON)) {
    if (norm.includes(normalizeWord(key)) || normalizeWord(key).includes(norm)) {
      return byLang[language] ?? byLang.en ?? [];
    }
  }
  return [];
}

export function fallbackGenerateWords(
  categories: { name: string; weight?: number }[],
  language: Language
): GeneratedWord[] {
  const picked: GeneratedWord[] = [];
  const used = new Set<string>();

  const totalWeight = categories.reduce((s, c) => s + (c.weight ?? 0), 0);
  const quotas = categories.map((c) =>
    totalWeight > 0 && c.weight ? Math.round((c.weight / totalWeight) * 25) : Math.ceil(25 / categories.length)
  );

  categories.forEach((c, i) => {
    const pool = secureShuffle(wordsForCategory(c.name, language));
    for (const w of pool) {
      if (picked.length >= 25 || picked.filter((p) => p.category === c.name).length >= quotas[i]) break;
      const key = normalizeWord(w);
      if (used.has(key)) continue;
      used.add(key);
      picked.push({ word: w.toUpperCase(), category: c.name });
    }
  });

  // Fill remaining slots from the generic pool, attributed round-robin.
  const generic = secureShuffle(GENERIC[language]);
  let gi = 0;
  let ci = 0;
  while (picked.length < 25 && gi < generic.length) {
    const w = generic[gi++];
    const key = normalizeWord(w);
    if (used.has(key)) continue;
    used.add(key);
    picked.push({ word: w.toUpperCase(), category: categories[ci++ % categories.length].name });
  }
  return picked.slice(0, 25);
}
