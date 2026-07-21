// ── Type Options ─────────────────────────────────────────────────────────────
export const MAIN_TYPES = [
  { name: "MLM", value: "MLM" },
  { name: "General", value: "General" },
];

export const MLM_SELECT_TYPES = [
  { name: "Today Trending", value: "Today_Trending" },
  { name: "Rank Promotion", value: "Rank_Promotion" },
  { name: "Rank Promotion B", value: "Rank_Promotion_B" },
  { name: "Capping", value: "Capping" },
  { name: "Meeting", value: "Meeting" },
  { name: "Training", value: "Training" },
  { name: "Product", value: "Product" },
];

export const GENERAL_SELECT_TYPES = [
  { name: "Trending", value: "Trending" },
  { name: "Festival", value: "Festival" },

  { name: "Motivational", value: "Motivational" },
  { name: "Good Morning", value: "Good_Morning" },
  { name: "Sport", value: "Sport" },
  { name: "Daily_Life", value: "Daily_Life" },
  { name: "Devotional / Spiritual", value: "Devotional_Spiritual" },
  { name: "Leader Quotes", value: "Leader_Quotes" },
  { name: "Health Tips", value: "Health_Tips" },

  { name: "Bonanza", value: "Bonanza" },
  { name: "Achievements", value: "Achievements" },
  { name: "Achievements B", value: "Achievements_B" },
  { name: "Income", value: "Income" },
  { name: "Welcome / Closing", value: "Welcome_Closing" },
  { name: "General Meeting", value: "General_Meeting" },
  { name: "Anniversary & Birthday", value: "Anniversary_Birthday" },
  { name: "Greeting & Wishes", value: "Greeting_Wishes" },
  { name: "Thank You Banner B", value: "ThankYou_Banner_B" },
  {
    name: "Thank You (Birthday & Anniversary)",
    value: "ThankYou_Birthday_Anniversary",
  },
  // { name: "Capping", value: "Capping" },
];

export const POSITION_OPTIONS = [
  { name: "Left", value: "left" },
  { name: "Right", value: "right" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
export const uid = () => Math.random().toString(36).slice(2, 9);

// Auto-incrementing counter for numeric IDs (resets per page session)
let _idCounter = Date.now();
export const nextId = () => ++_idCounter;

export const emptyGraphicsLink = () => ({
  _key: uid(), // local React key only (not saved to Firestore)
  id: nextId(), // auto-generated numeric ID — not editable by user
  url: "",
  backgroundVideoUrl: "",
  suggestionImage: "",
  Date: "",
  nameImageUrl: "",
  rankNameImageUrl: "", // Rank Promotion only — image for the rank name
  bannerId: "",
  position: "left",
  incmNameId: "",
  Filter: "true",
  active: "true",
  pass: "", // password-protected delete (checked against "5688")
});

export const INITIAL_FORM = {
  MainType: "",
  SelectType: "",
  Subtype: "",
  Company: "",
  Showcase_url: "",
  ShowCaseForm: "",
  Date: "",
  serial: "",
  Active: true,
  Launched: true,
  GraphicsLink: [emptyGraphicsLink()],
};

// ── Conditional helpers (ported from GraphicsLinkSingle) ──────────────────────

/** Types where nameImageUrl (Badge/Achievement graphic) is shown */
export const SHOW_NAME_IMAGE_TYPES = ["Achievements", "Achievements_B"];

/** Types where bannerId (badge/frame) is HIDDEN */
export const HIDE_BANNER_ID_TYPES = [
  "Festival",
  "Leader_Quotes",
  "Today_Trending",
  "ThankYou_Banner_B",
  "ThankYou_Birthday_Anniversary",

];

/** Types where position selector is HIDDEN */
export const HIDE_POSITION_TYPES = ["Festival", "Achievements"];

/** Default position override per type */
export const defaultPosition = (selType) =>
  selType === "Achievements" ? "right" : "left";

/** Default Filter Options (Show/Hide) */
export const DEFAULT_FILTER_OPTIONS = [
  { name: "Show", value: "true" },
  { name: "Hide", value: "false" },
];

/** Meeting Filter Options (Host/Without Host) */
export const MEETING_FILTER_OPTIONS = [
  { name: "Host", value: "true" },
  { name: "Without Host", value: "false" },
];

/** Welcome/Closing Filter Options (SP/BV/PV) */
export const WELCOME_CLOSING_FILTER_OPTIONS = [
  { name: "SP", value: "SP" },
  { name: "BV", value: "BV" },
  { name: "PV", value: "PV" },
];

/** Get filter options based on selType */
export const getFilterOptions = (selType) => {
  if (selType === "Meeting" || selType === "General_Meeting")
    return MEETING_FILTER_OPTIONS;
  if (selType === "Welcome_Closing") return WELCOME_CLOSING_FILTER_OPTIONS;
  return DEFAULT_FILTER_OPTIONS;
}

/** Get SelectType options for a given MainType */
export const getSelectTypes = (mainType) =>
  mainType === "MLM"
    ? MLM_SELECT_TYPES
    : mainType === "General"
      ? GENERAL_SELECT_TYPES
      : [];

/** Delete password */
export const DELETE_PASS = "5688";
