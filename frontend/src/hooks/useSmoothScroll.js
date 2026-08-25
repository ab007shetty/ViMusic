// hooks/useSmoothScroll.js
import { useEffect, useRef, useCallback } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';

/**
 * Wires Lenis smooth scrolling to a specific scrollable element (not
 * `window` — this app's real scroll container is a nested <main
 * overflow-y-auto>), synced to GSAP's ticker per Lenis's documented GSAP
 * integration. No-ops if the user prefers reduced motion.
 *
 * Returns `scrollToTop()` — callers must use this (not a direct
 * `element.scrollTop = 0`) to reset scroll position, since Lenis tracks its
 * own internal target scroll position; setting the DOM property directly
 * would leave Lenis's internal state stale and cause a jump/snap-back on
 * the next scroll interaction.
 */
export function useSmoothScroll(scrollElementRef) {
  const lenisRef = useRef(null);

  useEffect(() => {
    const wrapper = scrollElementRef.current;
    if (!wrapper) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const content = wrapper.firstElementChild;
    if (!content) return;

    const lenis = new Lenis({
      wrapper,
      content,
      smoothWheel: true,
      duration: 1.1,
    });
    lenisRef.current = lenis;

    const onTick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [scrollElementRef]);

  const scrollToTop = useCallback(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    } else if (scrollElementRef.current) {
      scrollElementRef.current.scrollTop = 0;
    }
  }, [scrollElementRef]);

  return { scrollToTop };
}
