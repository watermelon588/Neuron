import { useRef } from 'react';
import PulseLayout from './PulseLayout';
import { gsap, useGsap } from '../../hooks/useGsap';
import sidePhoto from '../../assets/home/docs-book.webp';

/** Split auth frame: form on the left, photograph on the right (desktop). */
export function AuthShell({ title, subtitle, children, aside }) {
    const rootRef = useRef(null);

    useGsap((c) => {
        if (!c.motion) return;
        gsap.timeline({ defaults: { ease: 'expo.out' } })
            .from('.a-title', { yPercent: 100, fontStretch: '62%', duration: 1.1 })
            .from('.a-form > *, .a-sub, .a-foot', { y: 20, opacity: 0, duration: 0.7, stagger: 0.05 }, 0.2)
            .from('.a-photo', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: 'expo.inOut' }, 0)
            .from('.a-photo img', { scale: 1.25, duration: 1.6 }, 0);
    }, rootRef);

    return (
        <PulseLayout footer={false}>
            <section ref={rootRef} className="a-shell">
                <div className="a-panel">
                    <div className="a-inner">
                        <h1 className="a-title-wrap"><span className="a-title">{title}</span></h1>
                        <p className="a-sub">{subtitle}</p>
                        {children}
                    </div>
                </div>
                <figure className="a-photo" aria-hidden="true">
                    <img src={sidePhoto} alt="" />
                    <figcaption className="a-quote">
                        {aside || 'Upload a document, ask a question, and jump straight to the passage that answers it.'}
                    </figcaption>
                </figure>
            </section>
        </PulseLayout>
    );
}

export function FormError({ message }) {
    if (!message) return null;
    return (
        <p className="p-alert" role="alert">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {message}
        </p>
    );
}

export function Field({ label, id, hint, ...props }) {
    return (
        <div className="p-field">
            <label htmlFor={id}>{label}</label>
            <input id={id} className="p-input" {...props} />
            {hint && <span className="p-hint">{hint}</span>}
        </div>
    );
}

export function SubmitButton({ children, busy }) {
    return (
        <button type="submit" className="p-btn p-btn-accent p-btn-lg a-submit" disabled={busy}>
            {busy ? <><i className="fa-solid fa-circle-notch p-spin" aria-hidden="true" /> Please wait</> : children}
        </button>
    );
}
