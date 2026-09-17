import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { createRoom } from "../shared/room.js";
import { earlier, liveScript, people, fmt } from "../shared/data.js";

gsap.registerPlugin(ScrollTrigger, SplitText);
window.__gsap = gsap; // review-only debugging handle

const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];

// ---------------------------------------------------------------------------
// Functional layer (runs with or without motion)
// ---------------------------------------------------------------------------
const reactions = ["\u{1F44B}", "\u{1F525}", "\u{1F44F}", "\u{1F34C}"];

const room = createRoom(q("[data-room]"), {
  onMessage(node) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from(node, { y: 14, opacity: 0, duration: 0.45, ease: "power3.out" });
    const dots = qa(".msg-typing i", node);
    if (dots.length) {
      gsap.to(dots, { y: -4, duration: 0.3, ease: "sine.inOut", stagger: { each: 0.12, yoyo: true, repeat: -1 } });
    }
  },
  onSpeaker(_, tile) {
    if (!tile || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(tile, { scale: 0.985 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)" });
  },
  onCite(_, tile) {
    if (!tile) return;
    tile.scrollIntoView({ block: "nearest", behavior: "smooth" });
    gsap.fromTo(tile, { filter: "brightness(1.8)" }, { filter: "brightness(1)", duration: 1.2, ease: "power2.out" });
  },
  onReact(btn) {
    const stage = q(".stage-grid");
    const r = stage.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const span = document.createElement("span");
    span.textContent = reactions[Math.floor(Math.random() * reactions.length)];
    span.setAttribute("aria-hidden", "true");
    Object.assign(span.style, {
      position: "absolute", left: `${b.left - r.left + b.width / 2}px`, top: `${r.height - 20}px`,
      fontSize: "40px", pointerEvents: "none", zIndex: 4,
    });
    stage.style.position = "relative";
    stage.append(span);
    gsap.to(span, {
      y: -r.height * 0.8, x: gsap.utils.random(-80, 80), rotation: gsap.utils.random(-30, 30),
      opacity: 0, duration: 1.8, ease: "power2.out", onComplete: () => span.remove(),
    });
  },
  onState(state, ended) {
    if (state === "ended") gsap.from(ended.children, { y: 20, opacity: 0, stagger: 0.07, duration: 0.5, ease: "power3.out" });
  },
});

// Hero mini-call: its own clock and caption loop.
(() => {
  const timerEl = q("[data-hero-timer]");
  const capEl = q("[data-hero-caption]");
  let s = 4 * 60 + 12;
  setInterval(() => { s += 1; timerEl.textContent = fmt(s); }, 1000);
  const lines = [earlier[2], ...liveScript.filter((l) => l.who === "ines"), earlier[0]];
  let i = 0;
  const show = () => {
    const line = lines[i++ % lines.length];
    const text = line.who === "ines" ? line.text : `${people[line.who].short}: ${line.text}`;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { capEl.textContent = text; return; }
    gsap.to(capEl, {
      opacity: 0, y: -6, duration: 0.25, ease: "power2.in",
      onComplete() {
        capEl.textContent = text;
        gsap.fromTo(capEl, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" });
      },
    });
  };
  setInterval(show, 4200);
})();

// ---------------------------------------------------------------------------
// Motion layer
// ---------------------------------------------------------------------------
const mm = gsap.matchMedia();

document.fonts.ready.then(() => {
  mm.add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      desktop: "(min-width: 768px)",
    },
    (ctx) => {
      const { motion, desktop } = ctx.conditions;
      if (!motion) return undefined;
      const cleanups = [];

      // HERO INTRO. Characters rise and expand from condensed to wide,
      // which is the brand gesture: a pulse moving through the word.
      const split = SplitText.create(".hero-title", { type: "chars", charsClass: "ch" });
      const chars = split.chars;
      const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
      intro
        .from(chars, { yPercent: 115, fontStretch: "62%", duration: 1.2, stagger: 0.028 })
        .from(".hero-sub", { y: 24, opacity: 0, duration: 0.9 }, 0.55)
        .from(".hero-cta > *", { y: 18, opacity: 0, duration: 0.8, stagger: 0.08 }, 0.7)
        .from(".htile-main", { clipPath: "inset(100% 0% 0% 0%)", duration: 1.3, ease: "expo.inOut" }, 0)
        .from(".htile-main img", { scale: 1.35, duration: 1.8 }, 0)
        .from(".htile-pip", { y: 80, opacity: 0, duration: 1.1 }, 0.6)
        .from(".hcap", { x: 24, opacity: 0, duration: 0.8 }, 0.9)
        .from(".nav", { yPercent: -100, duration: 0.9 }, 0.2);

      // PERSISTENT: idle width pulse through the headline.
      const pulse = gsap.timeline({ repeat: -1, repeatDelay: 2.8, delay: 2.4, paused: false });
      pulse.to(chars, {
        fontStretch: "74%",
        duration: 0.45,
        ease: "sine.inOut",
        stagger: { each: 0.05, yoyo: true, repeat: 1 },
      });

      // Pointer: characters near the cursor condense, like pressure on type.
      if (desktop) {
        const title = q(".hero-title");
        let raf = 0;
        let px = 0;
        const onMove = (e) => {
          px = e.clientX;
          if (raf) return;
          raf = requestAnimationFrame(() => {
            raf = 0;
            chars.forEach((c) => {
              const r = c.getBoundingClientRect();
              const d = Math.abs(r.left + r.width / 2 - px);
              const w = gsap.utils.mapRange(0, 260, 66, 125, Math.min(d, 260));
              gsap.to(c, { fontStretch: `${w}%`, duration: 0.5, ease: "power3.out", overwrite: "auto" });
            });
          });
        };
        const onEnter = () => pulse.pause();
        const onLeave = () => {
          gsap.to(chars, {
            fontStretch: "125%", duration: 0.7, ease: "elastic.out(1, 0.6)", overwrite: "auto",
            onComplete: () => pulse.restart(true),
          });
        };
        title.addEventListener("pointerenter", onEnter);
        title.addEventListener("pointermove", onMove);
        title.addEventListener("pointerleave", onLeave);
        cleanups.push(() => {
          title.removeEventListener("pointerenter", onEnter);
          title.removeEventListener("pointermove", onMove);
          title.removeEventListener("pointerleave", onLeave);
          cancelAnimationFrame(raf);
        });
      }

      // PERSISTENT: audio level bars. Only the active speaker moves.
      qa(".wave i").forEach((bar) => {
        gsap.to(bar, {
          scaleY: () => {
            const host = bar.closest("[data-tile]");
            const live = host ? host.dataset.speaking === "true" : bar.closest("[data-live]");
            return live ? gsap.utils.random(0.25, 1) : 0.2;
          },
          duration: () => gsap.utils.random(0.12, 0.26),
          ease: "sine.inOut",
          repeat: -1,
          repeatRefresh: true,
        });
      });

      // PERSISTENT: live indicator breathes.
      gsap.to(".rec", { opacity: 0.25, duration: 0.9, ease: "sine.inOut", repeat: -1, yoyo: true });

      // MARQUEE: loops forever; scrolling fast pushes it faster.
      const set = q(".band-set");
      q(".band-track").append(set.cloneNode(true));
      const loop = gsap.to(".band-track", { xPercent: -50, duration: 26, ease: "none", repeat: -1 });
      ScrollTrigger.create({
        trigger: ".band",
        start: "top bottom",
        end: "bottom top",
        onUpdate(self) {
          const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 300, 5);
          gsap.to(loop, { timeScale: boost, duration: 0.2, overwrite: true });
          gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.2 });
        },
      });

      // Section reveals.
      gsap.utils.toArray(".reveal").forEach((node) => {
        gsap.from(node, {
          y: 40, opacity: 0, duration: 1, ease: "expo.out",
          scrollTrigger: { trigger: node, start: "top 85%", once: true },
        });
      });
      gsap.from(".reveal-app", {
        clipPath: "inset(12% 6% 12% 6%)", opacity: 0.4, duration: 1.2, ease: "expo.out",
        scrollTrigger: { trigger: ".reveal-app", start: "top 80%", once: true },
      });
      gsap.from(".ptile", {
        opacity: 0, scale: 0.92, duration: 0.8, ease: "expo.out", stagger: 0.07,
        scrollTrigger: { trigger: ".stage-grid", start: "top 75%", once: true },
      });

      // FEATURES: pinned horizontal pan (desktop only).
      if (desktop) {
        const track = q(".pan-track");
        const distance = () => track.scrollWidth - window.innerWidth;
        const pan = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: ".features",
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
        qa(".panel").forEach((panel) => {
          gsap.fromTo(q(".panel-fig img", panel), { xPercent: -7 }, {
            xPercent: 7, ease: "none",
            scrollTrigger: { trigger: panel, containerAnimation: pan, start: "left right", end: "right left", scrub: true },
          });
          gsap.from(q(".panel-word", panel), {
            yPercent: 100, fontStretch: "62%", ease: "expo.out", duration: 1.2,
            scrollTrigger: { trigger: panel, containerAnimation: pan, start: "left 65%", toggleActions: "play none none reverse" },
          });
        });
      }

      // CLOSE: the headline stretches open as it scrolls in.
      gsap.fromTo(".close-title", { fontStretch: "62%" }, {
        fontStretch: "125%", ease: "none",
        scrollTrigger: { trigger: ".close", start: "top bottom", end: "top 25%", scrub: true },
      });

      return () => {
        cleanups.forEach((fn) => fn());
        split.revert();
        const clones = qa(".band-set");
        clones.slice(1).forEach((c) => c.remove());
      };
    },
  );
});

window.addEventListener("pagehide", () => room.destroy());
