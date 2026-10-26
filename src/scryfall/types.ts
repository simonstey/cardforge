/** Subset of the Scryfall API objects that CardForge reads. */

export interface ScryfallImageUris {
  art?: string;
  display?: string;
  grid?: string;
  thumb?: string;
  crop?: string;
  jpeg?: string;
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface ScryfallCardFace {
  name: string;
  oracle_id?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  colors?: string[];
  artist?: string;
  image_uris?: ScryfallImageUris;
  printed_name?: string;
  printed_text?: string;
  printed_type_line?: string;
}

export interface ScryfallCard {
  id: string;
  name: string;
  layout: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  oracle_id?: string;
  scryfall_uri?: string;
  set_type?: string;
  lang?: string;
  games?: string[];
  booster?: boolean;
  digital?: boolean;
  image_status?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  colors?: string[];
  artist?: string;
  printed_name?: string;
  printed_text?: string;
  printed_type_line?: string;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
}

export interface ScryfallSet {
  code: string;
  name: string;
  set_type: string;
  released_at?: string;
  card_count: number;
  printed_size?: number;
  digital: boolean;
  parent_set_code?: string;
  icon_svg_uri?: string;
  search_uri: string;
}

export interface ScryfallList<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
  next_page?: string | null;
  total_cards?: number;
  warnings?: string[];
}

export interface ScryfallErrorBody {
  object: 'error';
  code: string;
  status: number;
  details: string;
  type?: string;
  warnings?: string[];
}
