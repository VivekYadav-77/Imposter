export type GameSound =
  | "ui"
  | "role-crew"
  | "role-imposter"
  | "meeting"
  | "vote"
  | "upload"
  | "task-complete"
  | "kill"
  | "eliminated"
  | "cooldown-ready"
  | "result"
  | "victory"
  | "defeat"
  | "easter-egg";

const STORAGE_KEY = "imposter-game-sound-enabled";
let context: AudioContext | null = null;
let master: GainNode | null = null;

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "false";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
  if (master) master.gain.setTargetAtTime(enabled ? 0.42 : 0, context!.currentTime, 0.01);
}

function audio(): { context: AudioContext; master: GainNode } | null {
  if (typeof window === "undefined" || !isSoundEnabled()) return null;
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return null;
  context ??= new AudioContextConstructor();
  if (!master) {
    master = context.createGain();
    master.gain.value = 0.42;
    master.connect(context.destination);
  }
  if (context.state === "suspended") void context.resume();
  return { context, master };
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

export function playGameSound(sound: GameSound): void {
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
    case "meeting":
      for (let index = 0; index < 4; index += 1) {
        tone(index % 2 ? 520 : 760, index * 0.18, 0.16, {
          gain: 0.16,
          type: "square",
        });
      }
      break;
    case "vote":
      tone(190, 0, 0.12, { endFrequency: 120, gain: 0.2, type: "triangle" });
      tone(760, 0.07, 0.09, { gain: 0.08 });
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
