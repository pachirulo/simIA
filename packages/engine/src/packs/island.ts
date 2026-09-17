import type { PlaceKind } from "../types.ts";

/**
 * Valdearenas as data. A world pack is places (with positions the client draws from), roads (exits, made two-way on load),
 * jobs, and the float each unowned business starts with. Add a district, a job, or a whole village by adding a pack.
 */
export interface PlaceSpec { id: string; name: string; kind: PlaceKind; district: string; sprite: string; x: number; y: number; exits: string[]; sells?: { item: string; base: number }[]; beds?: { price: number; capacity: number }; stock?: Record<string, number> }
/** What a paid shift makes at a place, from what, and in which seasons. */
export interface ProduceSpec { place: string; makes: string; qty: number; needs?: { item: string; qty: number }; seasons?: string[]; /** only in these months (1 to 12), for a crop with a short season */ months?: number[] }
/** A day the whole village keeps: a feast at the square, everyone fed. Month and day of the village's year. */
export interface FeastSpec { name: string; month: number; day: number; place: string }
/** The morning cart: what moves from where to where each day, and what the buyer's till pays for it. */
export interface SupplySpec { from: string; to: string; item: string; qty: number; price: number; /** the cart fills the buyer's shelf only up to this much */ upTo?: number }
/** What outside merchants pay per unit for surplus leaving Valdearenas. */
export interface ExportSpec { item: string; price: number; /** how much the village keeps back before the rest is sold outside */ keep: number }
export interface JobSpec { id: string; title: string; place: string; wage: number; hours: [number, number]; slots: number }
export interface WorldPack { id: string; name: string; size: { w: number; h: number }; places: PlaceSpec[]; jobs: JobSpec[]; float: Record<string, number>; produce: ProduceSpec[]; supply: SupplySpec[]; exports: ExportSpec[]; feasts: FeastSpec[] }

const P = (id: string, name: string, kind: PlaceKind, district: string, sprite: string, x: number, y: number, exits: string[], extra: Partial<PlaceSpec> = {}): PlaceSpec => ({ id, name, kind, district, sprite, x, y, exits, ...extra });

export const ISLAND: WorldPack = {
  // Keep the internal id for compatibility with engine/runtime references.
  id: "island", name: "Valdearenas", size: { w: 3000, h: 1800 },
  places: [
    // Ribera
    P("harbor", "el embarcadero del río", "harbor", "harbor", "harbor-office", 560, 1180, ["inn", "market", "chandlery", "boatshed", "fishhouse", "coast"]),
    P("inn", "el Mesón del Puente", "inn", "harbor", "inn", 820, 1020, ["harbor", "market"], { sells: [{ item: "soup", base: 2 }, { item: "bread", base: 1 }], beds: { price: 4, capacity: 6 } , stock: { bread: 6, soup: 8, fish: 4 } }),
    P("chandlery", "la cordelería y aceitería", "shop", "harbor", "chandlery", 880, 1280, ["harbor", "market"], { sells: [{ item: "rope", base: 3 }, { item: "lamp oil", base: 2 }], beds: { price: 3, capacity: 1 } }),
    P("boatshed", "el cobertizo de barcas", "home", "harbor", "boatshed", 420, 1400, ["harbor"], { beds: { price: 0, capacity: 8 } }),
    P("fishhouse", "el saladero de pescado", "workplace", "harbor", "fishhouse", 300, 1000, ["harbor"], { sells: [{ item: "fish", base: 1 }] , stock: { fish: 12 } }),
    // Casco de la aldea
    P("market", "la plaza del mercado", "market", "old town", "stall", 1180, 1100, ["harbor", "inn", "bakery", "chandlery", "tavern", "council", "hill", "chapel", "smithy", "lane"], { sells: [{ item: "bread", base: 1 }, { item: "apples", base: 1 }, { item: "fish", base: 1 }] , stock: { bread: 10, apples: 8, fish: 8 } }),
    P("bakery", "el Horno de los Ibáñez", "workplace", "old town", "bakery", 1160, 840, ["market"], { sells: [{ item: "bread", base: 1 }] , stock: { bread: 20, flour: 24 } }),
    P("tavern", "la Taberna del Olmo", "public", "old town", "tavern", 1500, 1200, ["market", "lane"], { sells: [{ item: "drink", base: 1 }] }),
    P("council", "la Casa del Concejo", "civic", "old town", "council", 1520, 880, ["market", "chapel"]),
    P("chapel", "la ermita de San Roque", "public", "old town", "chapel", 1820, 760, ["council", "market", "hill"]),
    P("smithy", "la herrería", "workplace", "old town", "smithy", 900, 760, ["market"], { sells: [{ item: "nails", base: 2 }] , stock: { nails: 10 } }),
    P("lane", "la calle de los Cordeleros", "public", "old town", "lamp", 1420, 1420, ["market", "tavern", "lane-1", "lane-2"]),
    P("lane-1", "un solar vacío en la calle de los Cordeleros", "plot", "old town", "plot", 1300, 1560, ["lane"]),
    P("lane-2", "el solar de la esquina en la calle de los Cordeleros", "plot", "old town", "plot", 1620, 1520, ["lane"]),
    // Loma y tierras de labor
    P("hill", "el camino de la loma", "public", "hill", "well", 2000, 1000, ["market", "chapel", "mill", "fields", "orchard", "pinewood"]),
    P("mill", "el Molino de los Molina", "workplace", "hill", "mill", 2180, 640, ["hill", "fields"], { stock: { flour: 30, grain: 12 } }),
    P("fields", "las tierras de labor", "workplace", "hill", "field", 2380, 1000, ["hill", "mill", "orchard"], { stock: { grain: 90 } }),
    P("orchard", "el huerto viejo", "workplace", "hill", "orchard", 2360, 1320, ["fields", "hill", "shore"], { sells: [{ item: "apples", base: 1 }] , stock: { apples: 20 } }),
    // Ribera norte
    P("coast", "el camino de la ribera", "public", "north shore", "searocks", 520, 620, ["harbor", "cove", "shore"]),
    P("cove", "el remanso del río", "public", "north shore", "rowboat", 300, 380, ["coast", "lighthouse"]),
    P("shore", "la ribera norte", "public", "north shore", "bench", 1000, 440, ["coast", "shore-1", "shore-2", "shore-3", "pinewood", "orchard"]),
    P("shore-1", "un solar sobre el remanso", "plot", "north shore", "plot", 760, 300, ["shore"]),
    P("shore-2", "un solar junto a la ribera norte", "plot", "north shore", "plot", 1060, 220, ["shore"]),
    P("shore-3", "el último solar antes del pinar", "plot", "north shore", "plot", 1380, 300, ["shore"]),
    // Pinar y cantera
    P("pinewood", "el pinar comunal", "wild", "pinewood", "tree-large", 1900, 380, ["shore", "hill", "sawpit", "quarry"], { stock: { timber: 10 } }),
    P("sawpit", "el aserradero", "workplace", "pinewood", "sawpit", 1700, 520, ["pinewood", "wood-1"], { sells: [{ item: "timber", base: 3 }] , stock: { planks: 24, timber: 8 } }),
    P("wood-1", "un claro del pinar", "plot", "pinewood", "plot", 1620, 260, ["sawpit", "pinewood"]),
    P("quarry", "la cantera vieja", "wild", "pinewood", "quarry", 2300, 260, ["pinewood", "lighthouse", "point-1"], { stock: { stone: 10 } }),
    P("lighthouse", "la torre de vigía", "public", "pinewood", "lighthouse", 2660, 420, ["quarry", "cove"]),
    P("point-1", "el solar junto a la torre", "plot", "pinewood", "plot", 2560, 700, ["quarry", "lighthouse"]),
  ],
  jobs: [
    { id: "bakery.cook", title: "panadero del horno", place: "bakery", wage: 3, hours: [6, 12], slots: 2 },
    { id: "inn.help", title: "mozo del mesón", place: "inn", wage: 2, hours: [8, 16], slots: 2 },
    { id: "fields.hand", title: "jornalero del campo", place: "fields", wage: 2, hours: [7, 15], slots: 4 },
    { id: "mill.hand", title: "ayudante de molinero", place: "mill", wage: 3, hours: [7, 14], slots: 1 },
    { id: "harbor.dock", title: "mozo del embarcadero", place: "harbor", wage: 2, hours: [6, 12], slots: 2 },
    { id: "chandlery.clerk", title: "dependiente de la cordelería", place: "chandlery", wage: 2, hours: [9, 17], slots: 1 },
    { id: "tavern.keep", title: "ayudante de taberna", place: "tavern", wage: 2, hours: [16, 23], slots: 1 },
    { id: "fishhouse.gutter", title: "salador de pescado", place: "fishhouse", wage: 2, hours: [5, 11], slots: 2 },
    { id: "smithy.help", title: "ayudante de herrero", place: "smithy", wage: 3, hours: [8, 16], slots: 1 },
    { id: "orchard.picker", title: "recolector del huerto", place: "orchard", wage: 2, hours: [7, 14], slots: 3 },
    { id: "pinewood.cutter", title: "leñador", place: "pinewood", wage: 3, hours: [7, 15], slots: 2 },
    { id: "sawpit.sawyer", title: "aserrador", place: "sawpit", wage: 3, hours: [8, 16], slots: 1 },
    { id: "quarry.hand", title: "cantero", place: "quarry", wage: 3, hours: [7, 14], slots: 2 },
  ],
  float: { inn: 60, bakery: 40, fields: 40, mill: 40, harbor: 40, chandlery: 30, tavern: 30, fishhouse: 30, smithy: 30, orchard: 30, pinewood: 30, sawpit: 30, quarry: 30, market: 20 },
  // A paid shift produces goods. Keep item ids stable because they are engine contracts.
  produce: [
    { place: "fields", makes: "grain", qty: 6, seasons: ["summer", "autumn"] }, { place: "fields", makes: "grain", qty: 3, seasons: ["spring"] }, { place: "fields", makes: "grain", qty: 1, seasons: ["winter"] },
    // Lavender is the seasonal cash crop sold to travelling merchants.
    { place: "fields", makes: "lavender", qty: 4, months: [6, 7] }, { place: "orchard", makes: "lavender", qty: 2, months: [6, 7] },
    { place: "mill", makes: "flour", qty: 6, needs: { item: "grain", qty: 6 } },
    { place: "bakery", makes: "bread", qty: 24, needs: { item: "flour", qty: 2 } },
    { place: "fishhouse", makes: "fish", qty: 12 }, { place: "orchard", makes: "apples", qty: 5, seasons: ["summer", "autumn"] }, { place: "orchard", makes: "apples", qty: 1, seasons: ["spring"] },
    { place: "pinewood", makes: "timber", qty: 3 }, { place: "sawpit", makes: "planks", qty: 4, needs: { item: "timber", qty: 4 } },
    { place: "smithy", makes: "nails", qty: 2 }, { place: "quarry", makes: "stone", qty: 2 },
    // Counters and workshops transform or prepare what the village already produces.
    { place: "inn", makes: "soup", qty: 8, needs: { item: "fish", qty: 2 } }, { place: "tavern", makes: "drink", qty: 4 },
    { place: "chandlery", makes: "rope", qty: 1 }, { place: "chandlery", makes: "lamp oil", qty: 1 },
  ],
  // Local feast days.
  feasts: [{ name: "la Fiesta de Valdearenas", month: 7, day: 24, place: "market" }, { name: "la Cena de la Cosecha", month: 10, day: 5, place: "market" }, { name: "la Hoguera de Invierno", month: 12, day: 21, place: "harbor" }],
  // The six o'clock cart.
  supply: [
    { from: "fields", to: "mill", item: "grain", qty: 6, price: 1, upTo: 12 }, { from: "mill", to: "bakery", item: "flour", qty: 6, price: 2, upTo: 8 },
    { from: "bakery", to: "market", item: "bread", qty: 8, price: 1, upTo: 10 }, { from: "bakery", to: "inn", item: "bread", qty: 4, price: 1, upTo: 6 },
    { from: "orchard", to: "market", item: "apples", qty: 5, price: 1, upTo: 8 }, { from: "fishhouse", to: "market", item: "fish", qty: 5, price: 1, upTo: 8 },
    { from: "pinewood", to: "sawpit", item: "timber", qty: 4, price: 2, upTo: 8 }, { from: "fishhouse", to: "inn", item: "fish", qty: 4, price: 1, upTo: 8 },
  ],
  // Travelling merchants buy the village's surplus and bring coin back into Valdearenas.
  exports: [
    { item: "grain", price: 1, keep: 60 }, { item: "flour", price: 2, keep: 24 }, { item: "bread", price: 1, keep: 12 }, { item: "fish", price: 1, keep: 12 }, { item: "apples", price: 1, keep: 12 },
    { item: "lavender", price: 3, keep: 0 }, { item: "timber", price: 2, keep: 12 }, { item: "planks", price: 3, keep: 24 }, { item: "nails", price: 2, keep: 8 }, { item: "stone", price: 2, keep: 8 },
  ],
};
