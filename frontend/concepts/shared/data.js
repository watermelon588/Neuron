// Shared content for the three Neuron design concepts.
// Every concept renders the same people, call script and chat so the
// comparison is about design language only, not about content.

export const ASSET = "/src/assets/Neuron";

export const LOGO = `${ASSET}/logo/logo3-160.png`;

export const people = {
  ines: { name: "Ines Duarte", short: "Ines", img: `${ASSET}/gallery/fa358c755b204cc2f8282e6c6b70baf8.jpg` },
  kofi: { name: "Kofi Mensah", short: "Kofi", img: `${ASSET}/gallery/70762889dccedc034f76ebed1449f449.jpg` },
  aarav: { name: "Aarav Sen", short: "Aarav", img: `${ASSET}/gallery/a25740cd5a27e5149846ad9c91aff116.jpg` },
  otto: { name: "Otto", short: "Otto", img: `${ASSET}/gallery/547c613297f266ca47279a062ee97dd6.jpg` },
  mira: { name: "Mira Okafor", short: "Mira", img: `${ASSET}/gallery/42142ffcc3d6b3ac4e5f13d1cb249b72.jpg` },
  you: { name: "You", short: "You", img: `${ASSET}/gallery/0b63e188d91b7db8ede853705b4b6fb3.jpg` },
};

export const media = {
  catEye: `${ASSET}/gallery/15197034_1280_720_24fps%20(1).mp4`,
  eye: `${ASSET}/gallery/15912342_1920_1080_24fps.mp4`,
  blob: "/1.mp4",
  orb: `${ASSET}/gallery/7.jpg`,
  folder: `${ASSET}/gallery/0b416699a0382b1a3fc7be66f8d95f7a.jpg`,
  prism: `${ASSET}/gallery/wewewe.png`,
  purpleHead: `${ASSET}/gallery/623fc7c957f277c926c5a4a83d147012.jpg`,
  book: `${ASSET}/gallery/pexels-hamza01nsr-10158225.jpg`,
  webLens: `${ASSET}/gallery/1154f15def29d77d4d6cf1208ae241c4.jpg`,
};

// Said earlier in the call. Recall can answer from these immediately.
export const earlier = [
  { who: "kofi", t: "03:10", text: "Pricing stays on the current tier for existing teams until March." },
  { who: "aarav", t: "07:45", text: "The onboarding video needs captions in Hindi and Portuguese." },
  { who: "ines", t: "12:04", text: "Launch moves to Thursday so QA gets two full days." },
  { who: "otto", t: "15:20", text: "The chart on my wall says we should ship anyway." },
];

// Plays on a loop as the "live" part of the call.
export const liveScript = [
  { who: "ines", text: "Can everyone see my screen? This is the new call layout." },
  { who: "kofi", text: "Looks good. I would move the captions closer to the speaker." },
  { who: "aarav", text: "Agreed. Recall answers should link straight to the timestamp." },
  { who: "otto", text: "I have been on hold for twenty minutes." },
  { who: "ines", text: "Otto, you are not on hold. You are unmuted." },
  { who: "kofi", text: "Let's lock Thursday and send the notes to the thread." },
];

export const seedChat = [
  { kind: "peer", who: "kofi", time: "6:02 PM", text: "Notes from Monday are pinned above." },
  {
    kind: "peer", who: "aarav", time: "6:10 PM", text: "Moodboard for the launch film.",
    attachment: { src: `${ASSET}/gallery/7.jpg`, name: "moodboard.jpg" },
  },
  { kind: "bot", who: "neuron", time: "6:10 PM", text: "I looked at the image: a dark sphere inside a glass shell. Filed it under Brand." },
  { kind: "peer", who: "ines", time: "6:30 PM", text: "Starting the call now. Ask Neuron if you miss anything." },
];

export const suggestions = [
  "/ask when is launch?",
  "/ask what about pricing?",
  "/ask recap the call",
];

export const teammateReplies = {
  ines: ["On it.", "Good call. Adding it to the notes.", "Say that again on the call?"],
  kofi: ["Makes sense to me.", "Can we decide this before Thursday?", "Noted."],
  aarav: ["Love it.", "I'll pick that up tomorrow.", "Send me the file?"],
  otto: ["Ook.", "Is this about bananas?", "I agree with whoever spoke last."],
};

export const fmt = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export const wallClock = () =>
  new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
