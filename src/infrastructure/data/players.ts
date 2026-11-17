import type { Player, PlayerRatings, Position } from '@/domain/auction/types';

/**
 * PLACEHOLDER DATA — overall ratings are rough estimates made for testing the
 * game, not official numbers. Replace this file with the real database
 * (2K ratings or ratings computed from real stats) later; the rest of the app
 * only depends on the `Player` type.
 */

type Archetype =
  | 'scorer'
  | 'playmaker'
  | 'slasher'
  | 'threeAndD'
  | 'twoWay'
  | 'stretchBig'
  | 'rimProtector'
  | 'post'
  | 'bigPlaymaker';

type RatingDeltas = [number, number, number, number, number, number];

// Offsets from the overall: shooting, finishing, playmaking, defense, rebounding, athleticism.
const ARCHETYPES: Record<Archetype, RatingDeltas> = {
  scorer: [3, 1, -4, -10, -25, -4],
  playmaker: [-2, -3, 4, -10, -18, -6],
  slasher: [-10, 4, -6, -8, -15, 5],
  threeAndD: [2, -8, -12, 6, -15, -2],
  twoWay: [-3, 0, -5, 4, -10, 1],
  stretchBig: [0, -3, -12, -3, 2, -6],
  rimProtector: [-18, 2, -18, 6, 6, 1],
  post: [-12, 4, -8, -4, 6, -4],
  bigPlaymaker: [-4, 2, 2, -10, 4, -12],
};

type PlayerSeed = [name: string, positions: Position[], overall: number, archetype: Archetype];

const SEEDS: PlayerSeed[] = [
  // Point guards
  ['Shai Gilgeous-Alexander', ['PG', 'SG'], 97, 'scorer'],
  ['Luka Dončić', ['PG', 'SG'], 96, 'playmaker'],
  ['Stephen Curry', ['PG'], 92, 'scorer'],
  ['Jalen Brunson', ['PG'], 91, 'scorer'],
  ['Cade Cunningham', ['PG'], 91, 'playmaker'],
  ['Tyrese Haliburton', ['PG'], 89, 'playmaker'],
  ['Tyrese Maxey', ['PG', 'SG'], 89, 'scorer'],
  ['Kyrie Irving', ['PG', 'SG'], 88, 'scorer'],
  ['Jamal Murray', ['PG'], 87, 'scorer'],
  ['De\'Aaron Fox', ['PG'], 87, 'slasher'],
  ['Trae Young', ['PG'], 87, 'playmaker'],
  ['James Harden', ['PG'], 87, 'playmaker'],
  ['Ja Morant', ['PG'], 86, 'slasher'],
  ['LaMelo Ball', ['PG'], 86, 'playmaker'],
  ['Damian Lillard', ['PG'], 85, 'scorer'],
  ['Darius Garland', ['PG'], 85, 'scorer'],
  ['Derrick White', ['PG', 'SG'], 84, 'threeAndD'],
  ['Josh Giddey', ['PG', 'SG'], 82, 'playmaker'],
  ['Jrue Holiday', ['PG', 'SG'], 82, 'twoWay'],
  ['Dejounte Murray', ['PG'], 82, 'twoWay'],
  ['Fred VanVleet', ['PG'], 81, 'threeAndD'],
  ['Coby White', ['PG', 'SG'], 81, 'scorer'],
  ['Immanuel Quickley', ['PG'], 80, 'scorer'],
  ['Jalen Suggs', ['PG', 'SG'], 80, 'twoWay'],
  ['Payton Pritchard', ['PG'], 80, 'scorer'],
  ['Stephon Castle', ['PG', 'SG'], 80, 'slasher'],
  ['Collin Sexton', ['PG', 'SG'], 80, 'scorer'],
  ['Andrew Nembhard', ['PG'], 79, 'twoWay'],
  ['Chris Paul', ['PG'], 78, 'playmaker'],
  ['Mike Conley', ['PG'], 77, 'playmaker'],

  // Shooting guards
  ['Anthony Edwards', ['SG'], 93, 'scorer'],
  ['Donovan Mitchell', ['SG'], 91, 'scorer'],
  ['Devin Booker', ['SG', 'PG'], 90, 'scorer'],
  ['Jaylen Brown', ['SG', 'SF'], 88, 'slasher'],
  ['Jalen Williams', ['SG', 'SF'], 87, 'twoWay'],
  ['Austin Reaves', ['SG', 'PG'], 85, 'scorer'],
  ['Tyler Herro', ['SG'], 85, 'scorer'],
  ['Amen Thompson', ['SG', 'SF'], 84, 'slasher'],
  ['Desmond Bane', ['SG'], 84, 'scorer'],
  ['Zach LaVine', ['SG'], 84, 'scorer'],
  ['DeMar DeRozan', ['SG', 'SF'], 83, 'scorer'],
  ['Dyson Daniels', ['SG', 'PG'], 82, 'threeAndD'],
  ['Norman Powell', ['SG', 'SF'], 82, 'scorer'],
  ['Anfernee Simons', ['SG', 'PG'], 81, 'scorer'],
  ['Jalen Green', ['SG'], 81, 'slasher'],
  ['CJ McCollum', ['SG'], 81, 'scorer'],
  ['Josh Hart', ['SG', 'SF'], 81, 'twoWay'],
  ['Devin Vassell', ['SG', 'SF'], 80, 'threeAndD'],
  ['Christian Braun', ['SG'], 80, 'threeAndD'],
  ['Bradley Beal', ['SG'], 80, 'scorer'],
  ['Alex Caruso', ['SG', 'PG'], 79, 'threeAndD'],
  ['Luguentz Dort', ['SG', 'SF'], 79, 'threeAndD'],
  ['Jaden Ivey', ['SG'], 79, 'slasher'],
  ['Bennedict Mathurin', ['SG', 'SF'], 79, 'slasher'],
  ['Cam Thomas', ['SG'], 79, 'scorer'],
  ['Klay Thompson', ['SG'], 78, 'threeAndD'],

  // Small forwards
  ['Jayson Tatum', ['SF', 'PF'], 92, 'twoWay'],
  ['Kevin Durant', ['SF', 'PF'], 91, 'scorer'],
  ['LeBron James', ['SF', 'PF'], 90, 'playmaker'],
  ['Kawhi Leonard', ['SF'], 89, 'twoWay'],
  ['Franz Wagner', ['SF', 'PF'], 87, 'slasher'],
  ['Scottie Barnes', ['SF', 'PF'], 87, 'twoWay'],
  ['Jimmy Butler', ['SF', 'PF'], 86, 'twoWay'],
  ['Brandon Ingram', ['SF'], 85, 'scorer'],
  ['Mikal Bridges', ['SF', 'SG'], 84, 'threeAndD'],
  ['OG Anunoby', ['SF', 'PF'], 84, 'threeAndD'],
  ['Paul George', ['SF'], 84, 'twoWay'],
  ['Deni Avdija', ['SF'], 84, 'twoWay'],
  ['Cooper Flagg', ['SF', 'PF'], 84, 'twoWay'],
  ['Michael Porter Jr.', ['SF', 'PF'], 83, 'scorer'],
  ['Trey Murphy III', ['SF'], 83, 'threeAndD'],
  ['Brandon Miller', ['SF'], 83, 'scorer'],
  ['Herbert Jones', ['SF', 'SG'], 81, 'threeAndD'],
  ['Keegan Murray', ['SF', 'PF'], 81, 'threeAndD'],
  ['Jaden McDaniels', ['SF', 'PF'], 81, 'threeAndD'],
  ['Cameron Johnson', ['SF', 'PF'], 81, 'threeAndD'],
  ['Andrew Wiggins', ['SF'], 80, 'twoWay'],
  ['Toumani Camara', ['SF'], 79, 'threeAndD'],
  ['Aaron Nesmith', ['SF'], 79, 'threeAndD'],
  ['Dillon Brooks', ['SF'], 79, 'threeAndD'],
  ['Khris Middleton', ['SF'], 78, 'scorer'],

  // Power forwards
  ['Giannis Antetokounmpo', ['PF', 'C'], 96, 'slasher'],
  ['Anthony Davis', ['PF', 'C'], 91, 'rimProtector'],
  ['Paolo Banchero', ['PF', 'SF'], 88, 'scorer'],
  ['Evan Mobley', ['PF', 'C'], 88, 'twoWay'],
  ['Jaren Jackson Jr.', ['PF', 'C'], 87, 'rimProtector'],
  ['Pascal Siakam', ['PF', 'SF'], 87, 'twoWay'],
  ['Zion Williamson', ['PF'], 86, 'slasher'],
  ['Lauri Markkanen', ['PF', 'SF'], 85, 'stretchBig'],
  ['Jalen Johnson', ['PF', 'SF'], 85, 'twoWay'],
  ['Julius Randle', ['PF'], 84, 'post'],
  ['Aaron Gordon', ['PF'], 82, 'twoWay'],
  ['John Collins', ['PF', 'C'], 81, 'stretchBig'],
  ['Draymond Green', ['PF', 'C'], 80, 'twoWay'],
  ['Jabari Smith Jr.', ['PF'], 80, 'stretchBig'],
  ['Jerami Grant', ['PF', 'SF'], 80, 'scorer'],
  ['Tobias Harris', ['PF'], 80, 'twoWay'],
  ['P.J. Washington', ['PF'], 80, 'stretchBig'],
  ['Kyle Kuzma', ['PF'], 79, 'scorer'],
  ['Rui Hachimura', ['PF'], 79, 'scorer'],
  ['Bobby Portis', ['PF', 'C'], 78, 'stretchBig'],

  // Centers
  ['Nikola Jokić', ['C'], 98, 'bigPlaymaker'],
  ['Victor Wembanyama', ['C', 'PF'], 95, 'rimProtector'],
  ['Joel Embiid', ['C'], 92, 'post'],
  ['Karl-Anthony Towns', ['C', 'PF'], 89, 'stretchBig'],
  ['Alperen Şengün', ['C'], 88, 'bigPlaymaker'],
  ['Chet Holmgren', ['C', 'PF'], 87, 'rimProtector'],
  ['Bam Adebayo', ['C', 'PF'], 87, 'twoWay'],
  ['Domantas Sabonis', ['C', 'PF'], 87, 'bigPlaymaker'],
  ['Rudy Gobert', ['C'], 84, 'rimProtector'],
  ['Kristaps Porziņģis', ['C'], 84, 'stretchBig'],
  ['Ivica Zubac', ['C'], 84, 'post'],
  ['Myles Turner', ['C'], 83, 'stretchBig'],
  ['Jarrett Allen', ['C'], 83, 'rimProtector'],
  ['Isaiah Hartenstein', ['C'], 82, 'rimProtector'],
  ['Nikola Vučević', ['C'], 81, 'post'],
  ['Jalen Duren', ['C'], 81, 'rimProtector'],
  ['Walker Kessler', ['C'], 80, 'rimProtector'],
  ['Dereck Lively II', ['C'], 80, 'rimProtector'],
  ['Onyeka Okongwu', ['C', 'PF'], 80, 'rimProtector'],
  ['Naz Reid', ['C', 'PF'], 80, 'stretchBig'],
  ['Deandre Ayton', ['C'], 80, 'post'],
  ['Brook Lopez', ['C'], 79, 'stretchBig'],
  ['Daniel Gafford', ['C'], 79, 'rimProtector'],
  ['Mark Williams', ['C'], 79, 'rimProtector'],
  ['Mitchell Robinson', ['C'], 78, 'rimProtector'],
  ['Nic Claxton', ['C'], 78, 'rimProtector'],
  ['Donovan Clingan', ['C'], 78, 'rimProtector'],
  ['Zach Edey', ['C'], 78, 'post'],
  ['Kel\'el Ware', ['C'], 78, 'rimProtector'],
  ['Al Horford', ['C', 'PF'], 77, 'stretchBig'],
  ['Jonas Valančiūnas', ['C'], 77, 'post'],
  ['Clint Capela', ['C'], 77, 'rimProtector'],
];

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function clampRating(value: number): number {
  return Math.min(99, Math.max(30, value));
}

function buildRatings(overall: number, archetype: Archetype): PlayerRatings {
  const [shooting, finishing, playmaking, defense, rebounding, athleticism] = ARCHETYPES[archetype].map(
    (delta) => clampRating(overall + delta),
  );
  return { shooting, finishing, playmaking, defense, rebounding, athleticism };
}

export const PLAYERS: Player[] = SEEDS.map(([name, positions, overall, archetype]) => ({
  id: slugify(name),
  name,
  positions,
  overall,
  ratings: buildRatings(overall, archetype),
}));
