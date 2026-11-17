// The Mouse screen. Plain JavaScript, no outside libraries, so it works
// with no internet.
//
// It keeps a small picture of the world in `state`, asks the Mouse program
// (the server in app.rs) for data, and redraws the parts that changed.

//
// A word on names: on screen a saved folder of photos is called a "day". In
// the code, and in the Mouse program, it is still called a "visit".

"use strict";

// On the public demo page there is no Mouse program behind the screen. A
// small stand-in (demo.js) answers instead, with a made-up day.
const DEMO = window.MouseDemo || null;

// Whether this screen is inside the app on a tablet or phone, which carries
// the whole of Mouse within it (the `mouse-mobile` program). The Mouse
// program marks the page when it is. Such a device has no folders for a
// person to browse, so the few things that need them are left out there.
const IN_APP = document.documentElement.dataset.home === "app";

// Whether Mouse is shown in a window of its own (the `mouse-window`
// program) and not in a web browser. A window can do a few things a tab in
// a browser cannot: see "The window", near the end of this file. (The app
// on a tablet or phone is neither: it has its own ways.)
const IN_WINDOW = Boolean(window.ipc) && !DEMO && !IN_APP;
if (IN_WINDOW) document.documentElement.dataset.window = "yes";

// What a person calls the thing Mouse runs on. On a computer, a computer.
// Inside the app it is an iPad or an iPhone (or, where the app cannot tell,
// a "device"). An iPad often says it is a Mac, so fingers are counted too.
const DEVICE = !IN_APP ? "computer"
  : /iPhone|iPod/.test(navigator.userAgent) ? "iPhone"
  : /iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "iPad"
  : "device";

/** Mouse's own sentences were written for a computer: "kept on this
    computer". Inside the app on a tablet or phone they name that device
    instead. Only Mouse's own words are passed through here, never what a
    person wrote. */
function here(words) {
  if (DEVICE === "computer") return words;
  return words.replaceAll("this computer", "this " + DEVICE)
    .replaceAll("my computer", "my " + DEVICE)
    .replaceAll("your own computer", "your own " + DEVICE);
}

// Which edition of Mouse this is: the same app under a different name, with
// different words and different things switched on. The editions are written
// out in editions.js. The page was marked with its edition before this script
// started (see the top of index.html).
const EDITION = window.MouseEditions[document.documentElement.dataset.edition]
  || window.MouseEditions.everyday;

/** Put this edition's word for one saved folder of photos into a sentence:
    phrase("Add a {noun}") gives "Add a day" or "Add a visit". */
function phrase(words) {
  return words.replaceAll("{nouns}", EDITION.nouns).replaceAll("{noun}", EDITION.noun);
}

// The parts a visit is shown in, as tabs across the top, where the edition
// has them (the audit one does: see editions.js). Otherwise null, and the
// visit is shown as a day and its photos.
const PARTS = EDITION.parts || null;

// The labels shown first on a data plate, in this order.
const USUAL = ["make", "model", "serial", "volts", "phase", "hz", "amps", "hp", "rpm", "refrigerant", "date"];

// Labels that are written in capitals.
const SPELLING = { hz: "Hz", hp: "HP", rpm: "RPM" };

const state = {
  visits: [],      // the list on the left
  removed: 0,      // how many were taken out of that list and can be put back
  visit: null,     // the open visit, with all its files
  selected: null,  // the number of the photo that is open
  kindShown: null, // which kind of thing the Inventory part lists
  entryOpen: null, // the thing (an entry) that is open in the side panel
  statusShown: "all", // which visits the list shows: all, or those of one status
  spaceForNew: "", // the space last chosen when adding a thing from Inventory
  view: "day",     // "day" (told in order), "spaces" (rooms) or "photos" (tiles)
  plates: false,   // whether the Nameplates tool is switched on
  spaces: false,   // whether the Spaces tool is switched on
  spaceShown: "all", // which photos the tiles view shows: "all", "none" (not sorted) or a space's id
  spaceOpen: null,   // the space whose own page is open in the Spaces view: its id, "none", or null for the cards
  picking: false,  // whether photos are being picked, to move several at once
  picked: new Set(), // the numbers of the picked photos
  about: null,     // the version, and where the days are kept
  filter: "all",   // which photos the tiles view shows
  side: null,      // the right panel: null, "photo" or "ask"
  readers: null,   // which readers and AI models can be used right now
  talks: {},       // conversations with Mouse, one per visit
  polling: null,   // the timer that watches a running job
  toldOfWork: null, // what Mouse's own window was last told about that job
  sending: false,  // whether files from this device are on their way to Mouse
  recording: null, // the voice note being recorded on this device, if any
  sendTo: null,    // the space those files are to go into, if any
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

/** Make an element. Text is always set as text, never as HTML. */
function make(tag, options = {}, children = []) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(options)) {
    if (name === "text") element.textContent = value;
    else if (name === "class") element.className = value;
    else if (name.startsWith("on")) element.addEventListener(name.slice(2), value);
    else if (value !== false && value !== null && value !== undefined) element.setAttribute(name, value === true ? "" : value);
  }
  for (const child of [].concat(children)) {
    if (child) element.append(child);
  }
  return element;
}

/** A small line drawing, such as a tick or a loudspeaker. */
function icon(path) {
  const space = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(space, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const line = document.createElementNS(space, "path");
  line.setAttribute("d", path);
  svg.append(line);
  return svg;
}

const TICK = "M5 12.5l4.5 4.5L19 7.5";
const SPEAKER = "M5 9v6h4l5 4V5L9 9H5zM17.5 9a4.5 4.5 0 0 1 0 6";

/** Ask the Mouse program for something, or tell it to change something. */
async function ask(address, change) {
  if (DEMO) return DEMO.ask(address, change);
  const options = change === undefined
    ? {}
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) };
  const response = await fetch(address, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.problem || "Mouse could not do that.");
  return data;
}

let toastTimer = null;
/** Say something in the small message at the bottom of the screen. It can
    offer things to press: `offers` is a list of { text, does }. A message
    with something to press stays up longer. */
function say(message, isProblem = false, offers = []) {
  const toast = $("toast");
  const away = () => { toast.className = "toast"; };
  toast.replaceChildren(make("span", { text: message }), ...offers.map((offer) =>
    make("button", { class: "toast-button", type: "button", text: offer.text, onclick: () => { away(); offer.does(); } })));
  toast.className = "toast is-showing" + (isProblem ? " is-problem" : "") + (offers.length ? " has-buttons" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(away, offers.length ? 12000 : isProblem ? 7000 : 3500);
}

function labelText(label) {
  if (SPELLING[label]) return SPELLING[label];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function plural(count, one, many) {
  return count + " " + (count === 1 ? one : many);
}

function clip(text, length) {
  return text.length > length ? text.slice(0, length - 1).trimEnd() + "…" : text;
}

function visitAddress() {
  return "/api/visits/" + encodeURIComponent(state.visit.id);
}

function itemAddress(item) {
  return visitAddress() + "/items/" + item.number;
}

/** Where a photo's picture comes from: "thumb" is small, "photo" is large,
    "full" is as large as the camera made it. */
function pictureAddress(item, size) {
  if (DEMO) return DEMO.picture(state.visit.id, item, size);
  return itemAddress(item) + "/" + size + "?turn=" + item.turns;
}

// ---------------------------------------------------------------------------
// What a photo is, and what to call it
// ---------------------------------------------------------------------------

/** Only someone who has switched the Nameplates tool on sees a nameplate as
    anything special. For everyone else it is a photo with words on it. */
function isNameplate(item) {
  return state.plates && item.looks_like === "nameplate";
}

/** The lines of text read from a photo, without the empty ones. */
function textLines(item) {
  return (item.text || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

/** The few words on the tag: Sign, Meter, Audio... */
function kindWords(item) {
  if (item.kind !== "photo") return labelText(item.kind);
  if (!item.looks_like || item.looks_like === "other") return "Photo";
  if (item.looks_like === "nameplate" && !state.plates) return "Photo";
  return labelText(item.looks_like);
}

/** The main line for a photo. A nameplate is called by its make and model.
    Anything else is called by what it says. */
function headline(item) {
  if (item.kind !== "photo") return item.name;
  if (isNameplate(item)) {
    const name = [item.fields.make, item.fields.model].filter(Boolean).join(" ");
    return name || "Nameplate";
  }
  const lines = textLines(item);
  if (lines.length > 0) return clip(lines.join(" "), 90);
  return kindWords(item);
}

/** The quieter second line. */
function subline(item) {
  if (item.kind !== "photo") {
    const parts = [];
    if (item.seconds) parts.push(lengthWords(item.seconds));
    if (!item.heard) parts.push("What was said is not written down yet");
    else if (item.heard.lines.length) parts.push(plural(item.heard.words, "word", "words") + " of what was said");
    else parts.push("Mouse heard no words in it");
    return parts.join(". ") + ".";
  }
  if (isNameplate(item) && item.fields.serial) return "Serial " + item.fields.serial;
  return item.name;
}

/** The labels of an item, usual ones first, the rest in A-Z order. */
function orderedLabels(item) {
  const labels = Object.keys(item.fields);
  const usual = USUAL.filter((label) => labels.includes(label));
  const others = labels.filter((label) => !USUAL.includes(label)).sort();
  return usual.concat(others);
}

/** How many values an item has, and how many of them are checked. */
function progress(item) {
  const labels = Object.keys(item.fields);
  const checked = labels.filter((label) => item.checked.includes(label)).length;
  return { values: labels.length, checked };
}

function needsChecking(item) {
  const { values, checked } = progress(item);
  return values > 0 && checked < values;
}

// ---------------------------------------------------------------------------
// Look: theme, colour, background, glass and text size
// ---------------------------------------------------------------------------

// Each edition remembers its own choices, so picking a colour in one does not
// change the other. The everyday edition keeps the plain names it always had.
const KEPT_AS = EDITION.id === "everyday" ? "" : "-" + EDITION.id;

function remember(name, value) {
  try { localStorage.setItem(name + KEPT_AS, value); } catch { /* private window: fine */ }
}

function recall(name) {
  try { return localStorage.getItem(name + KEPT_AS); } catch { return null; }
}

function forget(name) {
  try { localStorage.removeItem(name + KEPT_AS); } catch { /* private window: fine */ }
}

// What can be chosen in Settings, where each choice is remembered, and what
// Mouse starts with.
const LOOK = {
  theme: { saved: "mouse-theme", normal: "auto", choices: ["light", "dark", "auto"] },
  accent: { saved: "mouse-accent", normal: "amber", choices: ["amber", "blue", "teal", "green", "rose", "violet", "graphite"] },
  wall: { saved: "mouse-wall", normal: "aurora", choices: ["aurora", "dusk", "meadow", "ember", "mist", "plain"] },
  text: { saved: "mouse-text", normal: "normal", choices: ["small", "normal", "large"] },
};

// An edition can start with a look of its own (its colour, its background).
for (const [name, choice] of Object.entries(EDITION.look || {})) {
  if (LOOK[name] && LOOK[name].choices.includes(choice)) LOOK[name].normal = choice;
}

// How see-through the glass is, out of 100.
const CLEAR_NORMAL = 62;

const COMPUTER_IS_LIGHT = window.matchMedia("(prefers-color-scheme: light)");

function lookChoice(name) {
  const saved = recall(LOOK[name].saved);
  return LOOK[name].choices.includes(saved) ? saved : LOOK[name].normal;
}

function clearChoice() {
  const saved = recall("mouse-clear");
  const amount = Number(saved);
  return saved !== null && saved !== "" && amount >= 0 && amount <= 100 ? amount : CLEAR_NORMAL;
}

/** When Mouse is shown in a window of its own (not in a web browser), the
    window is told two things: which look is showing, so its title bar can
    match, and when the screen has first drawn itself, so the window appears
    whole instead of half made. In a browser there is nobody to tell. */
function tellWindow(words) {
  try {
    if (window.ipc) window.ipc.postMessage(words);
  } catch { /* no window of its own: fine */ }
}

/** Put the chosen look onto the page. style.css does the rest. */
function applyLook() {
  const root = document.documentElement;
  const theme = lookChoice("theme");
  // "auto" follows the computer's own light or dark setting.
  root.dataset.theme = theme === "auto" ? (COMPUTER_IS_LIGHT.matches ? "light" : "dark") : theme;
  tellWindow("theme:" + root.dataset.theme);
  root.dataset.accent = lookChoice("accent");
  root.dataset.wall = lookChoice("wall");
  root.dataset.text = lookChoice("text");
  root.style.setProperty("--clear", String(clearChoice() / 100));
}

function setLook(name, value) {
  remember(LOOK[name].saved, value);
  applyLook();
  drawLook();
}

/** Show, in Settings, which choices are the current ones. */
function drawLook() {
  for (const group of document.querySelectorAll("[data-setting]")) {
    const chosen = lookChoice(group.dataset.setting);
    for (const button of group.querySelectorAll("[data-value]")) {
      button.setAttribute("aria-checked", button.dataset.value === chosen ? "true" : "false");
    }
  }
  $("look-clear").value = clearChoice();
}

function resetLook() {
  for (const name of Object.keys(LOOK)) forget(LOOK[name].saved);
  forget("mouse-clear");
  applyLook();
  drawLook();
}

// ---------------------------------------------------------------------------
// The edition: its name and its words
// ---------------------------------------------------------------------------

/** Put this edition's name and words onto the page. The page is written
    with the everyday edition's words; this swaps in the right ones. */
function applyEdition() {
  document.title = EDITION.name;
  $("wordmark").textContent = EDITION.name;

  // Buttons whose meaning is told by a tooltip.
  const tips = {
    "toggle-sidebar": "Show or hide your {nouns}",
    "add-visit": "Add a {noun}",
    "open-ask": "Ask Mouse about this {noun}",
    "copy-note": "Copy this whole {noun} as text, to paste anywhere",
    "save-note": "Save this whole {noun} as a text note",
  };
  for (const [id, words] of Object.entries(tips)) {
    $(id).title = phrase(words);
    if ($(id).hasAttribute("aria-label")) $(id).setAttribute("aria-label", phrase(words));
  }
  // In Mouse's own window some buttons have a key as well (see "Keys").
  if (IN_WINDOW) {
    $("add-visit").title += " (Ctrl+N)";
    $("open-settings").title += " (Ctrl+,)";
    $("find-visit").title = "Ctrl+F";
  }
  $("reveal-visit").textContent = phrase("Show this {noun}'s folder");
  $("drop-words").textContent = phrase("Let go to add this folder as a {noun}");
  $("shortcuts-words").textContent =
    "A shortcut opens " + EDITION.name + " straight away, with its own icon. " +
    "It starts this copy of " + EDITION.name + ", with the " + phrase("{nouns}") + " you see here.";

  $("sidebar").setAttribute("aria-label", phrase("Your {nouns}"));
  $("visit-list").setAttribute("aria-label", phrase("Saved {nouns}"));
  $("find-visit").placeholder = phrase("Find a {noun}");
  $("find-visit").setAttribute("aria-label", phrase("Find a {noun}"));
  $("view-day-tab").textContent = EDITION.viewName;

  $("empty-title").textContent = EDITION.emptyTitle;
  // (Where a visit starts empty and is filled from the camera, the words
  // do not speak of choosing a folder.)
  $("empty-text").textContent = here(CAMERA_AT_HAND || IN_APP ? EDITION.emptyTextByHand : EDITION.emptyText);
  $("add-first").textContent = phrase("Add a {noun}");

  $("rename-title").textContent = phrase("Change this {noun}'s name or date");
  $("remove-visit").textContent = phrase("Remove this {noun}");
  $("removed-title").textContent = phrase("Removed {nouns}");
  $("removed-words").textContent = phrase(
    "Nothing here was deleted. Put a {noun} back and it is in your list again, with everything in it.");

  $("add-title").textContent = phrase("Add a {noun}");
  $("add-save").textContent = phrase("Add this {noun}");
  $("add-name").placeholder = EDITION.exampleName;
  $("add-empty-words").textContent = phrase(
    "The {noun} starts with nothing in it. Its photos are added afterwards, from whatever device this screen is on: taken with its camera, or chosen from its files.");

  $("demo-words").textContent =
    phrase("You are trying " + EDITION.name + " with a made-up {noun}. Nothing you do here is saved.");
}

function toggleSidebar() {
  // (On a phone, and on a tablet held upright, the list floats over the
  // page and starts closed. The width is the one in style.css.)
  const small = window.matchMedia("(max-width: 860px)").matches;
  $("shell").classList.toggle(small ? "show-sidebar" : "no-sidebar");
}

// ---------------------------------------------------------------------------
// The list of visits
// ---------------------------------------------------------------------------

async function loadVisits(openId) {
  const listed = await ask("/api/visits");
  state.visits = listed.visits;
  state.removed = listed.removed || 0;
  drawVisits();

  if (state.visits.length === 0) {
    state.visit = null;
    state.selected = null;
    drawVisit();
    return;
  }
  const wanted = openId || (state.visit && state.visit.id) || state.visits[0].id;
  const exists = state.visits.some((visit) => visit.id === wanted);
  await openVisit(exists ? wanted : state.visits[0].id);
}

function drawVisits() {
  const list = $("visit-list");
  const wanted = $("find-visit").value.trim().toLowerCase();
  list.replaceChildren();

  // Where each visit has a status, the list can be shown by status.
  drawStatusChips();
  const shown = state.visits.filter((visit) =>
    (visit.name + " " + visit.date).toLowerCase().includes(wanted) &&
    (!PARTS || state.statusShown === "all" || visit.status === state.statusShown));

  for (const visit of shown) {
    const facts = visit.date + ", " + plural(visit.photos, "photo", "photos");
    list.append(make("button", {
      class: "visit-link",
      type: "button",
      "aria-label": visit.name + ", " + facts,
      "aria-current": state.visit && state.visit.id === visit.id ? "true" : "false",
      onclick: () => openVisit(visit.id),
    }, [
      make("span", { class: "visit-link-name", text: visit.name }),
      make("span", { class: "visit-link-facts", text: facts }),
      PARTS && STATUS_WORDS[visit.status] ? make("span", { class: "pill is-" + visit.status, text: STATUS_WORDS[visit.status] }) : null,
    ]));
  }
  if (shown.length === 0 && state.visits.length > 0) {
    list.append(make("p", { class: "visit-none", text: phrase("No {noun} matches that.") }));
  }
  // The way to what was taken out of the list, while anything is there.
  $("open-removed").hidden = !state.removed;
  $("open-removed").textContent = phrase("Removed {nouns}") + " (" + state.removed + ")";
}

/** Take a fresh copy of the open visit from the Mouse program. */
function takeVisit(fresh) {
  fresh.spaces = fresh.spaces || [];
  fresh.entries = fresh.entries || [];
  fresh.details = fresh.details || {};
  state.visit = fresh;
}

/** Ask the Mouse program to change something in the open visit, and take
    the fresh copy it sends back. Says so, and answers false, if it fails. */
async function changeVisit(address, change) {
  try {
    takeVisit(await ask(visitAddress() + address, change));
    return true;
  } catch (problem) {
    say(problem.message, true);
    return false;
  }
}

async function openVisit(id) {
  const another = !state.visit || state.visit.id !== id;
  try {
    takeVisit(await ask("/api/visits/" + encodeURIComponent(id)));
  } catch (problem) {
    say(problem.message, true);
    return;
  }
  // A visit shown in parts opens on its first part: what is left to do.
  if (PARTS && another) state.view = partsShown()[0];
  // What was said about the last piece of work belongs to the visit it was
  // done in, not to the one opened next.
  if (another && !state.polling && !state.sending) showNotice("");
  state.selected = null;
  state.filter = "all";
  state.spaceShown = "all";
  state.spaceOpen = null;
  state.picking = false;
  state.picked.clear();
  if (state.side === "photo" || state.side === "entry") state.side = null;
  state.entryOpen = null;
  $("shell").classList.remove("show-sidebar");
  drawVisits();
  drawVisit();
}

// ---------------------------------------------------------------------------
// The open visit: its heading and facts
// ---------------------------------------------------------------------------

function drawVisit() {
  const visit = state.visit;
  // The window (or the browser's tab) is named after what is open in it,
  // as a document's window is: "Riverside School - Fieldmouse".
  document.title = visit ? visit.name + " - " + EDITION.name : EDITION.name;
  // Only what can be shown: a part of the visit where the edition has parts
  // (one that belongs to a tool only while that tool is on), otherwise the
  // day, its photos and, with the Spaces tool on, its spaces.
  const parts = partsShown();
  const views = parts || (state.spaces ? ["day", "spaces", "photos"] : ["day", "photos"]);
  if (!views.includes(state.view)) state.view = views[0];
  $("empty").hidden = state.visits.length > 0;
  $("visit-head").hidden = !visit;
  $("visit-head").classList.toggle("has-parts", Boolean(parts));
  for (const view of ["photos", "spaces", "day", "overview", "details", "inventory", "reports"]) {
    $("view-" + view).hidden = !visit || state.view !== view;
  }
  if (!visit) {
    drawSide();
    return;
  }

  $("visit-name").textContent = visit.name;
  drawFacts();
  drawParts(parts);
  $("mark-complete").hidden = !parts;
  syncStatus();

  // The Excel file matters most to someone using the Nameplates tool, so it
  // gets a button of its own then. Otherwise it lives in the More menu and
  // the text note is the main thing.
  // An edition made for site work puts it up front as well.
  const excelFirst = state.plates || EDITION.mainAction === "excel";
  // A visit sorted into spaces gives more than one file (a Word report, an
  // Excel workbook, the photos by space), so the Spaces tool swaps the
  // Excel button for a Reports menu that holds all three.
  const reports = state.spaces;
  $("reports").hidden = !reports;
  $("export").hidden = !excelFirst || reports;
  $("export-menu").hidden = excelFirst || reports;
  $("save-note").classList.toggle("button-main", !excelFirst && !reports);

  $("view-photos-tab").setAttribute("aria-selected", state.view === "photos" ? "true" : "false");
  $("view-day-tab").setAttribute("aria-selected", state.view === "day" ? "true" : "false");
  $("view-spaces-tab").setAttribute("aria-selected", state.view === "spaces" ? "true" : "false");
  $("view-spaces-tab").hidden = !state.spaces;

  drawView();
  drawSide();
}

/** Draw what the chosen view, or part, of the open visit shows. */
function drawView() {
  if (state.view === "photos") {
    drawFilters();
    drawGrid();
  } else if (state.view === "spaces") {
    drawSpaces();
  } else if (state.view === "overview") {
    drawOverview();
  } else if (state.view === "details") {
    drawDetailsPart();
  } else if (state.view === "inventory") {
    drawInventoryPart();
  } else if (state.view === "reports") {
    drawReportsPart();
  } else {
    // The visit told in order. Where a visit is shown in parts, its details
    // and its summary are not above the telling: they have parts of their
    // own (Details, and Overview).
    if (PARTS) {
      $("summary").hidden = $("view-day").contains($("summary"));
    } else {
      drawVisitDetails();
      drawSummary();
    }
    drawDay();
  }
}

/** The parts that can be shown right now, in order. A part that belongs to
    a tool is only there while that tool is switched on. Null in an edition
    that has no parts (see PARTS). */
function partsShown() {
  if (!PARTS) return null;
  return PARTS.filter((part) => {
    if (part === "details") return DETAILS.length > 0;
    if (part === "spaces") return state.spaces;
    if (part === "inventory") return state.spaces && INVENTORY.length > 0;
    return true;
  });
}

/** The line under the name that says what kind of visit this is, and the
    row of tabs for its parts. */
function drawParts(parts) {
  const visit = state.visit;
  const details = visit.details || {};
  const context = [details.audit, [details.address, details.city].filter(Boolean).join(", "), visit.date].filter(Boolean);
  $("visit-context").hidden = !parts;
  const status = statusOf(visit);
  $("visit-context").replaceChildren(
    parts ? make("span", { class: "pill is-" + status, id: "visit-status", text: STATUS_WORDS[status] }) : "",
    ...context.map((words) => make("span", { text: words })),
  );

  const box = $("parts");
  box.hidden = !parts;
  if (!parts) return;
  const names = {
    overview: ["Overview"],
    details: ["Details"],
    day: [EDITION.viewName],
    spaces: ["Spaces", visit.spaces.length],
    inventory: ["Inventory", visit.entries.length],
    photos: ["Photos", visit.items.filter((item) => item.kind === "photo").length],
    reports: ["Reports"],
  };
  box.replaceChildren(...parts.map((part) => {
    const [words, count] = names[part];
    return make("button", {
      class: "part",
      type: "button",
      role: "tab",
      "aria-selected": state.view === part ? "true" : "false",
      onclick: () => {
        // (Pressed while it is already open, Spaces goes back to all of them.)
        if (part === "spaces" && state.view === "spaces") state.spaceOpen = null;
        setView(part);
      },
    }, [words, count === undefined ? null : make("span", { class: "part-count", text: String(count) })]);
  }));
  // On a narrow page the tabs are one line that slides sideways: the open
  // one is slid into sight. (Only sideways: the page itself stays put.)
  const open = box.querySelector('[aria-selected="true"]');
  if (open && box.scrollWidth > box.clientWidth) {
    const middle = open.offsetLeft - box.offsetLeft - (box.clientWidth - open.offsetWidth) / 2;
    box.scrollLeft = Math.max(0, middle);
  }
}

// ---------------------------------------------------------------------------
// The parts of a visit: Overview
// ---------------------------------------------------------------------------

/** "a, b and c". */
function listWords(words) {
  if (words.length < 2) return words.join("");
  return words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
}

/** What is left to do in the open visit, as a short list with one button
    for each line. Under it, what Mouse found, in numbers, and the summary. */
function drawOverview() {
  const visit = state.visit;
  const photos = visit.items.filter((item) => item.kind === "photo");
  const steps = [];

  // The photos and recordings themselves. They can be added at any time,
  // from whatever device this screen is on.
  const sounds = visit.items.length - photos.length;
  const none = visit.items.length === 0;
  steps.push({
    title: "Photos and recordings",
    done: none ? 0 : 1,
    all: 1,
    plain: true, // one thing to do, so no bar to fill
    words: none
      ? "None yet. " + (CAMERA_AT_HAND ? "Take them with this device, or choose ones you already have." : "Choose them from this device.")
      : plural(photos.length, "photo", "photos") + (sounds ? " and " + plural(sounds, "recording", "recordings") : "") + " so far.",
    button: none ? (CAMERA_AT_HAND ? "Take photo" : "Add photos") : "Add more",
    does: () => openChooser(none && CAMERA_AT_HAND ? "take-photo" : "choose-files"),
    second: none && CAMERA_AT_HAND ? { text: "Add photos", does: () => openChooser("choose-files") } : null,
  });

  // The boxes that describe the visit itself.
  if (DETAILS.length) {
    const missing = DETAILS.filter(([label]) => !(visit.details || {})[label]).map(([, words]) => words);
    const filled = DETAILS.length - missing.length;
    const which = missing.length > 4 ? missing.slice(0, 3).join(", ") + " and " + (missing.length - 3) + " more" : listWords(missing);
    steps.push({
      title: "Building details",
      done: filled,
      all: DETAILS.length,
      words: missing.length ? filled + " of " + DETAILS.length + " filled in. Still empty: " + which + "." : "All " + DETAILS.length + " filled in.",
      button: missing.length ? "Fill in the rest" : "See them",
      does: () => setView("details"),
    });
  }

  // The photos, sorted into the rooms and areas they were taken in.
  if (state.spaces) {
    const loose = photos.filter((item) => !spaceOf(item)).length;
    const none = visit.spaces.length === 0;
    steps.push({
      title: "Photos sorted into spaces",
      done: none ? 0 : photos.length - loose,
      all: photos.length,
      words: none ? "No spaces yet. A space is a room or an area you walked through."
        : loose ? (photos.length - loose) + " of " + photos.length + " are in a space. " + loose + " still to sort."
          : "All " + photos.length + " are in a space.",
      button: none ? "Add a space" : loose ? "Sort " + plural(loose, "photo", "photos") : "See the spaces",
      does: () => (none || !loose ? setView("spaces") : showSpace("none")),
    });
  }

  // What Mouse read, checked against the photo by a person.
  if (state.plates) {
    const read = photos.filter((item) => progress(item).values > 0);
    const waiting = read.filter(needsChecking);
    if (read.length) {
      steps.push({
        title: "Values checked",
        done: read.length - waiting.length,
        all: read.length,
        words: waiting.length
          ? (read.length - waiting.length) + " of " + read.length + " photos with values are checked. Next: " + clip(headline(waiting[0]), 60) + "."
          : "All " + read.length + " photos with values are checked.",
        button: waiting.length ? "Check the next one" : null,
        does: checkNext,
      });
    }
  }

  steps.push({
    title: "Reports",
    words: state.spaces ? "A Word report, an Excel workbook and the photos by space." : "An Excel file and a text note.",
    button: "Open reports",
    does: () => setView("reports"),
  });

  // The first line that is not finished has the button that stands out.
  const isDone = (step) => step.all !== undefined && step.done >= step.all;
  const first = steps.findIndex((step) => !isDone(step));
  const list = make("ol", { class: "steps" }, steps.map((step, number) => make("li", { class: "step" + (isDone(step) ? " is-done" : "") }, [
    make("span", { class: "step-mark", "aria-hidden": "true" }, isDone(step) ? icon(TICK) : String(number + 1)),
    make("div", {}, [
      make("div", { class: "step-title", text: step.title }),
      make("div", { class: "step-sub", text: step.words }),
      step.all && !step.plain ? make("div", { class: "step-track" }, make("div", { class: "step-bar", style: "width: " + Math.round(100 * step.done / step.all) + "%" })) : null,
    ]),
    step.button ? make("div", { class: "step-buttons" }, [
      make("button", { class: "button" + (number === first ? " button-main" : ""), type: "button", text: step.button, onclick: step.does }),
      step.second ? make("button", { class: "button", type: "button", text: step.second.text, onclick: step.second.does }) : null,
    ]) : null,
  ])));

  const found = [[photos.length, photos.length === 1 ? "photo" : "photos"]];
  const recordings = visit.items.length - photos.length;
  if (recordings) found.push([recordings, recordings === 1 ? "recording" : "recordings"]);
  if (state.spaces) {
    found.push([visit.spaces.length, visit.spaces.length === 1 ? "space" : "spaces"]);
    for (const info of INVENTORY) {
      const count = visit.entries.filter((entry) => entry.kind === info.kind).length;
      found.push([count, count === 1 ? info.one : info.many]);
    }
  }

  // (The summary's own box is moved here from the other layout's place.)
  const summary = $("summary");
  summary.hidden = false;
  $("view-overview").replaceChildren(
    make("h3", { class: "part-title", text: "What is left" }),
    make("p", { class: "part-lead", text: "Mouse keeps this list up to date. Work down it, or use the tabs above to go anywhere." }),
    list,
    make("div", { class: "found-row" }, [
      make("section", { class: "found" }, [
        make("h3", { class: "summary-title", text: "What Mouse found" }),
        make("dl", { class: "found-counts" }, found.map(([count, words]) => make("div", {}, [make("dt", { text: words }), make("dd", { text: String(count) })]))),
      ]),
      summary,
    ]),
  );
  drawSummary();
}

/** Open the first photo whose values still wait to be checked, large, with
    its values beside it. The arrows then go through the others that wait. */
function checkNext() {
  const next = state.visit.items.find((item) => item.kind === "photo" && needsChecking(item));
  if (!next) return;
  state.filter = "to-check";
  state.spaceShown = "all";
  state.picking = false;
  state.picked.clear();
  setView("photos");
  select(next.number);
  openViewer(next.number);
}

// ---------------------------------------------------------------------------
// The parts of a visit: Details
// ---------------------------------------------------------------------------

/** The boxes that describe the visit itself, as a part of their own. They
    are the same boxes the other layout folds away above the summary; here
    they are moved into this part, under a line that says what is missing. */
function drawDetailsPart() {
  const view = $("view-details");
  if (!view.contains($("about-fields"))) {
    view.replaceChildren(make("p", { class: "part-lead", id: "details-count" }), $("about-fields"));
  }
  drawVisitDetails();
}

// ---------------------------------------------------------------------------
// The parts of a visit: Inventory
// ---------------------------------------------------------------------------
// Everything noted in the building, one kind at a time, floor by floor. They
// are the same things each space's own page shows; here they are together.

/** Where a floor comes in a building, for putting floors in order: cellars
    first, then the numbered floors upwards, then anything else by its name,
    and the roof last. */
function floorRank(floor) {
  const words = String(floor || "").trim().toLowerCase();
  if (!words) return [4, 0, ""];
  if (/^(sub|cellar|basement|lower)/.test(words) || /^b\d*$/.test(words)) return [0, 0, words];
  if (/roof|penthouse/.test(words)) return [3, 0, words];
  const number = numberIn(words.replace(/^(floor|level|fl\.?)\s*/, ""));
  if (number !== null) return [1, number, words];
  if (/^(g|ground|lobby|first)\b/.test(words)) return [1, 1, words];
  return [2, 0, words];
}

/** A floor as a heading: "Floor 3", "Basement", "Roof". */
function floorWords(floor) {
  const words = String(floor || "").trim();
  if (!words) return "Floor not said";
  return /^\d+$/.test(words) ? "Floor " + words : words.charAt(0).toUpperCase() + words.slice(1);
}

/** The few values that tell one entry from another in a list, after its
    title: "1,200 MBH, 15 yrs, Fair". Which values, and what is written after
    one that is a bare number, is the kind's `brief` (see editions.js). */
function briefOf(entry, info) {
  return (info.brief || [])
    .map(([label, after]) => {
      const value = String(entry.fields[label] || "").trim();
      if (!value) return "";
      const words = after && /^[\d.,]+$/.test(value) ? value + after : value;
      // An age is said against the typical life, where the person has given one.
      const life = label === "age" ? typicalLife(entry.fields.equipment) : null;
      return life ? words + " of about " + life : words;
    })
    .filter(Boolean)
    .join(", ");
}

/** How many of an entry's values there are, and how many wait for a tick. */
function entryProgress(entry) {
  const filled = Object.keys(entry.fields).filter((label) => entry.fields[label]);
  return { values: filled.length, waiting: filled.filter((label) => !entry.checked.includes(label)).length };
}

/** One entry as one line of a list. A click opens it beside the list.
    `withWhere` says which space it is in (not needed on that space's page). */
function inventoryRow(entry, info, withWhere = true) {
  const space = spaceOf(entry);
  const photo = filesOf(entry).find((item) => item.kind === "photo");
  const { values, waiting } = entryProgress(entry);
  const worked = info.sum ? sumFor(entry, info.sum) : null;
  const yearly = yearlyFor(entry, info);
  const where = withWhere ? (space ? "In " + space.name : "Not in a space yet") : "";
  const line = [briefOf(entry, info), where].filter(Boolean).join(". ");
  return make("button", {
    class: "row",
    type: "button",
    "aria-current": state.side === "entry" && state.entryOpen === entry.id ? "true" : "false",
    onclick: () => openEntry(entry.id),
  }, [
    photo ? thumbnail(photo, "row-thumb") : make("span", { class: "row-thumb is-missing", text: "No photo" }),
    make("span", { class: "row-words" }, [
      make("span", { class: "row-title", text: entryTitle(entry) }),
      line ? make("span", { class: "row-line", text: line + "." }) : null,
    ]),
    worked !== null ? make("span", { class: "row-sum" }, [
      tidyNumber(worked) + " " + info.sum.unit,
      yearly !== null ? make("small", { text: tidyNumber(yearly) + " " + info.yearly.words }) : null,
    ]) : null,
    values ? make("span", { class: "pill " + (waiting ? "is-waiting" : "is-done"), text: waiting ? waiting + " to check" : "All checked" }) : null,
  ]);
}

/** Open an entry beside the list: its photos, its values with their ticks,
    its notes, and where it is. */
function openEntry(id) {
  state.entryOpen = id;
  state.side = "entry";
  drawView();
  drawSide();
}

/** The side panel with one entry in it. It is the entry's own card, the
    one place its values are typed and ticked. */
function drawEntryPanel() {
  const entry = state.visit.entries.find((one) => one.id === state.entryOpen);
  if (!entry) {
    state.side = null;
    state.entryOpen = null;
    drawSide();
    return;
  }
  const info = kindInfo(entry.kind);
  const space = spaceOf(entry);
  $("side-photo").replaceChildren(make("div", { class: "entry-panel" }, [
    make("p", { class: "detail-name" }, [info.name + ". ", space
      ? make("button", { class: "button button-quiet", type: "button", text: "In " + space.name, title: "Open this space", onclick: () => openSpace(space.id) })
      : "Not in a space yet."]),
    drawEntry(entry, info, () => { drawView(); syncStatus(); }),
  ]));
}

// ---------------------------------------------------------------------------
// What is worked out from the values: energy, age, and a typical life
// ---------------------------------------------------------------------------

/** The hours a year a typed number of hours stands for: up to 24 is taken
    as hours a day, anything more as hours a year. */
function hoursAYear(text) {
  const hours = numberIn(text);
  if (hours === null || hours < 0) return null;
  return hours <= 24 ? hours * 365 : hours;
}

/** What an entry uses in a year (a light fitting's kWh: its watts times its
    hours, over 1000), or null while a number it needs is missing. */
function yearlyFor(entry, info) {
  if (!info.yearly || !info.sum) return null;
  const power = sumFor(entry, info.sum);
  const hours = hoursAYear(entry.fields[info.yearly.hours]);
  if (power === null || hours === null) return null;
  return Math.round(power * hours / 1000);
}

/** ", 1.51 W per sq ft": a kind's total in a space over the space's floor
    area, for a kind that has such a number (lighting: its power density). */
function perAreaWords(info, space, spaceId) {
  if (!info.perArea || !info.sum || !space) return "";
  const area = numberIn(space.area);
  const worked = entriesIn(spaceId).filter((entry) => entry.kind === info.kind)
    .map((entry) => sumFor(entry, info.sum)).filter((number) => number !== null);
  if (!area || !worked.length) return "";
  return ", " + tidyNumber(Math.round(100 * worked.reduce((all, number) => all + number, 0) / area) / 100) + " " + info.perArea;
}

/** The year in a date as plates print them ("3/2010", "2014.8", "2019"). */
function yearIn(text) {
  const found = String(text || "").match(/\b(19[5-9]\d|20\d\d)\b/);
  const year = found ? Number(found[1]) : null;
  return year && year <= new Date().getFullYear() ? year : null;
}

/** The year a serial number points to, for the makers whose serial numbers
    are known to start with it. Guides differ on the details, and a serial
    number says when a thing was made, not when it was put in: so this is
    only ever offered, never filled in by itself. */
function yearFromSerial(maker, serial) {
  const name = String(maker || "").toLowerCase();
  const number = String(serial || "").trim().toUpperCase();
  const thisYear = new Date().getFullYear();
  const whole = (two) => (2000 + two <= thisYear ? 2000 + two : 1900 + two);
  // Carrier, Bryant, Payne: the week, the year, then a letter.
  // "2311E98765" is week 23 of 2011.
  if (/carrier|bryant|payne/.test(name)) {
    const found = number.match(/^(\d\d)(\d\d)[A-Z]/);
    if (found && Number(found[1]) >= 1 && Number(found[1]) <= 53) {
      return { year: whole(Number(found[2])), why: "serial numbers of this make usually start with the week and the year" };
    }
  }
  // Goodman, Amana, Daikin: the year first. "1407499099" is 2014.
  if (/goodman|amana|daikin/.test(name)) {
    const found = number.match(/^(\d\d)(\d\d)\d{4,}$/);
    if (found && Number(found[2]) >= 1 && Number(found[2]) <= 53) {
      return { year: whole(Number(found[1])), why: "serial numbers of this make usually start with the year" };
    }
  }
  return null;
}

/** When a thing was made, as far as its photos and its own values say: a
    date printed on the plate first (that is certain), then what its serial
    number points to (that is not). */
function madeIn(entry) {
  const sources = [...filesOf(entry).map((file) => file.fields), entry.fields];
  for (const fields of sources) {
    for (const [label, value] of Object.entries(fields)) {
      if (label === "age" || !/date|year|mfg|mfd|manufactur/i.test(label)) continue;
      const year = yearIn(value);
      if (year) return { year, sure: true, words: "The plate gives its " + labelText(label).toLowerCase() + " as " + value };
    }
  }
  for (const fields of sources) {
    const found = yearFromSerial(fields.make || entry.fields.make, fields.serial);
    if (found) return { year: found.year, sure: false, words: "Its serial number (" + fields.serial + ") points to " + found.year + ": " + found.why };
  }
  return null;
}

/** The typical lives of equipment, in years, by kind of equipment. They are
    the person's own, typed in from their handbook and kept on this
    computer. None are built in. */
function typicalLives() {
  try {
    return JSON.parse(recall("mouse-lives") || "{}") || {};
  } catch {
    return {};
  }
}

function typicalLife(type) {
  const years = Number(typicalLives()[String(type || "").trim().toLowerCase()]);
  return years > 0 ? years : null;
}

/** The folded-away table where those typical lives are typed in. */
function drawLives(info) {
  const types = (info.values.find(([label]) => label === "equipment") || [])[2] || [];
  const lives = typicalLives();
  return make("details", { class: "lives" }, [
    make("summary", { text: "Typical life of equipment (yours to fill in)" }),
    make("p", { class: "hint", text: here("Type the typical life of each kind of equipment, in years, from your own handbook. Mouse then says how an age sits against it. None are built in, and they are kept on this computer only.") }),
    make("div", { class: "lives-rows" }, types.map((type) => {
      const key = type.toLowerCase();
      const input = make("input", {
        class: "input lives-years", type: "number", min: "1", max: "99", value: lives[key] || "",
        "aria-label": "Typical life of a " + key + ", in years",
      });
      // (Kept as it is typed. The lists show it the next time they are drawn,
      // so that typing down the table is not interrupted.)
      input.addEventListener("change", () => {
        const all = typicalLives();
        if (Number(input.value) > 0) all[key] = Number(input.value);
        else delete all[key];
        remember("mouse-lives", JSON.stringify(all));
      });
      return make("label", { class: "lives-row" }, [make("span", { text: type }), input, make("span", { class: "quiet", text: "years" })]);
    })),
  ]);
}

// ---------------------------------------------------------------------------
// The status of a visit (an edition that shows visits in parts)
// ---------------------------------------------------------------------------

const STATUS_WORDS = { new: "Not started", progress: "In progress", complete: "Complete" };

/** Where a visit has got to: complete once it has been marked so, in
    progress once anything has been done to it by hand, new until then.
    (The Mouse program works it out the same way for the list.) */
function statusOf(visit) {
  const marked = String((visit.details || {}).status || "").trim().toLowerCase();
  if (marked === "complete" || marked === "filed") return "complete";
  const touched = visit.spaces.length || visit.entries.length
    || Object.keys(visit.details || {}).some((label) => label !== "status")
    || visit.items.some((item) => (item.checked || []).length);
  return touched ? "progress" : "new";
}

/** Keep what the screen says of the open visit's status in step with the
    visit, which changes as it is worked on: in the list, under its name,
    and on the button. */
function syncStatus() {
  if (!PARTS || !state.visit) return;
  const now = statusOf(state.visit);
  const listed = state.visits.find((one) => one.id === state.visit.id);
  if (listed && listed.status !== now) {
    listed.status = now;
    drawVisits();
  }
  const pill = $("visit-status");
  if (pill) {
    pill.className = "pill is-" + now;
    pill.textContent = STATUS_WORDS[now];
  }
  $("mark-complete").textContent = now === "complete" ? "Reopen" : "Mark as complete";
}

/** The chips over the list of visits that show them by status. */
function drawStatusChips() {
  const box = $("status-chips");
  const counts = { all: state.visits.length };
  for (const visit of state.visits) counts[visit.status] = (counts[visit.status] || 0) + 1;
  box.hidden = !PARTS || state.visits.length < 2;
  if (!counts[state.statusShown]) state.statusShown = "all";
  box.replaceChildren(...[["all", "All"], ["progress", "In progress"], ["complete", "Complete"], ["new", "Not started"]]
    .filter(([key]) => counts[key])
    .map(([key, words]) => make("button", {
      class: "filter",
      type: "button",
      "aria-pressed": state.statusShown === key ? "true" : "false",
      text: words + " " + counts[key],
      onclick: () => { state.statusShown = key; drawVisits(); },
    })));
}

/** What in the open visit still waits: photos with unchecked values, photos
    in no space. As the ends of a sentence, or none. */
function openThings() {
  const visit = state.visit;
  const waiting = state.plates ? visit.items.filter(needsChecking).length : 0;
  const loose = state.spaces && visit.spaces.length ? visit.items.filter((item) => item.kind === "photo" && !spaceOf(item)).length : 0;
  return [
    waiting ? plural(waiting, "photo has", "photos have") + " values that are not checked" : "",
    loose ? plural(loose, "photo is", "photos are") + " not in a space" : "",
  ].filter(Boolean);
}

/** Mark the open visit as complete, or open it again. Marking never waits
    for everything to be checked: it says what is still open, and can be
    undone. */
async function toggleComplete() {
  if (!state.visit) return;
  const complete = statusOf(state.visit) === "complete";
  if (!await changeVisit("/details", { label: "status", value: complete ? null : "Complete" })) return;
  drawVisit();
  if (complete) {
    say("Open again.");
    return;
  }
  const open = openThings();
  say(open.length ? "Marked as complete. Still open: " + open.join(", and ") + ". You can reopen it." : "Marked as complete.");
}

function drawInventoryPart() {
  const visit = state.visit;
  if (!INVENTORY.some((info) => info.kind === state.kindShown)) state.kindShown = INVENTORY[0].kind;
  const info = kindInfo(state.kindShown);
  const ofKind = visit.entries.filter((entry) => entry.kind === info.kind);

  const chips = make("div", { class: "filter-row", role: "group", "aria-label": "Show" }, INVENTORY.map((one) => make("button", {
    class: "filter",
    type: "button",
    "aria-pressed": one.kind === info.kind ? "true" : "false",
    text: one.name + " " + visit.entries.filter((entry) => entry.kind === one.kind).length,
    onclick: () => { state.kindShown = one.kind; drawInventoryPart(); },
  })));

  // Floor by floor: each entry under the floor of the space it is in.
  const floors = new Map();
  for (const entry of ofKind) {
    const space = spaceOf(entry);
    const name = space ? floorWords(space.floor) : "Not in a space yet";
    if (!floors.has(name)) floors.set(name, { rank: space ? floorRank(space.floor) : [5, 0, ""], entries: [] });
    floors.get(name).entries.push(entry);
  }
  const byFloor = [...floors.entries()].sort(([, a], [, b]) =>
    a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.rank[2].localeCompare(b.rank[2]));

  const list = [];
  for (const [name, floor] of byFloor) {
    list.push(make("h4", { class: "floor-head" }, [name, make("span", { class: "part-count", text: String(floor.entries.length) })]));
    list.push(make("div", { class: "rows" }, floor.entries.map((entry) => inventoryRow(entry, info))));
  }
  if (!ofKind.length) {
    list.push(make("p", { class: "quiet", text: "No " + info.many + " noted yet." }));
  }

  // What the kind adds up to, for the whole building, and in a year.
  if (info.sum) {
    const worked = ofKind.map((entry) => sumFor(entry, info.sum)).filter((number) => number !== null);
    const yearly = ofKind.map((entry) => yearlyFor(entry, info)).filter((number) => number !== null);
    if (worked.length) {
      list.push(make("p", { class: "rows-total" }, [
        info.sum.words.replace(/\s*\(.*\)$/, "") + " for the building: ",
        make("strong", { text: tidyNumber(worked.reduce((all, number) => all + number, 0)) + " " + info.sum.unit }),
        worked.length < ofKind.length ? " (" + worked.length + " of " + ofKind.length + " counted)" : "",
        yearly.length ? ". About " : "",
        yearly.length ? make("strong", { text: tidyNumber(yearly.reduce((all, number) => all + number, 0)) + " " + info.yearly.words }) : null,
        yearly.length && yearly.length < ofKind.length ? " (" + yearly.length + " of " + ofKind.length + " have their hours)" : "",
      ]));
    }
    if (info.yearly && ofKind.length) {
      list.push(make("p", { class: "hint", style: "max-width: 880px; text-align: right", text: "Hours up to 24 are taken as hours a day, anything more as hours a year." }));
    }
  }

  // Adding one from here: it needs to be told which space it is in.
  const where = make("select", { class: "select", "aria-label": "The space to add it to" }, [
    make("option", { value: "", text: "In no space yet" }),
    ...visit.spaces.map((space) => make("option", { value: space.id, text: "In " + space.name })),
  ]);
  if (visit.spaces.some((space) => space.id === state.spaceForNew)) where.value = state.spaceForNew;
  const add = make("div", { class: "rows-add" }, [
    make("button", { class: "button", type: "button", text: info.add, onclick: () => { state.spaceForNew = where.value; addEntry(info, where.value || null); } }),
    where,
  ]);

  $("view-inventory").replaceChildren(...[
    make("p", { class: "part-lead", text: "Everything noted in the building, floor by floor. Click one to open it beside the list." }),
    chips,
    add,
    ...list,
    info.values.some(([label]) => label === "age") ? drawLives(info) : null,
  ].filter(Boolean));
}

// ---------------------------------------------------------------------------
// The parts of a visit: Reports
// ---------------------------------------------------------------------------

/** The files a visit gives, each with a line about what is in it. Above
    them it says, plainly, what has not been checked or sorted yet. */
function drawReportsPart() {
  const visit = state.visit;
  const choices = [];
  if (state.spaces) {
    choices.push(["Word report", "The visit told space by space, with its photos, and schedules at the end.", saveWordReport]);
    choices.push(["Excel workbook", "A sheet each for spaces, equipment, lighting, windows and meters, with totals.", exportToExcel]);
    choices.push(["Photos by space", "A zip file with a folder for each space.", savePhotosZip]);
  } else {
    choices.push(["Excel file", "A row for each photo, with what was read in it.", exportToExcel]);
  }
  choices.push(["Copy as text", phrase("This whole {noun} as text, to paste anywhere."), copyNote]);
  choices.push(["Save as a note", phrase("This whole {noun} as a text note."), saveNote]);

  const open = openThings();

  $("view-reports").replaceChildren(...[
    open.length ? make("p", { class: "notice", text: "Before you send anything out: " + open.join(", and ") + ". Every report can still be made." }) : null,
    make("div", { class: "rows" }, choices.map(([title, words, does]) => make("button", { class: "row", type: "button", onclick: does }, [
      make("span", { class: "row-words" }, [make("span", { class: "row-title", text: title }), make("span", { class: "row-line", text: words })]),
    ]))),
  ].filter(Boolean));
}

/** The facts under the title, like the properties at the top of a note. */
function drawFacts() {
  const visit = state.visit;
  const items = visit.items;
  const toCheck = items.filter(needsChecking).length;
  const plates = items.filter(isNameplate).length;

  const facts = [["Date", visit.date], ["Photos", String(visit.photos)]];
  if (visit.audio) facts.push(["Audio", String(visit.audio)]);
  if (visit.video) facts.push(["Video", String(visit.video)]);
  // These two only matter to someone using the nameplates tool.
  if (state.plates && plates) {
    facts.push(["Nameplates", String(plates)]);
    facts.push(["To check", toCheck === 0 ? "all done" : String(toCheck), toCheck > 0]);
  }
  // And these two to someone sorting photos into spaces.
  if (state.spaces && visit.spaces.length) {
    const loose = unsorted().length;
    facts.push(["Spaces", String(visit.spaces.length)]);
    facts.push(["To sort", loose === 0 ? "all done" : String(loose), loose > 0]);
  }
  // What has been noted in them, kind by kind.
  if (state.spaces) {
    for (const info of INVENTORY) {
      const count = visit.entries.filter((entry) => entry.kind === info.kind).length;
      if (count) facts.push([info.name, String(count)]);
    }
  }

  const list = $("visit-facts");
  list.replaceChildren();
  for (const [name, value, needsYou] of facts) {
    list.append(make("div", { class: needsYou ? "needs-you" : "" }, [
      make("dt", { text: name }),
      make("dd", { text: value }),
    ]));
  }
}

function setView(view) {
  state.view = view;
  remember("mouse-view", view);
  drawVisit();
}

// ---------------------------------------------------------------------------
// Photos view: filters and tiles
// ---------------------------------------------------------------------------

function shownItems() {
  let items = state.visit.items;
  if (state.view === "day") return inOrder(items);

  // First by space (the Spaces tool), then by what the photo is (Nameplates).
  if (state.spaces && state.spaceShown !== "all") {
    items = items.filter((item) =>
      state.spaceShown === "none" ? !spaceOf(item) : item.space === state.spaceShown);
  }
  switch (state.filter) {
    case "nameplates": return items.filter(isNameplate);
    case "to-check": return items.filter(needsChecking);
    case "other": return items.filter((item) => !isNameplate(item));
    default: return items;
  }
}

function drawFilters() {
  const items = state.visit.items;
  const filters = $("filters");
  filters.replaceChildren();

  // Each tool brings its own row of filters. With neither tool on there is
  // nothing to filter by.
  if (!state.plates) state.filter = "all";
  if (!state.spaces) {
    state.spaceShown = "all";
    state.picking = false;
    state.picked.clear();
  }
  filters.hidden = !state.plates && !state.spaces;
  if (filters.hidden) return;

  const chip = (words, pressed, onclick) => make("button", {
    class: "filter",
    type: "button",
    "aria-pressed": pressed ? "true" : "false",
    text: words,
    onclick,
  });
  const redraw = () => { drawFilters(); drawGrid(); };

  if (state.plates) {
    const choices = [
      ["all", "All", items.length],
      ["nameplates", "Nameplates", items.filter(isNameplate).length],
      ["to-check", "To check", items.filter(needsChecking).length],
      ["other", "Everything else", items.filter((item) => !isNameplate(item)).length],
    ];
    const row = make("div", { class: "filter-row", role: "group", "aria-label": "Show" });
    for (const [id, name, count] of choices) {
      row.append(chip(name + " " + count, state.filter === id, () => { state.filter = id; redraw(); }));
    }
    filters.append(row);
  }

  if (state.spaces) {
    const show = (which) => () => { state.spaceShown = which; redraw(); };
    const row = make("div", { class: "filter-row", role: "group", "aria-label": "Space" });
    row.append(make("span", { class: "quiet", text: "Space" }));
    row.append(chip("All " + items.length, state.spaceShown === "all", show("all")));
    for (const space of state.visit.spaces) {
      row.append(chip(space.name + " " + itemsIn(space).length, state.spaceShown === space.id, show(space.id)));
    }
    if (state.visit.spaces.length) {
      row.append(chip("Not sorted " + unsorted().length, state.spaceShown === "none", show("none")));
    }
    row.append(make("button", {
      class: "button button-small pick-toggle",
      type: "button",
      "aria-pressed": state.picking ? "true" : "false",
      text: state.picking ? "Stop picking" : "Pick photos",
      title: "Pick several photos to put into a space together",
      onclick: () => { state.picking = !state.picking; state.picked.clear(); redraw(); },
    }));
    filters.append(row);
  }
}

function drawGrid() {
  const grid = $("grid");
  grid.replaceChildren();
  const items = shownItems();
  drawPickBar();
  // Adding from this device. While the tiles show one space, what is added
  // goes into that space.
  const shown = state.spaces && !["all", "none"].includes(state.spaceShown) ? state.spaceShown : null;
  $("add-bar").replaceChildren(...addButtons(shown).filter(Boolean));

  if (items.length === 0) {
    grid.append(make("p", { class: "nothing", text: "Nothing to show here." }));
    return;
  }
  for (const item of items) grid.append(drawTile(item));
}

/** A small picture of a photo. One that cannot be shown gets words. */
function thumbnail(item, className) {
  if (item.kind !== "photo") {
    return make("div", { class: className + " is-missing", text: labelText(item.kind) + " file" });
  }
  const picture = make("img", { class: className, src: pictureAddress(item, "thumb"), alt: "", loading: "lazy" });
  picture.addEventListener("error", () => {
    picture.replaceWith(make("div", { class: className + " is-missing", text: "No preview" }));
  });
  return picture;
}

function checkedLine(item) {
  const { values, checked } = progress(item);
  if (values === 0 || !state.plates) return null;
  const done = checked === values;
  return make("div", {
    class: "tile-checked " + (done ? "is-done" : "is-waiting"),
    text: done ? "All " + values + " checked" : checked + " of " + values + " checked",
  });
}

function drawTile(item) {
  // While photos are being picked, a click picks; otherwise it opens.
  const picking = state.spaces && state.picking;
  const picked = picking && state.picked.has(item.number);
  const space = state.spaces ? spaceOf(item) : null;

  return make("button", {
    class: "tile" + (picking ? " is-picking" : "") + (picked ? " is-picked" : ""),
    type: "button",
    "aria-label": kindWords(item) + ": " + headline(item),
    "data-number": item.number,
    "aria-current": state.selected === item.number ? "true" : "false",
    "aria-pressed": picking ? (picked ? "true" : "false") : null,
    onclick: () => (picking ? togglePicked(item.number) : select(item.number)),
    // A double-click goes straight to the photo, large.
    ondblclick: () => { if (!picking && item.kind === "photo") openViewer(item.number); },
  }, [
    thumbnail(item, "tile-picture"),
    make("span", { class: "tag" + (isNameplate(item) ? " is-plate" : ""), text: kindWords(item) }),
    make("div", { class: "tile-words" }, [
      make("div", { class: "tile-title", text: headline(item) }),
      make("div", { class: "tile-sub", text: space ? space.name : subline(item) }),
      checkedLine(item),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// Spaces: the rooms and areas a visit's photos are sorted into
// ---------------------------------------------------------------------------

/** The space a file belongs to, or null when it has not been sorted. */
function spaceOf(item) {
  return state.visit.spaces.find((space) => space.id === item.space) || null;
}

function itemsIn(space) {
  return state.visit.items.filter((item) => item.space === space.id);
}

function unsorted() {
  return state.visit.items.filter((item) => !spaceOf(item));
}

/** Floor, use, area and height of a space, as short facts. */
function spaceFacts(space) {
  const facts = [];
  if (space.floor) facts.push(["Floor", space.floor]);
  if (space.occupancy) facts.push(["Used as", space.occupancy]);
  if (space.area) facts.push(["Area", space.area + " sq ft"]);
  if (space.height) facts.push(["Height", space.height + " ft"]);
  return facts;
}

/** Put files into a space, or (with no space) take them out of every one. */
async function sortItems(numbers, spaceId) {
  try {
    takeVisit(await ask(visitAddress() + "/sort", { items: numbers, space: spaceId }));
    return true;
  } catch (problem) {
    say(problem.message, true);
    return false;
  }
}

function togglePicked(number) {
  if (state.picked.has(number)) state.picked.delete(number);
  else state.picked.add(number);
  const tile = $("grid").querySelector('.tile[data-number="' + number + '"]');
  if (tile) {
    tile.classList.toggle("is-picked", state.picked.has(number));
    tile.setAttribute("aria-pressed", state.picked.has(number) ? "true" : "false");
  }
  drawPickBar();
}

/** The bar that appears while photos are being picked. */
function drawPickBar() {
  const bar = $("pick-bar");
  bar.hidden = !(state.spaces && state.picking && state.view === "photos");
  bar.replaceChildren();
  if (bar.hidden) return;

  const count = state.picked.size;
  const spaces = state.visit.spaces;
  const choice = make("select", { class: "select", "aria-label": "The space to put the picked photos into" },
    spaces.map((space) => make("option", { value: space.id, text: space.name })));
  // Offer the space being looked at first, when there is one.
  if (spaces.some((space) => space.id === state.spaceShown)) choice.value = state.spaceShown;

  const move = async (spaceId) => {
    if (await sortItems([...state.picked], spaceId)) {
      say(plural(count, "photo", "photos") + (spaceId ? " put into " + spaceOf({ space: spaceId }).name + "." : " taken out of their spaces."));
      state.picked.clear();
      drawVisit();
    }
  };

  bar.append(make("span", {
    class: "pick-count",
    text: count === 0 ? "Click the photos you want to move" : plural(count, "photo picked", "photos picked"),
  }));
  if (spaces.length) {
    bar.append(choice, make("button", {
      class: "button button-main button-small", type: "button", text: "Put in this space",
      disabled: count === 0, onclick: () => move(choice.value),
    }));
  } else {
    bar.append(make("button", {
      class: "button button-small", type: "button", text: "Add a space first", onclick: () => openSpaceDialog(),
    }));
  }
  bar.append(make("button", {
    class: "button button-small", type: "button", text: "Take out of spaces",
    disabled: count === 0, onclick: () => move(null),
  }));
}

/** The Spaces view: one card for each space, and one for what is not sorted. */
function drawSpaces() {
  const box = $("spaces");
  box.replaceChildren();
  const visit = state.visit;

  // One space's own page, when one has been opened.
  $("add-space").parentElement.hidden = state.spaceOpen !== null;
  if (state.spaceOpen !== null) {
    drawSpacePage();
    return;
  }

  if (visit.spaces.length === 0) {
    box.append(make("p", {
      class: "nothing",
      text: "No spaces yet. Add the first room or area you walked through, then put photos into it. " +
        "A quick way: in the " + EDITION.viewName + " view, choose \"Start a space here\" on the first " +
        "photo you took in a room, and the photos after it follow.",
    }));
    return;
  }

  for (const space of visit.spaces) {
    const items = itemsIn(space);
    const facts = spaceFacts(space);
    box.append(make("article", { class: "space-card" }, [
      make("div", { class: "space-strip" },
        items.filter((item) => item.kind === "photo").slice(0, 4).map((item) => thumbnail(item, "space-thumb"))),
      make("div", { class: "space-words" }, [
        make("h3", { class: "space-name", text: space.name }),
        facts.length ? make("dl", { class: "facts" }, facts.map(([name, value]) =>
          make("div", {}, [make("dt", { text: name }), make("dd", { text: value })]))) : null,
        make("p", { class: "space-count", text: [items.length === 0 ? "No photos in it yet" : plural(items.length, "photo", "photos")]
          .concat(inventoryCounts(space.id)).join(", ") }),
        space.notes ? make("p", { class: "space-notes", text: space.notes }) : null,
        make("div", { class: "space-actions" }, [
          make("button", { class: "button button-main button-small", type: "button", text: "Open", onclick: () => openSpace(space.id) }),
          make("button", { class: "button button-small", type: "button", text: "See its photos", onclick: () => showSpace(space.id) }),
          make("button", { class: "button button-small", type: "button", text: "Change", onclick: () => openSpaceDialog(space) }),
        ]),
      ]),
    ]));
  }

  const loose = unsorted();
  const looseNoted = inventoryCounts(null);
  if (loose.length || looseNoted.length) {
    box.append(make("article", { class: "space-card is-loose" }, [
      make("div", { class: "space-words" }, [
        make("h3", { class: "space-name", text: "Not sorted yet" }),
        make("p", { class: "space-count", text: [plural(loose.length, "photo", "photos")].concat(looseNoted).join(", ") + " in no space." }),
        make("div", { class: "space-actions" }, [
          make("button", { class: "button button-small", type: "button", text: "Open", onclick: () => openSpace("none") }),
          make("button", { class: "button button-small", type: "button", text: "See the photos", onclick: () => showSpace("none") }),
        ]),
      ]),
    ]));
  }
}

/** Open one space's own page (or, with "none", what is in no space). */
function openSpace(which) {
  state.spaceOpen = which;
  setView("spaces");
}

// ---------------------------------------------------------------------------
// Entries: what was noted in a space (equipment, lighting, windows, meters)
// ---------------------------------------------------------------------------

// The kinds of entry this edition has, and the values of each. An edition
// with none (the everyday one) shows nothing about entries.
const INVENTORY = EDITION.inventory || [];

function kindInfo(kind) {
  return INVENTORY.find((info) => info.kind === kind)
    || { kind, name: labelText(kind), add: "Add", one: kind, many: kind, title: [], values: [] };
}

/** The entry a file shows, or null. */
function entryOf(item) {
  return state.visit.entries.find((entry) => entry.id === item.entry) || null;
}

function filesOf(entry) {
  return state.visit.items.filter((item) => item.entry === entry.id);
}

/** The entries in one space; with null, the ones in no space. */
function entriesIn(spaceId) {
  return state.visit.entries.filter((entry) =>
    spaceId === null ? !spaceOf(entry) : entry.space === spaceId);
}

/** "2 equipment", "1 meter"...: what is noted in a space, kind by kind. */
function inventoryCounts(spaceId) {
  const entries = entriesIn(spaceId);
  return INVENTORY
    .map((info) => [info, entries.filter((entry) => entry.kind === info.kind).length])
    .filter(([, count]) => count > 0)
    .map(([info, count]) => plural(count, info.one, info.many));
}

/** The number a typed value starts with, if it starts with one: "32" is 32,
    "32 W" is 32, "1,750 RPM" is 1750, and "about 5" is not a number.
    (The reports work totals out the same way, in mouse-core/src/kinds.rs.) */
function numberIn(text) {
  let digits = "";
  let seenPoint = false;
  for (const letter of String(text || "").trim()) {
    if (letter >= "0" && letter <= "9") digits += letter;
    else if (letter === "," && digits && !seenPoint) continue;   // 1,750
    else if (letter === "." && !seenPoint) { seenPoint = true; digits += "."; }
    else break;
  }
  return /\d/.test(digits) ? parseFloat(digits) : null;
}

/** The number worked out for one entry (a light fitting's total watts, a
    window's area), or null while a value it needs is missing. */
function sumFor(entry, sum) {
  let result = 1;
  for (const label of sum.of) {
    const number = numberIn(entry.fields[label]);
    if (number === null) return null;
    result *= number;
  }
  return Math.round((result / (sum.divideBy || 1)) * 100) / 100;
}

/** A number the way people write it: 384, 12.5, 1,750. */
function tidyNumber(number) {
  return number.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** How many of a kind a space has, and their total where the kind has one:
    "3, 968 W in all". Says so when an entry could not be counted. */
function countWords(info, spaceId) {
  const ofKind = entriesIn(spaceId).filter((entry) => entry.kind === info.kind);
  if (ofKind.length === 0) return "none yet";
  if (!info.sum) return String(ofKind.length);
  const worked = ofKind.map((entry) => sumFor(entry, info.sum)).filter((number) => number !== null);
  if (worked.length === 0) return String(ofKind.length);
  const total = worked.reduce((all, number) => all + number, 0);
  const missed = worked.length < ofKind.length ? " (" + worked.length + " of " + ofKind.length + " counted)" : "";
  return ofKind.length + ", " + tidyNumber(total) + " " + info.sum.unit + " in all" + missed;
}

/** What an entry is called: by what it is, its make and model, or whatever
    values its kind is named by. */
function entryTitle(entry) {
  const info = kindInfo(entry.kind);
  const words = info.title.map((label) => entry.fields[label]).filter(Boolean).join(" ");
  if (words) return words;
  // Nothing to call it by yet. Its first photo's name at least tells two
  // such entries apart.
  const photo = filesOf(entry)[0];
  return photo ? "Not named yet (" + photo.name + ")" : "Not named yet";
}

/** One space's own page: what is noted in it, kind by kind, and its photos. */
function drawSpacePage() {
  const box = $("spaces");
  const visit = state.visit;
  const space = state.spaceOpen === "none" ? null : visit.spaces.find((one) => one.id === state.spaceOpen);
  if (state.spaceOpen !== "none" && !space) {
    // The space has gone (removed): back to the cards.
    state.spaceOpen = null;
    drawSpaces();
    return;
  }

  const spaceId = space ? space.id : null;
  const files = space ? itemsIn(space) : unsorted();
  const entries = entriesIn(spaceId);
  const facts = space ? spaceFacts(space) : [];
  const page = make("div", { class: "space-page" });

  page.append(make("div", { class: "space-head" }, [
    make("button", { class: "button button-small", type: "button", text: "All spaces", onclick: () => { state.spaceOpen = null; drawVisit(); } }),
    make("h3", { class: "space-title", text: space ? space.name : "Not sorted yet" }),
    space ? make("button", { class: "button button-small", type: "button", text: "Change", onclick: () => openSpaceDialog(space) }) : null,
  ]));
  if (facts.length) {
    page.append(make("dl", { class: "facts" }, facts.map(([name, value]) =>
      make("div", {}, [make("dt", { text: name }), make("dd", { text: value })]))));
  }
  if (space && space.notes) page.append(make("p", { class: "space-page-notes", text: space.notes }));

  for (const info of INVENTORY) {
    const ofKind = entries.filter((entry) => entry.kind === info.kind);
    // Photos here that could each become an entry of this kind: for
    // equipment, the nameplates nobody has made an entry from yet.
    const waiting = info.fillsFromPhoto
      ? files.filter((file) => file.kind === "photo" && file.looks_like === "nameplate" && !entryOf(file))
      : [];

    // How many there are, their total and, where the kind has one, that
    // total over the floor area of the space.
    const count = make("span", { class: "quiet", text: countWords(info, spaceId) + perAreaWords(info, space, spaceId) });

    const section = make("section", { class: "inventory" }, [
      make("div", { class: "inventory-head" }, [
        make("h4", { text: info.name }),
        count,
        make("button", { class: "button button-small", type: "button", text: info.add, onclick: () => addEntry(info, spaceId) }),
        waiting.length ? make("button", {
          class: "button button-small",
          type: "button",
          text: "Make " + info.one + " from the " + plural(waiting.length, "nameplate", "nameplates") + " here",
          title: "One entry for each nameplate photo in this space, filled in from what Mouse read on it",
          onclick: () => makeFromPhotos(info, waiting),
        }) : null,
      ]),
    ]);
    // One line for each. A click opens it beside the list.
    if (ofKind.length) section.append(make("div", { class: "rows" }, ofKind.map((entry) => inventoryRow(entry, info, false))));
    page.append(section);
  }

  // The photos in this space, small. A click opens one in the side panel.
  const strip = make("div", { class: "photo-strip" }, files.map((file) => {
    const picture = thumbnail(file, "strip-thumb");
    picture.title = file.name;
    picture.addEventListener("click", () => select(file.number));
    return picture;
  }));
  page.append(make("section", { class: "inventory" }, [
    make("div", { class: "inventory-head" }, [
      make("h4", { text: "Photos" }),
      make("span", { class: "quiet", text: files.length ? String(files.length) : "none yet" }),
      // Taken or chosen on this device, they go straight into this space.
      ...addButtons(spaceId, true),
      files.length ? make("button", { class: "button button-small", type: "button", text: "See them as tiles", onclick: () => showSpace(space ? space.id : "none") }) : null,
    ]),
    files.length ? strip : null,
  ]));

  box.append(page);
}

/** Add an empty entry to a space, and put the cursor in its first box. */
async function addEntry(info, spaceId) {
  const before = new Set(state.visit.entries.map((entry) => entry.id));
  if (!await changeVisit("/entries", { kind: info.kind, space: spaceId, items: [], fill: false })) return;
  drawVisit();
  const added = state.visit.entries.find((entry) => !before.has(entry.id));
  if (!added) return;
  // It opens beside the list, ready to be filled in.
  openEntry(added.id);
  const first = info.values.length ? $("entry-" + added.id + "-" + info.values[0][0]) : null;
  if (first) first.focus();
}

/** Make one entry for each of some photos, filled in from what was read. */
async function makeFromPhotos(info, files) {
  for (const file of files) {
    const made = await changeVisit("/entries", { kind: info.kind, space: file.space || null, items: [file.number], fill: true });
    if (!made) break;
  }
  drawVisit();
  say(plural(files.length, info.one, info.many) + " made from the nameplates. Grey values were read by Mouse; check them.");
}

/** One entry as a card: its photos, its values to fill in and check, notes.
    `afterChange` is called whenever one of its values changes. */
function drawEntry(entry, info, afterChange = () => {}) {
  const files = filesOf(entry);
  const title = make("h5", { class: "entry-title", text: entryTitle(entry) });
  const card = make("article", { class: "entry", "data-entry": entry.id }, [title]);

  // What is worked out from its values, such as a light fitting's total
  // watts. While a number is missing, it says which values it needs.
  const worked = info.sum ? make("p", { class: "entry-sum" }) : null;
  const showSum = () => {
    if (!worked) return;
    const number = sumFor(entry, info.sum);
    if (number !== null) {
      const yearly = yearlyFor(entry, info);
      worked.replaceChildren(
        info.sum.words + ": ", make("strong", { text: tidyNumber(number) }),
        ...(yearly !== null ? [". About ", make("strong", { text: tidyNumber(yearly) }), " " + info.yearly.words + "."] : []),
      );
    } else {
      const needs = info.sum.of.map((label) => (info.values.find(([mine]) => mine === label) || [label, labelText(label)])[1]);
      worked.textContent = info.sum.words + ": needs " + needs.slice(0, -1).join(", ") + " and " + needs[needs.length - 1];
    }
  };
  showSum();

  if (files.length) {
    card.append(make("div", { class: "entry-photos" }, files.map((file) => {
      const picture = thumbnail(file, "entry-thumb");
      picture.title = file.name;
      picture.addEventListener("click", () => select(file.number));
      return picture;
    })));
  }

  // Its values. After each change only the title is brought up to date, so
  // the card stays put and typing can carry on into the next box.
  // For a thing that has an age: what its plate says about when it was
  // made, offered for one click, and how its age sits against a typical life.
  const ageBox = info.values.some(([label]) => label === "age") ? make("div", { class: "entry-spoken" }) : null;
  const showAge = () => {
    if (!ageBox) return;
    const lines = [];
    const made = entry.fields.age ? null : madeIn(entry);
    if (made) {
      const years = new Date().getFullYear() - made.year;
      const use = make("button", { class: "button button-quiet", type: "button", text: "Use " + years + " as its age" });
      use.addEventListener("click", async () => {
        if (await changeVisit("/entries/" + encodeURIComponent(entry.id) + "/value", { label: "age", value: String(years) })) drawVisit();
      });
      lines.push(make("div", {}, [
        made.words + ". That makes it about " + plural(years, "year", "years") + " old." + (made.sure ? " " : " Check it against the plate. "),
        use,
      ]));
    }
    const age = numberIn(entry.fields.age);
    const life = typicalLife(entry.fields.equipment);
    if (age !== null && life) {
      lines.push(make("div", { text: tidyNumber(age) + " of about " + life + " years of typical life" + (age >= life ? ": at or past it." : ".") }));
    }
    ageBox.hidden = lines.length === 0;
    ageBox.replaceChildren(...(lines.length ? [make("div", { class: "says-title", text: "Its age" }), ...lines] : []));
  };
  showAge();

  card.append(drawEntryCells(entry, info, () => {
    title.textContent = entryTitle(entry);
    showSum();
    showAge();
    afterChange();
  }));
  if (worked) card.append(worked);
  if (ageBox) card.append(ageBox);

  const notes = make("textarea", {
    class: "input entry-notes", rows: "2", placeholder: "Notes", "aria-label": "Notes about this " + info.one,
  });
  notes.value = entry.notes || "";
  notes.addEventListener("blur", async () => {
    const written = notes.value.trim();
    if (written === (entry.notes || "")) return;
    if (await changeVisit("/entries/" + encodeURIComponent(entry.id), { notes: written })) entry.notes = written;
  });

  // What was said around the time its photos were taken: often the very
  // thing worth noting about it (its age, its condition). One click puts
  // the words into the notes, where they can be tidied.
  // (Words that only say which room this is are not about the thing itself.)
  const said = files.flatMap((file) => saidBeside(file)).filter((line) => !line.cue);
  if (said.length) {
    const words = said.map((line) => line.text).join(" ");
    const add = make("button", { class: "button button-quiet", type: "button", text: "Add to the notes" });
    const alreadyThere = () => (entry.notes || "").includes(words);
    const showAdded = () => {
      add.disabled = true;
      add.textContent = "In the notes";
    };
    if (alreadyThere()) showAdded();
    add.addEventListener("click", async () => {
      const written = [notes.value.trim(), words].filter(Boolean).join("\n");
      if (await changeVisit("/entries/" + encodeURIComponent(entry.id), { notes: written })) {
        entry.notes = written;
        notes.value = written;
        showAdded();
      }
    });
    card.append(make("div", { class: "entry-spoken" }, [
      make("div", { class: "says-title", text: "Said beside its photos" }),
      make("ul", { class: "spoken" }, said.map((line) => drawSaidLine(line, true))),
      add,
    ]));
  }
  card.append(notes);

  // Move it to another space, or remove it.
  const move = make("select", { class: "select", "aria-label": "The space this " + info.one + " is in" }, [
    make("option", { value: "", text: "In no space" }),
    ...state.visit.spaces.map((space) => make("option", { value: space.id, text: "In " + space.name })),
  ]);
  move.value = spaceOf(entry) ? entry.space : "";
  move.addEventListener("change", async () => {
    if (await changeVisit("/entries/" + encodeURIComponent(entry.id), { space: move.value || null })) drawVisit();
  });
  const remove = make("button", { class: "button button-quiet", type: "button", text: "Remove" });
  remove.addEventListener("click", async () => {
    if (!remove.dataset.sure) {
      remove.dataset.sure = "yes";
      remove.textContent = "Click again to remove. Its photos stay.";
      return;
    }
    if (await changeVisit("/entries/" + encodeURIComponent(entry.id), { remove: true })) drawVisit();
  });
  // For a thing with a model: the directory of certified products, where
  // its certified capacity and efficiency can be read. Only at a click.
  let lookUp = null;
  if (info.values.some(([label]) => label === "model")) {
    lookUp = make("button", {
      class: "button button-quiet", type: "button", text: "Look the model up",
      title: "Copies the make and model, and opens the AHRI directory of certified products in your web browser",
    });
    lookUp.addEventListener("click", async () => {
      const words = [entry.fields.make, entry.fields.model].filter(Boolean).join(" ");
      if (!words) {
        say("Fill in the make or the model first.");
        return;
      }
      try {
        await navigator.clipboard.writeText(words);
      } catch { /* the directory still opens */ }
      window.open("https://www.ahridirectory.org/", "_blank", "noopener");
      say("Copied \"" + words + "\". Paste it into the directory's search.");
    });
  }
  card.append(make("div", { class: "entry-foot" }, [move, lookUp, remove]));
  return card;
}

/** The boxes for an entry's values: first the ones its kind always has,
    then anything else it holds, such as ratings copied from a nameplate. */
function drawEntryCells(entry, info, afterChange) {
  const own = info.values.map(([label]) => label);
  const others = Object.keys(entry.fields).filter((label) => !own.includes(label));
  const ordered = USUAL.filter((label) => others.includes(label))
    .concat(others.filter((label) => !USUAL.includes(label)).sort());

  const cells = make("div", { class: "plate-cells entry-cells" });
  for (const [label, words, suggestions] of info.values) {
    cells.append(drawEntryCell(entry, label, words, suggestions, afterChange));
  }
  for (const label of ordered) cells.append(drawEntryCell(entry, label, labelText(label), null, afterChange));
  return cells;
}

function drawEntryCell(entry, label, words, suggestions, afterChange) {
  // The box's own name. A label read from a plate can have spaces in it
  // ("max fuse") and a name cannot, so they become dashes.
  const id = "entry-" + entry.id + "-" + label.replace(/[^a-z0-9]+/gi, "-");
  const address = visitAddress() + "/entries/" + encodeURIComponent(entry.id);
  const input = make("input", {
    class: "cell-value", type: "text", id, value: entry.fields[label] || "",
    spellcheck: "false", autocomplete: "off", list: suggestions ? id + "-list" : null,
  });
  const check = make("button", { class: "check", type: "button" }, icon(TICK));
  const cell = make("div", { class: "cell" }, [
    make("label", { class: "cell-label", for: id, text: words }),
    input,
    check,
    suggestions ? make("datalist", { id: id + "-list" }, suggestions.map((one) => make("option", { value: one }))) : null,
  ]);

  // Show the cell as it now is: empty, pencilled in (read by Mouse) or inked
  // (checked by a person).
  const paint = () => {
    const isChecked = entry.checked.includes(label);
    cell.classList.toggle("is-checked", isChecked);
    cell.classList.toggle("is-empty", !entry.fields[label]);
    // A long value gets the whole row, so that all of it can be read.
    cell.classList.toggle("is-wide", String(entry.fields[label] || "").length > 12);
    check.title = isChecked ? "Checked. Click to undo." : "Mark as checked";
    check.setAttribute("aria-label", (isChecked ? "Checked: " : "Mark as checked: ") + words);
    check.setAttribute("aria-pressed", isChecked ? "true" : "false");
  };
  paint();

  // The card is not redrawn after a change (that would take the cursor
  // away), so this card's own copy of the entry is kept up to date by hand.
  const save = async () => {
    const typed = input.value.trim();
    if (typed === (entry.fields[label] || "")) return;
    try {
      takeVisit(await ask(address + "/value", { label, value: typed === "" ? null : typed }));
    } catch (problem) {
      say(problem.message, true);
      input.value = entry.fields[label] || "";
      return;
    }
    if (typed === "") {
      delete entry.fields[label];
      entry.checked = entry.checked.filter((one) => one !== label);
    } else {
      entry.fields[label] = typed;
      if (!entry.checked.includes(label)) entry.checked.push(label);
    }
    paint();
    afterChange();
    drawFacts();
  };
  input.addEventListener("blur", save);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") input.blur();
    if (event.key === "Escape") { input.value = entry.fields[label] || ""; input.blur(); }
  });

  check.addEventListener("click", async () => {
    const checked = !entry.checked.includes(label);
    try {
      takeVisit(await ask(address + "/checked", { label, checked }));
    } catch (problem) {
      say(problem.message, true);
      return;
    }
    entry.checked = checked ? entry.checked.concat(label) : entry.checked.filter((one) => one !== label);
    paint();
  });
  return cell;
}

/** In the photo panel: say which entry this photo shows, or make a new
    entry from it. */
function drawEntryChooser(item) {
  const current = entryOf(item);
  const spaceId = spaceOf(item) ? item.space : null;
  // The entries in the same space as the photo are the likely ones.
  const near = entriesIn(spaceId);
  const listed = current && !near.includes(current) ? near.concat(current) : near;

  const choice = make("select", { class: "select", id: "photo-entry" }, [
    make("option", { value: "", text: "Nothing yet" }),
    ...listed.map((entry) => make("option", { value: "is:" + entry.id, text: kindInfo(entry.kind).name + ": " + entryTitle(entry) })),
    ...INVENTORY.map((info) => make("option", { value: "new:" + info.kind, text: "New " + info.one })),
  ]);
  choice.value = current ? "is:" + current.id : "";

  choice.addEventListener("change", async () => {
    const [what, id] = [choice.value.slice(0, choice.value.indexOf(":")), choice.value.slice(choice.value.indexOf(":") + 1)];
    let done;
    if (what === "new") {
      const info = kindInfo(id);
      done = await changeVisit("/entries", { kind: id, space: spaceId, items: [item.number], fill: Boolean(info.fillsFromPhoto) });
    } else if (what === "is") {
      const entry = state.visit.entries.find((one) => one.id === id);
      done = await changeVisit("/attach", { items: [item.number], entry: id, fill: Boolean(entry && kindInfo(entry.kind).fillsFromPhoto) });
    } else {
      done = await changeVisit("/attach", { items: [item.number], entry: null, fill: false });
    }
    if (done) drawVisit();
  });

  return make("div", { class: "photo-space" }, [
    make("label", { for: "photo-entry", text: "Shows" }),
    choice,
    current ? make("button", {
      class: "button button-small", type: "button", text: "Open it",
      onclick: () => openSpace(spaceOf(current) ? current.space : "none"),
    }) : null,
  ]);
}

/** Open the tiles view on one space's photos (or on the unsorted ones). */
function showSpace(which) {
  state.spaceShown = which;
  state.filter = "all";
  setView("photos");
}

// The space being changed in the form (null while adding a new one), and the
// photo a new space starts at when it was begun from the telling of a visit.
let spaceBeingChanged = null;
let spaceStartsAt = null;

function openSpaceDialog(space = null, startsAt = null, suggestedName = "") {
  spaceBeingChanged = space;
  spaceStartsAt = startsAt;

  $("space-title").textContent = space ? "Change this space" : "Add a space";
  $("space-save").textContent = space ? "Save" : "Add this space";
  $("space-name").value = space ? space.name : suggestedName;
  $("space-floor").value = space ? space.floor : "";
  $("space-use").value = space ? space.occupancy : "";
  $("space-area").value = space ? space.area : "";
  $("space-height").value = space ? space.height : "";
  $("space-notes").value = space ? space.notes : "";
  $("space-problem").hidden = true;

  // Removing is offered only for a space that exists, and asks twice.
  const remove = $("space-remove");
  remove.hidden = !space;
  remove.textContent = "Remove this space";
  delete remove.dataset.sure;

  // Started from a photo: say which photos will follow it in.
  const from = $("space-from");
  const first = startsAt === null ? null : state.visit.items.find((item) => item.number === startsAt);
  from.hidden = !first;
  if (first) {
    const time = clockTime(first.recorded);
    from.textContent = "The photo" + (time ? " taken at " + time : "") +
      " and the ones after it will go into this space, up to where the next space begins.";
  }

  // Suggestions for what a space is used as come from the edition.
  $("space-uses").replaceChildren(...(EDITION.occupancies || []).map((use) => make("option", { value: use })));

  $("space-dialog").showModal();
  $("space-name").focus();
}

async function saveSpace(event) {
  event.preventDefault();
  const details = {
    name: $("space-name").value,
    floor: $("space-floor").value,
    occupancy: $("space-use").value,
    area: $("space-area").value,
    height: $("space-height").value,
    notes: $("space-notes").value,
  };
  try {
    if (spaceBeingChanged) {
      takeVisit(await ask(visitAddress() + "/spaces/" + encodeURIComponent(spaceBeingChanged.id), details));
    } else {
      if (spaceStartsAt !== null) details.starting_at = spaceStartsAt;
      takeVisit(await ask(visitAddress() + "/spaces", details));
    }
  } catch (failure) {
    $("space-problem").textContent = failure.message;
    $("space-problem").hidden = false;
    return;
  }
  $("space-dialog").close();
  drawVisit();
}

async function removeSpace() {
  const button = $("space-remove");
  if (!button.dataset.sure) {
    button.dataset.sure = "yes";
    button.textContent = phrase("Click again to remove it. Its photos stay in the {noun}.");
    return;
  }
  const id = spaceBeingChanged.id;
  try {
    takeVisit(await ask(visitAddress() + "/spaces/" + encodeURIComponent(id), { remove: true }));
  } catch (failure) {
    $("space-problem").textContent = failure.message;
    $("space-problem").hidden = false;
    return;
  }
  if (state.spaceShown === id) state.spaceShown = "all";
  $("space-dialog").close();
  drawVisit();
}

// What a photo can be said to show. The readers use the same words.
const KINDS_OF_PHOTO = ["nameplate", "meter", "panel", "equipment", "sign", "document", "screen", "other"];

/** In the photo panel: say by hand what a photo shows. A reader can get
    this wrong, and a nameplate it missed is never offered as equipment.
    What a person says here, no reader changes afterwards. */
function drawKindChooser(item) {
  const kinds = KINDS_OF_PHOTO.slice();
  // A reader may have used a word of its own; keep it in the list.
  if (item.looks_like && !kinds.includes(item.looks_like)) kinds.unshift(item.looks_like);

  const choice = make("select", { class: "select", id: "photo-kind" }, [
    item.looks_like ? null : make("option", { value: "?", text: "Not known yet", disabled: true }),
    ...kinds.map((kind) => make("option", { value: kind, text: kind === "other" ? "Something else" : labelText(kind) })),
    item.looks_like_checked ? make("option", { value: "", text: "Let Mouse decide again" }) : null,
  ]);
  choice.value = item.looks_like || "?";
  choice.addEventListener("change", async () => {
    try {
      replaceItem(await ask(itemAddress(item) + "/looks-like", { looks_like: choice.value || null }));
    } catch (problem) {
      say(problem.message, true);
    }
  });
  return make("div", { class: "photo-space" }, [
    make("label", { for: "photo-kind", text: "This is" }),
    choice,
    item.looks_like_checked ? make("span", { class: "quiet", text: "as you said" }) : null,
  ]);
}

/** In the photo panel: a drop-down to say which space this file belongs to. */
function drawSpaceChooser(item) {
  const choice = make("select", { class: "select", id: "photo-space" }, [
    make("option", { value: "", text: "Not sorted" }),
    ...state.visit.spaces.map((space) => make("option", { value: space.id, text: space.name })),
  ]);
  choice.value = spaceOf(item) ? item.space : "";
  choice.addEventListener("change", async () => {
    if (await sortItems([item.number], choice.value || null)) drawVisit();
  });
  return make("div", { class: "photo-space" }, [
    make("label", { for: "photo-space", text: "Space" }),
    choice,
  ]);
}

// ---------------------------------------------------------------------------
// Day view: the visit told in order, with a summary on top
// ---------------------------------------------------------------------------

/** A written time as a moment that can be compared with another. (Times
    carry their own time zone, so they cannot be compared as text.) */
function momentOf(recorded) {
  const moment = Date.parse(recorded || "");
  return Number.isNaN(moment) ? null : moment;
}

/** Items in the order they were recorded. Those with no time come first. */
function inOrder(items) {
  const when = (item) => {
    const moment = momentOf(item.recorded);
    return moment === null ? -Infinity : moment;
  };
  // (Two items with no time give "not a number", and fall to their numbers.)
  return items.slice().sort((a, b) => (when(a) - when(b)) || a.number - b.number);
}

/** "2026-09-21T09:07:47+05:30" becomes "09:07". */
function clockTime(recorded) {
  return recorded && recorded.length >= 16 ? recorded.slice(11, 16) : "";
}

/** The AI model that answers and writes summaries: the one picked in
    Settings if it is still installed, otherwise the usual one. */
function aiModel() {
  const local = state.readers ? state.readers.local : null;
  if (!local || !local.available) return null;
  const chosen = recall("mouse-model");
  return local.models.includes(chosen) ? chosen : local.preferred;
}

/** Who answers questions and writes summaries. Claude, if the person has
    connected it and it is the one wanted here (the edition says which is
    usual; Settings can change it). Otherwise the AI model on this computer,
    if one is running. Null when there is nobody to ask. */
function brain() {
  const claude = state.readers ? state.readers.claude : null;
  const wanted = recall("mouse-brain") || EDITION.brain || "local";
  const model = aiModel();
  if (claude && claude.ready && (wanted === "claude" || !model)) {
    return { ask: { brain: "claude", claude_model: claudeModel() }, name: "Claude", sends: true };
  }
  return model ? { ask: { model }, name: "the AI on this computer", sends: false } : null;
}

/** What to say where an AI is needed and none is connected. */
const NO_BRAIN = IN_APP
  ? "No AI is connected. Connect Claude in Settings, under Tools."
  : "No AI is connected. Start Ollama on this computer, or connect Claude in Settings, under Tools.";

// ---------------------------------------------------------------------------
// Listening: what was said in a recording, and where it falls in the visit
// ---------------------------------------------------------------------------

const SPEECH = "M5 5h14v10h-8l-5 4v-4H5V5z";

/** Every line said on the open visit, each with the recording it is from. */
function saidLines() {
  const lines = [];
  for (const item of state.visit.items) {
    if (!item.heard) continue;
    item.heard.lines.forEach((line, index) => lines.push({ ...line, index, recording: item }));
  }
  return lines;
}

/** What was said around the time a photo was taken. */
function saidBeside(photo) {
  return saidLines().filter((line) => line.near === photo.number);
}

function hasTime(line) {
  return line.at !== null && line.at !== undefined;
}

/** 754 seconds as "12 min 34 s". */
function lengthWords(seconds) {
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  const two = (number) => String(number).padStart(2, "0");
  if (hours) return hours + " h " + two(minutes) + " min";
  if (minutes) return minutes + " min " + two(rest) + " s";
  return rest + " s";
}

/** 754 seconds into a recording as "12:34". */
function runTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const two = (number) => String(number).padStart(2, "0");
  return (hours ? hours + ":" + two(minutes) : minutes) + ":" + two(whole % 60);
}

// The player of the open recording. It is kept from one drawing of the
// panel to the next, so that changing something does not stop the sound.
let player = null;      // { key, element }
let listenFrom = null;  // where to start playing once the panel is drawn

function playerFor(item) {
  // The demo has made-up visits and no recording to play.
  if (DEMO) return null;
  const key = state.visit.id + "/" + item.number;
  if (!player || player.key !== key) {
    if (player) player.element.pause();
    player = {
      key,
      element: make(item.kind === "video" ? "video" : "audio", {
        class: "player", controls: true, preload: "metadata", src: itemAddress(item) + "/file",
      }),
    };
  }
  return player.element;
}

/** Open a recording and play it from where a line was said. */
function listenAt(line) {
  if (hasTime(line)) listenFrom = line.at;
  select(line.recording.number);
}

/** One thing that was said: when, and the words. The time is a button that
    plays the recording from there. With `onTheClock` it shows the time of
    day; otherwise how far into the recording it comes. */
function drawSaidLine(line, onTheClock) {
  const time = onTheClock && line.clock ? line.clock.slice(11, 19) : (hasTime(line) ? runTime(line.at) : "");
  return make("li", { class: "spoken-line" }, [
    time
      ? make("button", {
        class: "spoken-time",
        type: "button",
        text: time,
        title: DEMO ? "In the real app this plays the recording from here" : "Listen from here",
        onclick: () => listenAt(line),
      })
      : make("span", { class: "spoken-time is-none" }),
    make("span", { class: "spoken-words", text: line.text }),
  ]);
}

/** The first photo taken after something was said, if there is one. */
function firstPhotoAfter(line) {
  const when = momentOf(line.clock);
  if (when === null) return null;
  const next = inOrder(state.visit.items).find((item) => {
    const taken = momentOf(item.recorded);
    return item.kind === "photo" && taken !== null && taken >= when;
  });
  return next ? next.number : null;
}

/** In the telling of a visit: what was said between two photos. Where the
    words announce a room ("now in the boiler room"), a space can be
    started right there. */
function drawSaid(block) {
  const lines = block.map((line) => {
    const row = drawSaidLine(line, true);
    const known = state.visit.spaces.some((space) => space.name.trim().toLowerCase() === (line.cue || "").toLowerCase());
    if (state.spaces && line.cue && !known) {
      row.append(make("button", {
        class: "button button-quiet spoken-cue",
        type: "button",
        text: "Start a space here: " + line.cue,
        title: "The photos taken after this was said go into a new space",
        onclick: () => openSpaceDialog(null, firstPhotoAfter(line), line.cue),
      }));
    }
    return row;
  });
  return make("li", { class: "moment is-spoken" }, [
    make("div", { class: "moment-time", text: clockTime(block[0].clock) }),
    make("div", { class: "moment-spoken-mark" }, [icon(SPEECH)]),
    make("div", { class: "moment-words" }, [
      make("div", { class: "moment-kind", text: "Said" }),
      make("ul", { class: "spoken" }, lines),
    ]),
  ]);
}

/** Whether Mouse can listen right now: the listening model is on this
    computer. (The demo has nothing to listen with.) */
function canListen() {
  return !DEMO && Boolean(state.readers && state.readers.listener && state.readers.listener.ready);
}

/** Have Mouse listen to one recording and write down what was said. With
    no recording named: to every one in the open visit that has no words. */
async function listenTo(item) {
  try {
    await ask(visitAddress() + "/listen", item ? { item: item.number } : {});
    watchJob();
  } catch (problem) {
    say(problem.message, true);
  }
}

/** Fetch the listening model. This only ever happens on a person's click. */
async function getListener() {
  try {
    await ask("/api/listener/get", {});
    watchJob();
  } catch (problem) {
    say(problem.message, true);
  }
}

/** In a recording's panel: the button that has Mouse listen to it, or the
    way to get the listening model if it is not on this computer yet. */
function drawListen(item, heard) {
  if (DEMO) {
    return make("p", { class: "hint", text:
      "In the real app Mouse listens to a recording and writes the words down itself, on your own computer. The demo's words were made up beforehand." });
  }
  const listener = state.readers ? state.readers.listener : null;
  if (!listener) return null;
  if (!listener.ready) {
    return make("div", { class: "listen" }, [
      make("p", { class: "hint", text:
        here("Mouse can write the words down for you. It needs its listening model on this computer first: ") + listener.megabytes +
        " MB, fetched once. After that it listens with no internet, and nothing you record is sent anywhere." }),
      make("button", { class: "button button-small", type: "button", text: "Get the listening model (" + listener.megabytes + " MB)", onclick: getListener }),
    ]);
  }

  // Words a person typed, or that came in a file, are theirs: Mouse does
  // not put its own in their place without being asked twice.
  const theirs = Boolean(heard) && !heard.by_mouse;
  const button = make("button", {
    class: "button button-small" + (item.heard ? "" : " button-main"),
    type: "button",
    text: !item.heard ? "Listen to it" : (theirs ? "Have Mouse listen instead" : "Listen again"),
  });
  button.addEventListener("click", () => {
    if (theirs && !button.dataset.sure) {
      button.dataset.sure = "yes";
      button.textContent = "Click again: this replaces the words here";
      return;
    }
    listenTo(item);
  });
  return make("div", { class: "listen" }, [
    button,
    item.heard ? null : make("span", { class: "quiet", text: here("Mouse writes down what was said, on this computer.") }),
  ]);
}

/** In the side panel, for a sound or video recording: when it began, how
    long it is, and what was said in it. */
function drawRecording(item, body) {
  if (item.seconds) body.append(make("p", { class: "detail-how", text: lengthWords(item.seconds) + " long." }));

  // When it began. Everything said in it is placed on the clock from here,
  // so it is shown and can be put right.
  const began = make("input", { class: "input", id: "began", type: "datetime-local", step: "1" });
  began.value = (item.recorded || "").slice(0, 19);
  const setBegan = make("button", { class: "button button-small", type: "button", text: "Set" });
  setBegan.addEventListener("click", async () => {
    if (!began.value) return;
    try {
      replaceItem(await ask(itemAddress(item) + "/began", { began: began.value }));
    } catch (problem) {
      say(problem.message, true);
    }
  });
  body.append(make("div", { class: "photo-space" }, [make("label", { for: "began", text: "Began" }), began, setBegan]));
  body.append(make("p", { class: "hint", text: item.recorded_checked
    ? "As you said. What was said moves with it."
    : "Worked out from the file, which is not always right. If the words sit beside the wrong photos, put the real start here." }));

  const heard = item.heard && item.heard.lines.length ? item.heard : null;
  if (heard) {
    body.append(make("div", { class: "says spoken-panel" }, [
      make("div", { class: "says-title", text: "What was said (" + plural(heard.words, "word", "words") + ", " + heard.came + ")" }),
      make("ul", { class: "spoken" }, heard.lines.map((line, index) => drawSaidLine({ ...line, index, recording: item }, false))),
    ]));
    if (heard.by_mouse) {
      body.append(make("p", { class: "hint", text:
        here("Mouse wrote these down by listening, on this computer. It can mishear: click a time to listen for yourself, and correct the words below.") }));
    }
    if (!heard.lines.some(hasTime)) {
      body.append(make("p", { class: "hint", text: "These words came without times, so they are not lined up with your photos." }));
    }
  } else {
    body.append(make("p", { class: "detail-how", text: item.heard
      ? "Mouse listened to it and heard no words."
      : "What was said in it is not written down yet." }));
  }

  // Mouse writes the words down itself, by listening.
  body.append(drawListen(item, heard));

  // Bringing the words in by hand, correcting them, or taking them away.
  // The box starts with the words as they are, so a misheard one can be
  // put right where it stands.
  const box = make("textarea", {
    class: "input spoken-paste",
    rows: "6",
    "aria-label": "What was said in this recording",
    placeholder: "Type or paste what was said here.\nA time at the start of a line is understood:\n\n0:05 Now in the boiler room.\n0:40 Boiler one, about fifteen years old.",
  });
  if (heard) box.value = heard.lines.map((line) => (hasTime(line) ? runTime(line.at) + " " : "") + line.text).join("\n");
  const keep = make("button", { class: "button button-small button-main", type: "button", text: "Keep these words" });
  keep.addEventListener("click", async () => {
    if (!box.value.trim()) {
      box.focus();
      return;
    }
    try {
      replaceItem(await ask(itemAddress(item) + "/heard", { words: box.value }));
    } catch (problem) {
      say(problem.message, true);
    }
  });
  const remove = heard ? make("button", { class: "button button-small", type: "button", text: "Take the words away" }) : null;
  if (remove) {
    remove.addEventListener("click", async () => {
      if (!remove.dataset.sure) {
        remove.dataset.sure = "yes";
        remove.textContent = "Click again to take them away";
        return;
      }
      try {
        replaceItem(await ask(itemAddress(item) + "/heard", { words: "" }));
      } catch (problem) {
        say(problem.message, true);
      }
    });
  }
  body.append(make("details", { class: "spoken-bring", open: !heard && !canListen() }, [
    make("summary", { text: heard ? "Correct the words, or put others in their place" : "Type or paste what was said" }),
    box,
    make("div", { class: "spoken-bring-actions" }, [keep, remove]),
    make("p", { class: "hint", text:
      "Many phone recorders write the words for you; copy them from there. Or, before adding the " + EDITION.noun +
      ", put a .srt, .vtt or .txt file with the recording's name beside it (walk.m4a and walk.srt), and the words come in with it." }),
  ]));
}

// What the visit itself is described by: the building, the client, the kind
// of audit. An edition with none of these (the everyday one) shows nothing.
// (Where a visit is shown in parts, "where it has got to" is not a box to
// type in: it is the visit's status, set with one button.)
const DETAILS = (EDITION.details || []).filter(([label]) => !(PARTS && label === "status"));

/** The panel above the summary with those boxes. They go on the first page
    of the Word report. */
function drawVisitDetails() {
  const panel = $("about-visit");
  // (Where a visit is shown in parts, these boxes are a part of their own,
  // not a folded panel: see drawDetailsPart.)
  panel.hidden = DETAILS.length === 0 || Boolean(PARTS);
  if (DETAILS.length === 0) return;

  // This card's own copy, kept up to date by hand as boxes are filled in,
  // so that filling one in does not redraw the others and take the cursor.
  const details = { ...(state.visit.details || {}) };
  const showCount = () => {
    const filled = DETAILS.filter(([label]) => details[label]).length;
    $("about-title").textContent = "About this visit" +
      (filled ? " — " + filled + " of " + DETAILS.length + " filled in" : " — not filled in yet");
    const line = $("details-count");
    if (line) {
      const missing = DETAILS.filter(([label]) => !details[label]).map(([, words]) => words);
      line.textContent = missing.length
        ? filled + " of " + DETAILS.length + " filled in. Still empty: " + listWords(missing) + "."
        : "All " + DETAILS.length + " filled in. They go on the first page of the Word report.";
    }
  };
  showCount();

  const box = $("about-fields");
  box.replaceChildren();
  for (const [label, words, suggestions] of DETAILS) {
    const id = "detail-" + label;
    const input = make("input", {
      class: "input", type: "text", id, value: details[label] || "",
      autocomplete: "off", list: suggestions ? id + "-list" : null,
    });
    input.addEventListener("blur", async () => {
      const typed = input.value.trim();
      if (typed === (details[label] || "")) return;
      if (!await changeVisit("/details", { label, value: typed || null })) {
        input.value = details[label] || "";
        return;
      }
      if (typed) details[label] = typed;
      else delete details[label];
      showCount();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") input.blur();
      if (event.key === "Escape") { input.value = details[label] || ""; input.blur(); }
    });
    box.append(make("div", { class: "about-field" }, [
      make("label", { class: "field", for: id, text: words }),
      input,
      suggestions ? make("datalist", { id: id + "-list" }, suggestions.map((one) => make("option", { value: one }))) : null,
    ]));
  }
}

function drawSummary() {
  const box = $("summary");
  const visit = state.visit;
  box.replaceChildren(make("div", { class: "summary-title", text: "Summary" }));

  if (visit.summary) {
    box.append(make("p", { class: "summary-words", text: visit.summary }));
  } else {
    box.append(make("p", {
      class: "summary-empty",
      text: phrase("No summary yet. Mouse can write a few sentences about this {noun} from what it has read."),
    }));
  }

  const actions = make("div", { class: "summary-actions" });
  if (brain()) {
    actions.append(make("button", {
      class: "button button-small",
      type: "button",
      id: "write-summary",
      text: visit.summary ? "Write it again" : "Write a summary",
      onclick: writeSummary,
    }));
    if (visit.summary) actions.append(speakButton(visit.summary));
  } else {
    actions.append(make("span", { class: "quiet", text: NO_BRAIN }));
  }
  box.append(actions);
}

async function writeSummary() {
  const button = $("write-summary");
  button.disabled = true;
  button.textContent = "Writing…";
  try {
    const reply = await ask(visitAddress() + "/summary", brain().ask);
    state.visit.summary = reply.summary;
  } catch (problem) {
    say(problem.message, true);
  }
  drawSummary();
}

function drawDay() {
  const day = $("day");
  day.replaceChildren();

  // Nothing in it yet (it was started empty): say so, and offer the ways
  // to add from this device.
  if (state.visit.items.length === 0) {
    day.append(make("li", { class: "day-empty" }, [
      make("p", { class: "nothing", text: phrase("Nothing in this {noun} yet. Add its photos and recordings from this device.") }),
      make("div", { class: "add-bar" }, addButtons()),
    ]));
    return;
  }

  // With the Spaces tool on, a heading marks each place where the telling
  // moves into another space (or back out into photos not sorted yet).
  const markSpaces = state.spaces && state.visit.spaces.length > 0;
  let lastSpace; // the space of the moment before; not set before the first

  // What was said, to be told between the photos at the moment it was said.
  const said = saidLines()
    .map((line) => ({ ...line, when: momentOf(line.clock) }))
    .filter((line) => line.when !== null)
    .sort((a, b) => a.when - b.when);
  let told = 0;
  const saidBefore = (moment) => {
    const block = [];
    while (told < said.length && (moment === null || said[told].when < moment)) block.push(said[told++]);
    return block;
  };
  // Whether something said belongs to a space: it announces it ("now in
  // the boiler room"), or it was said beside one of its photos.
  const belongsTo = (line, space) => {
    if ((line.cue || "").toLowerCase() === space.name.trim().toLowerCase()) return true;
    const beside = state.visit.items.find((item) => item.number === line.near);
    return Boolean(beside) && spaceOf(beside) === space;
  };

  for (const item of inOrder(state.visit.items)) {
    const recorded = momentOf(item.recorded);
    const block = recorded === null ? [] : saidBefore(recorded);

    // People say where they are and what they are looking at before they
    // take the photo. So where a new space begins, the words that belong
    // to it are told under its heading, not above it.
    const space = markSpaces ? spaceOf(item) : null;
    const spaceBegins = markSpaces && space !== lastSpace;
    let itsOwn = block.length;
    if (spaceBegins && space) {
      const first = block.findIndex((line) => belongsTo(line, space));
      if (first >= 0) itsOwn = first;
    }
    if (itsOwn > 0) day.append(drawSaid(block.slice(0, itsOwn)));
    if (spaceBegins) {
      day.append(drawSpaceStart(space));
      lastSpace = space;
    }
    if (itsOwn < block.length) day.append(drawSaid(block.slice(itsOwn)));

    // What to say about this moment: for a nameplate its main values, for
    // anything else the words on it.
    let words = "";
    if (isNameplate(item)) {
      const parts = [];
      if (item.fields.serial) parts.push("Serial " + item.fields.serial);
      for (const label of ["volts", "phase", "hz", "amps", "hp", "rpm", "refrigerant"]) {
        if (item.fields[label]) parts.push(labelText(label) + " " + item.fields[label]);
      }
      words = parts.join(", ");
    } else if (item.kind === "photo") {
      words = textLines(item).slice(0, 5).join("\n");
    } else {
      words = subline(item);
    }

    const title = isNameplate(item) || item.kind !== "photo" ? headline(item) : kindWords(item);
    const picture = thumbnail(item, "moment-picture");
    picture.addEventListener("click", () => select(item.number));

    day.append(make("li", { class: "moment" + (isNameplate(item) ? " is-plate" : "") }, [
      make("div", { class: "moment-time", text: clockTime(item.recorded) }),
      picture,
      make("div", { class: "moment-words" }, [
        make("div", { class: "moment-kind", text: isNameplate(item) ? "Nameplate" : (item.kind === "photo" ? item.name : kindWords(item) + " recording") }),
        make("div", { class: "moment-title", text: title }),
        words ? make("div", { class: "moment-text", text: words }) : null,
        checkedLine(item),
        make("div", { class: "moment-actions" }, [
          make("button", { class: "button button-quiet", type: "button", text: "Open", onclick: () => select(item.number) }),
          // A recording with no words yet can be listened to from here.
          item.kind !== "photo" && !item.heard && canListen()
            ? make("button", { class: "button button-quiet", type: "button", text: "Listen to it", onclick: () => listenTo(item) })
            : null,
          // "I stepped into a new room here": this photo and the ones
          // after it go into a new space.
          state.spaces ? make("button", {
            class: "button button-quiet",
            type: "button",
            text: "Start a space here",
            title: "This photo and the ones after it go into a new space",
            onclick: () => openSpaceDialog(null, item.number),
          }) : null,
        ]),
      ]),
    ]));
  }
  // Whatever was said after the last photo.
  const last = saidBefore(null);
  if (last.length) day.append(drawSaid(last));
}

/** The heading in the telling of a visit where a space begins. */
function drawSpaceStart(space) {
  if (!space) {
    return make("li", { class: "space-start is-loose" }, [
      make("span", { class: "space-start-name", text: "Not sorted into a space" }),
    ]);
  }
  const facts = spaceFacts(space).map(([name, value]) => name + " " + value).join(", ");
  return make("li", { class: "space-start" }, [
    make("span", { class: "space-start-name", text: space.name }),
    facts ? make("span", { class: "space-start-facts", text: facts }) : null,
    make("button", { class: "button button-quiet", type: "button", text: "Change", onclick: () => openSpaceDialog(space) }),
  ]);
}

// ---------------------------------------------------------------------------
// The side panel: one photo close up, or a conversation with Mouse
// ---------------------------------------------------------------------------

function select(number) {
  state.selected = number;
  if (number === null) {
    if (state.side === "photo") state.side = null;
  } else {
    state.side = "photo";
  }
  markSelectedTile();
  drawSide();
}

/** Show which tile is open, without redrawing the grid (and its pictures). */
function markSelectedTile() {
  for (const tile of $("grid").querySelectorAll(".tile")) {
    tile.setAttribute("aria-current", Number(tile.dataset.number) === state.selected ? "true" : "false");
  }
}

function currentItem() {
  if (!state.visit || state.selected === null) return null;
  return state.visit.items.find((item) => item.number === state.selected) || null;
}

/** Move to the photo before or after this one, among those shown. */
function step(by) {
  const items = shownItems();
  const position = items.findIndex((item) => item.number === state.selected);
  const next = items[position + by];
  if (next) select(next.number);
}

// ---------------------------------------------------------------------------
// A photo, large
// ---------------------------------------------------------------------------
//
// Clicking the photo in the side panel opens it over the whole of Mouse.
// There it can be made larger (a click, the wheel, plus and minus) and moved
// about by dragging, to read what is small in it; the arrows go to the photo
// before and the photo after.

// Which photo is being looked at, how much larger than "the whole photo
// fits" it is drawn (1 is fitting), and how far it has been moved from the
// middle. `held` is where the pointer was when a drag began.
const viewing = { number: null, size: 1, x: 0, y: 0, held: null };
const LARGEST_VIEW = 8;
const VIEW_STEPS = [1, 1.5, 2, 3, 4, 6, LARGEST_VIEW];

/** The photos that the arrows step through: the ones in view, in the order
    they are shown (recordings are skipped). */
function photosInView() {
  return shownItems().filter((item) => item.kind === "photo");
}

function openViewer(number) {
  if (!state.visit) return;
  showInViewer(number);
  if (!$("viewer").open) $("viewer").showModal();
}

function showInViewer(number) {
  const item = state.visit.items.find((one) => one.number === number);
  if (!item || item.kind !== "photo") return;
  Object.assign(viewing, { number, size: 1, x: 0, y: 0, held: null });

  // The picture that is already on the screen is shown at once. The photo
  // as large as the camera made it takes its place when it has arrived, so
  // that looking closely shows more, not just bigger dots.
  const photo = $("viewer-photo");
  const quick = pictureAddress(item, "photo");
  const whole = pictureAddress(item, "full");
  photo.src = quick;
  photo.alt = kindWords(item) + ", " + item.name;
  if (whole !== quick) {
    const sharper = new Image();
    sharper.src = whole;
    sharper.decode().then(() => {
      if (viewing.number === number && $("viewer").open) photo.src = whole;
    }).catch(() => { /* the quick picture stays */ });
  }

  const photos = photosInView();
  const place = photos.findIndex((one) => one.number === number);
  $("viewer-count").textContent = place >= 0 ? (place + 1) + " of " + photos.length : "";
  $("viewer-before").disabled = place <= 0;
  $("viewer-after").disabled = place < 0 || place >= photos.length - 1;
  nameViewedPhoto(item);
  drawViewerValues();
  placeViewedPhoto(false);
}

/** The line under the large photo that says what it is. */
function nameViewedPhoto(item) {
  const time = clockTime(item.recorded);
  $("viewer-name").textContent = (isNameplate(item) ? headline(item) : kindWords(item))
    + ", " + item.name + (time ? ", " + time : "");
}

/** Go to the photo before (-1) or after (1). The side panel follows. */
function stepViewer(by) {
  const photos = photosInView();
  const next = photos[photos.findIndex((one) => one.number === viewing.number) + by];
  if (!next) return;
  select(next.number);
  showInViewer(next.number);
}

/** Put the photo where `viewing` says, never so far off that it is lost. */
function placeViewedPhoto(gliding) {
  const stage = $("viewer-stage");
  const photo = $("viewer-photo");
  const farX = Math.max(0, (photo.clientWidth * viewing.size - stage.clientWidth) / 2);
  const farY = Math.max(0, (photo.clientHeight * viewing.size - stage.clientHeight) / 2);
  viewing.x = Math.min(farX, Math.max(-farX, viewing.x));
  viewing.y = Math.min(farY, Math.max(-farY, viewing.y));
  photo.classList.toggle("is-gliding", Boolean(gliding));
  photo.style.transform = "translate(" + viewing.x + "px, " + viewing.y + "px) scale(" + viewing.size + ")";
  stage.classList.toggle("is-large", viewing.size > 1);
  $("viewer-smaller").disabled = viewing.size <= 1;
  $("viewer-whole").disabled = viewing.size <= 1;
  $("viewer-larger").disabled = viewing.size >= LARGEST_VIEW;
}

/** Draw the photo at another size. `towards` is the spot on the screen that
    should stay where it is (the pointer); without one, the middle stays. */
function resizeViewedPhoto(size, towards, gliding = true) {
  const stage = $("viewer-stage").getBoundingClientRect();
  const middle = { x: stage.left + stage.width / 2, y: stage.top + stage.height / 2 };
  const spot = towards || middle;
  size = Math.min(LARGEST_VIEW, Math.max(1, size));
  // Which point of the photo is under the spot now; it is put back under
  // it at the new size.
  const acrossPhoto = (spot.x - middle.x - viewing.x) / viewing.size;
  const downPhoto = (spot.y - middle.y - viewing.y) / viewing.size;
  viewing.size = size;
  viewing.x = size === 1 ? 0 : spot.x - middle.x - size * acrossPhoto;
  viewing.y = size === 1 ? 0 : spot.y - middle.y - size * downPhoto;
  placeViewedPhoto(gliding);
}

/** One step larger (1) or smaller (-1), about the middle. */
function stepViewedSize(by) {
  const next = by > 0
    ? VIEW_STEPS.find((step) => step > viewing.size + 0.01)
    : [...VIEW_STEPS].reverse().find((step) => step < viewing.size - 0.01);
  if (next) resizeViewedPhoto(next);
}

/** The size at which one dot of the photo is one dot of the screen: the
    closest look that still shows something new. At least twice the fitting
    size, so that a click always does something. */
function closeLook() {
  const photo = $("viewer-photo");
  const true_size = photo.naturalWidth / Math.max(1, photo.clientWidth * window.devicePixelRatio);
  return Math.min(LARGEST_VIEW, Math.max(2, true_size));
}

// Beside the large photo, for someone using the Nameplates tool: what Mouse
// read in it. The values, their ticks and the boxes to type in are the very
// ones from the side panel (see drawRead), so a nameplate can be checked
// against the plate itself without going back and forth.

/** Whether what Mouse read is wanted beside the large photo. It is, until
    the person hides it; that is remembered. */
function valuesBesidePhoto() {
  return state.plates && recall("mouse-viewer-values") !== "off";
}

/** Show what Mouse read beside the large photo, or hide it. */
function toggleViewerValues() {
  if (!state.plates || !$("viewer").open) return;
  if (valuesBesidePhoto()) remember("mouse-viewer-values", "off");
  else forget("mouse-viewer-values");
  drawViewerValues();
}

/** Where the keyboard is among the values beside the photo, said in a way
    that still means something once they have been drawn afresh: the box or
    the tick of which value, or which of the two boxes for a new value. With
    what was being typed there, if anything. (Never "the how-manieth box":
    after a change that could be another value's box.) */
function whereInValues() {
  const panel = $("viewer-values");
  const at = document.activeElement;
  if (!at || !panel.contains(at)) return null;

  // A new value that has just been sent off: its two boxes come back empty,
  // and the keyboard goes to the first of them, ready for the next value.
  const form = at.closest(".add-value");
  if (form && form.dataset.sent) return { part: "[data-part='new-label']" };

  const cell = at.closest(".cell");
  let where = null;
  if (cell) where = { cell: cell.dataset.label, part: at.classList.contains("check") ? ".check" : ".cell-value" };
  else if (at.dataset.part) where = { part: "[data-part='" + at.dataset.part + "']" };

  if (where && at.matches("input")) {
    Object.assign(where, { typed: at.value, from: at.selectionStart, to: at.selectionEnd });
    // (Being taken off the screen is not "leaving the box": see drawCell.)
    at.dataset.kept = "yes";
  }
  return where;
}

/** Give the keyboard back to where `whereInValues` found it. */
function backInValues(where) {
  if (!where) return;
  const panel = $("viewer-values");
  const within = where.cell === undefined
    ? panel
    : [...panel.querySelectorAll(".cell")].find((one) => one.dataset.label === where.cell);
  const next = within ? within.querySelector(where.part) : null;
  if (!next) return;
  if (where.typed !== undefined) {
    next.value = where.typed;
    next.setSelectionRange(where.from, where.to);
  }
  next.focus({ preventScroll: true });
}

/** Draw what Mouse read in the photo that is open large, beside it. */
function drawViewerValues() {
  const viewer = $("viewer");
  const panel = $("viewer-values");
  const item = state.visit ? state.visit.items.find((one) => one.number === viewing.number) : null;
  const shown = Boolean(item) && valuesBesidePhoto();
  const changed = shown !== viewer.classList.contains("has-values");

  viewer.classList.toggle("has-values", shown);
  panel.hidden = !shown;
  $("viewer-values-gap").hidden = !state.plates;
  $("viewer-values-toggle").hidden = !state.plates;
  $("viewer-values-toggle").setAttribute("aria-pressed", shown ? "true" : "false");

  if (!shown) {
    panel.replaceChildren();
    delete panel.dataset.number;
  } else {
    // This is drawn afresh after every change. While it is still the same
    // photo, the keyboard stays where it was (with whatever was being
    // typed), and so do how far the list was scrolled and the text that
    // was folded out.
    const same = panel.dataset.number === String(item.number);
    const where = same ? whereInValues() : null;
    const scrolled = same ? panel.scrollTop : 0;
    const unfolded = same && Boolean(panel.querySelector(".text-read[open]"));

    panel.dataset.number = item.number;
    panel.replaceChildren(...[
      make("h3", { class: "detail-kind", text: isNameplate(item) ? headline(item) : kindWords(item) }),
      checkedLine(item),
      make("p", { class: "detail-how", text: howRead(item) }),
      ...drawRead(item),
    ].filter(Boolean));

    const text = panel.querySelector(".text-read");
    if (text && unfolded) text.open = true;
    panel.scrollTop = scrolled;
    backInValues(where);
  }
  // The photo has more room now, or less: fit it again.
  if (changed) placeViewedPhoto(false);
}

function drawSide() {
  const open = Boolean(state.visit && state.side);
  $("shell").classList.toggle("has-side", open);
  $("side").hidden = !open;
  $("open-ask").setAttribute("aria-pressed", open && state.side === "ask" ? "true" : "false");
  if (!open) return;

  // The first tab shows one thing: a photo or, opened from a list, an entry.
  const oneThing = state.side === "photo" || state.side === "entry";
  $("side-photo-tab").setAttribute("aria-selected", oneThing ? "true" : "false");
  $("side-photo-tab").textContent = state.side === "entry" ? "Details" : "Photo";
  $("side-ask-tab").setAttribute("aria-selected", state.side === "ask" ? "true" : "false");
  $("side-photo").hidden = !oneThing;
  $("side-ask").hidden = state.side !== "ask";

  if (state.side === "photo") drawPhoto();
  else if (state.side === "entry") drawEntryPanel();
  else drawAsk();
}

function drawPhoto() {
  const panel = $("side-photo");
  const item = currentItem();
  panel.replaceChildren();

  if (!item) {
    panel.append(make("p", { class: "side-hint", text: "Click a photo to see it here, with what Mouse found in it." }));
    return;
  }

  if (item.kind === "photo") {
    const address = pictureAddress(item, "photo");
    const photo = make("img", {
      class: "detail-photo", src: address, alt: "The photo. Click to see it large.",
      title: "See it large", tabindex: "0", role: "button",
    });
    photo.addEventListener("click", () => openViewer(item.number));
    photo.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openViewer(item.number);
    });
    photo.addEventListener("error", () => photo.remove());
    panel.append(photo);
  } else {
    // A recording is played where a photo would be shown.
    const playing = playerFor(item);
    if (playing) {
      panel.append(make("div", { class: "player-holder is-" + item.kind }, [playing]));
      if (listenFrom !== null) {
        const from = listenFrom;
        const start = () => {
          playing.currentTime = from;
          playing.play().catch(() => {});
        };
        if (playing.readyState >= 1) start();
        else playing.addEventListener("loadedmetadata", start, { once: true });
      }
    } else {
      panel.append(make("div", { class: "player-holder is-missing", text: "In the real app the recording plays here." }));
    }
    listenFrom = null;
  }

  panel.append(make("div", { class: "detail-steps" }, [
    make("button", { class: "button button-small", type: "button", text: "Previous", onclick: () => step(-1) }),
    make("button", { class: "button button-small", type: "button", text: "Next", onclick: () => step(1) }),
  ]));

  const body = make("div", { class: "detail-body" });
  body.append(make("p", { class: "detail-name", text: kindWords(item) + ", " + item.name }));
  body.append(make("h3", { class: "detail-kind", text: isNameplate(item) || item.kind !== "photo" ? headline(item) : kindWords(item) }));
  // Saying what a photo is belongs to the Nameplates tool: it is what
  // decides whether a photo counts as a nameplate.
  if (state.plates && item.kind === "photo") body.append(drawKindChooser(item));
  if (state.spaces) body.append(drawSpaceChooser(item));
  // (A recording runs through many rooms and things; it shows no one thing.)
  if (state.spaces && INVENTORY.length && item.kind === "photo") body.append(drawEntryChooser(item));

  if (item.kind !== "photo") {
    drawRecording(item, body);
    panel.append(body);
    return;
  }

  body.append(make("p", { class: "detail-how", text: howRead(item) }));

  // What the person said around the time they took it.
  const beside = saidBeside(item);
  if (beside.length) {
    body.append(make("div", { class: "says spoken-panel" }, [
      make("div", { class: "says-title", text: "Said around when this was taken" }),
      make("ul", { class: "spoken" }, beside.map((line) => drawSaidLine(line, true))),
    ]));
  }

  body.append(...drawRead(item));
  panel.append(body);
}

/** Who read a photo, in a sentence. */
function howRead(item) {
  return item.reader ? "Read by " + item.reader + "." : "This photo has not been read yet.";
}

/** What Mouse read in a photo, set out to be checked: what it says, its
    labelled values with their ticks, and all the text. The side panel shows
    this under the photo; the large view shows it beside the photo. */
function drawRead(item) {
  const read = [];

  // For a sign, a meter or anything else that is not a nameplate, what
  // matters is what it says. Show that first, in full.
  if (!isNameplate(item) && item.text) {
    read.push(make("div", { class: "says" }, [
      make("div", { class: "says-title", text: "What it says" }),
      item.text.trim(),
    ]));
  }

  // Labelled values, and checking them off, belong to the Nameplates tool.
  if (!state.plates) return read;

  read.push(drawPlate(item));
  if (Object.keys(item.fields).length > 0) {
    read.push(make("div", { class: "legend" }, [
      make("span", {}, [make("span", { class: "legend-pencil", text: "Grey" }), " read by Mouse"]),
      make("span", {}, [make("span", { class: "legend-ink", text: "Bright" }), " checked by you"]),
    ]));
  }

  // For a nameplate the values above are what matter. The loose text is
  // rough, so it stays folded away.
  if (isNameplate(item) && item.text) {
    read.push(make("details", { class: "text-read" }, [
      make("summary", { text: "All the text read from this photo" }),
      make("pre", { text: item.text }),
    ]));
  }
  return read;
}

function drawPlate(item) {
  const plate = make("div", { class: "plate" });
  const labels = orderedLabels(item);

  if (labels.length === 0) {
    plate.append(make("p", {
      class: "plate-empty",
      text: isNameplate(item)
        ? "No values were found on this plate. Add the ones you can see."
        : "No labelled values here. Add one if there is something to keep, such as a reading.",
    }));
  } else {
    const cells = make("div", { class: "plate-cells" });
    for (const label of labels) {
      const isLong = String(item.fields[label]).length > 12;
      cells.append(drawCell(item, label, isLong));
    }
    plate.append(cells);
  }

  // Add a value the reader missed.
  const newLabel = make("input", { class: "input", type: "text", placeholder: "Label, such as HP", "aria-label": "Label of a new value", "data-part": "new-label" });
  const newValue = make("input", { class: "input", type: "text", placeholder: "What the photo shows", "aria-label": "The new value", "data-part": "new-value" });
  const add = async (event) => {
    event.preventDefault();
    if (!newLabel.value.trim() || !newValue.value.trim()) return;
    // (Sent off: when the values are drawn afresh these two boxes come back
    // empty, instead of carrying over what was typed. See whereInValues.)
    form.dataset.sent = "yes";
    await setValue(item, newLabel.value, newValue.value);
    delete form.dataset.sent;
  };
  const form = make("form", { class: "add-value", onsubmit: add }, [
    newLabel,
    newValue,
    make("button", { class: "button button-small", type: "submit", text: "Add" }),
  ]);
  plate.append(form);

  const { values, checked } = progress(item);
  if (values > checked) {
    plate.append(make("div", { class: "plate-actions" }, [
      make("button", {
        class: "button button-small",
        type: "button",
        text: checked === 0 ? "Mark all " + values + " as checked" : "Mark the other " + (values - checked) + " as checked",
        onclick: () => checkAll(item),
      }),
    ]));
  }

  // Labels you have said are not on the photo at all.
  const notShown = item.checked.filter((label) => !(label in item.fields));
  if (notShown.length > 0) {
    const line = make("p", { class: "not-shown", text: "You said the photo does not show: " });
    for (const label of notShown) {
      line.append(make("span", {}, [
        labelText(label) + " ",
        make("button", {
          class: "button button-quiet",
          type: "button",
          text: "allow again",
          title: "Let a reader fill this in again next time",
          "aria-label": "Allow " + labelText(label) + " to be read again",
          onclick: () => setChecked(item, label, false),
        }),
      ]));
    }
    plate.append(line);
  }
  return plate;
}

function drawCell(item, label, wide) {
  const isChecked = item.checked.includes(label);
  const input = make("input", {
    class: "cell-value",
    type: "text",
    value: item.fields[label],
    "aria-label": labelText(label),
    spellcheck: "false",
  });

  // Saving happens when you leave the box or press Enter. Emptying the box
  // means "the photo does not show this". (A box that is only being drawn
  // afresh has not been left: what was typed in it is carried over to the
  // new one, see whereInValues.)
  const save = async () => {
    if (input.dataset.kept) return;
    const typed = input.value.trim();
    if (typed === item.fields[label]) return;
    await setValue(item, label, typed === "" ? null : typed);
  };
  input.addEventListener("blur", save);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") input.blur();
    if (event.key === "Escape") { input.value = item.fields[label]; input.blur(); }
  });

  return make("div", { class: "cell" + (isChecked ? " is-checked" : "") + (wide ? " is-wide" : ""), "data-label": label }, [
    make("label", { class: "cell-label", text: labelText(label) }),
    input,
    make("button", {
      class: "check",
      type: "button",
      title: isChecked ? "Checked. Click to undo." : "Mark as checked",
      "aria-label": (isChecked ? "Checked: " : "Mark as checked: ") + labelText(label),
      "aria-pressed": isChecked ? "true" : "false",
      onclick: () => setChecked(item, label, !isChecked),
    }, icon(TICK)),
  ]);
}

// ---------------------------------------------------------------------------
// Changing values
// ---------------------------------------------------------------------------

/** Put the server's fresh copy of an item into the open visit and redraw. */
function replaceItem(fresh) {
  const position = state.visit.items.findIndex((item) => item.number === fresh.number);
  state.visit.items[position] = fresh;
  drawFacts();
  syncStatus();

  if (state.view === "photos") {
    drawFilters();
    const tile = $("grid").querySelector('.tile[data-number="' + fresh.number + '"]');
    if (tile && shownItems().includes(fresh)) tile.replaceWith(drawTile(fresh));
    else drawGrid();
  } else {
    drawView();
  }
  drawSide();
  // The photo may be open large, with what Mouse read beside it.
  if ($("viewer").open && fresh.number === viewing.number) {
    nameViewedPhoto(fresh);
    drawViewerValues();
  }
}

async function setValue(item, label, value) {
  try {
    replaceItem(await ask(itemAddress(item) + "/value", { label, value }));
  } catch (problem) {
    say(problem.message, true);
  }
}

async function setChecked(item, label, checked) {
  try {
    replaceItem(await ask(itemAddress(item) + "/checked", { label, checked }));
  } catch (problem) {
    say(problem.message, true);
  }
}

async function checkAll(item) {
  try {
    let fresh = item;
    for (const label of Object.keys(item.fields)) {
      if (!item.checked.includes(label)) {
        fresh = await ask(itemAddress(item) + "/checked", { label, checked: true });
      }
    }
    replaceItem(fresh);
  } catch (problem) {
    say(problem.message, true);
  }
}

// ---------------------------------------------------------------------------
// Ask Mouse: a conversation about the open visit
// ---------------------------------------------------------------------------

function talk() {
  const id = state.visit.id;
  if (!state.talks[id]) state.talks[id] = [];
  return state.talks[id];
}

/** A button that reads some words aloud, using a voice on this computer. */
function speakButton(words) {
  if (!("speechSynthesis" in window)) return null;
  return make("button", {
    class: "icon-button",
    type: "button",
    title: "Read this aloud",
    "aria-label": "Read this aloud",
    onclick: () => speak(words),
  }, icon(SPEAKER));
}

function speak(words) {
  const voices = window.speechSynthesis;
  if (voices.speaking) {
    voices.cancel(); // a second click stops it
    return;
  }
  // Only a voice that lives on this computer is used, so nothing is sent away.
  const all = voices.getVoices().filter((voice) => voice.localService);
  const voice = all.find((voice) => voice.lang.startsWith("en")) || all[0];
  if (!voice) {
    say(here("No voice is installed on this computer to read aloud."), true);
    return;
  }
  const speech = new SpeechSynthesisUtterance(words);
  speech.voice = voice;
  voices.speak(speech);
}

function drawAsk() {
  const log = $("ask-log");
  const turns = talk();
  const answering = brain();
  const model = Boolean(answering);
  const item = currentItem();
  const photo = item && item.kind === "photo" ? item : null;
  log.replaceChildren();

  if (turns.length === 0) {
    // Say who answers, and say plainly when that means sending things away.
    const who = answering ? answering.name : "an AI";
    const sent = answering && answering.sends
      ? phrase(" What it has read of this {noun}, and the photo you have open, are sent to Anthropic to be answered.")
      : "";
    log.append(make("p", {
      class: "ask-intro",
      text: phrase("Ask anything about this {noun}. Mouse answers from what it has read, using ") + who + "." + sent,
    }));
  }
  for (const turn of turns) {
    const bubble = make("div", {
      class: "said " + (turn.by_person ? "by-person" : "by-mouse") + (turn.thinking ? " is-thinking" : "") + (turn.problem ? " is-problem" : ""),
      text: turn.words,
    });
    log.append(bubble);
    if (!turn.by_person && !turn.thinking && !turn.problem) {
      log.append(make("div", { class: "said-foot" }, [speakButton(turn.words), turn.model ? "Answered by " + turn.model : ""]));
    }
  }
  log.scrollTop = log.scrollHeight;

  // A few questions to start from. They change when a photo is open.
  const starters = $("ask-starters");
  starters.replaceChildren();
  const ideas = photo
    ? ["What does this photo show?", "Read out what it says", "Is anything on it hard to read?"]
    : state.plates && EDITION.startersWithNameplates
      ? EDITION.startersWithNameplates
      : EDITION.starters;
  if (model && turns.length === 0) {
    for (const idea of ideas) {
      starters.append(make("button", { class: "starter", type: "button", text: idea, onclick: () => sendQuestion(idea) }));
    }
  }

  $("ask-box").disabled = !model;
  $("ask-send").disabled = !model;
  $("ask-box").placeholder = phrase(photo ? "Ask about this photo or the {noun}" : "Ask about this {noun}");
  $("ask-note").textContent = !model
    ? NO_BRAIN
    : photo
      ? "Mouse will also look at the open photo: " + clip(headline(photo), 50) + "."
      : "Open a photo first if you want to ask about that photo.";
}

async function sendQuestion(question) {
  question = question.trim();
  const answering = brain();
  if (!question || !answering) return;

  const turns = talk();
  const earlier = turns.filter((turn) => !turn.thinking && !turn.problem)
    .map((turn) => ({ by_person: turn.by_person, words: turn.words }));
  const item = currentItem();
  const photo = item && item.kind === "photo" ? item.number : null;

  turns.push({ by_person: true, words: question });
  const waiting = { by_person: false, words: "Thinking…", thinking: true };
  turns.push(waiting);
  $("ask-box").value = "";
  drawAsk();

  const visitId = state.visit.id;
  try {
    const reply = await ask(visitAddress() + "/ask", { question, photo, earlier, ...answering.ask });
    Object.assign(waiting, { words: reply.answer || "Mouse had nothing to say.", thinking: false, model: reply.model });
  } catch (problem) {
    Object.assign(waiting, { words: problem.message, thinking: false, problem: true });
  }
  if (state.visit && state.visit.id === visitId && state.side === "ask") drawAsk();
}

// ---------------------------------------------------------------------------
// Readers, reading again, and exporting
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Renaming a visit, and taking one out of the list
// ---------------------------------------------------------------------------

function openRenameDialog() {
  if (!state.visit) return;
  $("more").open = false;
  $("rename-name").value = state.visit.name;
  $("rename-date").value = state.visit.date;
  $("rename-problem").hidden = true;
  $("rename-dialog").showModal();
  $("rename-name").select();
}

async function saveRename(event) {
  event.preventDefault();
  try {
    takeVisit(await ask(visitAddress() + "/rename", { name: $("rename-name").value, date: $("rename-date").value }));
  } catch (problem) {
    $("rename-problem").textContent = problem.message;
    $("rename-problem").hidden = false;
    return;
  }
  $("rename-dialog").close();
  // The list on the left shows the name and the day too.
  const listed = state.visits.find((visit) => visit.id === state.visit.id);
  if (listed) Object.assign(listed, { name: state.visit.name, date: state.visit.date });
  drawVisits();
  drawVisit();
}

/** Take the open visit out of the list. It asks twice. Nothing is deleted:
    the Mouse program moves the visit's folder into "removed", and it can be
    put back from there (see the next part). */
async function removeVisit() {
  const button = $("remove-visit");
  if (!button.dataset.sure) {
    button.dataset.sure = "yes";
    button.textContent = "Click again to remove it.\nYou can put it back.";
    return;
  }
  forgetRemoving();
  $("more").open = false;
  try {
    const done = await ask(visitAddress() + "/remove", {});
    state.visit = null;
    await loadVisits();
    // The way back is offered at once, for a remove that was not meant.
    say(phrase("Taken out of your {nouns}. Nothing was deleted."), false,
      done.id ? [{ text: "Put back", does: () => putBack(done.id) }] : []);
  } catch (problem) {
    say(problem.message, true);
  }
}

/** Put the Remove button back to asking the first time. */
function forgetRemoving() {
  delete $("remove-visit").dataset.sure;
  $("remove-visit").textContent = phrase("Remove this {noun}");
}

// ---------------------------------------------------------------------------
// What was taken out of the list, and putting it back
// ---------------------------------------------------------------------------

/** "Removed today", "Removed yesterday" or "Removed on 2026-11-14", from the
    moment the Mouse program wrote down when it took the visit out. (One
    taken out by an older Mouse has no such moment: then nothing is said.) */
function removedWords(when) {
  if (!when || when.length < 10) return "";
  const day = when.slice(0, 10);
  if (day === today()) return "Removed today";
  if (day === yesterday()) return "Removed yesterday";
  return "Removed on " + day;
}

/** Open the list of what was taken out. */
function openRemoved() {
  // A message still showing (the "Put back" offered after a remove, say)
  // would lie blurred behind the list: this list takes over from it.
  $("toast").className = "toast";
  $("removed-problem").hidden = true;
  $("removed-list").replaceChildren();
  $("removed-dialog").showModal();
  drawRemoved();
}

/** Say that something in that list went wrong, inside the list's own box:
    a message at the foot of the screen would lie behind it. */
function removedProblem(message) {
  $("removed-problem").textContent = message;
  $("removed-problem").hidden = false;
}

/** Fill that list with what the Mouse program says was taken out. */
async function drawRemoved() {
  let removed;
  try {
    removed = (await ask("/api/removed")).removed;
  } catch (problem) {
    removedProblem(problem.message);
    return;
  }
  const rows = removed.map((visit) => {
    const facts = [visit.date + ", " + plural(visit.photos, "photo", "photos"), removedWords(visit.removed)]
      .filter(Boolean).join(". ");
    return make("li", {}, [
      make("div", { class: "removed-about" }, [
        make("span", { class: "removed-name", text: visit.name }),
        make("span", { class: "removed-facts", text: facts }),
      ]),
      // The demo on the web has no folders to show, and neither has the
      // app on a tablet or phone.
      DEMO || IN_APP ? null : make("button", {
        class: "button button-small", type: "button", text: "Show its folder",
        "aria-label": "Show the folder of " + visit.name,
        onclick: () => showRemovedFolder(visit.id),
      }),
      make("button", {
        class: "button button-main button-small", type: "button", text: "Put back",
        "aria-label": "Put back " + visit.name,
        onclick: () => putBack(visit.id),
      }),
    ]);
  });
  // (Nothing there after all: the folders were moved by hand, perhaps.)
  if (!rows.length) rows.push(make("li", { class: "removed-none", text: "There is nothing here now." }));
  $("removed-list").replaceChildren(...rows);
}

/** Open the folder a removed visit is kept in, in the computer's own file
    window. */
async function showRemovedFolder(id) {
  try {
    await ask("/api/reveal", { removed: id });
  } catch (problem) {
    removedProblem(problem.message);
  }
}

// One at a time: a second press while the first is under way does nothing.
let puttingBack = false;

/** Put a visit that was taken out back into the list, and open it. */
async function putBack(id) {
  if (puttingBack) return;
  puttingBack = true;
  try {
    const back = await ask("/api/removed/" + encodeURIComponent(id) + "/put-back", {});
    $("removed-dialog").close();
    await loadVisits(back.visit);
    // While it was away, another may have been given its name and day. Both
    // are kept, so say why there are two alike.
    const open = state.visit;
    const alike = open ? state.visits.filter((visit) => visit.name === open.name && visit.date === open.date).length : 1;
    say(back.name + phrase(" is back in your {nouns}.") +
      (alike > 1 ? phrase(" Another {noun} has the same name and date, so there are now two.") : ""));
  } catch (problem) {
    // In the list's own box while it is open: a message at the foot of the
    // screen would lie behind it.
    if ($("removed-dialog").open) removedProblem(problem.message);
    else say(problem.message, true);
  } finally {
    puttingBack = false;
  }
}

/** Fill a drop-down with the readers that can be used right now. */
function fillReaders(select) {
  select.replaceChildren();
  select.append(make("option", { value: "ocr", text: "Quick text reader (built in)" }));

  const local = state.readers ? state.readers.local : null;
  if (local && local.available) {
    for (const model of local.models) {
      select.append(make("option", { value: "local:" + model, text: "AI on this computer: " + model }));
    }
    if (local.preferred) select.value = "local:" + local.preferred;
  } else if (!IN_APP) {
    select.append(make("option", { value: "", disabled: true, text: "AI on this computer (not running)" }));
  }

  // Claude is offered once the person has connected it with their own key.
  // Where the edition says Claude is the usual reader, it is picked first.
  const claude = state.readers ? state.readers.claude : null;
  if (claude && claude.ready) {
    select.append(make("option", { value: "claude", text: "Claude (the photos are sent to Anthropic)" }));
    if ((recall("mouse-brain") || EDITION.brain) === "claude") select.value = "claude";
  }
}

/** Which Claude model to use: the one chosen in Settings if Mouse still
    offers it, otherwise the usual one. */
function claudeModel() {
  const claude = state.readers ? state.readers.claude : null;
  if (!claude) return "";
  const chosen = recall("mouse-claude-model");
  const offered = (claude.models || []).some((one) => one.id === chosen);
  return offered ? chosen : claude.model;
}

/** Turn a drop-down choice into what the server wants. */
function readerChoice(select) {
  const [reader, ...model] = select.value.split(":");
  return { reader, model: model.join(":"), claude_model: claudeModel() };
}

function readerHint() {
  const chosen = $("add-reader").value;
  $("add-reader-hint").textContent = chosen === "claude"
    ? "Claude reads small print and nameplates best. Each photo is sent over the internet to Anthropic to be read, and costs a few cents on your key."
    : chosen.startsWith("local:")
      ? "The AI reads more than the quick reader and can say what a photo shows. It takes about 5 seconds a photo. Nothing leaves this computer."
      : IN_APP
        ? "The quick reader only picks out the words in a photo. It works with no internet."
        : "The quick reader only picks out the words in a photo. Start Ollama to use the AI on this computer instead.";
}

async function loadReaders() {
  try {
    state.readers = await ask("/api/readers");
  } catch {
    state.readers = null;
  }
  fillReaders($("reader-choice"));
  fillReaders($("add-reader"));
  readerHint();
  drawKeptHere();
}

/** The line at the foot of the list of visits. It says everything is kept
    on this computer, which is true of where things are kept. Once Claude is
    connected it also says what is sent away, so the line never promises
    more than Mouse does. */
function drawKeptHere() {
  if (DEMO) return;
  const claude = state.readers ? state.readers.claude : null;
  document.querySelector(".kept-here").textContent = here(claude && claude.ready
    ? "Everything is kept on this computer. What Claude reads or answers is sent to Anthropic for that."
    : "Everything is kept on this computer.");
}

async function readAgain() {
  if (!state.visit) return;
  $("more").open = false;
  try {
    await ask(visitAddress() + "/read", readerChoice($("reader-choice")));
    watchJob();
  } catch (problem) {
    say(problem.message, true);
  }
}

/** Hand a file Mouse has made to the person.
    In a browser it is saved the browser's way, to the Downloads folder.
    Inside the app on a tablet or phone there is no Downloads folder: the
    file is already kept with the visit, where the Files app shows it, and
    the person is told so, with a button that sends it on (to mail, to
    another app, to someone nearby) where the device offers that. */
function handOver(file, done) {
  if (!IN_APP) {
    const link = make("a", { href: URL.createObjectURL(file), download: file.name });
    document.body.append(link);
    link.click();
    link.remove();
    say(done.saved);
    return;
  }
  let canShare = false;
  try { canShare = Boolean(navigator.canShare && navigator.canShare({ files: [file] })); } catch { /* not offered */ }
  say(done.made + " " + whereInFiles(), false, canShare ? [{
    text: "Share",
    // (Turned away by the person, or not allowed just now: nothing to say.)
    does: () => navigator.share({ files: [file] }).catch(() => {}),
  }] : []);
}

/** Where the open visit's own files are, as the Files app shows them. */
function whereInFiles() {
  return "It is kept with this " + EDITION.noun + ": in the Files app, under " + EDITION.name + ", in visits, " + state.visit.id + ".";
}

/** Have the Mouse program make a file out of the open visit, and hand it to
    the browser to save. `what` describes it: where to ask, the name to save
    it under, the words for the demo, for when it is done and for when it
    fails. The buttons are greyed while it is being made. */
async function saveFile(what, buttons) {
  if (!state.visit) return;
  $("more").open = false;
  $("reports").open = false;
  if (DEMO) {
    say("The demo cannot make files. In the real app this saves " + what.called + ".");
    return;
  }
  for (const button of buttons) button.disabled = true;
  try {
    const response = await fetch(visitAddress() + what.address);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.problem || what.failed);
    }
    const made = await response.blob();
    handOver(new File([made], state.visit.id + what.ending, { type: made.type }), { saved: what.done, made: what.made });
  } catch (problem) {
    say(problem.message, true);
  } finally {
    for (const button of buttons) button.disabled = false;
  }
}

function exportToExcel() {
  // There are three buttons for this: one in the toolbar, one in the More
  // menu and one in the Reports menu.
  return saveFile({
    address: "/visit.xlsx",
    ending: ".xlsx",
    called: "an Excel file",
    done: "Exported to Excel. Look in your Downloads folder.",
    made: "The Excel workbook is made.",
    failed: "The Excel file could not be made.",
  }, [$("export"), $("export-menu"), $("report-excel")]);
}

function saveWordReport() {
  return saveFile({
    address: "/report.docx",
    ending: ".docx",
    called: "a Word report",
    done: "The Word report is saved. Look in your Downloads folder.",
    made: "The Word report is made.",
    failed: "The Word report could not be made.",
  }, [$("report-word")]);
}

/** The photos, zipped into a folder for each space. The zip can be very
    large, so the browser is sent straight to it and saves it as it comes,
    instead of the screen holding all of it first. */
function savePhotosZip() {
  if (!state.visit) return;
  $("reports").open = false;
  if (DEMO) {
    say("The demo cannot make files. In the real app this saves a zip file of the photos.");
    return;
  }
  if (IN_APP) {
    // Inside the app the zip is made and left with the visit, where the
    // Files app shows it. ("HEAD" asks for the file to be made without
    // sending it back: it can be far too large to pass through the screen.)
    say("Packing the photos…");
    fetch(visitAddress() + "/photos.zip", { method: "HEAD" }).then((response) => {
      if (!response.ok) throw new Error("no zip");
      say("The photos are packed into a zip file. " + whereInFiles());
    }).catch(() => say("The photos could not be packed.", true));
    return;
  }
  const link = make("a", { href: visitAddress() + "/photos.zip", download: state.visit.id + "-photos.zip" });
  document.body.append(link);
  link.click();
  link.remove();
  say("Packing the photos. The zip file will turn up in your Downloads folder.");
}

// ---------------------------------------------------------------------------
// The day as text: copy it, or save it as a note
// ---------------------------------------------------------------------------

async function copyNote() {
  if (!state.visit) return;
  try {
    const note = await ask(visitAddress() + "/note");
    await navigator.clipboard.writeText(note.text);
    say("Copied. Paste it into any app.");
  } catch (problem) {
    say(problem.message || "The text could not be copied.", true);
  }
}

async function saveNote() {
  if (!state.visit) return;
  try {
    // The same words as "Copy as text", handed to the browser as a file.
    const note = await ask(visitAddress() + "/note");
    handOver(new File([note.text], state.visit.id + ".md", { type: "text/markdown" }),
      { saved: "Saved as a note. Look in your Downloads folder.", made: "The note is made." });
  } catch (problem) {
    say(problem.message, true);
  }
}

// ---------------------------------------------------------------------------
// Settings: the look, the tools, plugs and about
// ---------------------------------------------------------------------------

function openSettings(section) {
  showSettings(section);
  drawLook();
  drawTools();
  drawAbout();
  $("settings-dialog").showModal();
}

/** Show one section of Settings and mark its name in the list. */
function showSettings(section) {
  for (const link of document.querySelectorAll(".settings-link")) {
    link.setAttribute("aria-current", link.dataset.section === section ? "true" : "false");
  }
  for (const part of document.querySelectorAll(".settings-section")) {
    part.hidden = part.id !== "settings-" + section;
  }
}

function drawTools() {
  const list = $("tools-list");
  list.replaceChildren();
  const local = state.readers ? state.readers.local : null;
  const models = local && local.available ? local.models : [];

  /** One row: a name, a line about it, its state or a switch, and
      sometimes one more control underneath. */
  const row = (name, about, status, extra = null, extraClass = "") =>
    make("li", { class: "tool" + extraClass }, [
      make("div", { class: "tool-name", text: name }),
      typeof status === "string"
        ? make("div", { class: "tool-state" + (status === "On" ? " is-on" : ""), text: status })
        : make("div", { class: "tool-state" }, status),
      make("div", { class: "tool-about", text: about }),
      extra,
    ]);

  list.append(row(
    "Text reader",
    "Reads the words in a photo. Built in, quick, and works with no internet.",
    "On",
  ));

  // With more than one AI model installed, you choose which one answers.
  let chooseModel = null;
  if (models.length > 1) {
    const choice = make("select", { class: "select", id: "model-choice" },
      models.map((model) => make("option", { value: model, text: model })));
    choice.value = aiModel();
    choice.addEventListener("change", () => {
      remember("mouse-model", choice.value);
      if (state.visit) drawVisit();
    });
    chooseModel = make("div", { class: "tool-extra" }, [
      make("label", { for: "model-choice", text: "Answers and summaries come from" }),
      choice,
    ]);
  }
  // (Not offered inside the app on a tablet or phone: there is no such AI
  // there to start.)
  if (!IN_APP || models.length) {
    list.append(row(
      "AI on this computer",
      models.length
        ? "Looks at photos, answers questions and writes summaries. Nothing leaves this computer."
        : "Looks at photos, answers questions and writes summaries. It is not running: start Ollama on this computer to use it.",
      models.length ? "On" : "Not running",
      chooseModel,
    ));
  }

  list.append(drawClaudeTool(row));

  const plateSwitch = make("button", {
    class: "switch",
    type: "button",
    role: "switch",
    "aria-checked": state.plates ? "true" : "false",
    "aria-label": "Nameplates tool",
    onclick: () => {
      state.plates = !state.plates;
      remember("mouse-plates", state.plates ? "on" : "off");
      drawTools();
      if (state.visit) drawVisit();
    },
  });
  list.append(row(
    "Nameplates",
    "For equipment surveys, such as heating and cooling. Finds the nameplates in your photos, lays out make, model, serial and ratings, keeps track of what you have checked, and puts Export to Excel up front.",
    plateSwitch,
  ));

  const spacesSwitch = make("button", {
    class: "switch",
    type: "button",
    role: "switch",
    "aria-checked": state.spaces ? "true" : "false",
    "aria-label": "Spaces tool",
    onclick: () => {
      state.spaces = !state.spaces;
      remember("mouse-spaces", state.spaces ? "on" : "off");
      drawTools();
      if (state.visit) drawVisit();
    },
  });
  list.append(row(
    "Spaces",
    "Sorts photos into the rooms and areas you walked through: the boiler room, the roof, a corridor. " +
      "Each space can carry its floor, what it is used as, its size and your notes. " +
      "It also adds the Reports button: a Word report, an Excel workbook and the photos zipped by space.",
    spacesSwitch,
  ));

  // Listening: on once its model is on this computer. Fetching the model
  // is a download, so it waits for a person to ask.
  const listener = state.readers ? state.readers.listener : null;
  const listening = "Writes down what is said in your recordings and tells it between your photos, at the moment it was said. " +
    here("It runs on this computer: nothing you record is sent anywhere. ");
  if (DEMO || !listener) {
    list.append(row(
      "Listening",
      listening + (DEMO ? "The demo has nothing to listen with; its words were made up beforehand." : "Mouse could not find out whether its listening model is here."),
      DEMO ? "Not in the demo" : "Not known",
    ));
  } else if (listener.ready) {
    list.append(row(
      "Listening",
      listening + "New recordings are listened to as you add them. It can mishear, so the words are yours to check and correct. " +
        "The model is " + listener.name + ", made by OpenAI and free to use.",
      "On",
    ));
  } else {
    list.append(row(
      "Listening",
      listening + "To listen, Mouse needs its listening model here first: " + listener.megabytes + " MB, fetched once from the internet. " +
        "Until then, words can still come with a recording (a .srt, .vtt or .txt file of the same name beside it) or be typed in.",
      here("Not on this computer"),
      make("div", { class: "tool-extra" }, [
        make("button", { class: "button button-small", type: "button", text: "Get the listening model (" + listener.megabytes + " MB)", onclick: getListener }),
      ]),
    ));
  }
}

/** The Claude row of the Tools list: what it is, what using it means, and
    where the person gives (or removes) their own key. */
function drawClaudeTool(row) {
  const claude = state.readers ? state.readers.claude : null;
  const about = "Anthropic's AI model, in the cloud. It reads small print and nameplates best, answers questions and writes summaries. " +
    here("Unlike the tools above it does not run on this computer: what it reads or answers is sent over the internet to Anthropic, ") +
    "and it is paid for through a key of your own.";

  // The public demo has no Mouse program behind it, and is no place for a key.
  if (DEMO || !claude) {
    return row("Claude", about, "Not connected", make("div", { class: "tool-extra" }, [
      make("span", { class: "quiet", text: DEMO ? "In the real app you connect Claude here, with a key of your own." : "Mouse could not find out whether a key is kept." }),
    ]));
  }

  /** Tell the Mouse program to keep a key or forget it, then redraw with
      whatever is true afterwards. */
  const change = async (what, problemBox) => {
    try {
      state.readers.claude = await ask("/api/claude-key", what);
    } catch (problem) {
      if (problemBox) {
        problemBox.textContent = problem.message;
        problemBox.hidden = false;
      } else {
        say(problem.message, true);
      }
      return;
    }
    fillReaders($("reader-choice"));
    fillReaders($("add-reader"));
    readerHint();
    drawKeptHere();
    drawTools();
    if (state.visit) drawVisit();
  };

  if (!claude.ready) {
    // The key is typed into a box that hides it, sent once to the Mouse
    // program on this computer, and not kept by the screen.
    const box = make("input", {
      class: "input", type: "password", id: "claude-key", autocomplete: "off", spellcheck: "false",
      placeholder: "Paste your key here (it starts with sk-ant-)", "aria-label": "Your Anthropic key",
    });
    const problemBox = make("p", { class: "form-problem", hidden: true });
    const save = async (event) => {
      event.preventDefault();
      const key = box.value;
      box.value = "";
      await change({ key }, problemBox);
    };
    return row("Claude", about, "Not connected", make("form", { class: "tool-extra tool-key", onsubmit: save }, [
      box,
      make("button", { class: "button button-small", type: "submit", text: "Connect" }),
      problemBox,
      make("p", { class: "quiet tool-small-print", text: IN_APP
        ? "You make a key in your own account at console.anthropic.com. Mouse keeps it inside the app on this " + DEVICE +
          ", not with your " + EDITION.nouns + ", and never shows it again."
        : "You make a key in your own account at console.anthropic.com. Mouse keeps it in one file in your own settings folder (" +
          claude.folder + "), not with your " + EDITION.nouns + ", and never shows it again." }),
    ]));
  }

  // Connected: choose who answers, and a way to disconnect.
  const choice = make("select", { class: "select", id: "brain-choice" }, [
    make("option", { value: "claude", text: "Claude" }),
    IN_APP ? null : make("option", { value: "local", text: "The AI on this computer" }),
  ]);
  choice.value = (recall("mouse-brain") || EDITION.brain) === "claude" ? "claude" : "local";
  choice.addEventListener("change", () => {
    remember("mouse-brain", choice.value);
    fillReaders($("reader-choice"));
    fillReaders($("add-reader"));
    readerHint();
    if (state.visit) drawVisit();
  });

  // Which Claude to ask. They differ in price by a lot, so this is worth
  // trying on a visit's photos.
  const models = claude.models || [];
  const whichModel = make("select", { class: "select", id: "claude-model" },
    models.map((one) => make("option", { value: one.id, text: one.name })));
  whichModel.value = claudeModel();
  const aboutModel = make("p", { class: "quiet tool-small-print" });
  const showAboutModel = () => {
    const one = models.find((model) => model.id === whichModel.value);
    aboutModel.textContent = one
      ? one.about + " Anthropic sets the prices and can change them; theirs is the page to check."
      : "";
  };
  showAboutModel();
  whichModel.addEventListener("change", () => {
    remember("mouse-claude-model", whichModel.value);
    showAboutModel();
  });

  const fromSetting = claude.kept_in === "setting";
  const remove = make("button", { class: "button button-quiet", type: "button", text: "Disconnect and forget the key" });
  remove.addEventListener("click", () => {
    if (!remove.dataset.sure) {
      remove.dataset.sure = "yes";
      remove.textContent = "Click again to forget the key";
      return;
    }
    change({ forget: true });
  });

  return row("Claude", about, "On", make("div", { class: "tool-extra tool-key" }, [
    make("label", { for: "brain-choice", text: "Usually read photos and answer with" }),
    choice,
    make("label", { for: "claude-model", text: "Which Claude" }),
    whichModel,
    aboutModel,
    fromSetting
      ? make("p", { class: "quiet tool-small-print", text: "The key comes from this computer's setting MOUSE_CLAUDE_KEY. Remove it there to disconnect." })
      : remove,
    make("p", { class: "quiet tool-small-print", text:
      "Anthropic says it does not keep what is sent or train on it by default. " +
      "Check that the people whose buildings you photograph are happy for the photos to be read this way." }),
  ]));
}

async function drawAbout() {
  if (!state.about) {
    try {
      state.about = await ask("/api/about");
    } catch {
      state.about = {};
    }
  }
  const list = $("about-list");
  list.replaceChildren();
  // On a tablet or phone a person finds them in the Files app, under the
  // app's own name: the long path of the folder would tell them nothing.
  const keptIn = IN_APP
    ? "This " + DEVICE + ", in the Files app, under " + EDITION.name
    : state.about.vault || "a folder on this computer";
  const facts = [
    ["Edition", EDITION.name],
    ["Version", state.about.version || "not known"],
    [phrase("Your {nouns} are kept in"), keptIn],
  ];
  for (const [name, value] of facts) {
    list.append(make("dt", { text: name }), make("dd", { text: value }));
  }
  // The demo on the web has no folder to open.
  $("open-vault").hidden = Boolean(DEMO);
  // Mouse's own window is asked where its shortcuts are; the answer comes
  // back to `mouseWindowSays`, which draws them.
  if (IN_WINDOW) {
    $("shortcuts-said").textContent = "";
    tellWindow("shortcuts");
    drawKeys();
  }
}

/** Open a folder in the computer's own file window: the open visit's
    folder, or (with no visit named) the folder everything is kept in. */
async function showFolder(visit) {
  try {
    await ask("/api/reveal", visit ? { visit } : {});
  } catch (problem) {
    say(problem.message, true);
  }
}

// ---------------------------------------------------------------------------
// Long jobs: watch until done
// ---------------------------------------------------------------------------

const BUSY_BUTTONS = ["read-again", "add-visit", "add-first", "add-files"];

function showNotice(message, isProblem) {
  const notice = $("notice");
  notice.textContent = message || "";
  notice.className = "notice" + (isProblem ? " is-problem" : "");
  notice.hidden = !message;
}

/** In Mouse's own window, the button on the taskbar shows how far a long
    piece of work has got, and flashes when the work ends while you are
    looking at something else. */
function tellWindowOfWork(job) {
  let words = "job:done";
  if (job.running) {
    const share = job.total ? Math.min(100, Math.round((job.done / job.total) * 100)) : 0;
    // (With nothing done yet it only says "busy": an empty bar would look
    // like no bar at all.)
    words = share > 0 ? "job:" + share : "job:busy";
  } else if (!state.toldOfWork) {
    return; // no work was under way, so none has ended
  }
  if (words === state.toldOfWork) return;
  tellWindow(words);
  state.toldOfWork = job.running ? words : null;
}

function drawJob(job) {
  tellWindowOfWork(job);
  $("job").hidden = !job.running;
  if (!job.running) return;
  $("job-what").textContent = job.what;
  const share = job.total ? Math.min(100, Math.round((job.done / job.total) * 100)) : 0;
  $("job-bar").style.width = share + "%";
  // Some work says for itself how far along it is (listening counts
  // minutes of sound; fetching a model counts megabytes).
  $("job-now").textContent = job.words
    || (job.current ? "File " + job.done + " of " + job.total + ": " + job.current : "Getting ready…");
  for (const id of BUSY_BUTTONS) $(id).disabled = true;
}

// While Mouse is in the middle of a long piece of work (reading a visit's
// photos, listening to a recording), a phone or tablet is asked not to
// switch its screen off: an app that is put to sleep stops working until
// it is opened again. A computer is left to its own settings.
let awakeForWork = null;
function stayAwake(wanted) {
  if (!navigator.wakeLock || !(IN_APP || CAMERA_AT_HAND)) return;
  if (wanted && !awakeForWork) {
    awakeForWork = navigator.wakeLock.request("screen").catch(() => null);
  } else if (!wanted && awakeForWork) {
    awakeForWork.then((awake) => awake && awake.release().catch(() => {}));
    awakeForWork = null;
  }
}
// (A device lets go of this by itself when the app is put away. Back in
// front, it is asked for again on the next look at the work.)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) awakeForWork = null;
});

function watchJob() {
  clearInterval(state.polling);
  showNotice("");
  const look = async () => {
    let job;
    try {
      job = await ask("/api/job");
    } catch {
      return; // try again on the next tick
    }
    drawJob(job);
    stayAwake(job.running);
    if (job.running) return;

    clearInterval(state.polling);
    state.polling = null;
    for (const id of BUSY_BUTTONS) $(id).disabled = false;
    if (job.problem) {
      showNotice(job.problem, true);
      loadReaders().then(drawTools);
      return;
    }
    if (job.visit) {
      // Whatever was open in the side panel is opened again afterwards.
      const same = state.visit && state.visit.id === job.visit;
      const open = same ? state.selected : null;
      // So is a space's own page, and which photos the tiles showed: photos
      // added from there are then seen arriving there.
      const inSpace = same ? state.spaceOpen : null;
      const shown = same ? state.spaceShown : "all";
      await loadVisits(job.visit);
      const there = (id) => id === "none" || id === "all" || state.visit.spaces.some((space) => space.id === id);
      if (state.visit && ((inSpace && there(inSpace)) || (shown !== "all" && there(shown)))) {
        if (inSpace && there(inSpace)) state.spaceOpen = inSpace;
        if (there(shown)) state.spaceShown = shown;
        drawVisit();
      }
      if (open !== null && state.visit && state.visit.items.some((item) => item.number === open)) select(open);
      loadReaders().then(drawTools);
    } else {
      // Work that was not about one visit: the listening model arriving.
      // What the tools can do has changed, so everything is drawn afresh.
      await loadReaders();
      drawTools();
      if (state.visit) {
        drawVisit();
        drawSide();
      }
    }
    if (job.summary) showNotice(job.summary, false);
  };
  look();
  state.polling = setInterval(look, 500);
}

// ---------------------------------------------------------------------------
// Add a visit
// ---------------------------------------------------------------------------

/** A day the way Mouse writes days: 2026-11-17. */
function dayText(date) {
  const two = (number) => String(number).padStart(2, "0");
  return date.getFullYear() + "-" + two(date.getMonth() + 1) + "-" + two(date.getDate());
}

function today() {
  return dayText(new Date());
}

function yesterday() {
  const day = new Date();
  day.setDate(day.getDate() - 1);
  return dayText(day);
}

async function browse(path) {
  let here;
  try {
    here = await ask("/api/browse" + (path ? "?path=" + encodeURIComponent(path) : ""));
  } catch (problem) {
    say(problem.message, true);
    return;
  }

  $("browser-path").textContent = here.path;
  $("browser-up").disabled = !here.parent;
  $("browser-up").onclick = () => browse(here.parent);

  const places = $("browser-places");
  places.replaceChildren();
  for (const place of here.shortcuts) {
    places.append(make("button", { class: "button button-small", type: "button", text: place.name, onclick: () => browse(place.path) }));
  }

  const folders = $("browser-folders");
  folders.replaceChildren();
  for (const folder of here.folders) {
    folders.append(make("li", {}, [
      make("button", { class: "browser-folder", type: "button", text: folder.name, onclick: () => browse(folder.path) }),
    ]));
  }
  if (here.folders.length === 0) {
    folders.append(make("li", { class: "hint", text: "No folders inside this one." }));
  }

  const count = $("browser-count");
  count.className = "browser-count" + (here.recordings ? " has-files" : "");
  count.textContent = here.recordings
    ? plural(here.recordings, "photo, audio or video file", "photos, audio or video files") + " in this folder."
    : "No photos, audio or video directly in this folder.";

  // Whatever folder you are looking at is the one that will be saved.
  $("add-folder").value = here.path;
  if (!$("add-name").dataset.typed) {
    const last = here.path.split(/[\\/]/).filter(Boolean).pop() || "";
    $("add-name").value = here.recordings ? last.replace(/[-_]+/g, " ") : "";
  }
}

// ---------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------
//
// When Mouse is shown in a window of its own (the `mouse-window` program),
// that window can do a few things a tab in a browser cannot. The screen
// asks for them with `tellWindow` (a few fixed words, never a file's name
// or an address), and the window says what came of it by calling
// `mouseWindowSays` here. In a browser none of this happens, and nothing
// of it is shown.

window.mouseWindowSays = (said) => {
  if (!IN_WINDOW || !said) return;
  // A folder chosen in Windows' own "choose a folder" box.
  if (said.kind === "folder") browse(said.path);
  // A folder is being dragged over the window, or has been let go on it.
  if (said.kind === "dragging") $("drop-here").hidden = !said.on;
  if (said.kind === "dropped") addFromFolder(said.path);
  // A note or a report has arrived where Windows keeps downloads.
  if (said.kind === "saved") {
    say("Saved " + said.name + (said.folder ? " in " + said.folder : "") + ".", false, [
      { text: "Open", does: () => tellWindow("saved:open:" + said.number) },
      { text: "Show in folder", does: () => tellWindow("saved:show:" + said.number) },
    ]);
  }
  if (said.kind === "not-saved") say("That could not be saved.", true);
  if (said.kind === "zoom") say(said.percent === 100 ? "The usual size" : "Size: " + said.percent + "%");
  if (said.kind === "fullscreen" && said.on) say("Filling the whole screen. Press F11 to go back.");
  if (said.kind === "shortcuts") drawShortcuts(said);
};

/** A folder was dropped on the window: offer to add it. */
function addFromFolder(path) {
  if (state.polling) {
    say("Mouse is still busy. Drop the folder again when it has finished.");
    return;
  }
  const open = document.querySelector("dialog[open]");
  if (open && open.id !== "add-dialog") {
    say(phrase("Close what is open first, then drop the folder again to add it as a {noun}."));
    return;
  }
  // (The form shows whatever folder is written in its box.)
  $("add-folder").value = path;
  if (open) {
    $("add-way-folder").checked = true;
    drawAddWay();
  } else {
    openAddDialog("folder");
  }
}

/** Where this Mouse's shortcuts are, and what to press to change that. */
function drawShortcuts(said) {
  for (const [spot, there] of [["start-menu", said.startMenu], ["desktop", said.desktop]]) {
    const button = $("shortcut-" + spot);
    button.textContent = there ? "Remove" : "Add";
    button.dataset.there = there ? "yes" : "";
    button.disabled = false;
  }
  $("shortcuts-said").textContent = said.said || "";
  $("shortcuts-said").className = "hint" + (said.wrong ? " is-problem" : "");
}

/** The keys Mouse's own window answers to, listed in Settings. */
function drawKeys() {
  const keys = [
    ["Ctrl + N", phrase("Add a {noun}")],
    ["Ctrl + F", phrase("Find a {noun}")],
    ["Ctrl + ,", "Settings"],
    ["← and →", "The photo before, and the one after"],
    ["Esc", "Close what is open"],
    ["Ctrl + plus, minus, 0", "Larger, smaller, the usual size"],
    ["F11", "Fill the whole screen, and back"],
    ["F5", "Draw the screen afresh"],
    ["Ctrl + W", "Close " + EDITION.name],
  ];
  $("keys-list").replaceChildren(...keys.flatMap(([key, does]) =>
    [make("dt", { text: key }), make("dd", { text: does })]));
}

// Keys. In a web browser most of these belong to the browser (and do the
// browser's own thing), so Mouse only answers to them in its own window.
document.addEventListener("keydown", (event) => {
  if (!IN_WINDOW) return;
  const ctrl = event.ctrlKey && !event.altKey && !event.metaKey;
  const key = event.key.toLowerCase();
  const nothingOpen = !document.querySelector("dialog[open]");

  if (event.key === "F11") tellWindow("fullscreen");
  else if (event.key === "F5" || (ctrl && key === "r")) location.reload();
  else if (ctrl && (key === "=" || key === "+")) tellWindow("zoom:in");
  else if (ctrl && key === "-") tellWindow("zoom:out");
  else if (ctrl && key === "0") tellWindow("zoom:reset");
  // (Alt+F4 normally never gets this far: Windows closes the window
  // itself. Should it arrive here, it means the same.)
  else if ((ctrl && key === "w") || (event.altKey && event.key === "F4")) tellWindow("close");
  else if (ctrl && key === "n") {
    if (nothingOpen && !$("add-visit").disabled) openAddDialog();
  } else if (ctrl && key === "f") {
    if (nothingOpen) {
      // (The list may be folded away; finding something needs it shown.)
      $("shell").classList.remove("no-sidebar");
      if (window.matchMedia("(max-width: 760px)").matches) $("shell").classList.add("show-sidebar");
      $("find-visit").focus();
      $("find-visit").select();
    }
  } else if (ctrl && key === ",") {
    if (nothingOpen) openSettings("look");
  } else return;
  event.preventDefault();
});

// Ctrl and the mouse wheel: larger and smaller, a step at a time.
let lastSizeStep = 0;
document.addEventListener("wheel", (event) => {
  if (!IN_WINDOW || !event.ctrlKey) return;
  event.preventDefault();
  if (Date.now() - lastSizeStep < 180) return;
  lastSizeStep = Date.now();
  tellWindow(event.deltaY < 0 ? "zoom:in" : "zoom:out");
}, { passive: false });

// A right-click offers what it would in any program: cut, copy and paste
// where there is text to work on, copying or saving a picture. The
// browser's own list ("Back", "Refresh", "Save as") has no place in a
// window that is not a browser.
document.addEventListener("contextmenu", (event) => {
  if (!IN_WINDOW) return;
  const onText = event.target.closest("input, textarea, [contenteditable]");
  const onPicture = event.target.closest("img");
  const picked = String(window.getSelection() || "").trim() !== "";
  if (!onText && !onPicture && !picked) event.preventDefault();
});

// ---------------------------------------------------------------------------
// Adding from the device the screen is on: files chosen, or a photo taken
// ---------------------------------------------------------------------------

/** A phone or a tablet has a camera in the hand. (An iPad says it is a Mac,
    and gives itself away by being a Mac with a touch screen.) */
const CAMERA_AT_HAND = /Android|iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** What Mouse keeps: photos, sound and video, and the words that came with
    a recording. */
const KEPT = /\.(jpe?g|png|hei[cf]|m4a|mp3|wav|aac|ogg|opus|flac|mp4|mov|m4v|mkv|webm|avi|srt|vtt|txt)$/i;

/** The buttons that add to the open visit from this device. With a space
    named, what is added goes straight into that space. */
function addButtons(spaceId = null, small = false) {
  const size = small ? " button-small" : "";
  const here = spaceId ? " here" : "";
  return [
    CAMERA_AT_HAND ? make("button", {
      class: "button button-main" + size,
      type: "button",
      text: "Take photo" + here,
      onclick: () => openChooser("take-photo", spaceId),
    }) : null,
    make("button", {
      class: "button" + size,
      type: "button",
      text: "Add photos" + here,
      title: "Photos, sound or video from this device",
      onclick: () => openChooser("choose-files", spaceId),
    }),
    CAN_RECORD ? make("button", {
      class: "button" + size,
      type: "button",
      text: "Record a note" + here,
      title: "Say what you see; Mouse keeps the recording with this " + EDITION.noun,
      onclick: () => startRecording(spaceId),
    }) : null,
  ];
}

/** Open the device's own "choose files" box, or its camera. */
function openChooser(id, spaceId = null) {
  if (DEMO) {
    say(phrase("This is the demo, with a made-up {noun}. Get Mouse to add your own photos."));
    return;
  }
  if (!state.visit) return;
  if (state.polling || state.sending) {
    say("Mouse is still busy. Add more when it has finished.");
    return;
  }
  if (state.recording) {
    say("Stop the recording first, then add more.");
    return;
  }
  state.sendTo = spaceId;
  $("more").open = false;
  $(id).click();
}

/** The files the person chose, or the photo they took. */
function filesChosen(event) {
  const input = event.target;
  let files = [...input.files];
  // A camera calls every photo it hands over "image.jpg". Name each by the
  // moment it was taken instead, so a report never lists the same name twice.
  if (input.id === "take-photo") files = files.map(namedByMoment);
  input.value = ""; // so that the same file can be chosen again later
  sendFiles(files, state.sendTo);
}

function namedByMoment(file) {
  const two = (number) => String(number).padStart(2, "0");
  const at = new Date(file.lastModified || Date.now());
  const ending = (file.name.match(/\.[a-z0-9]+$/i) || [".jpg"])[0].toLowerCase();
  const name = "Photo " + at.getFullYear() + "-" + two(at.getMonth() + 1) + "-" + two(at.getDate())
    + " " + two(at.getHours()) + "." + two(at.getMinutes()) + "." + two(at.getSeconds()) + ending;
  return new File([file], name, { type: file.type, lastModified: file.lastModified });
}

/** Send files from this device to the open visit, one after another, and
    then have Mouse bring them in: saved, read and, if it can, listened to. */
async function sendFiles(files, spaceId = null) {
  if (!state.visit || !files.length) return false;
  if (state.polling || state.sending || state.recording) {
    say(state.recording ? "Stop the recording first, then add more." : "Mouse is still busy. Add more when it has finished.");
    return false;
  }
  const wanted = files.filter((file) => KEPT.test(file.name));
  const left = files.length - wanted.length;
  if (!wanted.length) {
    say("Mouse keeps photos, sound and video. None of those were chosen.", true);
    return false;
  }

  const address = visitAddress() + "/files";
  state.sending = true;
  showNotice("");
  try {
    // (Anything left from a batch that was given up half-way goes first.)
    await ask(address + "/forget", {});
    for (const [number, file] of wanted.entries()) {
      drawJob({
        running: true,
        what: "Sending to " + EDITION.name,
        done: number,
        total: wanted.length,
        words: "File " + (number + 1) + " of " + wanted.length + ": " + file.name,
      });
      await sendFile(address, await asJpeg(file));
    }
    await ask(address + "/add", { space: spaceId, ...readerChoice($("reader-choice")) });
  } catch (problem) {
    drawJob({ running: false });
    for (const id of BUSY_BUTTONS) $(id).disabled = false;
    showNotice(problem.message, true);
    return false;
  } finally {
    state.sending = false;
  }
  if (left) say(plural(left, "file was", "files were") + " left out: Mouse keeps photos, sound and video.");
  watchJob();
  return true;
}

/** A photo in Apple's own kind (HEIC) is one no reader of Mouse's can open.
    A device that can show such a photo (an iPad or an iPhone can) turns it
    into a JPEG here, upright and no larger than a reader needs, and that is
    what Mouse is sent. A device that cannot show it sends it as it is, and
    Mouse keeps it without a picture, as before. */
async function asJpeg(file) {
  if (!/\.hei[cf]$/i.test(file.name)) return file;
  try {
    const picture = await createImageBitmap(file);
    // (Some devices cannot draw a picture with more than about 16 million
    // dots. 4096 on the longer side is well within that, and more than a
    // nameplate needs.)
    const smaller = Math.min(1, 4096 / Math.max(picture.width, picture.height));
    const sheet = document.createElement("canvas");
    sheet.width = Math.round(picture.width * smaller);
    sheet.height = Math.round(picture.height * smaller);
    sheet.getContext("2d").drawImage(picture, 0, 0, sheet.width, sheet.height);
    picture.close();
    const jpeg = await new Promise((done) => sheet.toBlob(done, "image/jpeg", 0.92));
    if (!jpeg || !jpeg.size) return file;
    return new File([jpeg], file.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** Send one file as it is. Its name, and when it was last changed on this
    device, go along in the address. */
async function sendFile(address, file) {
  const where = address + "?name=" + encodeURIComponent(file.name) + "&changed=" + (file.lastModified || 0);
  let response;
  try {
    response = await fetch(where, { method: "POST", body: file });
  } catch {
    throw new Error(file.name + " did not get through. Nothing was added; try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.problem || "Mouse could not take " + file.name + ".");
}

// ---------------------------------------------------------------------------
// A voice note, recorded on the device the screen is on
// ---------------------------------------------------------------------------

/** Whether a voice note can be recorded here: on a phone or a tablet (in
    the app or in its browser) whose page may listen to the microphone. A
    computer's microphone is rarely where the person is looking, so it is
    not offered there. */
const SoundDesk = window.AudioContext || window.webkitAudioContext;
const CAN_RECORD = Boolean(SoundDesk && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  && (IN_APP || CAMERA_AT_HAND) && !DEMO;

// A voice note is kept as plain sound (a WAV file): one channel, 16,000
// numbers a second, which is all a voice needs and exactly what the
// listening model wants. Every device's recorder can make it and Mouse can
// always read it, which is not true of the packed kinds recorders make by
// themselves. A minute is about 2 MB.
const NOTE_RATE = 16000;
// The longest note: half an hour. It is saved then, and another can be begun.
const LONGEST_NOTE = 30 * 60 * 1000;

/** The little program that takes the sound as it arrives. It runs beside
    the page, so a busy page does not make it miss any, and hands the sound
    over a quarter of a second at a time. */
const SOUND_TAKER = `
  class MouseTaker extends AudioWorkletProcessor {
    constructor() { super(); this.kept = new Float32Array(4096); this.filled = 0; }
    process(inputs) {
      const sound = inputs[0] && inputs[0][0];
      if (!sound) return true;
      for (let at = 0; at < sound.length; at++) {
        this.kept[this.filled++] = sound[at];
        if (this.filled === this.kept.length) {
          this.port.postMessage(this.kept.slice(0));
          this.filled = 0;
        }
      }
      return true;
    }
  }
  registerProcessor("mouse-taker", MouseTaker);
`;

/** "Voice note 2026-05-05 10.02.03.wav", by the moment it began. */
function noteName(began) {
  const two = (number) => String(number).padStart(2, "0");
  const at = new Date(began);
  return "Voice note " + at.getFullYear() + "-" + two(at.getMonth() + 1) + "-" + two(at.getDate())
    + " " + two(at.getHours()) + "." + two(at.getMinutes()) + "." + two(at.getSeconds()) + ".wav";
}

/** Start recording a voice note for the open visit. With a space named, it
    goes straight into that space when it is saved. */
async function startRecording(spaceId = null) {
  if (!state.visit || state.recording) return;
  if (state.polling || state.sending) {
    say("Mouse is still busy. Record when it has finished.");
    return;
  }
  $("more").open = false;
  // (Made at once, while the press of the button still counts: a phone or
  // tablet lets a page start sound only as the answer to a press.)
  let desk;
  try {
    desk = new SoundDesk({ sampleRate: NOTE_RATE });
  } catch {
    desk = new SoundDesk(); // at the device's own rate, then
  }
  const note = {
    desk, stream: null, pieces: [], began: Date.now(), visit: state.visit.id, spaceId,
    keep: true, timer: null, awake: null, loud: 0, ended: false,
  };
  state.recording = note;
  drawRecording();
  try {
    desk.resume().catch(() => {});
    note.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (note.ended) throw new Error("ended before it began");
    const microphone = desk.createMediaStreamSource(note.stream);
    // The sound goes on to a tap that is turned all the way down: nothing
    // is played back, but the sound is kept moving through.
    const silent = desk.createGain();
    silent.gain.value = 0;
    silent.connect(desk.destination);
    const take = (sound) => {
      if (note.ended) return;
      const numbers = new Int16Array(sound.length);
      let power = 0;
      for (let at = 0; at < sound.length; at++) {
        const one = Math.max(-1, Math.min(1, sound[at]));
        numbers[at] = one < 0 ? one * 0x8000 : one * 0x7fff;
        power += one * one;
      }
      note.pieces.push(numbers);
      note.loud = Math.sqrt(power / Math.max(1, sound.length));
    };
    if (desk.audioWorklet) {
      const address = URL.createObjectURL(new Blob([SOUND_TAKER], { type: "text/javascript" }));
      await desk.audioWorklet.addModule(address);
      URL.revokeObjectURL(address);
      const taker = new AudioWorkletNode(desk, "mouse-taker");
      taker.port.onmessage = (event) => take(event.data);
      microphone.connect(taker).connect(silent);
    } else {
      // An older way to take the sound, for a device without the newer one.
      const taker = desk.createScriptProcessor(4096, 1, 1);
      taker.onaudioprocess = (event) => take(event.inputBuffer.getChannelData(0));
      microphone.connect(taker);
      taker.connect(silent);
    }
  } catch (problem) {
    const ended = note.ended;
    note.keep = false;
    recordingEnded(note, true);
    if (!ended) {
      say(problem && problem.name === "NotAllowedError"
        ? EDITION.name + " may not use the microphone. Allow it in this " + (DEVICE === "computer" ? "device" : DEVICE)
          + "'s Settings, under " + EDITION.name + ", then try again."
        : "The microphone could not be started.", true);
    }
    return;
  }
  // The time counts from when the microphone was really on.
  note.began = Date.now();
  // The screen stays on while recording, where the device lets a page ask.
  if (navigator.wakeLock) {
    navigator.wakeLock.request("screen").then((awake) => {
      if (state.recording === note) note.awake = awake;
      else awake.release().catch(() => {});
    }).catch(() => { /* not allowed just now; the recording goes on */ });
  }
  note.timer = setInterval(drawRecording, 250);
  drawRecording();
}

/** Show how long the recording has run, and how loud it hears. */
function drawRecording() {
  const note = state.recording;
  $("recording").hidden = !note;
  if (!note) return;
  const ready = Boolean(note.timer);
  const ran = ready ? Date.now() - note.began : 0;
  const seconds = Math.floor(ran / 1000);
  $("recording-words").textContent = ready ? "Recording" : "Starting the microphone…";
  $("recording-time").textContent = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  // A voice at arm's length fills about half the bar.
  $("recording-level").style.width = Math.min(100, Math.round(Math.sqrt(note.loud) * 140)) + "%";
  $("recording-stop").disabled = !ready;
  if (ran >= LONGEST_NOTE) {
    stopRecording(true);
    say("That is half an hour, the longest a voice note can be. It is saved; start another to go on.");
  }
}

/** End the recording: keep it, or throw it away. */
function stopRecording(keep) {
  const note = state.recording;
  if (!note) return;
  note.keep = keep;
  recordingEnded(note, false);
}

/** Let go of the microphone, and save the note if it is to be kept. */
function recordingEnded(note, quietly) {
  if (state.recording !== note) return;
  state.recording = null;
  note.ended = true;
  clearInterval(note.timer);
  if (note.stream) for (const track of note.stream.getTracks()) track.stop();
  const rate = note.desk.sampleRate;
  note.desk.close().catch(() => {});
  if (note.awake) note.awake.release().catch(() => {});
  drawRecording();
  if (quietly) return;
  if (!note.keep) {
    say("The recording was thrown away.");
    return;
  }
  const numbers = note.pieces.reduce((sum, piece) => sum + piece.length, 0);
  if (numbers < rate / 2) {
    say("Nothing was recorded.", true);
    return;
  }
  // (The file's date is the moment recording ended: Mouse works back from
  // it, by the length, to when the note began.)
  const sound = new File([wavHeading(numbers, rate), ...note.pieces], noteName(note.began),
    { type: "audio/wav", lastModified: Date.now() });
  saveVoiceNote(sound, note.visit, note.spaceId);
}

/** The 44 bytes a WAV file starts with: plain sound, one channel, 16 bits
    a number, `rate` numbers a second, `numbers` of them in all. */
function wavHeading(numbers, rate) {
  const bytes = numbers * 2;
  const heading = new DataView(new ArrayBuffer(44));
  const write = (at, words) => { for (let n = 0; n < words.length; n++) heading.setUint8(at + n, words.charCodeAt(n)); };
  write(0, "RIFF");
  heading.setUint32(4, 36 + bytes, true);
  write(8, "WAVE");
  write(12, "fmt ");
  heading.setUint32(16, 16, true);       // how long this description is
  heading.setUint16(20, 1, true);        // plain numbers, not packed
  heading.setUint16(22, 1, true);        // one channel
  heading.setUint32(24, rate, true);
  heading.setUint32(28, rate * 2, true); // bytes a second
  heading.setUint16(32, 2, true);        // bytes for one moment of sound
  heading.setUint16(34, 16, true);       // bits a number
  write(36, "data");
  heading.setUint32(40, bytes, true);
  return heading.buffer;
}

/** Save a voice note into the visit it was recorded for. If it cannot be
    sent just now (the app was put away while it was being saved), it is
    kept, and offered again. */
async function saveVoiceNote(file, visit, spaceId) {
  try {
    if (!state.visit || state.visit.id !== visit) await openVisit(visit);
    if (!state.visit || state.visit.id !== visit) throw new Error("its " + EDITION.noun + " is no longer there");
    if (await sendFiles([file], spaceId)) return;
  } catch { /* offered again, below */ }
  say("The voice note is not saved yet.", true, [{ text: "Save it now", does: () => saveVoiceNote(file, visit, spaceId) }]);
}

// When the app is put away (another app comes to the front, or the screen
// is locked), a page is no longer allowed to record. What has been said so
// far is saved at once, so nothing is lost.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.recording) stopRecording(true);
});

// Photos dragged from the computer onto the page are added to the open
// visit. (Mouse's own window hears of a drop from Windows itself, and takes
// whole folders: see `mouseWindowSays`.)
function bringsFiles(event) {
  return !IN_WINDOW && !DEMO && event.dataTransfer && [...event.dataTransfer.types].includes("Files");
}

document.addEventListener("dragover", (event) => {
  if (!bringsFiles(event)) return;
  event.preventDefault();
  $("drop-words").textContent = state.visit
    ? "Let go to add these to " + state.visit.name
    : phrase("Open a {noun} first, then drop photos on it");
  $("drop-here").hidden = false;
});

document.addEventListener("dragleave", (event) => {
  // (Leaving the page altogether, not passing from one thing on it to the next.)
  if (!event.relatedTarget) $("drop-here").hidden = true;
});

document.addEventListener("drop", (event) => {
  if (!bringsFiles(event)) return;
  event.preventDefault();
  $("drop-here").hidden = true;
  if (!state.visit) return;
  if (document.querySelector("dialog[open]")) {
    say("Close what is open first, then drop the photos again.");
    return;
  }
  // Dropped on a space's own page, they go into that space.
  const onSpace = state.view === "spaces" && state.spaceOpen && state.spaceOpen !== "none";
  sendFiles([...event.dataTransfer.files], onSpace ? state.spaceOpen : null);
});

// ---------------------------------------------------------------------------
// A new visit
// ---------------------------------------------------------------------------

/** Which way of beginning is chosen in the Add form: with a folder that is
    on this computer, or empty. */
function addWay() {
  return $("add-way-empty").checked ? "empty" : "folder";
}

function drawAddWay() {
  const empty = addWay() === "empty";
  $("add-folder-part").hidden = empty;
  $("add-reader-part").hidden = empty;
  $("add-empty-words").hidden = !empty;
  $("add-problem").hidden = true;
  if (!empty) browse($("add-folder").value);
}

/** Open the Add form. `way` says how it should begin ("folder" or "empty");
    left out, it begins the way it was last used. */
function openAddDialog(way) {
  if (DEMO) {
    say(phrase("This is the demo, with a made-up {noun}. Get Mouse to add your own."));
    return;
  }
  // A phone or a tablet has no folder of photos to point at: there, a
  // visit always starts empty and is filled from the camera or the library.
  $("add-ways").hidden = CAMERA_AT_HAND || IN_APP;
  if (CAMERA_AT_HAND || IN_APP) way = "empty";
  if (way !== "folder" && way !== "empty") way = recall("mouse-add-way") === "empty" ? "empty" : "folder";
  $("add-way-" + way).checked = true;

  $("add-problem").hidden = true;
  $("add-date").value = today();
  $("add-name").value = "";
  delete $("add-name").dataset.typed;
  loadReaders();
  $("add-dialog").showModal();
  drawAddWay();
}

/** Start a visit with nothing in it, and open it: its photos come next. */
async function saveEmptyVisit() {
  const problem = $("add-problem");
  let made;
  try {
    made = await ask("/api/visits", { name: $("add-name").value, date: $("add-date").value });
  } catch (failure) {
    problem.textContent = failure.message === "'name' is missing"
      ? phrase("Give the {noun} a name first.")
      : failure.message;
    problem.hidden = false;
    return;
  }
  $("add-dialog").close();
  await loadVisits(made.visit);
  say(made.existed
    ? phrase("There is already a {noun} with that name on that day. It is open now.")
    : phrase("Added. Now add this {noun}'s photos."));
}

async function saveNewVisit(event) {
  event.preventDefault();
  const problem = $("add-problem");
  problem.hidden = true;
  remember("mouse-add-way", addWay());
  if (addWay() === "empty") {
    await saveEmptyVisit();
    return;
  }

  const choice = readerChoice($("add-reader"));
  try {
    await ask("/api/import", {
      folder: $("add-folder").value,
      name: $("add-name").value,
      date: $("add-date").value,
      reader: choice.reader,
      model: choice.model,
    });
  } catch (failure) {
    problem.textContent = failure.message;
    problem.hidden = false;
    return;
  }
  $("add-dialog").close();
  watchJob();
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

applyEdition();
// The sentences written into the page itself that name the computer.
if (DEVICE !== "computer") {
  for (const marked of document.querySelectorAll("[data-here]")) {
    const walker = document.createTreeWalker(marked, NodeFilter.SHOW_TEXT);
    for (let words = walker.nextNode(); words; words = walker.nextNode()) words.nodeValue = here(words.nodeValue);
  }
}
applyLook();
// If the theme is "match my computer", follow the computer when it changes.
COMPUTER_IS_LIGHT.addEventListener("change", applyLook);
// (A visit shown in parts always opens on its first part instead.)
if (!PARTS && ["photos", "spaces"].includes(recall("mouse-view"))) state.view = recall("mouse-view");
// Nameplates is a tool for equipment surveys, Spaces a tool for sorting
// photos by room. Whether each starts on depends on the edition; after that
// it is whatever the person last chose.
const platesChoice = recall("mouse-plates");
state.plates = platesChoice === null ? Boolean(EDITION.toolsOn.nameplates) : platesChoice === "on";
const spacesChoice = recall("mouse-spaces");
state.spaces = spacesChoice === null ? Boolean(EDITION.toolsOn.spaces) : spacesChoice === "on";
if (DEMO) {
  $("demo-bar").hidden = false;
  // The made-up days are not in any folder.
  $("reveal-visit").hidden = true;
  document.querySelector(".kept-here").textContent = phrase("Made-up {nouns}, for trying things out.");
}

$("open-settings").addEventListener("click", () => openSettings("look"));
$("open-tools").addEventListener("click", () => openSettings("tools"));
$("settings-close").addEventListener("click", () => $("settings-dialog").close());
for (const link of document.querySelectorAll(".settings-link")) {
  link.addEventListener("click", () => showSettings(link.dataset.section));
}
// Every group of choices in Settings works the same way: click one to pick it.
for (const group of document.querySelectorAll("[data-setting]")) {
  group.addEventListener("click", (event) => {
    const button = event.target.closest("[data-value]");
    if (button) setLook(group.dataset.setting, button.dataset.value);
  });
}
$("look-clear").addEventListener("input", () => {
  remember("mouse-clear", $("look-clear").value);
  applyLook();
});
$("look-reset").addEventListener("click", resetLook);

$("copy-note").addEventListener("click", copyNote);
$("save-note").addEventListener("click", saveNote);

// The More menu closes when you click anywhere else.
document.addEventListener("click", (event) => {
  for (const menu of [$("more"), $("reports")]) {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  }
});

$("toggle-theme").addEventListener("click", () =>
  setLook("theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
$("toggle-sidebar").addEventListener("click", toggleSidebar);
$("find-visit").addEventListener("input", drawVisits);

$("add-visit").addEventListener("click", openAddDialog);
$("add-first").addEventListener("click", openAddDialog);
$("add-cancel").addEventListener("click", () => $("add-dialog").close());
$("add-form").addEventListener("submit", saveNewVisit);
$("add-name").addEventListener("input", () => { $("add-name").dataset.typed = "yes"; });
$("add-reader").addEventListener("change", readerHint);
$("add-folder").addEventListener("change", () => browse($("add-folder").value));
$("add-pick").addEventListener("click", () => tellWindow("pick-folder"));
$("add-ways").addEventListener("change", drawAddWay);

// Adding to the open visit from this device.
$("add-files").addEventListener("click", () => openChooser("choose-files"));
$("choose-files").addEventListener("change", filesChosen);
$("take-photo").addEventListener("change", filesChosen);

// The photo, large: its buttons, its keys, the wheel, and dragging.
$("viewer-before").addEventListener("click", () => stepViewer(-1));
$("viewer-after").addEventListener("click", () => stepViewer(1));
$("viewer-smaller").addEventListener("click", () => stepViewedSize(-1));
$("viewer-larger").addEventListener("click", () => stepViewedSize(1));
$("viewer-whole").addEventListener("click", () => resizeViewedPhoto(1));
$("viewer-close").addEventListener("click", () => $("viewer").close());
$("viewer-values-toggle").addEventListener("click", toggleViewerValues);
$("viewer-photo").addEventListener("load", () => placeViewedPhoto(false));
window.addEventListener("resize", () => { if ($("viewer").open) placeViewedPhoto(false); });
$("viewer").addEventListener("close", () => {
  fingers.clear();
  pinch = null;
  viewing.number = null;
  // Back to the photo in the side panel (which may be another one by now,
  // if the arrows were used), so the keyboard carries on from there.
  const photo = document.querySelector(".detail-photo");
  if (photo) photo.focus({ preventScroll: true });
});
// The keys of the large photo. They are listened for on the whole page, not
// on the viewer: after a click on the photo, or after leaving a box, the
// keyboard is on nothing in particular, and the keys must still work.
document.addEventListener("keydown", (event) => {
  if (!$("viewer").open) return;
  // Typing in a box beside the photo: the keys belong to the box. Esc there
  // gives up the typing (the first press leaves the box, and must not close
  // the photo as well; the next one closes it).
  if (event.target.closest && event.target.closest("input, textarea, select")) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.target.blur();
    }
    return;
  }
  // (With Ctrl held, plus and minus belong to the whole screen's size.)
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key === "ArrowLeft") stepViewer(-1);
  else if (event.key === "ArrowRight") stepViewer(1);
  else if (event.key === "+" || event.key === "=") stepViewedSize(1);
  else if (event.key === "-") stepViewedSize(-1);
  else if (event.key === "0") resizeViewedPhoto(1);
  else if (event.key === "v" || event.key === "V") toggleViewerValues();
  else return;
  event.preventDefault();
});
$("viewer-stage").addEventListener("wheel", (event) => {
  if (event.ctrlKey) return;
  event.preventDefault();
  resizeViewedPhoto(viewing.size * Math.exp(-event.deltaY * 0.0015), { x: event.clientX, y: event.clientY }, false);
}, { passive: false });
// The fingers on the large photo right now (or the mouse, which counts as
// one), and, while there are two, how far apart they were when the second
// came down and how large the photo was then. Two fingers pinch the photo
// larger and smaller about the spot between them, as they do everywhere on
// a tablet or phone.
const fingers = new Map();
let pinch = null;
const fingersApart = () => {
  const [one, other] = [...fingers.values()];
  return {
    apart: Math.max(1, Math.hypot(one.x - other.x, one.y - other.y)),
    between: { x: (one.x + other.x) / 2, y: (one.y + other.y) / 2 },
  };
};
/** A finger has left the photo. With fewer than two the pinch is over, and
    whatever finger is still down does nothing more until it is lifted (so
    the photo does not jump, and lifting it is not taken for a press). */
function fingerGone(event) {
  fingers.delete(event.pointerId);
  if (pinch && fingers.size < 2) {
    pinch = null;
    viewing.held = null;
    $("viewer-stage").classList.remove("is-held");
    return true;
  }
  return false;
}

$("viewer-stage").addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  $("viewer-stage").setPointerCapture(event.pointerId);
  if (fingers.size === 2) {
    pinch = { apart: fingersApart().apart, size: viewing.size };
    return;
  }
  if (fingers.size > 2) return;
  viewing.held = { x: event.clientX, y: event.clientY, fromX: viewing.x, fromY: viewing.y, moved: false, onPhoto: event.target === $("viewer-photo") };
});
$("viewer-stage").addEventListener("pointermove", (event) => {
  if (fingers.has(event.pointerId)) fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch && fingers.size >= 2) {
    const now = fingersApart();
    resizeViewedPhoto(pinch.size * now.apart / pinch.apart, now.between, false);
    return;
  }
  const held = viewing.held;
  if (!held) return;
  const across = event.clientX - held.x;
  const down = event.clientY - held.y;
  if (!held.moved && Math.hypot(across, down) < 5) return;
  held.moved = true;
  if (viewing.size <= 1) return;
  $("viewer-stage").classList.add("is-held");
  viewing.x = held.fromX + across;
  viewing.y = held.fromY + down;
  placeViewedPhoto(false);
});
$("viewer-stage").addEventListener("pointerup", (event) => {
  // (The end of a pinch is not a press.)
  const pinched = Boolean(pinch);
  if (fingerGone(event) || pinched) return;
  const held = viewing.held;
  viewing.held = null;
  $("viewer-stage").classList.remove("is-held");
  if (!held || held.moved) return;
  // A plain click. Beside the photo it closes the viewer. On the photo it
  // looks closely at that spot, or goes back to the whole photo.
  if (!held.onPhoto) $("viewer").close();
  else if (viewing.size > 1) resizeViewedPhoto(1);
  else resizeViewedPhoto(closeLook(), { x: event.clientX, y: event.clientY });
});
$("viewer-stage").addEventListener("pointercancel", (event) => {
  fingerGone(event);
  viewing.held = null;
  $("viewer-stage").classList.remove("is-held");
});
$("recording-stop").addEventListener("click", () => stopRecording(true));
$("recording-discard").addEventListener("click", () => stopRecording(false));
$("open-vault").addEventListener("click", () => showFolder(null));
$("reveal-visit").addEventListener("click", () => {
  $("more").open = false;
  if (state.visit) showFolder(state.visit.id);
});
for (const button of document.querySelectorAll("#shortcuts button")) {
  button.addEventListener("click", () => {
    button.disabled = true;
    tellWindow("shortcut:" + (button.dataset.there ? "remove" : "add") + ":" + button.dataset.spot);
  });
}

$("view-photos-tab").addEventListener("click", () => setView("photos"));
$("view-day-tab").addEventListener("click", () => setView("day"));
$("view-spaces-tab").addEventListener("click", () => setView("spaces"));

$("add-space").addEventListener("click", () => openSpaceDialog());
$("space-form").addEventListener("submit", saveSpace);
$("space-cancel").addEventListener("click", () => $("space-dialog").close());
$("space-remove").addEventListener("click", removeSpace);
$("read-again").addEventListener("click", readAgain);
$("rename-visit").addEventListener("click", openRenameDialog);
$("rename-form").addEventListener("submit", saveRename);
$("rename-cancel").addEventListener("click", () => $("rename-dialog").close());
$("remove-visit").addEventListener("click", removeVisit);
$("open-removed").addEventListener("click", openRemoved);
$("mark-complete").addEventListener("click", toggleComplete);
$("removed-close").addEventListener("click", () => $("removed-dialog").close());
// Closing the More menu takes back a half-given "remove".
$("more").addEventListener("toggle", () => { if (!$("more").open) forgetRemoving(); });
$("export").addEventListener("click", exportToExcel);
$("export-menu").addEventListener("click", exportToExcel);
$("report-excel").addEventListener("click", exportToExcel);
$("report-word").addEventListener("click", saveWordReport);
$("report-photos").addEventListener("click", savePhotosZip);

$("open-ask").addEventListener("click", () => {
  if (!state.visit) return;
  state.side = state.side === "ask" ? null : "ask";
  drawSide();
});
$("side-photo-tab").addEventListener("click", () => { state.side = "photo"; drawSide(); });
$("side-ask-tab").addEventListener("click", () => { state.side = "ask"; drawSide(); });
$("side-close").addEventListener("click", () => {
  state.side = null;
  state.selected = null;
  state.entryOpen = null;
  if (PARTS && state.visit) drawView();
  markSelectedTile();
  drawSide();
});

$("ask-form").addEventListener("submit", (event) => {
  event.preventDefault();
  sendQuestion($("ask-box").value);
});
// Enter sends the question. Shift+Enter starts a new line.
$("ask-box").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendQuestion($("ask-box").value);
  }
});

// Arrow keys move between photos while one is open, unless you are typing.
document.addEventListener("keydown", (event) => {
  const typing = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName);
  if (event.key === "Escape") {
    $("more").open = false;
    $("reports").open = false;
  }
  if (typing || state.selected === null || state.side !== "photo" || document.querySelector("dialog[open]")) return;
  if (event.key === "ArrowRight") step(1);
  if (event.key === "ArrowLeft") step(-1);
  if (event.key === "Escape") $("side-close").click();
});

(async function start() {
  // Finding out which AI models are installed can take a second or two, so
  // it does not hold up showing the days. The day is redrawn when it arrives.
  // (Not while someone is typing: redrawing would take the cursor away.)
  loadReaders().then(() => {
    const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
    if (state.visit && !typing) drawVisit();
  });
  try {
    await loadVisits();
  } catch (problem) {
    say(problem.message, true);
  }
  // The window is told once this first picture of the screen has really
  // been painted (that is two frames on), or after a quarter of a second
  // at the latest. It stays out of sight until then.
  let told = false;
  const tell = () => {
    if (!told) tellWindow("ready");
    told = true;
  };
  requestAnimationFrame(() => requestAnimationFrame(tell));
  setTimeout(tell, 250);
  watchJob(); // picks up a job that was already running, if any
})();
