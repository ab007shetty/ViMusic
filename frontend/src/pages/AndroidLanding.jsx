import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import './AndroidLanding.css';

gsap.registerPlugin(ScrollTrigger);

// Direct APK so the download starts on click instead of landing people on a
// releases page. Pinned to a version by nature — the app updates itself OTA.
const APK_URL = 'https://github.com/ab007shetty/ViMusicAndroid/releases/download/v1.0.2/ViMusic-release-1.0.2.apk';
const RELEASES_URL = 'https://github.com/ab007shetty/ViMusicAndroid/releases/latest';
const VERSION = '1.0.2';
const SOURCE_URL = 'https://github.com/ab007shetty/ViMusicAndroid';
const WEB_APP_URL = 'https://vimusic.vercel.app/';
const AUTHOR_URL = 'https://abshetty.com';

// Each feature owns a screenshot — the screenshots are the content here, not
// decoration, so every one of them earns a section.
const FEATURES = [
  {
    id: 'playlists',
    label: 'Playlists',
    shot: '/images/playlists.jpeg',
    title: 'Playlists that look like your music',
    body: 'Group songs however you like and give each playlist real cover art from a track inside it. Sort A–Z or by what you touched last, and search within a playlist once it gets long.',
  },
  {
    id: 'lyrics',
    label: 'Lyrics',
    shot: '/images/lyrics.jpeg',
    title: 'Lyrics that keep time',
    body: 'Synced line-by-line lyrics from LRCLIB, highlighting the line playing right now. Tap any line to jump there.',
  },
  {
    id: 'video',
    label: 'Video',
    shot: '/images/video.jpeg',
    title: 'Audio or video, mid-song',
    body: 'Switch to the music video without losing your place, then drop back to audio when you put the phone away.',
  },
  {
    id: 'local',
    label: 'Local files',
    shot: '/images/local.jpeg',
    title: 'Files already on your phone',
    body: 'Point it at a folder and your local tracks sit in the same library as everything else, with the same search and sorting.',
  },
  {
    id: 'favourites',
    label: 'Favourites',
    shot: '/images/fav.jpeg',
    title: 'Favourites, one tap away',
    body: 'Heart a song from anywhere — the player, a playlist, or search results — and it lands in Favourites straight away.',
  },
  {
    id: 'search',
    label: 'Search',
    shot: '/images/search.jpeg',
    title: 'Search the whole catalogue',
    body: 'Find any track and play it immediately. Songs you already saved are marked, so you never add the same one twice.',
  },
  {
    id: 'sync',
    label: 'Web sync',
    shot: '/images/about.jpeg',
    title: 'The same library in a browser',
    body: 'Signing in is optional. Do it and your playlists, favourites and history show up on the web app too, updating as you go.',
  },
];

const AndroidLanding = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const featureRefs = useRef([]);
  // Set by the pager effect; lets the rail drive the same one-section moves.
  const pagerRef = useRef(null);

  useEffect(() => {
    document.title = 'ViMusic for Android – free music player, no ads';
  }, []);

  // Loaded here rather than in index.html so the player app doesn't pay for
  // a font it never uses.
  useEffect(() => {
    const links = [
      Object.assign(document.createElement('link'), { rel: 'preconnect', href: 'https://fonts.googleapis.com' }),
      Object.assign(document.createElement('link'), { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' }),
      Object.assign(document.createElement('link'), {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap',
      }),
    ];
    links.forEach((l) => document.head.appendChild(l));
    return () => links.forEach((l) => l.remove());
  }, []);

  // Smooth scrolling, and on desktop a pager: one gesture moves exactly one
  // section, however hard you spin the wheel.
  //
  // Lenis's own snap module was tried first and behaved badly at both ends —
  // a gentle notch snapped straight back, so the page felt stuck, while a
  // hard flick still carried through two sections before settling. Driving
  // the movement directly is deterministic: input picks a direction, and the
  // page animates to the next section and refuses further input until it
  // arrives. ScrollTrigger is updated from Lenis's loop either way, or the
  // pinned phone lags a frame behind what's on screen.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // The pager owns input on every size now, so Lenis is only ever asked to
    // animate the programmatic jumps between sections.
    const lenis = new Lenis({ smoothWheel: false, duration: 1.1 });
    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    let cleanupPager = () => {};

    {
      const sections = Array.from(document.querySelectorAll('[data-snap]'));
      let index = 0;
      let busy = false;

      const goTo = (next) => {
        const target = Math.max(0, Math.min(sections.length - 1, next));
        if (busy || target === index) return;
        index = target;
        busy = true;
        lenis.scrollTo(sections[index], {
          duration: 0.9,
          easing: (t) => 1 - Math.pow(1 - t, 3),
          lock: true,
          onComplete: () => {
            // Short cooldown so the tail of a trackpad flick doesn't
            // immediately count as a second gesture.
            window.setTimeout(() => { busy = false; }, 140);
          },
        });
      };

      pagerRef.current = (el) => goTo(sections.indexOf(el));

      const onWheel = (e) => {
        e.preventDefault();
        if (busy || Math.abs(e.deltaY) < 4) return;
        goTo(index + (e.deltaY > 0 ? 1 : -1));
      };

      const onKey = (e) => {
        const forward = ['ArrowDown', 'PageDown', ' ', 'Spacebar'];
        const back = ['ArrowUp', 'PageUp'];
        if (forward.includes(e.key)) { e.preventDefault(); goTo(index + 1); }
        else if (back.includes(e.key)) { e.preventDefault(); goTo(index - 1); }
        else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
        else if (e.key === 'End') { e.preventDefault(); goTo(sections.length - 1); }
      };

      // Touch gets the same one-section-per-gesture treatment. touchmove is
      // swallowed so the page can't free-scroll underneath the pager, and the
      // direction is decided on release from the total travel.
      let touchStartY = 0;
      const onTouchStart = (e) => { touchStartY = e.touches[0].clientY; };
      const onTouchMove = (e) => { if (e.cancelable) e.preventDefault(); };
      const onTouchEnd = (e) => {
        if (busy) return;
        const travelled = touchStartY - e.changedTouches[0].clientY;
        if (Math.abs(travelled) < 40) return; // a tap or a stray nudge
        goTo(index + (travelled > 0 ? 1 : -1));
      };

      window.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('keydown', onKey);
      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd);
      cleanupPager = () => {
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
        pagerRef.current = null;
      };
    }

    return () => {
      cleanupPager();
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      // One orchestrated arrival, then the page stays still until you act.
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from('.al-hero-copy > *', { y: 26, opacity: 0, duration: 0.7, stagger: 0.09 })
        .from('.al-phone', { y: 40, opacity: 0, scale: 0.97, duration: 0.9 }, 0.15)
        .from('.al-rail button', { opacity: 0, x: -8, duration: 0.5, stagger: 0.05 }, 0.4);

      // The signature scroll moment, on every size: the phone holds still
      // while the feature list advances, swapping the screen to whichever
      // feature you're on.
      featureRefs.current.forEach((el, i) => {
        if (!el) return;
        ScrollTrigger.create({
          trigger: el,
          start: 'top 50%',
          end: 'bottom 50%',
          onEnter: () => setActiveFeature(i),
          onEnterBack: () => setActiveFeature(i),
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  const jumpTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Route through the pager when it's running, otherwise its idea of the
    // current section would drift out of step with the page.
    if (pagerRef.current) pagerRef.current(el);
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="al" ref={rootRef}>
      <a className="al-badge" href={WEB_APP_URL}>
        <span className="al-badge-dot" aria-hidden="true" />
        ViMusic <em>v{VERSION}</em>
      </a>

      <nav className="al-rail" aria-label="Sections">
        {FEATURES.map((f, i) => (
          <button
            key={f.id}
            type="button"
            data-active={activeFeature === i}
            onClick={() => jumpTo(f.id)}
          >
            {f.label}
          </button>
        ))}
      </nav>

      <main className="al-main">
        <header className="al-hero al-wrap" data-snap ref={heroRef}>
          <div className="al-hero-copy">
            <h1>Every song you want, without the ads.</h1>
            <p>
              ViMusic is a free music player for Android. Stream anything, keep playlists
              and favourites, read lyrics in time with the track, and play the files
              already on your phone — with nothing to subscribe to.
            </p>
            <div className="al-actions">
              <a className="al-cta" href={APK_URL}>
                Download the APK
              </a>
              <span className="al-meta">
                v{VERSION} · updates itself once installed
                <br />
                <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">All releases</a>
              </span>
            </div>
          </div>

          <div className="al-hero-visual">
            <div className="al-phone">
              <span className="al-glow" aria-hidden="true" />
              <div className="al-phone-screen">
                <img src="/images/lyrics.jpeg" alt="ViMusic playing a song with synced lyrics" data-current="true" width="720" height="1600" />
              </div>
            </div>
          </div>
        </header>

        <section className="al-features">
          <div className="al-wrap">
            <h2 className="al-features-head">Everything a music player should have already done.</h2>

            <div className="al-features-grid">
              <div className="al-sticky">
                <div className="al-phone">
                  <span className="al-glow" />
                  <div className="al-phone-screen">
                    {FEATURES.map((f, i) => (
                      <img
                        key={f.id}
                        src={f.shot}
                        alt=""
                        data-current={activeFeature === i}
                        loading={i === 0 ? 'eager' : 'lazy'}
                        width="720"
                        height="1600"
                      />
                    ))}
                  </div>
                </div>

                {/* Mobile only. The copy is pinned alongside the phone and
                    cross-fades in place, rather than scrolling up behind it.
                    The in-flow copy in the list below is hidden there, so
                    only one of the two is ever rendered per breakpoint. */}
                <div className="al-pinned-copy">
                  {FEATURES.map((f, i) => (
                    <div key={f.id} className="al-pinned-item" data-current={activeFeature === i}>
                      <h3>{f.title}</h3>
                      <p>{f.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="al-feature-list">
                {FEATURES.map((f, i) => (
                  <article
                    key={f.id}
                    id={f.id}
                    className="al-feature"
                    data-snap
                    data-active={activeFeature === i}
                    ref={(el) => { featureRefs.current[i] = el; }}
                  >
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="al-end" data-snap>
        <section className="al-download">
          <div className="al-wrap">
            <h2>Get ViMusic</h2>
            <p>
              One tap starts the download. Once it's installed the app checks for
              new versions on its own, so this is the only time you'll come here.
            </p>
            <a className="al-cta" href={APK_URL}>
              Download ViMusic {VERSION}
            </a>

            <ul className="al-steps">
              <li>
                <b>Download</b>
                Tap the button above and keep the .apk.
              </li>
              <li>
                <b>Allow the install</b>
                Android asks once before installing apps from outside the Play Store.
              </li>
              <li>
                <b>Get past Play Protect</b>
                It flags apps it hasn't seen before. Choose Install anyway, or switch it
                off under Play Store → Profile → Play Protect.
              </li>
              <li>
                <b>Open it</b>
                Sign in only if you want the same library on the web.
              </li>
            </ul>
          </div>
        </section>

          <footer className="al-foot al-wrap">
          <span className="al-foot-credits">
            <span>Inspired by <a href="https://github.com/vfsfitvnm/ViMusic" target="_blank" rel="noopener noreferrer">vfsfitvnm/ViMusic</a></span>
            <span>Lyrics by <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer">LRCLIB</a></span>
          </span>
          <span className="al-foot-made">
            Made with ❤️ by{' '}
            <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">abshetty</a>
          </span>

          <span>
            <a href={WEB_APP_URL}>Web app</a>
            {' · '}
            <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">Source</a>
          </span>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default AndroidLanding;
