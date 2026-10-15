import type { Page } from "@playwright/test";

// A pass-through observer of the browser audio boundary: every AudioContext the page creates is the
// real one (the sound still plays); the spy only records its state and each tone the app starts on it.
// `start` / `end` are the exact times the app scheduled, in seconds of that context's audio clock: compare
// tones of one context with them. `startOnPageClock` maps the start to the page's performance clock, to
// compare with `createdAt`, the moment of the user gesture (the app creates its context synchronously in the
// Start or Resume click). The audio clock advances in output-buffer steps (about 20 ms on a CI runner), so
// that mapping is only that precise.

export interface RecordedTone {
    frequency: number;
    start: number;
    end: number;
    startOnPageClock: number;
    /** The context clock has passed the tone's start, so the output really rendered it. */
    reached: boolean;
}

export interface RecordedAudioContext {
    createdAt: number;
    state: AudioContextState;
    tones: RecordedTone[];
}

interface SpyTone {
    frequency: number;
    start: number;
    end: number;
    startOnPageClock: number;
}

interface SpyRecord {
    createdAt: number;
    context: AudioContext;
    tones: SpyTone[];
}

declare global {
    interface Window {
        __audioSpy?: SpyRecord[];
    }
}

export async function installAudioSpy(page: Page): Promise<void> {
    await page.addInitScript(() => {
        const NativeAudioContext = window.AudioContext;
        const records: SpyRecord[] = [];
        window.__audioSpy = records;
        window.AudioContext = class extends NativeAudioContext {
            constructor(options?: AudioContextOptions) {
                super(options);
                const record: SpyRecord = { createdAt: performance.now() / 1000, context: this, tones: [] };
                records.push(record);
                const createOscillator = this.createOscillator.bind(this);
                this.createOscillator = () => {
                    const oscillator = createOscillator();
                    const start = oscillator.start.bind(oscillator);
                    const stop = oscillator.stop.bind(oscillator);
                    let tone: SpyTone | undefined;
                    oscillator.start = (when = 0) => {
                        // A time in the past plays now, as Web Audio does.
                        const at = Math.max(when, this.currentTime);
                        tone = { frequency: oscillator.frequency.value, start: at, end: Number.NaN, startOnPageClock: performance.now() / 1000 - this.currentTime + at };
                        record.tones.push(tone);
                        start(when);
                    };
                    oscillator.stop = (when = 0) => {
                        // The first stop is the planned end; a later one is the app cancelling the tone.
                        if (tone && Number.isNaN(tone.end)) tone.end = Math.max(when, this.currentTime);
                        stop(when);
                    };
                    return oscillator;
                };
            }
        };
    });
}

export async function readAudioContexts(page: Page): Promise<RecordedAudioContext[]> {
    return page.evaluate(() =>
        (window.__audioSpy ?? []).map(({ createdAt, context, tones }) => ({
            createdAt,
            state: context.state,
            tones: tones.map((tone) => ({ ...tone, reached: context.currentTime >= tone.start })),
        })),
    );
}
