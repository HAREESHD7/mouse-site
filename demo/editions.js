// The editions of Mouse.
//
// Mouse is one app that is shipped as more than one product. Each product is
// an "edition": the same program with a different name, different words and
// different things switched on. Everything an edition changes on the screen
// is written here, in one place.
//
// (The program itself keeps a much shorter list, in mouse-cli/src/edition.rs:
// the word each edition uses and where it stores its files. The names used
// here, "everyday" and "audit", must match the names used there.)
//
// To add an edition, copy one of these and change it. Never build a feature
// twice for two editions: put it in the shared app and add a switch here.

"use strict";

window.MouseEditions = {

  // For everyone: your day, written down for you.
  everyday: {
    id: "everyday",
    name: "Mouse",

    // What one saved folder of photos is called.
    noun: "day",
    nouns: "days",
    viewName: "Day",              // the name of the "told in order" view

    // How it looks until the person chooses for themselves in Settings.
    look: { accent: "amber", wall: "aurora" },

    // Which tools start switched on.
    toolsOn: { nameplates: false, spaces: false },

    // The button that stands out: "note" (save as text) or "excel".
    mainAction: "note",

    // Who reads photos and answers questions once the person has connected
    // Claude in Settings: "local" (the AI on this computer, as before) or
    // "claude". Either way the person can change it there.
    brain: "local",

    // Words for the first screen and the "add" form.
    exampleName: "Saturday in the city",
    emptyTitle: "Start with one day",
    emptyText: "Choose a folder of photos from today, a trip, or anything you want to remember. " +
      "Mouse keeps them on this computer, reads what is in each one, and writes the day out as " +
      "text you can use anywhere.",

    // Questions offered in Ask Mouse before the person has typed anything.
    starters: [
      "What did I see on this day?",
      "What is worth remembering from it?",
      "Write it up as a short diary entry",
    ],
    // The same, for someone who has switched the Nameplates tool on.
    startersWithNameplates: [
      "What did I see on this day?",
      "List the equipment with model and serial numbers",
      "What still needs checking?",
    ],
  },

  // For site work: energy audits and equipment surveys.
  // "Fieldmouse" is a working name until a final one is chosen.
  audit: {
    id: "audit",
    name: "Fieldmouse",

    noun: "visit",
    nouns: "visits",
    viewName: "Visit",

    look: { accent: "green", wall: "meadow" },

    toolsOn: { nameplates: true, spaces: true },

    // What the visit itself is described by, besides its name and date: the
    // building, who it is for, what kind of audit it is. These go on the
    // first page of the Word report. Written as [its short name, the words
    // shown on screen, and (if any) suggestions offered while typing].
    //
    // (The reports keep the same list in mouse-core/src/kinds.rs. Change
    // one, change the other: a check in mouse-cli/src/edition.rs fails if
    // they differ.)
    details: [
      ["building", "Building name"],
      ["address", "Address"],
      ["city", "City"],
      ["state", "State"],
      ["bbl", "BBL"],
      ["client", "Client"],
      ["contact", "Site contact"],
      ["property", "Property type", ["Office", "Multifamily", "Retail", "School", "Hospital", "Hotel", "Warehouse", "Mixed use", "Industrial", "Laboratory"]],
      ["floors", "Floors"],
      ["audit", "Audit type", ["ASHRAE Level I", "ASHRAE Level II", "ASHRAE Level III", "LL87 energy audit", "LL87 retro-commissioning", "Walk-through"]],
      ["status", "Status", ["Not started", "In progress", "Ready to review", "Filed"]],
    ],

    // What a space can be used as. Offered as suggestions when adding a
    // space; anything else can be typed.
    occupancies: [
      "Office", "Conference Room", "Corridor / Hallway", "Restroom", "Lobby / Reception",
      "Mechanical Room", "Electrical Room", "Kitchen / Break Room", "Storage", "Retail",
      "Classroom", "Residential Unit", "Common Area", "Garage / Parking", "Warehouse",
      "Stairwell", "Roof",
    ],

    // What can be noted in a space, and the values each kind has. Each
    // value is written as [its short name, the words shown on screen, and
    // (if any) suggestions to offer while typing]. Anything can be typed;
    // the suggestions only save time. The kinds and their values follow the
    // owner's own site inspection app.
    //
    // (The reports are made by the Mouse program, which keeps the same
    // list in mouse-core/src/kinds.rs. Change one, change the other: a
    // check in mouse-cli/src/edition.rs fails if they differ.)
    inventory: [
      {
        kind: "equipment",
        name: "Equipment",              // the heading
        add: "Add equipment",           // the button
        one: "equipment",               // in a sentence: "1 equipment"
        many: "equipment",
        title: ["equipment", "make", "model"], // the values an entry is called by
        // The values read from a photo of it (make, model, serial, ratings)
        // are copied in: a nameplate photo fills in the equipment.
        fillsFromPhoto: true,
        // (What it is, a boiler or a pump, is kept as "equipment" and not as
        // "type": a nameplate often has a "Type" of its own printed on it,
        // such as a motor's "TYPE E", and that must not become its name.)
        values: [
          ["equipment", "Equipment type", ["Boiler", "Rooftop unit", "Air handler", "Pump", "Chiller", "Split system", "Heat pump", "Water heater", "Fan", "Motor"]],
          ["make", "Make"],
          ["model", "Model"],
          ["serial", "Serial"],
          ["capacity", "Capacity"],
          ["age", "Age (years)"],
          ["condition", "Condition", ["Good", "Fair", "Poor", "Near end of life"]],
        ],
      },
      {
        kind: "lighting",
        name: "Lighting",
        add: "Add lighting",
        one: "lighting",
        many: "lighting",
        title: ["fixture", "lamp"],
        // What is worked out for each one and added up for a space: here,
        // lamps x watts x quantity.
        sum: { words: "Total watts", unit: "W", of: ["lamps", "watts", "quantity"] },
        values: [
          ["fixture", "Fixture ID"],
          ["lamp", "Lamp type", ["LED", "Fluorescent", "Incandescent", "Halogen", "CFL"]],
          ["lamps", "Lamps per fixture"],
          ["watts", "Watts per lamp"],
          ["quantity", "Quantity"],
          ["controls", "Controls", ["Switches", "Breaker", "Occupancy sensors", "Bi-level dimming", "Advanced automatic controls", "Daylight sensors", "Manual controls"]],
          ["hours", "Hours"],
        ],
      },
      {
        kind: "window",
        name: "Windows",
        add: "Add a window",
        one: "window",
        many: "windows",
        title: ["window", "panes"],
        // Inches x inches x how many, divided by 144, is square feet.
        sum: { words: "Area (sq ft)", unit: "sq ft", of: ["width", "height", "quantity"], divideBy: 144 },
        values: [
          ["window", "Window ID"],
          ["panes", "Panes", ["Single pane", "Double pane", "Triple pane"]],
          ["width", "Width (in)"],
          ["height", "Height (in)"],
          ["quantity", "Quantity"],
        ],
      },
      {
        kind: "meter",
        name: "Meters",
        add: "Add a meter",
        one: "meter",
        many: "meters",
        title: ["type", "number"],
        values: [
          ["type", "Type", ["Electrical", "Gas", "Water"]],
          ["number", "Number"],
          ["make", "Make"],
        ],
      },
    ],

    mainAction: "excel",

    // Site work needs small print read right, which is what Claude is best
    // at. Used only once the person has connected it with a key of their own.
    brain: "claude",

    exampleName: "Riverside School, plant room",
    emptyTitle: "Start with one site visit",
    emptyText: "Choose the folder of photos from a site visit. Fieldmouse keeps them on this " +
      "computer, reads the nameplates and labels, and lays out what it found for you to check " +
      "and export.",

    starters: [
      "What did I see on this visit?",
      "List the equipment with model and serial numbers",
      "What still needs checking?",
    ],
  },
};
