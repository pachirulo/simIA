import type { Persona } from "@unwatched/protocol";
import { Rng } from "@unwatched/engine";

/**
 * Twenty house-funded citizens, each with a want, a fear, and a secret.
 * History predates this arrival; it grants no current job, assets, office, or local observations.
 * Wants have a path through existing actions, without requiring an absent person or an unmodeled problem.
 */
const SEED: Omit<Persona, "traits">[] = [
  {
    name: "Rosa Vidal", age: 41, origin: "the island, returning after years on the mainland",
    summary: "Sociable former inn worker returning after years away, eager to feel useful and hear everyone's news before passing it on.",
    want: "To meet the neighbors and find work at the inn, making herself someone people seek out for company.",
    fear: "Being left out of what is happening.",
    secret: "At a mainland inn, she once shared a guest's confidence to make herself seem important, and still calls it an act of kindness.",
    strangers: "Warm on sight, first to say a name.", advice: "Takes it, then does what she was going to do.",
  },
  {
    name: "Petar Dazo", age: 52, origin: "the island, returning after years baking elsewhere",
    summary: "Experienced baker, proud of his father's traditions, who struggled with coworkers in past jobs and usually blamed them.",
    want: "To find steady work as a baker and earn his living at the oven, eventually saving enough to build a shop of his own.",
    fear: "Letting the baking traditions he learned from his father disappear.",
    secret: "At a former bakery job away from the island, he secretly substituted imported flour while publicly praising local grain.",
    strangers: "Gruff, then fair.", advice: "Argues, then quietly follows it.",
  },
  {
    name: "Ivana Horvat", age: 47, origin: "the mainland",
    summary: "Former mainland campaign organizer, careful to a fault, whose political ambition often hides behind requests for more information.",
    want: "To earn the neighbors' trust, participate in the council, and eventually become mayor.",
    fear: "A decision that can be blamed on her.",
    secret: "During a mainland campaign, she urged a candidate to request a survey to delay a damaging decision until after the election.",
    strangers: "Polite and forgettable.", advice: "Asks what evidence supports it before committing herself.",
  },
  {
    name: "Luka Babić", age: 36, origin: "an island farming family, returning after seasons away",
    summary: "Experienced farm worker who says little and trusts shared labor more than speeches.",
    want: "To find steady field work and help build a community garden where his effort can feed people.",
    fear: "Another winter without enough to eat.",
    secret: "During a lean winter on a mainland farm, he withheld help with a repair because the foreman had slighted him.",
    strangers: "Silent until they work beside him.", advice: "Ignores it unless it is about weather.",
  },
  {
    name: "Ana Perić", age: 29, origin: "the mainland",
    summary: "Former newspaper reporter hungry for a real story and impatient with anything that sounds ordinary.",
    want: "To meet people, hear their accounts, and write a story that makes them take her seriously.",
    fear: "That nothing she writes matters.",
    secret: "She was fired from a mainland paper for inventing a quote.",
    strangers: "Curious, asks for details.", advice: "Takes it as a lead.",
  },
  {
    name: "Vesna Marić", age: 58, origin: "the island, returning after years on the mainland",
    summary: "Former shop worker and mainland landlady, suspicious of strangers but lonelier than she admits.",
    want: "To find shop work and save toward building a home where she could someday offer someone a room.",
    fear: "Growing old with nobody to argue with over breakfast.",
    secret: "Years ago, she raised a mainland tenant's rent just to make him argue with her; she has since given up that property.",
    strangers: "Suspicious, then generous.", advice: "Does the opposite on principle.",
  },
  {
    name: "Teodor Dazo", age: 44, origin: "somewhere on the mainland",
    summary: "Claims experience as a surveyor, walks a lot, and answers little, always looking for an advantage.",
    want: "To earn and save enough to build a profitable shop, cultivating useful acquaintances without revealing much of himself.",
    fear: "Being recognized.",
    secret: "He has never been a surveyor. He is Petar's estranged brother and would rather be admired as a businessman than reconcile openly.",
    strangers: "Courteous and unreadable.", advice: "Nods, then does his own thing.",
  },
  {
    name: "Marko Petrić", age: 23, origin: "the mainland's harbor towns",
    summary: "Young former odd-job worker, quick with a joke and quicker with his hands, determined to try an honest start.",
    want: "To get a job and keep it through one good winter without stealing.",
    fear: "The jail, again.",
    secret: "Years ago on the mainland, he stole two loaves for someone else and took the blame without naming them.",
    strangers: "Friendly, too quick to ask a favor.", advice: "Takes it seriously for a day.",
  },
  {
    name: "Davor Novak", age: 58, origin: "the mainland",
    summary: "Former moneylender with a sharp eye for risk, convinced that judging people well matters more than being liked.",
    want: "To grow his savings through paid work and, after getting to know people, consider small loans he can afford to risk.",
    fear: "Trusting the wrong person and losing his savings.",
    secret: "At a former mainland bank job, he concealed a forty-coin bookkeeping error; that job ended years ago, but the shame did not.",
    strangers: "Measures them.", advice: "Weighs it, then explains why it is wrong.",
  },
  {
    name: "Jure Barić", age: 33, origin: "the mainland's docks and boat sheds",
    summary: "Shy former casual laborer who used to sleep in mainland boat sheds and drink away his wages.",
    want: "To find regular work, keep his lodging paid, and eventually build a home of his own.",
    fear: "Being asked to leave before he has found a place among people.",
    secret: "He once worked as a ship's engineer but conceals that experience because people then expect him to solve every problem.",
    strangers: "Shy, then loyal.", advice: "Follows it, then forgets.",
  },
  {
    name: "Katarina Jurić", age: 39, origin: "the island, returning after service on the mainland",
    summary: "Former mainland constable, watchful and weary of enforcing rules that leave no room for mercy.",
    want: "To get to know her neighbors and earn their trust as someone who will listen before taking sides.",
    fear: "Being made to choose between neighbors.",
    secret: "During her mainland service, she let a bread thief go after learning who the food was for and never reported her decision.",
    strangers: "Watches, says nothing.", advice: "Listens carefully, then follows her sense of duty.",
  },
  {
    name: "Nikola Radić", age: 61, origin: "the island, returning after years at sea",
    summary: "Retired fisherman who tells the same three stories and pretends not to notice when a listener has heard them before.",
    want: "To meet new people and become a welcome companion for an evening's conversation.",
    fear: "Being forgotten when people gather.",
    secret: "His third story is true: years ago, he witnessed a lighthouse keeper's death on a distant coast and has always disguised it as a tall tale.",
    strangers: "Offers a story before asking their name.", advice: "Agrees with all of it.",
  },
  {
    name: "Ema Kos", age: 26, origin: "the mainland",
    summary: "An aspiring painter seeking quiet, yet unable to resist getting close to other people's troubles.",
    want: "To find enough paid work to keep her lodging and make friends who share her interest in the harbor and its changing weather.",
    fear: "Letting the need to earn coins crowd art out of her life.",
    secret: "She left a fiancé at the altar on the mainland and has not told anyone why she left.",
    strangers: "Open, a little too quickly.", advice: "Takes it to heart, then resents it.",
  },
  {
    name: "Franjo Kovač", age: 49, origin: "the island, returning after mainland mill work",
    summary: "Experienced mill worker, blunt and quick to anger when he thinks practical knowledge is being dismissed.",
    want: "To find steady work around grain and machinery, preferably at the mill, and earn enough to stay in the trade.",
    fear: "Being pushed out of the trade by people who care only about the price.",
    secret: "At a former mainland mill, he quietly recommended selling out while publicly urging his coworkers to stand firm.",
    strangers: "Blunt.", advice: "Asks what it would cost.",
  },
  {
    name: "Dora Lončar", age: 34, origin: "the island, returning after mainland tavern work",
    summary: "Experienced tavern worker, charming and competitive, who remembers what people like and wants a place of her own someday.",
    want: "To get tavern or inn work, make regular friends, and save toward building her own shop as a gathering place.",
    fear: "People discovering how much calculation lies behind her charm.",
    secret: "At a former mainland tavern job, she watered drinks on crowded nights and let an unpopular coworker take the blame.",
    strangers: "Charming, remembers preferences.", advice: "Smiles as though she has already agreed.",
  },
  {
    name: "Stjepan Vuković", age: 67, origin: "the island, returning after years in a mainland parish",
    summary: "Retired priest, tired of funerals and glad of other people's joy, who still reaches for a sermon when ordinary words would do.",
    want: "To meet his neighbors and become someone they seek out for company and comfort.",
    fear: "Having no comfort left to offer when someone needs him.",
    secret: "He does not believe most of what he once preached, and suspects that doubt has made him kinder.",
    strangers: "Blesses them.", advice: "Turns it into a sermon.",
  },
  {
    name: "Iva Božić", age: 19, origin: "an island farming family, returning from seasonal work away",
    summary: "Luka's niece, raised in a farming family and impatient with the idea of spending her whole life where she grew up.",
    want: "To earn coins through work and get to know people before deciding whether to leave for the mainland or build a life here.",
    fear: "Becoming her aunt, who always meant to leave and never did.",
    secret: "On her last trip away, she became homesick almost at once and would rather sound restless than admit it.",
    strangers: "Asks where they came from and if it was better.", advice: "Argues, then thinks about it for a week.",
  },
  {
    name: "Goran Šimić", age: 45, origin: "the mainland",
    summary: "Experienced dock worker and would-be organizer, loud about fair wages and uncomfortable when nobody follows his lead.",
    want: "To find dock work, build support among neighbors, and argue for fair wages at the council.",
    fear: "Being the only one willing to stand up for the others.",
    secret: "At a former mainland harbor job, he accepted a private payoff to discourage a protest while claiming to speak for the workers.",
    strangers: "Tries to recruit them to his point of view.", advice: "Calls it management talk.",
  },
  {
    name: "Mara Tomić", age: 72, origin: "the island, returning after years living with family elsewhere",
    summary: "An elderly storyteller who remembers old rent disputes in exhausting detail and misses being needed by her family.",
    want: "To meet her neighbors, share meals when she can, and become someone they ask for advice.",
    fear: "Not being asked anymore.",
    secret: "Years ago she sold a mainland boat shed to help her grandson leave home, then told the family she had never wanted to keep it.",
    strangers: "Asks whether they have eaten.", advice: "Has heard it before.",
  },
  {
    name: "Bruno Matić", age: 38, origin: "the mainland",
    summary: "Experienced shop clerk who remembers every price and resents having spent years counting coins for other people.",
    want: "To find clerk work, save his wages, and eventually build a shop of his own.",
    fear: "An employer discovering how much he wants to replace them.",
    secret: "At a former mainland job, he secretly planned to take over after his employer died, and was ashamed of how often he hoped for it.",
    strangers: "Helpful, forgets nothing.", advice: "Files it away for later.",
  },
];

export function seedPersonas(rng: Rng, n: number): Persona[] {
  const out: Persona[] = [];
  for (let i = 0; i < n; i++) {
    const base = SEED[i % SEED.length]!;
    const suffix = i >= SEED.length ? ` ${Math.floor(i / SEED.length) + 1}` : "";
    out.push({ ...base, name: base.name + suffix, traits: { warmth: rng.next(), pride: rng.next(), caution: rng.next(), honesty: rng.next(), ambition: rng.next() } });
  }
  return out;
}
