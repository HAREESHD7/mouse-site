// The stand-in for the Mouse program on the public demo page.
//
// The real screen (index.html, style.css, app.js) asks the Mouse program on
// your computer for its data. On the web there is no such program, so this
// file answers instead, with two made-up days. Nothing here is real: the
// places, the names and the "photos" (which are drawings made below) are
// invented, and nothing a visitor does is saved or sent anywhere.

"use strict";

(function () {
  // -------------------------------------------------------------------------
  // The made-up days
  // -------------------------------------------------------------------------

  const DAYS = [
    {
      id: "2026-11-07_saturday-in-the-city",
      name: "Saturday in the city",
      date: "2026-11-07",
      summary:
        "A Saturday in town. Coffee at Harbour Coffee a little before nine, then the 09:32 train to Riverside from platform 3. " +
        "The city library is open 10 am to 5 pm on Saturdays. A note to pick up a birthday card for Maya and AA batteries, " +
        "and to return a library book by the 14th. Lunch at Green Fork Kitchen came to 13.30. Parking by the river is two hours " +
        "at most and free after 6 pm. The open-air cinema is on Friday 13 November at 7:30 pm.",
      items: [
        { time: "08:42", name: "IMG_4101.jpg", shows: "menu", draw: "board",
          text: "HARBOUR COFFEE\nFlat white 4.20\nOat latte 4.80\nCinnamon bun 3.50\nOpen from 7 am" },
        { time: "09:16", name: "IMG_4102.jpg", shows: "screen", draw: "screen",
          text: "DEPARTURES\n09:32 Riverside  Plat 3  On time\n09:47 Airport    Plat 1  On time\n10:05 Old Town   Plat 2  Delayed" },
        { time: "10:05", name: "IMG_4103.jpg", shows: "sign", draw: "sign",
          text: "CITY LIBRARY\nMonday to Friday 9 am to 8 pm\nSaturday 10 am to 5 pm\nSunday closed" },
        { time: "11:20", name: "IMG_4104.jpg", shows: "note", draw: "note",
          text: "Pick up\nBirthday card for Maya\nAA batteries\nLibrary book back by the 14th" },
        { time: "13:08", name: "IMG_4105.jpg", shows: "receipt", draw: "paper",
          text: "GREEN FORK KITCHEN\nLentil soup 7.50\nFlatbread 3.00\nMint tea 2.80\nTotal 13.30\nPaid by card 13:04" },
        { time: "15:30", name: "IMG_4106.jpg", shows: "sign", draw: "sign",
          text: "RIVERSIDE PARKING\nPay at the machine\n2 hours maximum\nFree after 6 pm" },
        // A voice note that came with its words written down.
        { time: "16:10", name: "voice-note.m4a", kind: "audio", seconds: 21,
          heard: { from: "voice-note.txt", lines: [
            { at: 2, text: "Remember to book the dentist for next week." },
            { at: 11, text: "And ask Maya whether she wants to come to the cinema on Friday." },
          ] } },
        { time: "17:45", name: "IMG_4107.jpg", shows: "poster", draw: "poster",
          text: "OPEN-AIR CINEMA\nFriday 13 November\n7:30 pm by the river\nBring a blanket" },
      ],
    },
    {
      // A site visit: the only one shown in the audit edition's demo, and in
      // the everyday demo a day for trying the Nameplates tool.
      forAudit: true,
      id: "2026-11-05_plant-room-survey",
      name: "Plant room survey",
      date: "2026-11-05",
      summary: null,
      // What the visit itself is described by, part filled in, as a real
      // one would be part way through.
      details: {
        building: "Riverside School", address: "12 Mill Lane", city: "Riverside",
        client: "Riverside Board of Education", property: "School", floors: "3",
        audit: "ASHRAE Level II", status: "In progress",
      },
      // Two spaces are already made. The meter photo is left unsorted, so
      // there is something to put into a space.
      spaces: [
        { id: "boiler-room", name: "Boiler room", floor: "Basement", occupancy: "Mechanical Room",
          area: "420", height: "12", notes: "Two pumps, one running. Floor drain partly blocked." },
        { id: "roof", name: "Roof", floor: "Roof", occupancy: "Roof", area: "", height: "",
          notes: "Access by the east stair." },
      ],
      // What has been noted in the boiler room so far. The pump's entry was
      // made from its nameplate photo. On the roof, the unit's nameplate is
      // still waiting to be made into an entry.
      entries: [
        { id: "pump-1", kind: "equipment", space: "boiler-room",
          fields: { equipment: "Circulation pump", make: "ACME", model: "CP-4500X", serial: "78213-A", volts: "208",
            phase: "3", hz: "60", amps: "12.4", hp: "5", rpm: "1750", condition: "Fair" },
          checked: ["equipment", "model", "serial", "condition"], notes: "Seal weeping slightly." },
        { id: "lights-1", kind: "lighting", space: "boiler-room",
          fields: { fixture: "L1", lamp: "Fluorescent", lamps: "2", watts: "32", quantity: "6", controls: "Switches", hours: "2000" },
          checked: ["fixture", "lamp", "lamps", "watts", "quantity", "controls", "hours"], notes: "" },
      ],
      items: [
        { time: "09:58", name: "IMG_3979.jpg", shows: "meter", draw: "screen",
          text: "ELECTRIC METER\nNo. 48213906\nkWh  0 3 7 4 5 2\nMULT x 40" },
        { time: "10:02", name: "IMG_3980.jpg", shows: "nameplate", draw: "plate", space: "boiler-room", entry: "pump-1",
          text: "ACME PUMP COMPANY\nMODEL CP-4500X\nSERIAL 78213-A\n208 V  3 PH  60 HZ\n12.4 A  5 HP  1750 RPM",
          fields: { make: "ACME", model: "CP-4500X", serial: "78213-A", volts: "208", phase: "3", hz: "60", amps: "12.4", hp: "5", rpm: "1750" },
          checked: ["model", "serial"] },
        { time: "10:06", name: "IMG_3982.jpg", shows: "sign", draw: "sign", space: "boiler-room",
          text: "BOILER ROOM\nAuthorised staff only\nKeep this door shut" },
        { time: "10:21", name: "IMG_3981.jpg", shows: "nameplate", draw: "plate", space: "roof",
          text: "NORTHWIND AIR\nMODEL RTU-12B\nSERIAL NW2291047\n460 V  3 PH  60 HZ\nREFRIGERANT R-410A",
          fields: { make: "Northwind", model: "RTU-12B", serial: "NW2291047", volts: "460", phase: "3", hz: "60", refrigerant: "R-410A" },
          checked: [] },
        // A voice recording that ran for the whole walk, and came in with
        // its words. What was said falls between the photos, and the first
        // line announces a place that is not a space yet.
        { time: "09:57", name: "walk-through.m4a", kind: "audio", seconds: 1500,
          heard: { from: "walk-through.srt", lines: [
            { at: 40, text: "Starting in the main entrance lobby. The electric meter is here, multiplier forty.", cue: "Main entrance lobby" },
            { at: 200, text: "Now in the boiler room.", cue: "Boiler room" },
            { at: 305, text: "Circulation pump one, about twelve years old. The seal is weeping a little." },
            { at: 560, text: "The floor drain is partly blocked. Tell the caretaker." },
            { at: 1290, text: "We're on the roof now.", cue: "Roof" },
            { at: 1450, text: "Rooftop unit one, a Northwind, about five years old, good condition." },
          ] } },
      ],
    },
  ];

  /** A written time, moved on by some seconds, and written the same way. */
  function later(recorded, seconds) {
    const moment = new Date(Date.parse(recorded) + seconds * 1000);
    const two = (number) => String(number).padStart(2, "0");
    return moment.getFullYear() + "-" + two(moment.getMonth() + 1) + "-" + two(moment.getDate()) +
      "T" + two(moment.getHours()) + ":" + two(moment.getMinutes()) + ":" + two(moment.getSeconds());
  }

  /** Give each line of a recording what the Mouse program would give it:
      the moment it was said, and the photo it was said beside (the nearest
      within a minute and a half; of two equally near, the one after). */
  function placeWords(items) {
    const photos = items.filter((item) => item.kind === "photo");
    for (const item of items) {
      if (!item.heard) continue;
      for (const line of item.heard.lines) {
        const timed = line.at !== null && line.at !== undefined;
        line.clock = timed ? later(item.recorded, line.at) : null;
        line.near = null;
        if (!timed) continue;
        const when = Date.parse(line.clock);
        let best = null;
        for (const photo of photos) {
          const taken = Date.parse(photo.recorded);
          const apart = Math.abs(taken - when) / 1000;
          if (apart > 90) continue;
          if (!best || apart < best.apart || (apart === best.apart && best.taken < when && taken >= when)) {
            best = { apart, taken, number: photo.number };
          }
        }
        line.near = best ? best.number : null;
      }
      item.heard.words = item.heard.lines.reduce((count, line) => count + line.text.split(/\s+/).filter(Boolean).length, 0);
    }
  }

  /** "0:40 words" or "[00:01:23] words" as a line with its time; words
      with no time in front are kept as they are. */
  function timedLine(words) {
    const found = /^\s*[[(]?(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[\])]?\s*(?:[-–—:|>]\s*)?(\S.*)$/.exec(words);
    if (!found) return { at: null, text: words.trim(), cue: null };
    return { at: Number(found[1] || 0) * 3600 + Number(found[2]) * 60 + Number(found[3]), text: found[4].trim(), cue: null };
  }

  /** 754 seconds as "12 min 34 s". */
  function lengthWords(seconds) {
    const whole = Math.max(0, Math.round(seconds));
    const two = (number) => String(number).padStart(2, "0");
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    if (hours) return hours + " h " + two(minutes) + " min";
    if (minutes) return minutes + " min " + two(whole % 60) + " s";
    return (whole % 60) + " s";
  }

  /** Turn a made-up day into the shape the Mouse program would send. */
  function asVisit(day) {
    const items = day.items.map((item, number) => ({
      number,
      kind: item.kind || "photo",
      name: item.name,
      text: item.text || "",
      reader: item.kind ? null : "Mouse (demo)",
      looks_like: item.shows || null,
      looks_like_checked: false,
      fields: item.fields || {},
      checked: item.checked || [],
      turns: 0,
      space: item.space || null,
      entry: item.entry || null,
      recorded: day.date + "T" + item.time + ":00",
      recorded_checked: false,
      seconds: item.seconds || null,
      heard: item.heard
        ? { from: item.heard.from, came: "from " + item.heard.from, lines: item.heard.lines.map((line) => ({ cue: null, ...line })) }
        : null,
      draw: item.draw,
    }));
    placeWords(items);
    const count = (kind) => items.filter((item) => item.kind === kind).length;
    return {
      id: day.id, name: day.name, date: day.date, summary: day.summary,
      details: { ...(day.details || {}) },
      photos: count("photo"), audio: count("audio"), video: count("video"),
      spaces: (day.spaces || []).map((space) => ({ ...space })),
      entries: (day.entries || []).map((entry) => ({ ...entry, fields: { ...entry.fields }, checked: [...entry.checked] })),
      items,
    };
  }

  // The demo follows the edition named in the address ("?edition=audit");
  // the top of index.html has already worked that out and marked the page.
  // The audit edition shows only site visits, as the real one would.
  const EDITION_ID = document.documentElement.dataset.edition || "everyday";
  const visits = DAYS.filter((day) => EDITION_ID !== "audit" || day.forAudit).map(asVisit);

  function findVisit(id) {
    const visit = visits.find((one) => one.id === id);
    if (!visit) throw new Error("The demo has no such day.");
    return visit;
  }

  // -------------------------------------------------------------------------
  // The "photos": simple drawings of a sign, a screen, a receipt and so on
  // -------------------------------------------------------------------------

  const LOOKS = {
    board:  { wall: ["#6b5a4a", "#4f4135"], panel: "#23282d", edge: "#8a6a45", ink: "#f3f1ea", font: "'Segoe Print','Comic Sans MS',cursive", middle: true },
    screen: { wall: ["#3a3f47", "#23262b"], panel: "#0b0c0e", edge: "#1b1e22", ink: "#ffb238", font: "Consolas,'Courier New',monospace", small: true },
    sign:   { wall: ["#b9b2a6", "#8f887c"], panel: "#f7f7f4", edge: "#1f4e8c", ink: "#1b2a3d", font: "'Segoe UI',Arial,sans-serif", middle: true, band: "#1f4e8c" },
    note:   { wall: ["#b58a5a", "#94703f"], panel: "#ffe680", edge: "#e6c94f", ink: "#2b2b3a", font: "'Segoe Print','Comic Sans MS',cursive", tilt: -3 },
    paper:  { wall: ["#5b4a3c", "#3c3027"], panel: "#fbfaf6", edge: "#e2ded4", ink: "#222222", font: "Consolas,'Courier New',monospace", middle: true, narrow: true },
    poster: { wall: ["#8b8f96", "#6b6f76"], panel: "#3b1d5e", edge: "#f2c14e", ink: "#fbe9c0", font: "Georgia,'Times New Roman',serif", middle: true },
    plate:  { wall: ["#59636b", "#3d454b"], panel: "#c9ced2", edge: "#8d959b", ink: "#22272b", font: "Bahnschrift,'Arial Narrow',sans-serif", rivets: true },
  };

  function safe(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /** Draw one made-up photo as a picture, 800 wide and 600 tall. */
  function drawing(item) {
    const look = LOOKS[item.draw] || LOOKS.sign;
    const lines = item.text.split("\n");
    const box = look.narrow ? { x: 240, y: 40, w: 320, h: 520 } : { x: 90, y: 70, w: 620, h: 460 };
    const titleSize = look.narrow ? 28 : look.small ? 36 : 46;
    const lineSize = look.narrow ? 23 : look.small ? 25 : 31;
    const gap = lineSize * 1.75;
    const height = titleSize + gap * (lines.length - 1);
    let y = box.y + (box.h - height) / 2 + titleSize * 0.8;
    const x = look.middle ? box.x + box.w / 2 : box.x + 44;
    const anchor = look.middle ? "middle" : "start";

    let words = "";
    lines.forEach((line, index) => {
      const isTitle = index === 0;
      const onBand = isTitle && look.band;
      words += '<text x="' + x + '" y="' + (onBand ? box.y + 62 : y) + '" text-anchor="' + anchor +
        '" font-family="' + look.font + '" font-size="' + (isTitle ? titleSize : lineSize) +
        '" font-weight="' + (isTitle ? 700 : 400) + '" fill="' + (onBand ? "#ffffff" : look.ink) +
        '" xml:space="preserve">' + safe(line) + "</text>";
      y += gap;
    });

    const band = look.band
      ? '<path d="M' + box.x + " " + (box.y + 96) + "V" + (box.y + 14) + "a14 14 0 0 1 14-14h" + (box.w - 28) +
        "a14 14 0 0 1 14 14v82z" + '" fill="' + look.band + '"/>'
      : "";
    const rivets = look.rivets
      ? [[24, 24], [box.w - 24, 24], [24, box.h - 24], [box.w - 24, box.h - 24]].map(([dx, dy]) =>
          '<circle cx="' + (box.x + dx) + '" cy="' + (box.y + dy) + '" r="7" fill="#7d868c"/>').join("")
      : "";
    const turn = look.tilt ? ' transform="rotate(' + look.tilt + ' 400 300)"' : "";

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">' +
      '<defs><linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + look.wall[0] + '"/><stop offset="1" stop-color="' + look.wall[1] + '"/>' +
      "</linearGradient></defs>" +
      '<rect width="800" height="600" fill="url(#wall)"/>' +
      "<g" + turn + ">" +
      '<rect x="' + (box.x + 8) + '" y="' + (box.y + 12) + '" width="' + box.w + '" height="' + box.h + '" rx="14" fill="#000000" opacity="0.28"/>' +
      '<rect x="' + box.x + '" y="' + box.y + '" width="' + box.w + '" height="' + box.h + '" rx="14" fill="' + look.panel +
      '" stroke="' + look.edge + '" stroke-width="6"/>' +
      band + rivets + words + "</g></svg>";
  }

  const pictures = {};

  function picture(visitId, item) {
    const key = visitId + "/" + item.number;
    if (!pictures[key]) {
      const full = findVisit(visitId).items[item.number];
      pictures[key] = URL.createObjectURL(new Blob([drawing(full)], { type: "image/svg+xml" }));
    }
    return pictures[key];
  }

  // -------------------------------------------------------------------------
  // Ask Mouse, from a short script
  // -------------------------------------------------------------------------

  const NO_SCRIPT =
    "This is the demo, so I can only answer from a short script. Try asking about the library, the train, lunch, " +
    "or what is worth remembering. In the real app, the AI on your own computer answers anything about your day.";

  function answer(visit, question, photoNumber) {
    const photo = photoNumber === null || photoNumber === undefined ? null : visit.items[photoNumber];
    const asks = (pattern) => pattern.test(question);

    if (photo && asks(/photo show|what does this|what is this/i)) {
      return "It looks like a " + (photo.looks_like || "photo") + ". The first line reads \"" + photo.text.split("\n")[0] + "\".";
    }
    if (photo && asks(/read out|what does it say|says/i)) return photo.text;
    if (photo && asks(/hard to read/i)) return "No. The words on this one are clear.";

    if (visit.id.includes("plant-room")) {
      if (asks(/equipment|model|serial/i)) {
        return "Two pieces of equipment:\n1. ACME pump, model CP-4500X, serial 78213-A.\n2. Northwind Air unit, model RTU-12B, serial NW2291047.";
      }
      if (asks(/check/i)) return "The ACME pump has its model and serial checked. Everything on the Northwind unit still needs checking.";
      if (asks(/see|what did i/i)) return "Two equipment nameplates (an ACME pump and a Northwind Air unit) and the sign on the boiler room door.";
      return NO_SCRIPT;
    }

    if (asks(/library/i)) return "The city library is open 10 am to 5 pm on Saturdays, 9 am to 8 pm on weekdays, and closed on Sundays. That is from the sign photographed at 10:05.";
    if (asks(/train|platform|riverside|depart/i)) return "The 09:32 to Riverside left from platform 3 and was on time. The 10:05 to Old Town was delayed.";
    if (asks(/lunch|spend|spent|cost|receipt|total|pay/i)) return "Lunch at Green Fork Kitchen was 13.30 in total: lentil soup 7.50, flatbread 3.00 and mint tea 2.80, paid by card at 13:04.";
    if (asks(/park/i)) return "Riverside parking: pay at the machine, two hours at most, free after 6 pm.";
    if (asks(/cinema|film|movie|friday/i)) return "The open-air cinema is on Friday 13 November at 7:30 pm, by the river. The poster says to bring a blanket.";
    if (asks(/remember|to-?do|todo/i)) {
      return "Three things:\n1. Return the library book by the 14th.\n2. Buy a birthday card for Maya, and AA batteries.\n3. Open-air cinema on Friday 13 November, 7:30 pm.";
    }
    if (asks(/diary/i)) {
      return "Saturday 7 November. Started with a flat white at Harbour Coffee and caught the 09:32 to Riverside. Stopped by the library, " +
        "which closes at five on Saturdays. Lunch was lentil soup and flatbread at Green Fork Kitchen. Parked by the river in the afternoon " +
        "and spotted a poster for the open-air cinema next Friday. Still to do: Maya's card, batteries, and the library book.";
    }
    if (asks(/see|what did i|happen|summar/i)) return visit.summary;
    return NO_SCRIPT;
  }

  // -------------------------------------------------------------------------
  // The day as a text note
  // -------------------------------------------------------------------------

  function noteText(visit) {
    const photos = visit.items.filter((item) => item.kind === "photo").length;
    let note = "# " + visit.name + "\n\nDate: " + visit.date + "\nPhotos: " + photos + "\n";

    // What the visit itself is described by, the same way the real note
    // writes it (mouse-core/src/note.rs).
    const described = (EDITION.details || [])
      .filter(([label]) => visit.details[label])
      .map(([label, words]) => "- " + words + ": " + visit.details[label]);
    if (described.length) note += "\n## About this visit\n\n" + described.join("\n") + "\n";

    if (visit.summary) note += "\n## Summary\n\n" + visit.summary + "\n";

    // The spaces, and what was noted in each.
    if (visit.spaces.length || visit.entries.length) {
      note += "\n## Spaces\n";
      const places = visit.spaces.concat([null]);
      for (const space of places) {
        const here = (one) => (space ? one.space === space.id : !visit.spaces.some((s) => s.id === one.space));
        const entries = visit.entries.filter(here);
        if (!space && !entries.length) continue;
        note += "\n### " + (space ? space.name : "Not sorted into a space") + "\n";
        if (space) {
          const facts = [];
          if (space.floor) facts.push("Floor: " + space.floor);
          if (space.occupancy) facts.push("Used as: " + space.occupancy);
          if (space.area) facts.push("Area: " + space.area + " sq ft");
          if (space.height) facts.push("Height: " + space.height + " ft");
          facts.push("Photos: " + visit.items.filter((item) => item.kind === "photo" && here(item)).length);
          note += "\n" + facts.join(". ") + "\n";
          if (space.notes) note += "\n" + space.notes + "\n";
        }
        for (const info of INVENTORY) {
          const ofKind = entries.filter((entry) => entry.kind === info.kind);
          if (!ofKind.length) continue;
          note += "\n" + info.name + "\n\n";
          for (const entry of ofKind) {
            const parts = info.values
              .filter(([label]) => entry.fields[label])
              .map(([label, words]) => words + ": " + entry.fields[label] + (entry.checked.includes(label) ? "" : " (not checked)"));
            if (info.sum) {
              const worked = sumFor(entry, info.sum);
              if (worked !== null) parts.push(info.sum.words + ": " + tidyNumber(worked));
            }
            if (entry.notes) parts.push("Notes: " + entry.notes);
            const name = entryTitle(entry) || "Not named yet";
            note += "- **" + name + "**" + (parts.length ? ". " + parts.join(". ") : "") + "\n";
          }
        }
      }
    }

    note += "\n## In order\n";

    // Every photo and recording, oldest first, and between them what was
    // said at that moment.
    const ordered = visit.items.slice().sort((a, b) => Date.parse(a.recorded) - Date.parse(b.recorded) || a.number - b.number);
    const said = visit.items
      .flatMap((item) => (item.heard ? item.heard.lines : []))
      .filter((line) => line.clock)
      .sort((a, b) => Date.parse(a.clock) - Date.parse(b.clock));
    let told = 0;
    const saidBefore = (moment) => {
      let text = "";
      while (told < said.length && (moment === null || Date.parse(said[told].clock) < moment)) {
        if (!text) text = "\n### " + said[told].clock.slice(11, 16) + " Said\n\n";
        text += "- " + said[told].clock.slice(11, 19) + " " + said[told].text + "\n";
        told += 1;
      }
      return text;
    };

    for (const item of ordered) {
      note += saidBefore(Date.parse(item.recorded));
      const time = item.recorded.slice(11, 16);
      if (item.kind !== "photo") {
        note += "\n### " + time + " Recording: " + item.name + "\n\n";
        if (item.seconds) note += lengthWords(item.seconds) + " long. ";
        if (!item.heard) {
          note += "Saved. What was said in it has not been written down yet.\n";
          continue;
        }
        const untimed = item.heard.lines.filter((line) => !line.clock);
        if (untimed.length < item.heard.lines.length) {
          note += "What was said in it (" + item.heard.words + " words, " + item.heard.came + ") is told below, at the moments it was said.\n";
        }
        if (untimed.length) {
          note += (untimed.length < item.heard.lines.length ? "\nAlso said" : "What was said in it") +
            " (" + item.heard.came + "; these words came without times, so they are not lined up with the photos):\n\n";
          for (const line of untimed) note += "- " + line.text + "\n";
        }
        continue;
      }
      const kind = item.looks_like || "photo";
      note += "\n### " + time + " " + kind.charAt(0).toUpperCase() + kind.slice(1) + "\n\n";
      // Where it was taken, and what it shows.
      const space = visit.spaces.find((one) => one.id === item.space);
      const shows = visit.entries.find((one) => one.id === item.entry);
      const placed = [];
      if (space) placed.push("Space: " + space.name);
      if (shows) placed.push("Shows: " + (entryTitle(shows) || kindInfo(shows.kind).name));
      if (placed.length) note += placed.join(". ") + "\n\n";

      const values = Object.entries(item.fields);
      if (values.length) {
        for (const [label, value] of values) {
          note += "- " + label + ": " + value + (item.checked.includes(label) ? " (checked)" : "") + "\n";
        }
      } else {
        note += item.text.split("\n").map((line) => "> " + line).join("\n") + "\n";
      }
    }
    note += saidBefore(null);
    return note;
  }

  // -------------------------------------------------------------------------
  // Answering the screen
  // -------------------------------------------------------------------------

  const wait = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

  // How many spaces and entries a visitor has added, to give each new one a
  // name of its own.
  let madeSpaces = 0;
  let madeEntries = 0;

  /** Say that some files show an entry (or, with no entry, show none). With
      "fill", the values read from each file are copied into the entry, but
      never over a value the person has checked. The same rule as vault.rs. */
  function attach(files, entry, fill) {
    for (const file of files) {
      file.entry = entry ? entry.id : null;
      if (!entry) continue;
      if (fill) {
        for (const [label, value] of Object.entries(file.fields)) {
          if (entry.checked.includes(label)) continue;
          if (file.checked.includes(label)) entry.checked.push(label);
          entry.fields[label] = value;
        }
      }
      if (!file.space && entry.space) file.space = entry.space;
    }
  }

  async function ask(address, change) {
    const parts = address.split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
    // parts is like ["api", "visits", "<id>", "items", "3", "value"]
    const [, what, id, more, number, action] = parts;

    if (what === "readers") {
      // Claude is never connected in the demo: a public web page is no
      // place for anybody's key.
      return {
        local: { available: true, models: ["demo script"], preferred: "demo script" },
        claude: { ready: false, kept_in: null, model: "", models: [], folder: "" },
        // Nor does the demo listen: its recordings' words were made up.
        listener: { ready: false, name: "Whisper base", megabytes: 139, folder: "" },
      };
    }
    if (what === "job") return { running: false };
    if (what === "about") {
      return { version: "demo", vault: "Nowhere. This is the demo, so nothing is kept.", edition: EDITION_ID };
    }
    if (what !== "visits") throw new Error("The demo cannot do that. The real app can.");

    if (!id) {
      return { visits: visits.map(({ id, name, date, photos, audio, video }) => ({ id, name, date, photos, audio, video })) };
    }
    const visit = findVisit(id);
    if (!more) return visit;

    if (more === "note") return { text: noteText(visit) };
    if (more === "rename") {
      const name = String(change.name || "").trim();
      if (!name) throw new Error("a visit needs a name");
      visit.name = name;
      if (change.date) visit.date = change.date;
      return visit;
    }
    if (more === "remove") {
      // Gone until the page is loaded again: the demo keeps nothing.
      visits.splice(visits.indexOf(visit), 1);
      return { removed: true, note: "This is the demo: load the page again and it is back." };
    }
    if (more === "details") {
      const label = String(change.label || "").trim().toLowerCase();
      if (!label) throw new Error("a detail needs a label, such as 'address'");
      const value = String(change.value || "").trim();
      if (value) visit.details[label] = value;
      else delete visit.details[label];
      return visit;
    }
    if (more === "summary") {
      await wait(900);
      visit.summary = visit.summary || answer(visit, "what did I see", null);
      return { summary: visit.summary };
    }
    if (more === "ask") {
      await wait(700);
      return { answer: answer(visit, change.question, change.photo), model: "the demo script" };
    }
    // Spaces. These follow the same rules as the real program (vault.rs).
    if (more === "spaces") {
      const written = (name) => String(change[name] || "").trim();
      const details = () => ({
        name: written("name"), floor: written("floor"), occupancy: written("occupancy"),
        area: written("area"), height: written("height"), notes: written("notes"),
      });
      const spaceId = number; // in this address the fifth part is the space
      if (spaceId) {
        const space = visit.spaces.find((one) => one.id === spaceId);
        if (!space) throw new Error("this visit has no such space");
        if (change.remove) {
          visit.spaces = visit.spaces.filter((one) => one.id !== spaceId);
          for (const item of visit.items) if (item.space === spaceId) item.space = null;
          for (const entry of visit.entries) if (entry.space === spaceId) entry.space = null;
        } else {
          if (!written("name")) throw new Error("a space needs a name, such as 'Boiler room'");
          Object.assign(space, details());
        }
      } else {
        if (!written("name")) throw new Error("a space needs a name, such as 'Boiler room'");
        madeSpaces += 1;
        const id = "demo-space-" + madeSpaces;
        visit.spaces.push({ id, ...details() });
        // "From this photo on, until the next space begins."
        if (typeof change.starting_at === "number") {
          const order = visit.items.slice().sort((a, b) =>
            (a.recorded || "").localeCompare(b.recorded || "") || a.number - b.number);
          const start = order.findIndex((item) => item.number === change.starting_at);
          const wasIn = start < 0 ? null : order[start].space;
          for (const item of start < 0 ? [] : order.slice(start)) {
            if (item.space !== wasIn) break;
            item.space = id;
          }
        }
      }
      return visit;
    }
    // Entries: what was noted in a space. Also the same rules as vault.rs.
    if (more === "entries") {
      const entryId = number; // in this address the fifth part is the entry
      if (!entryId) {
        const kind = String(change.kind || "").trim().toLowerCase();
        if (!kind) throw new Error("an entry needs a kind, such as 'equipment'");
        const files = (change.items || []).map((itemNumber) => visit.items[itemNumber]);
        if (files.some((file) => !file)) throw new Error("this visit has no such file");
        madeEntries += 1;
        const entry = {
          id: "demo-entry-" + madeEntries, kind,
          space: change.space || (files[0] ? files[0].space : null) || null,
          fields: {}, checked: [], notes: "",
        };
        visit.entries.push(entry);
        attach(files, entry, Boolean(change.fill));
        return visit;
      }

      const entry = visit.entries.find((one) => one.id === entryId);
      if (!entry) throw new Error("this visit has no such entry");
      const label = String(change.label || "").trim().toLowerCase();
      if (action === "value") {
        if (!label) throw new Error("a value needs a label, such as 'model'");
        const value = String(change.value === null || change.value === undefined ? "" : change.value).trim();
        entry.checked = entry.checked.filter((one) => one !== label);
        if (value) {
          entry.fields[label] = value;
          entry.checked.push(label);
        } else {
          delete entry.fields[label];
        }
      } else if (action === "checked") {
        entry.checked = entry.checked.filter((one) => one !== label);
        if (change.checked) entry.checked.push(label);
      } else if (change.remove) {
        visit.entries = visit.entries.filter((one) => one.id !== entryId);
        for (const item of visit.items) if (item.entry === entryId) item.entry = null;
      } else if (typeof change.notes === "string") {
        entry.notes = change.notes.trim();
      } else if ("space" in change) {
        if (change.space && !visit.spaces.some((one) => one.id === change.space)) throw new Error("this visit has no such space");
        entry.space = change.space || null;
      } else {
        throw new Error("the request did not say what to change");
      }
      return visit;
    }
    if (more === "attach") {
      const entry = change.entry ? visit.entries.find((one) => one.id === change.entry) : null;
      if (change.entry && !entry) throw new Error("this visit has no such entry");
      const files = (change.items || []).map((itemNumber) => visit.items[itemNumber]).filter(Boolean);
      attach(files, entry, Boolean(change.fill));
      return visit;
    }
    if (more === "sort") {
      const spaceId = change.space || null;
      if (spaceId && !visit.spaces.some((one) => one.id === spaceId)) throw new Error("this visit has no such space");
      for (const itemNumber of change.items || []) {
        if (visit.items[itemNumber]) visit.items[itemNumber].space = spaceId;
      }
      return visit;
    }
    if (more === "items") {
      const item = visit.items[Number(number)];
      // What was said in a recording, pasted in; or when it began, said by
      // hand. The words are placed again either way.
      if (item && action === "heard") {
        if (item.kind === "photo") throw new Error("words belong to a recording, and this is a photo");
        const lines = String(change.words || "").split("\n").filter((line) => line.trim()).map(timedLine);
        item.heard = lines.length ? { from: "typed or pasted in", came: "typed or pasted in", lines } : null;
        placeWords(visit.items);
        return item;
      }
      if (item && action === "began") {
        if (item.kind === "photo") throw new Error("only a recording has a moment it began, and this is a photo");
        const began = String(change.began || "");
        if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(began)) throw new Error("'" + began + "' is not a time like 2026-09-21T09:07");
        item.recorded = began.length === 16 ? began + ":00" : began.slice(0, 19);
        item.recorded_checked = true;
        placeWords(visit.items);
        return item;
      }
      // Saying by hand what a photo shows, or handing that back to Mouse.
      if (item && action === "looks-like") {
        const said = String(change.looks_like || "").trim().toLowerCase();
        if (said) item.looks_like = said;
        item.looks_like_checked = Boolean(said);
        return item;
      }
      const label = String(change.label || "").trim().toLowerCase();
      if (!item || !label) throw new Error("The demo could not change that.");
      if (action === "value") {
        if (change.value === null || change.value === "") delete item.fields[label];
        else item.fields[label] = change.value;
        if (!item.checked.includes(label)) item.checked.push(label);
      } else if (action === "checked") {
        item.checked = item.checked.filter((one) => one !== label);
        if (change.checked) item.checked.push(label);
      }
      return item;
    }
    throw new Error("The demo cannot do that. The real app does it on your own computer.");
  }

  window.MouseDemo = { ask, picture };
})();
