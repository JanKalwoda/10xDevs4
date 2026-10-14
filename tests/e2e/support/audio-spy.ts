import type { Page } from "@playwright/test";

// A pass-through observer of the browser audio boundary: every AudioContext the page creates is the
// real one (the sound still plays); the spy only records its state and each tone the app starts on it.
// `start` / `end` are seconds on the page's performance clock, comparable with `createdAt`, which is
// the moment of the user gesture (the app creates its context synchronously in the Start or Resume click).

export interface RecordedTone {
    frequency: number;
    start: number;
    end: number;
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
    contextStart: number;
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
                    const toPageClock = (when: number) => performance.now() / 1000 - this.currentTime + Math.max(when, this.currentTime);
                    oscillator.start = (when = 0) => {
                        tone = { frequency: oscillator.frequency.value, start: toPageClock(when), end: Number.NaN, contextStart: Math.max(when, this.currentTime) };
                        record.tones.push(tone);
                        start(when);
                    };
                    oscillator.stop = (when = 0) => {
                        // The first stop is the planned end; a later one is the app cancelling the tone.
                        if (tone && Number.isNaN(tone.end)) tone.end = toPageClock(when);
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
            tones: tones.map(({ frequency, start, end, contextStart }) => ({ frequency, start, end, reached: context.currentTime >= contextStart })),
        })),
    );
}
