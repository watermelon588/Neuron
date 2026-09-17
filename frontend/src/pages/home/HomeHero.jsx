import { useRef } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from '../../components/SearchBar';
import WhyPanel from './WhyPanel';
import { gsap, SplitText, useFontsReady, useGsap } from '../../hooks/useGsap';
import heroScan from '../../assets/home/hero-scan.webp';
import eyeLoop from '../../assets/home/eye-loop.mp4';
import eyePoster from '../../assets/home/eye-poster.webp';

export default function HomeHero() {
    const rootRef = useRef(null);
    const fontsReady = useFontsReady();

    useGsap((c) => {
        const root = rootRef.current;
        if (!fontsReady) return undefined;
        root.dataset.intro = 'done';
        if (!c.motion) return undefined;

        const cleanups = [];
        const split = SplitText.create('.h-title', { type: 'chars', charsClass: 'h-ch' });
        const chars = split.chars;

        // Intro: characters rise and open from condensed to wide.
        gsap.timeline({ defaults: { ease: 'expo.out' } })
            .from(chars, { yPercent: 115, fontStretch: '62%', duration: 1.2, stagger: 0.028 })
            .from('.h-sub', { y: 24, opacity: 0, duration: 0.9 }, 0.5)
            .from('.h-search', { y: 24, opacity: 0, duration: 0.9 }, 0.62)
            .from('.h-alt', { opacity: 0, duration: 0.8 }, 0.85)
            .from('.h-main', { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut' }, 0)
            .from('.h-main img', { scale: 1.35, duration: 1.8 }, 0)
            .from('.h-pip', { y: 80, opacity: 0, duration: 1.1 }, 0.6)
            .from('.h-audio', { x: -30, opacity: 0, duration: 0.9 }, 0.8)
            .from('.h-why', { x: 30, opacity: 0, duration: 0.9 }, 0.9);

        // Persistent: a width pulse travels through the headline.
        const pulse = gsap.timeline({ repeat: -1, repeatDelay: 3, delay: 2.6 })
            .to(chars, {
                fontStretch: '74%', duration: 0.45, ease: 'sine.inOut',
                stagger: { each: 0.05, yoyo: true, repeat: 1 },
            });

        // Persistent: the audio input's level bars.
        gsap.to('.h-wave i', {
            scaleY: () => gsap.utils.random(0.2, 1),
            duration: () => gsap.utils.random(0.12, 0.3),
            ease: 'sine.inOut', repeat: -1, repeatRefresh: true,
        });

        if (c.desktop) {
            // Pointer pressure: letters near the cursor condense.
            const title = root.querySelector('.h-title');
            let raf = 0;
            let px = 0;
            const onMove = (e) => {
                px = e.clientX;
                if (raf) return;
                raf = requestAnimationFrame(() => {
                    raf = 0;
                    chars.forEach((ch) => {
                        const r = ch.getBoundingClientRect();
                        const d = Math.min(Math.abs(r.left + r.width / 2 - px), 260);
                        gsap.to(ch, {
                            fontStretch: `${gsap.utils.mapRange(0, 260, 66, 125, d)}%`,
                            duration: 0.5, ease: 'power3.out', overwrite: 'auto',
                        });
                    });
                });
            };
            const onEnter = () => pulse.pause();
            const onLeave = () => gsap.to(chars, {
                fontStretch: '125%', duration: 0.8, ease: 'elastic.out(1, 0.6)', overwrite: 'auto',
                onComplete: () => pulse.restart(true),
            });
            title.addEventListener('pointerenter', onEnter);
            title.addEventListener('pointermove', onMove);
            title.addEventListener('pointerleave', onLeave);
            cleanups.push(() => {
                title.removeEventListener('pointerenter', onEnter);
                title.removeEventListener('pointermove', onMove);
                title.removeEventListener('pointerleave', onLeave);
                cancelAnimationFrame(raf);
            });

            // Depth: the stage drifts slower than the copy as you leave the hero.
            gsap.to('.h-stage', {
                yPercent: -10, ease: 'none',
                scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
            });
        }

        return () => {
            cleanups.forEach((fn) => fn());
            split.revert();
        };
    }, rootRef, [fontsReady]);

    return (
        <section ref={rootRef} className="h-hero p-container" aria-labelledby="home-title">
            <div className="h-copy">
                <h1 id="home-title" className="h-title h-anim p-display">
                    <span className="h-line">Search beyond</span>
                    <span className="h-line p-accent-text">words.</span>
                </h1>
                <p className="h-sub h-anim p-lede">
                    Text, images, audio and video fused into one query. Every result explains why it ranked where it did.
                </p>
                <div className="h-search h-anim">
                    <SearchBar id="home-search" />
                </div>
                <p className="h-alt h-anim">
                    <Link to="/documents" className="p-link">Or ask questions about your own documents</Link>
                </p>
            </div>

            <div className="h-stage h-anim" aria-label="How a multimodal query looks">
                <figure className="h-tile h-main">
                    <img src={heroScan} alt="Portrait with a band of blue light across the eyes, used as an image query" fetchPriority="high" />
                    <figcaption className="h-bar"><span>Query image</span><span>portrait.jpg</span></figcaption>
                </figure>

                <figure className="h-tile h-pip">
                    <video src={eyeLoop} poster={eyePoster} autoPlay muted loop playsInline aria-label="Video input: close up of an eye" />
                    <figcaption className="h-bar"><span>Video</span><span>clip.mp4</span></figcaption>
                </figure>

                <div className="h-audio">
                    <span className="h-wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
                    <span className="p-mono">voice-note.webm</span>
                </div>

                <WhyPanel />
            </div>
        </section>
    );
}
