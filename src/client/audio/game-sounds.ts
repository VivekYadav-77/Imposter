export type GameSound =
  | "ui"
  | "role-crew"
  | "role-imposter"
  | "player-join"
  | "game-start"
  | "meeting"
  | "vote"
  | "vote-select"
  | "vote-lock"
  | "upload-start"
  | "upload-failure"
  | "upload"
  | "task-complete"
  | "kill"
  | "eliminated"
  | "cooldown-ready"
  | "result"
  | "victory"
  | "defeat"
  | "easter-egg";

export type GameSoundEvent = GameSound;

const STORAGE_KEY = "imposter-game-sound-enabled";
const MASTER_GAIN = 0.76;
let context: AudioContext | null = null;
let master: GainNode | null = null;
let limiter: DynamicsCompressorNode | null = null;
const lastPlayed = new Map<GameSound, number>();

export const gameSoundLabels: Record<GameSound, string> = {
  ui: "Interface confirmation",
  "role-crew": "Crew role reveal",
  "role-imposter": "Imposter role reveal",
  "player-join": "Player joined",
  "game-start": "Game started",
  meeting: "Meeting alert",
  vote: "Ballot confirmation",
  "vote-select": "Ballot selection",
  "vote-lock": "Ballot locked",
  "upload-start": "Evidence upload started",
  "upload-failure": "Evidence upload failed",
  upload: "Evidence uploaded",
  "task-complete": "Task completed",
  kill: "Elimination",
  eliminated: "Player eliminated",
  "cooldown-ready": "Ability ready",
  result: "Meeting result",
  victory: "Victory",
  defeat: "Defeat",
  "easter-egg": "Hidden interaction",
};

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "false";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
  if (master) master.gain.setTargetAtTime(enabled ? MASTER_GAIN : 0, context!.currentTime, 0.01);
}

function audio(): { context: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined" || !isSoundEnabled()) return null;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  if (context?.state === "closed") {
    context = null;
    master = null;
    limiter = null;
  }
  context ??= new AudioContextConstructor();
  if (!master) {
    master = context.createGain();
    master.gain.value = MASTER_GAIN;
    limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 18;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.22;
    master.connect(limiter).connect(context.destination);
  }
  return { context, master };
}

/**
 * Prime Web Audio from a real user gesture and resume it after mobile browsers suspend it.
 * Call once from a mounted game control and dispose the returned listeners on unmount.
 */
export function initializeGameAudio(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const unlock = () => {
    const output = audio();
    if (!output || output.context.state !== "suspended") return;
    void output.context
      .resume()
      .then(() => {
        // A silent one-sample source reliably opens the output route on iOS/WebKit.
        const buffer = output.context.createBuffer(1, 1, output.context.sampleRate);
        const source = output.context.createBufferSource();
        source.buffer = buffer;
        source.connect(output.master);
        source.start();
      })
      .catch(() => undefined);
  };
  const resumeWhenVisible = () => {
    if (!document.hidden) unlock();
  };
  window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  window.addEventListener("touchstart", unlock, { capture: true, passive: true });
  window.addEventListener("keydown", unlock, { capture: true });
  document.addEventListener("visibilitychange", resumeWhenVisible);
  return () => {
    window.removeEventListener("pointerdown", unlock, { capture: true });
    window.removeEventListener("touchstart", unlock, { capture: true });
    window.removeEventListener("keydown", unlock, { capture: true });
    document.removeEventListener("visibilitychange", resumeWhenVisible);
  };
}

function tone(
  frequency: number,
  start: number,
  duration: number,
  options: {
    endFrequency?: number;
    gain?: number;
    type?: OscillatorType;
    attack?: number;
  } = {},
): void {
  const output = audio();
  if (!output) return;
  const oscillator = output.context.createOscillator();
  const envelope = output.context.createGain();
  const begins = output.context.currentTime + start;
  const ends = begins + duration;
  const peak = options.gain ?? 0.22;
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(frequency, begins);
  if (options.endFrequency)
    oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, ends);
  envelope.gain.setValueAtTime(0.0001, begins);
  envelope.gain.exponentialRampToValueAtTime(peak, begins + (options.attack ?? 0.015));
  envelope.gain.exponentialRampToValueAtTime(0.0001, ends);
  oscillator.connect(envelope).connect(output.master);
  oscillator.start(begins);
  oscillator.stop(ends + 0.02);
}

function noise(start: number, duration: number, gain = 0.13, lowpass = 1200): void {
  const output = audio();
  if (!output) return;
  const sampleCount = Math.ceil(output.context.sampleRate * duration);
  const buffer = output.context.createBuffer(1, sampleCount, output.context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) channel[index] = Math.random() * 2 - 1;
  const source = output.context.createBufferSource();
  const filter = output.context.createBiquadFilter();
  const envelope = output.context.createGain();
  const begins = output.context.currentTime + start;
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.value = lowpass;
  envelope.gain.setValueAtTime(gain, begins);
  envelope.gain.exponentialRampToValueAtTime(0.0001, begins + duration);
  source.connect(filter).connect(envelope).connect(output.master);
  source.start(begins);
}

function renderGameSound(sound: GameSound): void {
  switch (sound) {
    case "ui":
      tone(420, 0, 0.07, { endFrequency: 620, gain: 0.08, type: "triangle" });
      break;
    case "role-crew":
      [261.63, 329.63, 392].forEach((frequency, index) =>
        tone(frequency, index * 0.09, 0.32, { gain: 0.12, type: "triangle" }),
      );
      break;
    case "role-imposter":
      tone(110, 0, 0.75, { endFrequency: 55, gain: 0.28, type: "sawtooth" });
      tone(116.5, 0.04, 0.66, { endFrequency: 58, gain: 0.12, type: "square" });
      noise(0, 0.42, 0.07, 500);
      break;
    case "player-join":
      tone(440, 0, 0.11, { endFrequency: 587.33, gain: 0.1, type: "triangle" });
      tone(659.25, 0.1, 0.2, { endFrequency: 783.99, gain: 0.12, type: "sine" });
      break;
    case "game-start":
      noise(0, 0.16, 0.08, 1500);
      [196, 293.66, 392, 587.33].forEach((frequency, index) =>
        tone(frequency, index * 0.095, 0.38, { gain: 0.13, type: "sawtooth" }),
      );
      break;
    case "meeting":
      // A long, speaker-friendly emergency klaxon: strong mid frequencies remain
      // audible on phones while the limiter prevents overlapping pulses from clipping.
      for (let index = 0; index < 5; index += 1) {
        const startsAt = index * 0.4;
        const high = index % 2 === 0 ? 980 : 760;
        tone(high, startsAt, 0.31, {
          endFrequency: index % 2 === 0 ? 650 : 1040,
          gain: 0.28,
          type: "sawtooth",
          attack: 0.018,
        });
        tone(high / 2, startsAt, 0.31, {
          endFrequency: index % 2 === 0 ? 325 : 520,
          gain: 0.16,
          type: "square",
          attack: 0.018,
        });
        noise(startsAt, 0.25, 0.045, 1350);
      }
      tone(92, 0, 2.12, { endFrequency: 78, gain: 0.09, type: "sine", attack: 0.03 });
      break;
    case "vote":
      tone(190, 0, 0.12, { endFrequency: 120, gain: 0.2, type: "triangle" });
      tone(760, 0.07, 0.09, { gain: 0.08 });
      break;
    case "vote-select":
      tone(520, 0, 0.08, { endFrequency: 650, gain: 0.07, type: "triangle" });
      break;
    case "vote-lock":
      tone(180, 0, 0.11, { endFrequency: 120, gain: 0.13, type: "triangle" });
      tone(680, 0.08, 0.13, { endFrequency: 880, gain: 0.1, type: "sine" });
      break;
    case "upload-start":
      tone(280, 0, 0.1, { endFrequency: 420, gain: 0.07, type: "triangle" });
      break;
    case "upload-failure":
      tone(210, 0, 0.18, { endFrequency: 130, gain: 0.12, type: "sawtooth" });
      tone(145, 0.13, 0.2, { gain: 0.08, type: "triangle" });
      break;
    case "upload":
      [330, 440, 660].forEach((frequency, index) =>
        tone(frequency, index * 0.08, 0.16, { gain: 0.1, type: "triangle" }),
      );
      break;
    case "task-complete":
      [523.25, 659.25, 783.99].forEach((frequency, index) =>
        tone(frequency, index * 0.1, 0.38, { gain: 0.12, type: "sine" }),
      );
      break;
    case "kill":
      noise(0, 0.18, 0.22, 1800);
      tone(150, 0, 0.5, { endFrequency: 42, gain: 0.3, type: "sawtooth" });
      break;
    case "eliminated":
      [293.66, 220, 146.83].forEach((frequency, index) =>
        tone(frequency, index * 0.16, 0.42, { gain: 0.14, type: "triangle" }),
      );
      break;
    case "cooldown-ready":
      tone(660, 0, 0.14, { gain: 0.09, type: "sine" });
      tone(880, 0.13, 0.2, { gain: 0.12, type: "sine" });
      break;
    case "result":
      tone(196, 0, 0.85, { endFrequency: 174.61, gain: 0.2, type: "triangle" });
      tone(98, 0, 0.95, { gain: 0.1, type: "sine" });
      break;
    case "victory":
      [261.63, 329.63, 392, 523.25].forEach((frequency, index) =>
        tone(frequency, index * 0.11, 0.55, { gain: 0.11, type: "triangle" }),
      );
      break;
    case "defeat":
      [261.63, 233.08, 196, 130.81].forEach((frequency, index) =>
        tone(frequency, index * 0.15, 0.5, { gain: 0.13, type: "sawtooth" }),
      );
      break;
    case "easter-egg":
      [880, 1174.66, 987.77, 1318.51].forEach((frequency, index) =>
        tone(frequency, index * 0.07, 0.16, { gain: 0.09, type: "square" }),
      );
      break;
  }
}

export function playGameSound(sound: GameSound): void {
  const now = typeof performance === "undefined" ? Date.now() : performance.now();
  if (now - (lastPlayed.get(sound) ?? -Infinity) < (sound === "ui" ? 70 : 180)) return;
  const output = audio();
  if (!output) return;
  lastPlayed.set(sound, now);
  if (output.context.state === "running") renderGameSound(sound);
  else
    void output.context
      .resume()
      .then(() => renderGameSound(sound))
      .catch(() => undefined);
}

/** Play the meeting klaxon and request a matching haptic alert where supported. */
export function playMeetingAlert(): void {
  playGameSound("meeting");
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;

  // Vibration is intentionally independent from the sound preference: it is a brief,
  // accessibility-friendly meeting signal and unsupported browsers simply ignore it.
  navigator.vibrate([300, 100, 300, 140, 520, 120, 300]);
}
