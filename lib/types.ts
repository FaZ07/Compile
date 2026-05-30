// COMPILE — shared types. Locked here so the SSE protocol and the UI agree.

export type NodeId =
  | "location"
  | "weather"
  | "reddit"
  | "wiki"
  | "flights"
  | "stays"
  | "events";

export interface NodeMeta {
  id: NodeId;
  label: string; // shown on the 3D node
  source: string; // "Open-Meteo", "Reddit", etc.
  real: boolean; // true = hits a live public API; false = realistic mock
  /** Order around the ring in the 3D graph. */
  angleOrder: number;
}

export const NODE_REGISTRY: Record<NodeId, NodeMeta> = {
  location: { id: "location", label: "Coordinates", source: "Nominatim", real: true, angleOrder: 0 },
  weather: { id: "weather", label: "Weather", source: "Open-Meteo", real: true, angleOrder: 1 },
  wiki: { id: "wiki", label: "Context", source: "Wikipedia", real: true, angleOrder: 2 },
  reddit: { id: "reddit", label: "Ground truth", source: "Reddit", real: true, angleOrder: 3 },
  flights: { id: "flights", label: "Flights", source: "Skyscanner *", real: false, angleOrder: 4 },
  stays: { id: "stays", label: "Stays", source: "Agoda + Airbnb *", real: false, angleOrder: 5 },
  events: { id: "events", label: "Events", source: "BookMyShow *", real: false, angleOrder: 6 },
};

export interface Intent {
  raw: string;
  destination: string; // human readable
  origin?: string;
  budget_inr?: number;
  party_size: number;
  nights: number; // trip duration in nights (1 night = 2-day trip)
  vibe: string; // free-text mood tag
  themes: string[]; // e.g. ["beach", "nightlife"]
  date_window: string; // human readable; e.g. "this weekend"
}

export interface LocationData {
  display_name: string;
  lat: number;
  lon: number;
}

export interface WeatherData {
  summary: string; // "Sunny, 28–32°C"
  rain_probability_pct: number;
  temp_min_c: number;
  temp_max_c: number;
}

export interface RedditData {
  posts: { title: string; subreddit: string; score: number; url: string; snippet: string }[];
  sentiment: "positive" | "mixed" | "negative" | "unclear";
}

export interface WikiData {
  title: string;
  summary: string;
  url: string;
}

export interface FlightOption {
  airline: string;
  depart: string; // ISO
  arrive: string;
  price_inr: number;
  route: string; // "BLR → GOI"
}


export interface StayOption {
  platform: string;
  name: string;
  area: string;
  nightly_inr: number;
  all_in_nightly_inr: number;
  fee_breakdown: { label: string; amount: number }[];
  rating: number;
}

export interface EventOption {
  name: string;
  venue: string;
  when: string;
  price_inr: number | "free";
}

// Discriminated payload for each node's result.
export type NodePayload =
  | { id: "location"; data: LocationData }
  | { id: "weather"; data: WeatherData }
  | { id: "reddit"; data: RedditData }
  | { id: "wiki"; data: WikiData }
  | { id: "flights"; data: FlightOption[] }
  | { id: "stays"; data: StayOption[] }
  | { id: "events"; data: EventOption[] };

export interface NodeResult<T = unknown> {
  id: NodeId;
  ok: boolean;
  duration_ms: number;
  data?: T;
  error?: string;
}

export interface Verification {
  source: string;
  claim: string;
  link?: string;
}

export interface Synthesis {
  headline: string; // big single line for the reveal
  summary: string; // 3–4 sentence story
  total_inr: number;
  verification: Verification[];
}

// ---- Wire protocol (SSE events) ----------------------------------------

export type CompileEvent =
  | { type: "stage"; stage: "parse" | "compile" | "fetch" | "synthesize" | "done" }
  | { type: "intent"; intent: Intent }
  | { type: "dag"; nodes: NodeId[] }
  | { type: "node:start"; id: NodeId }
  | { type: "node:done"; id: NodeId; result: NodeResult }
  | { type: "synthesis"; synthesis: Synthesis }
  | { type: "error"; message: string };
