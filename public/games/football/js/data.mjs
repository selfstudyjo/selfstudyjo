// Self-Study Football - every team, player, league, cup and stadium.
//
// Everything here is ORIGINAL and generated: the clubs carry real city names (which
// are not anybody's trademark) with invented club names, every player is generated
// from a seeded name pool, and the competitions are this game's own. No real player,
// club badge, kit or competition brand is used. National teams are named after their
// countries, with generated squads.
//
// Plain module: no DOM. `npm test` drives it in node.

export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

// ---------------------------------------------------------------- name pools
const NAMES = {
  es: [['Alejandro', 'Pablo', 'Sergio', 'Diego', 'Iker', 'Marcos', 'Rubén', 'Adrián', 'Hugo', 'Álvaro', 'Dani', 'Javi', 'Raúl', 'Unai', 'Mario'],
    ['García', 'Martínez', 'López', 'Sánchez', 'Romero', 'Navarro', 'Torres', 'Ruiz', 'Morales', 'Ortega', 'Delgado', 'Castro', 'Vidal', 'Prieto', 'Serrano']],
  en: [['Harry', 'Jack', 'Oliver', 'George', 'Charlie', 'James', 'Leo', 'Mason', 'Kieran', 'Declan', 'Ben', 'Tom', 'Ryan', 'Callum', 'Jordan'],
    ['Walker', 'Hughes', 'Clarke', 'Bennett', 'Foster', 'Shaw', 'Turner', 'Mitchell', 'Barnes', 'Webb', 'Cole', 'Price', 'Hayes', 'Fletcher', 'Ward']],
  it: [['Lorenzo', 'Matteo', 'Federico', 'Nicolò', 'Davide', 'Andrea', 'Giorgio', 'Marco', 'Luca', 'Simone', 'Alessio', 'Ciro', 'Pietro', 'Enzo', 'Gianluca'],
    ['Rossi', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'Costa', 'Fontana', 'Caruso', 'Ferri', 'Moretti']],
  de: [['Lukas', 'Jonas', 'Leon', 'Felix', 'Niklas', 'Maximilian', 'Tim', 'Julian', 'Florian', 'Kai', 'Timo', 'Moritz', 'Jan', 'Fabian', 'Nico'],
    ['Müller', 'Schmidt', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Koch', 'Richter', 'Krause', 'Lehmann', 'Brandt', 'Vogel', 'Keller', 'Hahn']],
  fr: [['Lucas', 'Hugo', 'Théo', 'Antoine', 'Kylian', 'Raphaël', 'Mathis', 'Nolan', 'Adrien', 'Bastien', 'Yanis', 'Ousmane', 'Jules', 'Rayan', 'Enzo'],
    ['Martin', 'Bernard', 'Dubois', 'Laurent', 'Lefèvre', 'Moreau', 'Girard', 'Fontaine', 'Mercier', 'Blanc', 'Garnier', 'Chevalier', 'Rousseau', 'Faure', 'Perrin']],
  pt: [['João', 'Pedro', 'Gabriel', 'Rafael', 'Bruno', 'Thiago', 'Lucas', 'Matheus', 'Vinícius', 'Rodrigo', 'Diogo', 'André', 'Caio', 'Felipe', 'Gustavo'],
    ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Lima', 'Carvalho', 'Ferreira', 'Rocha', 'Almeida', 'Ribeiro', 'Gomes', 'Barros', 'Mendes', 'Nunes']],
  ar: [['Omar', 'Yazan', 'Ali', 'Mousa', 'Hamza', 'Khaled', 'Faisal', 'Mahmoud', 'Yousef', 'Saleh', 'Tariq', 'Ibrahim', 'Nizar', 'Anas', 'Rami'],
    ['Al-Rashid', 'Haddad', 'Nasser', 'Al-Tamari', 'Khalil', 'Mansour', 'Odeh', 'Saadeh', 'Qudah', 'Hamdan', 'Darwish', 'Zaid', 'Shehab', 'Barakat', 'Ayoub']],
  ja: [['Haruto', 'Yuto', 'Sota', 'Ren', 'Kaito', 'Takumi', 'Daiki', 'Shota', 'Riku', 'Kenta', 'Yuma', 'Hiroki', 'Ryo', 'Kazuki', 'Takefusa'],
    ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi', 'Yamamoto', 'Kato', 'Endo', 'Mori', 'Ishii', 'Ueda', 'Kubo']],
  ko: [['Min-jun', 'Seo-jun', 'Ji-ho', 'Hyun-woo', 'Jae-sung', 'Dong-hyun', 'Sung-min', 'Woo-jin', 'Tae-hee', 'Kang-in', 'Jun-ho', 'Hee-chan', 'Young-woo', 'Gyu-sung', 'In-beom'],
    ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim', 'Han', 'Oh', 'Seo', 'Hwang', 'Song']],
  zh: [['Wei', 'Hao', 'Jun', 'Lei', 'Yang', 'Tao', 'Peng', 'Xin', 'Bo', 'Kai', 'Long', 'Ming', 'Rui', 'Yu', 'Zhen'],
    ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Zhao', 'Huang', 'Zhou', 'Wu', 'Xu', 'Sun', 'Ma', 'Hu', 'Guo']],
  af: [['Kwame', 'Sadio', 'Ismaila', 'Yaw', 'Moussa', 'Victor', 'Samuel', 'Emeka', 'Abdou', 'Kofi', 'Mamadou', 'Thomas', 'Ibrahima', 'Bongani', 'Achraf'],
    ['Mensah', 'Diallo', 'Traoré', 'Osei', 'Koné', 'Okafor', 'Ndiaye', 'Boateng', 'Sarr', 'Camara', 'Mahlangu', 'Eto', 'Bamba', 'Asante', 'Kamara']],
  nl: [['Daan', 'Sem', 'Bram', 'Lars', 'Jesse', 'Thijs', 'Ruben', 'Stijn', 'Milan', 'Joey', 'Teun', 'Wout', 'Jurriën', 'Cody', 'Xavi'],
    ['de Jong', 'Jansen', 'de Vries', 'van Dijk', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder', 'Bos', 'Vos', 'Peters', 'Hendriks', 'Dekker']],
};

// ---------------------------------------------------------------- kits
const COLOURS = ['#d62828', '#1d4ed8', '#f8fafc', '#111827', '#facc15', '#16a34a', '#7c3aed', '#ea580c', '#0ea5e9',
  '#be123c', '#065f46', '#9333ea', '#f472b6', '#14b8a6', '#78350f', '#64748b', '#1e3a8a', '#84cc16'];

function kitFor(r, base) {
  const primary = base || pick(r, COLOURS);
  let secondary = pick(r, COLOURS);
  if (secondary === primary) secondary = primary === '#f8fafc' ? '#111827' : '#f8fafc';
  const pattern = pick(r, ['plain', 'plain', 'stripes', 'hoops', 'half', 'sash']);
  return { primary, secondary, shorts: r() < 0.5 ? secondary : '#f8fafc', pattern };
}

// ---------------------------------------------------------------- clubs
// [city, club name, strength]
const LEAGUE_DEFS = [
  { id: 'iberia', name: 'Iberian Primera', region: 'Europe', pool: 'es', country: 'Spain', clubs: [
    ['Madrid', 'Madrid Royals', 89], ['Barcelona', 'Barcelona Blaugrana Stars', 88], ['Madrid', 'Atlético Manzanares', 84], ['Seville', 'Sevilla Giralda', 79],
    ['Bilbao', 'Bilbao Lions', 78], ['Valencia', 'Valencia Bats', 77], ['San Sebastián', 'Donostia Real', 79], ['Villarreal', 'Villarreal Submarines', 78],
    ['Málaga', 'Málaga Costa', 72], ['Vigo', 'Vigo Celtas', 74]] },
  { id: 'albion', name: 'Albion Premier League', region: 'Europe', pool: 'en', country: 'England', clubs: [
    ['Manchester', 'Manchester Sky', 88], ['Liverpool', 'Mersey Reds', 87], ['London', 'North London Cannons', 87], ['London', 'Thames Blues', 82],
    ['Manchester', 'Manchester Devils', 81], ['Newcastle', 'Tyne Magpies', 81], ['Birmingham', 'Villa Claret', 80], ['London', 'Spurs Lane', 80],
    ['Brighton', 'Brighton Gulls', 77], ['Nottingham', 'Forest Reds', 76]] },
  { id: 'azzurra', name: 'Serie Azzurra', region: 'Europe', pool: 'it', country: 'Italy', clubs: [
    ['Milan', 'Milano Nerazzurri', 85], ['Milan', 'Milano Rossoneri', 82], ['Turin', 'Torino Zebras', 82], ['Naples', 'Napoli Vesuvio', 84],
    ['Rome', 'Roma Wolves', 79], ['Rome', 'Lazio Eagles', 78], ['Bergamo', 'Bergamo Goddess', 81], ['Florence', 'Firenze Viola', 77],
    ['Bologna', 'Bologna Towers', 77], ['Genoa', 'Genova Griffins', 72]] },
  { id: 'germania', name: 'Germania Liga', region: 'Europe', pool: 'de', country: 'Germany', clubs: [
    ['Munich', 'München Bavaria', 88], ['Dortmund', 'Dortmund Yellow Wall', 82], ['Leverkusen', 'Leverkusen Werks', 84], ['Leipzig', 'Leipzig Bulls', 80],
    ['Stuttgart', 'Stuttgart Swabians', 78], ['Frankfurt', 'Frankfurt Eagles', 78], ['Freiburg', 'Freiburg Forest', 75], ['Wolfsburg', 'Wolfsburg Wolves', 75],
    ['Berlin', 'Berlin Unioners', 74], ['Bremen', 'Bremen Islanders', 73]] },
  { id: 'hexagone', name: 'Ligue Hexagone', region: 'Europe', pool: 'fr', country: 'France', clubs: [
    ['Paris', 'Paris Saint-Seine', 87], ['Marseille', 'Marseille Phocéens', 79], ['Monaco', 'Monaco Princes', 79], ['Lille', 'Lille Dogues', 78],
    ['Lyon', 'Lyon Gones', 78], ['Nice', 'Nice Aiglons', 76], ['Lens', 'Lens Sang et Or', 76], ['Rennes', 'Rennes Bretons', 75],
    ['Strasbourg', 'Strasbourg Rhine', 73], ['Nantes', 'Nantes Canaries', 72]] },
  { id: 'lusitania', name: 'Lusitania Liga', region: 'Europe', pool: 'pt', country: 'Portugal', clubs: [
    ['Lisbon', 'Lisboa Eagles', 80], ['Lisbon', 'Lisboa Lions', 80], ['Porto', 'Porto Dragons', 80], ['Braga', 'Braga Warriors', 76],
    ['Guimarães', 'Vitória Conquistadores', 73], ['Amsterdam', 'Amsterdam Ajacieden', 79], ['Eindhoven', 'Eindhoven Lights', 79], ['Rotterdam', 'Rotterdam Harbour', 78]] },
  { id: 'jordan', name: 'Jordan Pro League', region: 'Asia', pool: 'ar', country: 'Jordan', clubs: [
    ['Amman', 'Amman Faisaly Knights', 70], ['Amman', 'Amman Wehdat Greens', 70], ['Irbid', 'Irbid Hussein Falcons', 69], ['Amman', 'Ramtha Northern Stars', 66],
    ['Zarqa', 'Zarqa Blue Wave', 64], ['Aqaba', 'Aqaba Red Sea', 63], ['Salt', 'Salt Mountaineers', 62], ['Mafraq', 'Mafraq Desert Foxes', 61]] },
  { id: 'gulf', name: 'Gulf Pro League', region: 'Asia', pool: 'ar', country: 'Saudi Arabia', clubs: [
    ['Riyadh', 'Riyadh Crescent', 82], ['Riyadh', 'Riyadh Victory', 81], ['Jeddah', 'Jeddah Tigers', 80], ['Jeddah', 'Jeddah Nobles', 78],
    ['Doha', 'Doha Sadd Falcons', 74], ['Abu Dhabi', 'Abu Dhabi Emirates', 74], ['Dammam', 'Dammam Ettifaq', 72], ['Dubai', 'Dubai Shabab', 71]] },
  { id: 'asiapro', name: 'East Asia Pro League', region: 'Asia', pool: 'ja', country: 'Japan', clubs: [
    ['Yokohama', 'Yokohama Marinos', 74], ['Kawasaki', 'Kawasaki Frontier', 74], ['Kashima', 'Kashima Antlers', 73], ['Seoul', 'Seoul Ulsan Tigers', 73],
    ['Jeonju', 'Jeonbuk Motors', 72], ['Shanghai', 'Shanghai Harbour', 71], ['Guangzhou', 'Guangzhou Pearl', 70], ['Urawa', 'Urawa Red Diamonds', 72]] },
  { id: 'americas', name: 'Americas Primera', region: 'Americas', pool: 'pt', country: 'Brazil', clubs: [
    ['Rio de Janeiro', 'Rio Flamingos', 79], ['São Paulo', 'São Paulo Palms', 79], ['Buenos Aires', 'Buenos Aires River Plate Sharks', 79], ['Buenos Aires', 'La Boca Xeneizes', 77],
    ['Belo Horizonte', 'Belo Roosters', 75], ['Montevideo', 'Montevideo Nacionales', 74], ['Mexico City', 'México Águilas', 75], ['Monterrey', 'Monterrey Rayados', 75],
    ['Los Angeles', 'Los Angeles Galaxy Stars', 73], ['Miami', 'Miami Herons', 74]] },
  { id: 'africa', name: 'Africa Super League', region: 'Africa', pool: 'af', country: 'Africa', clubs: [
    ['Cairo', 'Cairo Red Devils', 76], ['Cairo', 'Cairo White Knights', 73], ['Casablanca', 'Casablanca Wydad Eagles', 74], ['Casablanca', 'Casablanca Raja Greens', 73],
    ['Tunis', 'Tunis Espérance', 72], ['Pretoria', 'Pretoria Sundowns', 74], ['Algiers', 'Algiers Mouloudia', 70], ['Kinshasa', 'Kinshasa Leopards', 69]] },
];

// [country, code, strength, pool, primary kit colour]
export const NATIONS = [
  ['USA', 'USA', 79, 'en', '#1e3a8a'], ['Mexico', 'MEX', 78, 'es', '#16a34a'], ['Canada', 'CAN', 76, 'en', '#d62828'],
  ['Japan', 'JPN', 80, 'ja', '#1d4ed8'], ['IR Iran', 'IRN', 76, 'ar', '#f8fafc'], ['Uzbekistan', 'UZB', 72, 'ar', '#f8fafc'], ['Korea Republic', 'KOR', 77, 'ko', '#d62828'],
  ['Jordan', 'JOR', 73, 'ar', '#f8fafc'], ['Australia', 'AUS', 75, 'en', '#facc15'], ['Qatar', 'QAT', 71, 'ar', '#7f1d1d'], ['Saudi Arabia', 'KSA', 73, 'ar', '#16a34a'],
  ['Morocco', 'MAR', 83, 'af', '#d62828'], ['Tunisia', 'TUN', 74, 'af', '#d62828'], ['Egypt', 'EGY', 76, 'ar', '#d62828'], ['Algeria', 'ALG', 76, 'af', '#f8fafc'],
  ['Ghana', 'GHA', 74, 'af', '#f8fafc'], ['Cabo Verde', 'CPV', 70, 'af', '#1d4ed8'], ['South Africa', 'RSA', 72, 'af', '#facc15'], ['Senegal', 'SEN', 80, 'af', '#f8fafc'],
  ["Côte d'Ivoire", 'CIV', 78, 'af', '#ea580c'], ['Argentina', 'ARG', 88, 'es', '#7dd3fc'], ['Brazil', 'BRA', 87, 'pt', '#facc15'], ['Ecuador', 'ECU', 77, 'es', '#facc15'],
  ['Uruguay', 'URU', 80, 'es', '#38bdf8'], ['Colombia', 'COL', 81, 'es', '#facc15'], ['Paraguay', 'PAR', 75, 'es', '#d62828'], ['New Zealand', 'NZL', 68, 'en', '#f8fafc'],
  ['England', 'ENG', 86, 'en', '#f8fafc'], ['France', 'FRA', 88, 'fr', '#1e3a8a'], ['Croatia', 'CRO', 81, 'it', '#d62828'], ['Norway', 'NOR', 80, 'de', '#d62828'],
  ['Portugal', 'POR', 86, 'pt', '#991b1b'], ['Netherlands', 'NED', 84, 'nl', '#ea580c'], ['Germany', 'GER', 85, 'de', '#f8fafc'], ['Switzerland', 'SUI', 79, 'de', '#d62828'],
  ['Spain', 'ESP', 88, 'es', '#be123c'], ['Belgium', 'BEL', 82, 'nl', '#b91c1c'], ['Austria', 'AUT', 79, 'de', '#d62828'], ['Scotland', 'SCO', 76, 'en', '#1e3a8a'],
  ['Italy', 'ITA', 83, 'it', '#1d4ed8'], ['Türkiye', 'TUR', 79, 'ar', '#d62828'], ['Czechia', 'CZE', 76, 'de', '#d62828'], ['Sweden', 'SWE', 77, 'de', '#facc15'],
  ['Panama', 'PAN', 71, 'es', '#d62828'], ['Haiti', 'HAI', 66, 'fr', '#1d4ed8'], ['Curaçao', 'CUW', 66, 'nl', '#1d4ed8'], ['Iraq', 'IRQ', 72, 'ar', '#16a34a'], ['DR Congo', 'COD', 72, 'af', '#0ea5e9'],
];

// ---------------------------------------------------------------- players
const ROLE_SLOTS = ['GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'FW'];

function makePlayer(r, pool, role, strength, number) {
  const [firsts, lasts] = NAMES[pool] || NAMES.en;
  const name = `${pick(r, firsts)[0]}. ${pick(r, lasts)}`;
  const v = (bias) => Math.max(35, Math.min(97, Math.round(strength + bias + (r() - 0.5) * 14)));
  const a = {
    GK: { pace: -18, shooting: -30, passing: -10, dribbling: -22, defending: -15, physical: 0, keeping: 6 },
    DF: { pace: -2, shooting: -18, passing: -5, dribbling: -10, defending: 6, physical: 4, keeping: -50 },
    MF: { pace: 0, shooting: -4, passing: 5, dribbling: 3, defending: -6, physical: -2, keeping: -50 },
    FW: { pace: 4, shooting: 6, passing: -3, dribbling: 4, defending: -25, physical: 0, keeping: -50 },
  }[role];
  const attrs = {};
  for (const k of Object.keys(a)) attrs[k] = v(a[k]);
  const skin = pick(r, ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0704f', '#6b4226']);
  const hair = pick(r, ['#1f1300', '#3b2414', '#6b4423', '#d4a373', '#111111', '#a52a2a', '#e5e5e5']);
  const overall = role === 'GK' ? Math.round((attrs.keeping * 3 + attrs.physical) / 4)
    : Math.round((attrs.pace + attrs.shooting + attrs.passing + attrs.dribbling + attrs.defending + attrs.physical) / 6 + (role === 'FW' ? 2 : 0));
  return { name, role, number, attrs, overall, skin, hair };
}

function makeSquad(seed, pool, strength) {
  const r = rng(seed);
  const used = new Set();
  return ROLE_SLOTS.map((role, i) => {
    let n = [1, 12, 2, 3, 4, 5, 15, 22, 6, 8, 10, 14, 16, 18, 9, 7, 11, 19][i];
    while (used.has(n)) n++;
    used.add(n);
    return makePlayer(r, pool, role, strength, n);
  });
}

function shortCode(name) {
  const words = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').split(/\s+/).filter(Boolean);
  if (words.length >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  return (words[0] || 'TEA').slice(0, 3).toUpperCase();
}

let _teams = null;
export function allTeams() {
  if (_teams) return _teams;
  const teams = [];
  for (const L of LEAGUE_DEFS) {
    for (const [city, name, strength] of L.clubs) {
      const id = 'c-' + hash(L.id + name).toString(36);
      const r = rng(id);
      teams.push({ id, name, short: shortCode(name), city, league: L.id, region: L.region, kind: 'club', strength,
        kit: kitFor(r), away: kitFor(r, '#f8fafc'), squad: makeSquad(id, L.pool, strength - 4) });
    }
  }
  for (const [country, code, strength, pool, colour] of NATIONS) {
    const id = 'n-' + code.toLowerCase();
    const r = rng(id);
    teams.push({ id, name: country, short: code, city: country, league: 'nations', region: 'World', kind: 'nation', strength,
      kit: kitFor(r, colour), away: kitFor(r), squad: makeSquad(id, pool, strength - 4) });
  }
  // Two "street" crews for the 5-a-side cage, so a quick street game has no club baggage.
  for (const [nm, st, col, pool] of [['Downtown Kings', 80, '#f97316', 'en'], ['Rooftop Ballers', 80, '#22d3ee', 'pt'], ['Harbour Crew', 78, '#a3e635', 'es'], ['Old Town Five', 78, '#e879f9', 'ar']]) {
    const id = 's-' + hash(nm).toString(36);
    teams.push({ id, name: nm, short: shortCode(nm), city: 'Street', league: 'street', region: 'Street', kind: 'street', strength: st,
      kit: kitFor(rng(id), col), away: kitFor(rng(id + 'a'), '#111827'), squad: makeSquad(id, pool, st - 4) });
  }
  _teams = teams;
  return teams;
}
export function teamById(id) { return allTeams().find((t) => t.id === id) || null; }
export function teamsOf(leagueId) { return allTeams().filter((t) => t.league === leagueId); }
export function leagues() { return LEAGUE_DEFS.map(({ id, name, region, country }) => ({ id, name, region, country })); }

// ---------------------------------------------------------------- competitions
const top = (leagueIds, n) => leagueIds.flatMap((l) => teamsOf(l).slice().sort((a, b) => b.strength - a.strength).slice(0, n)).map((t) => t.id);
const nationsBy = (codes) => codes.map((c) => 'n-' + c.toLowerCase());

export function competitions() {
  const list = LEAGUE_DEFS.map((L) => ({ id: 'league-' + L.id, name: L.name, kind: 'league', region: L.region, teams: teamsOf(L.id).map((t) => t.id), rounds: 1 }));
  list.push(
    { id: 'ecc', name: 'European Champions Cup', kind: 'groups', region: 'Europe', teams: top(['iberia', 'albion', 'azzurra', 'germania', 'hexagone', 'lusitania'], 3).slice(0, 16), groups: 4, advance: 2 },
    { id: 'euro-trophy', name: 'European Challenge Trophy', kind: 'knockout', region: 'Europe', teams: LEAGUE_DEFS.filter((l) => l.region === 'Europe').flatMap((l) => teamsOf(l.id).slice(3, 5).map((t) => t.id)).slice(0, 8) },
    { id: 'acc', name: 'Asian Champions Cup', kind: 'groups', region: 'Asia', teams: top(['gulf', 'asiapro', 'jordan'], 6).slice(0, 16), groups: 4, advance: 2 },
    { id: 'arab-cup', name: 'Arab Champions Cup', kind: 'knockout', region: 'Asia', teams: [...top(['gulf'], 4), ...top(['jordan'], 2), ...teamsOf('africa').filter((t) => /Cairo|Casablanca/.test(t.city)).slice(0, 2).map((t) => t.id)] },
    { id: 'afcc', name: 'African Champions Cup', kind: 'knockout', region: 'Africa', teams: top(['africa'], 8) },
    { id: 'amcc', name: 'Americas Champions Cup', kind: 'knockout', region: 'Americas', teams: top(['americas'], 8) },
    { id: 'club-world', name: 'Club World Series', kind: 'knockout', region: 'World', teams: [...top(['iberia', 'albion', 'germania', 'azzurra'], 1), ...top(['americas'], 1), ...top(['gulf'], 1), ...top(['africa'], 1), ...top(['asiapro'], 1)] },
    { id: 'wnc-2026', name: 'World Nations Cup 2026', kind: 'groups', region: 'World', teams: NATIONS.slice(0, 48).map((n) => 'n-' + n[1].toLowerCase()), groups: 12, advance: 2, bestThirds: 8 },
    { id: 'euro-nations', name: 'European Nations Championship', kind: 'groups', region: 'Europe',
      teams: nationsBy(['ENG', 'FRA', 'CRO', 'NOR', 'POR', 'NED', 'GER', 'SUI', 'ESP', 'BEL', 'AUT', 'SCO', 'ITA', 'TUR', 'CZE', 'SWE']), groups: 4, advance: 2 },
    { id: 'asian-nations', name: 'Asian Nations Cup', kind: 'groups', region: 'Asia',
      teams: nationsBy(['JPN', 'IRN', 'UZB', 'KOR', 'JOR', 'AUS', 'QAT', 'KSA', 'IRQ', 'EGY', 'TUN', 'MAR']), groups: 3, advance: 2, bestThirds: 2 },
    { id: 'africa-nations', name: 'Africa Nations Cup', kind: 'groups', region: 'Africa',
      teams: nationsBy(['MAR', 'TUN', 'EGY', 'ALG', 'GHA', 'CPV', 'RSA', 'SEN', 'CIV', 'COD', 'NZL', 'HAI']), groups: 3, advance: 2, bestThirds: 2 },
    { id: 'americas-nations', name: 'Americas Nations Cup', kind: 'groups', region: 'Americas',
      teams: nationsBy(['ARG', 'BRA', 'ECU', 'URU', 'COL', 'PAR', 'USA', 'MEX', 'CAN', 'PAN', 'HAI', 'CUW', 'NZL', 'JPN', 'KOR', 'AUS']), groups: 4, advance: 2 },
    { id: 'street-cup', name: 'Street Cage Cup', kind: 'knockout', region: 'Street', teams: allTeams().filter((t) => t.kind === 'street').map((t) => t.id), size: 5 },
  );
  return list;
}
export function competitionById(id) { return competitions().find((c) => c.id === id) || null; }

// ---------------------------------------------------------------- formations
// [x, y]: x from own goal (0) towards the opponent's (1), y across (0..1). GK first.
export const FORMATIONS = {
  11: {
    '4-4-2': [[0.03, 0.5], [0.2, 0.14], [0.17, 0.38], [0.17, 0.62], [0.2, 0.86], [0.4, 0.14], [0.36, 0.4], [0.36, 0.6], [0.4, 0.86], [0.53, 0.4], [0.53, 0.6]],
    '4-3-3': [[0.03, 0.5], [0.2, 0.14], [0.17, 0.38], [0.17, 0.62], [0.2, 0.86], [0.36, 0.3], [0.32, 0.5], [0.36, 0.7], [0.52, 0.17], [0.56, 0.5], [0.52, 0.83]],
    '4-2-3-1': [[0.03, 0.5], [0.2, 0.14], [0.17, 0.38], [0.17, 0.62], [0.2, 0.86], [0.31, 0.4], [0.31, 0.6], [0.45, 0.2], [0.46, 0.5], [0.45, 0.8], [0.57, 0.5]],
    '3-5-2': [[0.03, 0.5], [0.18, 0.28], [0.16, 0.5], [0.18, 0.72], [0.39, 0.09], [0.35, 0.35], [0.32, 0.5], [0.35, 0.65], [0.39, 0.91], [0.53, 0.4], [0.53, 0.6]],
    '5-3-2': [[0.03, 0.5], [0.24, 0.08], [0.18, 0.3], [0.16, 0.5], [0.18, 0.7], [0.24, 0.92], [0.37, 0.3], [0.35, 0.5], [0.37, 0.7], [0.52, 0.4], [0.52, 0.6]],
  },
  7: {
    '2-3-1': [[0.04, 0.5], [0.2, 0.32], [0.2, 0.68], [0.37, 0.18], [0.34, 0.5], [0.37, 0.82], [0.54, 0.5]],
    '3-2-1': [[0.04, 0.5], [0.2, 0.2], [0.18, 0.5], [0.2, 0.8], [0.37, 0.35], [0.37, 0.65], [0.54, 0.5]],
    '2-2-2': [[0.04, 0.5], [0.2, 0.32], [0.2, 0.68], [0.36, 0.3], [0.36, 0.7], [0.54, 0.38], [0.54, 0.62]],
  },
  5: {
    '2-1-1': [[0.05, 0.5], [0.24, 0.3], [0.24, 0.7], [0.4, 0.5], [0.56, 0.5]],
    '1-2-1': [[0.05, 0.5], [0.22, 0.5], [0.38, 0.22], [0.38, 0.78], [0.56, 0.5]],
  },
};
export const DEFAULT_FORMATION = { 11: '4-3-3', 7: '2-3-1', 5: '2-1-1' };

// Pitch per team size. A 5-a-side game is a FIFA-Street-style cage: boards on every
// side that the ball bounces off, small goals, no throw-ins or corners.
export const PITCHES = {
  11: { L: 105, W: 68, goal: 7.32, goalH: 2.44, walls: false, box: 16.5, boxW: 40.3 },
  7: { L: 64, W: 44, goal: 5, goalH: 2, walls: false, box: 11, boxW: 26 },
  5: { L: 40, W: 24, goal: 3, goalH: 1.8, walls: true, box: 6, boxW: 12 },
};

// The players to field: the best for each slot of the formation.
export function lineup(team, size, formation) {
  const shape = FORMATIONS[size][formation] || FORMATIONS[size][DEFAULT_FORMATION[size]];
  const pool = team.squad.slice();
  const take = (role) => {
    let best = -1;
    for (let i = 0; i < pool.length; i++) if (pool[i].role === role && (best < 0 || pool[i].overall > pool[best].overall)) best = i;
    if (best < 0) best = pool.reduce((b, p, i) => (p.role !== 'GK' && (b < 0 || p.overall > pool[b].overall) ? i : b), -1);
    return pool.splice(best, 1)[0];
  };
  return shape.map(([x], i) => {
    if (i === 0) return take('GK');
    return take(x < 0.25 ? 'DF' : x < 0.46 ? 'MF' : 'FW');
  });
}

// ---------------------------------------------------------------- stadiums
export function stadiumFor(team, seed = '') {
  const r = rng((team ? team.id : 'neutral') + seed);
  const names = ['Arena', 'Stadium', 'Park', 'Ground', 'Dome', 'Field'];
  const owner = team ? team.city : 'International';
  return {
    name: team && team.kind === 'street' ? `${pick(r, ['Neon', 'Harbour', 'Rooftop', 'Underpass'])} Cage` : `${owner} ${pick(r, ['Municipal', 'Grand', 'National', 'Central', 'Royal', 'New'])} ${pick(r, names)}`,
    stand: pick(r, ['#334155', '#1f2937', '#3f3f46', '#1e293b', '#44403c']),
    seat: team ? team.kit.primary : '#64748b',
    roof: r() < 0.5,
    tiers: 2 + Math.floor(r() * 2),
  };
}

export const DIFFICULTIES = [
  { id: 'beginner', name: 'Beginner', react: 0.55, skill: 0.62, speed: 0.86, keeper: 0.55 },
  { id: 'amateur', name: 'Amateur', react: 0.4, skill: 0.74, speed: 0.92, keeper: 0.68 },
  { id: 'pro', name: 'Professional', react: 0.28, skill: 0.84, speed: 0.97, keeper: 0.78 },
  { id: 'world', name: 'World Class', react: 0.18, skill: 0.92, speed: 1.0, keeper: 0.86 },
  { id: 'legend', name: 'Legendary', react: 0.1, skill: 1.0, speed: 1.04, keeper: 0.93 },
];
export const difficultyById = (id) => DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[2];
