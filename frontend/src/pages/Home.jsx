import PulseLayout from '../components/pulse/PulseLayout';
import HomeHero from './home/HomeHero';
import FormatBand from './home/FormatBand';
import PipelinePan from './home/PipelinePan';
import DocsSection from './home/DocsSection';
import SystemBento from './home/SystemBento';
import CloseCta from './home/CloseCta';
import './home/home.css';

/**
 * Landing page on the Pulse design system.
 *   hero (search) -> formats marquee -> pipeline (pinned pan)
 *   -> document chat -> system bento -> closing CTA
 */
export default function Home() {
    return (
        <PulseLayout>
            <HomeHero />
            <FormatBand />
            <PipelinePan />
            <DocsSection />
            <SystemBento />
            <CloseCta />
        </PulseLayout>
    );
}
