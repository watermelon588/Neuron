// Behaviour for the interactive call + chat preview, shared by all concepts.
// Each concept owns its markup, styles and motion; this module only wires
// state through data attributes and exposes hooks for animation.
//
//   [data-room]              root
//   [data-tile="ines"]       participant tile (gets data-speaking / data-muted / data-cam-off)
//   [data-caption-name]      live caption speaker
//   [data-caption-text]      live caption text
//   [data-timer]             call clock
//   [data-chat-log]          <ol> of messages
//   [data-chat-form]         <form> with [data-chat-input]
//   [data-suggest] [data-q]  suggestion chips
//   [data-ctl="mic|cam|react|leave"]
//   [data-ended] [data-rejoin]

import {
  people, earlier, liveScript, seedChat, teammateReplies, fmt, wallClock, LOGO,
} from "./data.js";

const STOP = new Set(
  "the and for that this with what when did does was were are you your about from have has into our can will just they them then than there their said say says tell neuron ask who how why".split(" "),
);
const SYN = {
  date: ["thursday", "launch"], ship: ["launch"], release: ["launch"], day: ["thursday"],
  price: ["pricing"], cost: ["pricing"], plan: ["pricing", "tier"],
  subtitles: ["captions"], translate: ["captions", "hindi", "portuguese"], language: ["hindi", "portuguese"],
  layout: ["screen", "layout"], hold: ["hold"], chart: ["chart", "wall"],
};
const stem = (w) => w.replace(/(ing|es|s)$/, "");
const tokens = (s) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

export function recall(question, transcript) {
  const q = question.toLowerCase();
  if (/summar|recap|decid|decision|notes|so far/.test(q)) {
    return {
      type: "summary",
      text: "Three decisions so far: launch moves to Thursday, pricing holds for existing teams until March, and onboarding gets Hindi and Portuguese captions.",
    };
  }
  const want = new Set();
  tokens(q).forEach((w) => {
    want.add(stem(w));
    (SYN[w] || []).forEach((s) => want.add(stem(s)));
  });
  let best = null;
  let bestScore = 0;
  transcript.forEach((line, i) => {
    const score = tokens(line.text).reduce((n, w) => n + (want.has(stem(w)) ? 1 : 0), 0);
    if (score > bestScore) { best = { ...line, index: i }; bestScore = score; }
  });
  if (!best) {
    return {
      type: "miss",
      text: "I couldn't find that in this call or the thread. Try asking about launch, pricing or captions.",
    };
  }
  return {
    type: "answer",
    text: `${people[best.who].short} said it at ${best.t}: “${best.text}”`,
    cite: best,
  };
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export function renderMessage(msg) {
  const li = el("li", `msg msg--${msg.kind}`);
  li.dataset.kind = msg.kind;
  const av = el("span", `msg-av${msg.kind === "bot" ? " msg-av--bot" : ""}`);
  const img = el("img");
  img.alt = "";
  img.src = msg.kind === "bot" ? LOGO : people[msg.who]?.img ?? people.you.img;
  av.append(img);

  const main = el("div", "msg-main");
  const meta = el("div", "msg-meta");
  const name = msg.kind === "bot" ? "Neuron" : msg.kind === "me" ? "You" : people[msg.who].short;
  meta.append(el("b", null, name), el("time", null, msg.time ?? wallClock()));
  main.append(meta);

  if (msg.typing) {
    const t = el("div", "msg-typing");
    t.setAttribute("aria-label", `${name} is typing`);
    t.append(el("i"), el("i"), el("i"));
    main.append(t);
  } else if (msg.pending) {
    const s = el("div", "msg-skel");
    s.setAttribute("aria-label", "Neuron is searching the call");
    s.append(el("i"), el("i"));
    main.append(s);
  } else {
    main.append(el("p", "msg-body", msg.text));
    if (msg.attachment) {
      const fig = el("figure", "msg-attach");
      const a = el("img");
      a.src = msg.attachment.src;
      a.alt = msg.attachment.name;
      fig.append(a, el("figcaption", null, msg.attachment.name));
      main.append(fig);
    }
    if (msg.cite) {
      const b = el("button", "msg-cite");
      b.type = "button";
      b.dataset.cite = String(msg.cite.index);
      b.innerHTML = '<i class="ph ph-play" aria-hidden="true"></i>';
      b.append(document.createTextNode(` Jump to ${msg.cite.t}`));
      main.append(b);
    }
  }
  li.append(av, main);
  return li;
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createRoom(root, options = {}) {
  const o = {
    startAt: 18 * 60 + 32,
    onMessage: () => {},
    onSpeaker: () => {},
    onReact: () => {},
    onState: () => {},
    onCite: () => {},
    ...options,
  };
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];

  let seconds = o.startAt;
  let live = true;
  let idx = 0;
  let speakerTimer = 0;
  let captionTimer = 0;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  };
  const transcript = earlier.map((x) => ({ ...x }));

  const clock = setInterval(() => {
    if (!live) return;
    seconds += 1;
    $$("[data-timer]").forEach((n) => { n.textContent = fmt(seconds); });
  }, 1000);
  $$("[data-timer]").forEach((n) => { n.textContent = fmt(seconds); });

  function setSpeaker(who) {
    $$("[data-tile]").forEach((t) => { t.dataset.speaking = String(t.dataset.tile === who); });
    o.onSpeaker(who, $(`[data-tile="${who}"]`));
  }

  function caption(who, text) {
    const nameEl = $("[data-caption-name]");
    const textEl = $("[data-caption-text]");
    if (!textEl) return;
    clearTimeout(captionTimer);
    if (nameEl) nameEl.textContent = people[who].short;
    if (reduced()) { textEl.textContent = text; return; }
    const words = text.split(" ");
    let i = 0;
    textEl.textContent = "";
    const step = () => {
      textEl.textContent = words.slice(0, ++i).join(" ");
      if (i < words.length) captionTimer = setTimeout(step, 170);
    };
    step();
  }

  function nextLine() {
    if (!live) return;
    const line = liveScript[idx % liveScript.length];
    idx += 1;
    setSpeaker(line.who);
    caption(line.who, line.text);
    transcript.push({ ...line, t: fmt(seconds) });
    if (transcript.length > 40) transcript.splice(earlier.length, 1);
    speakerTimer = later(nextLine, Math.max(3600, line.text.split(" ").length * 170 + 2200));
  }

  // chat
  const log = $("[data-chat-log]");
  const push = (msg) => {
    const node = renderMessage(msg);
    log.append(node);
    log.scrollTo({ top: log.scrollHeight, behavior: reduced() ? "auto" : "smooth" });
    o.onMessage(node, msg);
    return node;
  };
  const swap = (node, msg) => {
    const next = renderMessage(msg);
    node.replaceWith(next);
    log.scrollTo({ top: log.scrollHeight, behavior: reduced() ? "auto" : "smooth" });
    o.onMessage(next, msg);
  };
  seedChat.forEach((m) => log.append(renderMessage(m)));

  const form = $("[data-chat-form]");
  const input = $("[data-chat-input]");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    push({ kind: "me", who: "you", text });

    if (text.startsWith("/ask") || text.endsWith("?")) {
      const q = text.replace(/^\/ask\s*/i, "");
      const pending = push({ kind: "bot", pending: true });
      later(() => {
        const r = recall(q, transcript);
        swap(pending, { kind: "bot", text: r.text, cite: r.cite });
      }, 1100);
      return;
    }
    const pool = Object.keys(teammateReplies);
    const who = pool[Math.floor(Math.random() * pool.length)];
    later(() => {
      const typing = push({ kind: "peer", who, typing: true });
      later(() => {
        const lines = teammateReplies[who];
        swap(typing, { kind: "peer", who, text: lines[Math.floor(Math.random() * lines.length)] });
      }, 1400);
    }, 600);
  });

  $$("[data-suggest] [data-q]").forEach((chip) => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.q;
      form.requestSubmit();
    });
  });

  log.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cite]");
    if (!b) return;
    const line = transcript[Number(b.dataset.cite)];
    if (!line) return;
    if (!live) rejoin();
    clearTimeout(speakerTimer);
    timers.delete(speakerTimer);
    setSpeaker(line.who);
    caption(line.who, `${line.text} (${line.t})`);
    o.onCite(line, $(`[data-tile="${line.who}"]`));
    speakerTimer = later(nextLine, 5200);
  });

  // controls
  const you = $('[data-tile="you"]');
  const toggle = (btn, attr) => {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    if (you) you.dataset[attr] = String(on);
    return on;
  };
  $$('[data-ctl="mic"]').forEach((b) => b.addEventListener("click", () => {
    const on = toggle(b, "muted");
    b.setAttribute("aria-label", on ? "Unmute microphone" : "Mute microphone");
  }));
  $$('[data-ctl="cam"]').forEach((b) => b.addEventListener("click", () => {
    const on = toggle(b, "camOff");
    b.setAttribute("aria-label", on ? "Turn camera on" : "Turn camera off");
  }));
  $$('[data-ctl="react"]').forEach((b) => b.addEventListener("click", () => o.onReact(b)));

  const ended = $("[data-ended]");
  function leave() {
    live = false;
    clearTimeout(speakerTimer);
    clearTimeout(captionTimer);
    $$("[data-tile]").forEach((t) => { t.dataset.speaking = "false"; });
    if (ended) ended.hidden = false;
    root.dataset.state = "ended";
    o.onState("ended", ended);
  }
  function rejoin() {
    live = true;
    if (ended) ended.hidden = true;
    root.dataset.state = "live";
    o.onState("live", ended);
    nextLine();
  }
  $$('[data-ctl="leave"]').forEach((b) => b.addEventListener("click", leave));
  $$("[data-rejoin]").forEach((b) => b.addEventListener("click", rejoin));

  root.dataset.state = "live";
  later(nextLine, 900);

  return {
    setSpeaker,
    leave,
    rejoin,
    destroy() {
      clearInterval(clock);
      clearTimeout(captionTimer);
      timers.forEach(clearTimeout);
    },
  };
}
