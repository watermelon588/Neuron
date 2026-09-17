import { useLayoutEffect, useSyncExternalStore } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

// Dev-only handle for inspecting timelines from the console.
if (import.meta.env.DEV && typeof window !== 'undefined') window.__gsap = gsap;

export { gsap, ScrollTrigger, SplitText };

/** Breakpoint + motion conditions shared by every Pulse animation. */
export const MOTION_QUERIES = {
    motion: '(prefers-reduced-motion: no-preference)',
    reduce: '(prefers-reduced-motion: reduce)',
    desktop: '(min-width: 900px)',
    mobile: '(max-width: 899px)',
};

/**
 * Run GSAP setup scoped to a ref, inside gsap.matchMedia so animations are
 * rebuilt when breakpoints or reduced-motion change and fully reverted on
 * unmount (StrictMode safe).
 *
 *   useGsap((c) => { if (!c.motion) return; gsap.from('.x', {...}); }, rootRef);
 *
 * The setup may return a cleanup function for listeners it added.
 */
export function useGsap(setup, scopeRef, deps = []) {
    useLayoutEffect(() => {
        const mm = gsap.matchMedia(scopeRef?.current ?? undefined);
        mm.add(MOTION_QUERIES, (ctx) => setup(ctx.conditions, ctx));
        return () => mm.revert();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}

/* Fonts matter for SplitText measurements; resolve once, share everywhere. */
let fontsReady = typeof document === 'undefined' || document.fonts?.status === 'loaded';
const listeners = new Set();
if (!fontsReady && typeof document !== 'undefined') {
    const done = () => {
        if (fontsReady) return;
        fontsReady = true;
        listeners.forEach((fn) => fn());
    };
    document.fonts?.ready.then(done);
    // Never block the page on a slow font CDN.
    setTimeout(done, 1500);
}

export function useFontsReady() {
    return useSyncExternalStore(
        (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
        () => fontsReady,
        () => true,
    );
}
