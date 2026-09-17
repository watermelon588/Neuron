import PulseNav from './PulseNav';
import PulseFooter from './PulseFooter';

/**
 * Page frame for every screen on the Pulse design system:
 * grain overlay, fixed nav with the phone side-nav, and the footer.
 * Pages render their sections as children.
 */
export default function PulseLayout({ children, footer = true, className = '' }) {
    return (
        <div className={`pulse ${className}`.trim()}>
            <div className="p-grain" aria-hidden="true" />
            <PulseNav />
            <main id="main">{children}</main>
            {footer && <PulseFooter />}
        </div>
    );
}
