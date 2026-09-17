import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PulseLayout from '../components/pulse/PulseLayout';
import { useAuth } from '../context/AuthContext';
import * as profileApi from '../services/profileApi';
import { gsap, useGsap } from '../hooks/useGsap';
import './profile/profile.css';

function Status({ toast }) {
    if (!toast) return null;
    if (toast.type === 'error') {
        return <p className="p-alert" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {toast.message}</p>;
    }
    return <p className="pr-ok" role="status"><i className="fa-solid fa-check" aria-hidden="true" /> {toast.message}</p>;
}

function Stat({ label, value }) {
    return (
        <div className="pr-stat">
            <b className="p-mono" data-value={value ?? ''}>{value ?? '-'}</b>
            <span>{label}</span>
        </div>
    );
}

const SECTIONS = [
    { id: 'account', label: 'Account' },
    { id: 'password', label: 'Password' },
    { id: 'history', label: 'Search history' },
    { id: 'saved', label: 'Saved results' },
];

export default function Profile() {
    const { user, updateUser } = useAuth();
    const navigate = useNavigate();
    const rootRef = useRef(null);

    const [stats, setStats] = useState(null);
    const [history, setHistory] = useState([]);
    const [saved, setSaved] = useState([]);
    const [listsLoading, setListsLoading] = useState(true);

    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
    const [profileBusy, setProfileBusy] = useState(false);
    const [profileToast, setProfileToast] = useState(null);
    const [avatarBusy, setAvatarBusy] = useState(false);
    const avatarInputRef = useRef(null);

    const [pwBusy, setPwBusy] = useState(false);
    const [pwToast, setPwToast] = useState(null);
    const [confirmClear, setConfirmClear] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [s, h, sv] = await Promise.all([
                    profileApi.fetchStats().catch(() => null),
                    profileApi.fetchHistory().catch(() => []),
                    profileApi.fetchSaved().catch(() => []),
                ]);
                if (cancelled) return;
                setStats(s);
                setHistory(h || []);
                setSaved(sv || []);
            } finally {
                if (!cancelled) setListsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useGsap((c) => {
        if (!c.motion) return;
        gsap.timeline({ defaults: { ease: 'expo.out' } })
            .from('.pr-name', { yPercent: 100, fontStretch: '62%', duration: 1.1 })
            .from('.pr-avatar', { scale: 0.6, opacity: 0, duration: 0.9 }, 0)
            .from('.pr-sub > *, .pr-stat', { y: 16, opacity: 0, duration: 0.6, stagger: 0.05 }, 0.2);
    }, rootRef);

    // Count the stats up once they arrive.
    useGsap((c) => {
        if (!c.motion || !stats) return;
        gsap.utils.toArray('.pr-stat b').forEach((el) => {
            const end = Number(el.dataset.value);
            if (!Number.isFinite(end) || end === 0) return;
            const counter = { v: 0 };
            gsap.to(counter, {
                v: end, duration: 1.1, ease: 'power2.out',
                onUpdate: () => { el.textContent = Math.round(counter.v); },
            });
        });
    }, rootRef, [stats]);

    async function handleAvatarPick(e) {
        const file = e.target.files?.[0];
        e.target.value = '';           // allow re-picking the same file
        if (!file) return;
        setAvatarBusy(true);
        setProfileToast(null);
        try {
            // Uploads to Cloudinary and persists the URL in one step.
            const url = await profileApi.uploadAvatar(file);
            setAvatarUrl(url);
            updateUser({ ...user, avatar_url: url });
            setProfileToast({ type: 'success', message: 'Photo updated.' });
        } catch (err) {
            setProfileToast({ type: 'error', message: err.message });
        } finally {
            setAvatarBusy(false);
        }
    }

    async function handleAvatarRemove() {
        setAvatarBusy(true);
        setProfileToast(null);
        try {
            const updated = await profileApi.updateProfile({ avatarUrl: null });
            setAvatarUrl('');
            updateUser(updated);
            setProfileToast({ type: 'success', message: 'Photo removed.' });
        } catch (err) {
            setProfileToast({ type: 'error', message: err.message });
        } finally {
            setAvatarBusy(false);
        }
    }

    async function handleProfileSave(e) {
        e.preventDefault();
        setProfileBusy(true);
        setProfileToast(null);
        try {
            const updated = await profileApi.updateProfile({ displayName, bio });
            updateUser(updated);
            setProfileToast({ type: 'success', message: 'Profile updated.' });
        } catch (err) {
            setProfileToast({ type: 'error', message: err.message });
        } finally {
            setProfileBusy(false);
        }
    }

    async function handlePasswordChange(e) {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        const currentPassword = (fd.get('current') || '').toString();
        const newPassword = (fd.get('next') || '').toString();
        const confirm = (fd.get('confirm') || '').toString();
        if (newPassword !== confirm) {
            setPwToast({ type: 'error', message: 'New passwords do not match.' });
            return;
        }
        if (newPassword.length < 8) {
            setPwToast({ type: 'error', message: 'New password must be at least 8 characters.' });
            return;
        }
        setPwBusy(true);
        setPwToast(null);
        try {
            await profileApi.changePassword({ currentPassword, newPassword });
            setPwToast({ type: 'success', message: 'Password changed.' });
            form.reset();
        } catch (err) {
            setPwToast({ type: 'error', message: err.message });
        } finally {
            setPwBusy(false);
        }
    }

    async function removeHistory(id) {
        setHistory(prev => prev.filter(h => h.id !== id));
        try { await profileApi.deleteHistoryEntry(id); } catch { /* ignore */ }
    }

    async function clearAllHistory() {
        setConfirmClear(false);
        setHistory([]);
        try { await profileApi.clearHistory(); } catch { /* ignore */ }
    }

    async function removeSaved(id) {
        setSaved(prev => prev.filter(s => s.id !== id));
        try { await profileApi.deleteSaved(id); } catch { /* ignore */ }
    }

    function rerun(queryText) {
        navigate('/search', { state: { query: queryText, files: [], at: Date.now() } });
    }

    const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
    }) : '';
    const initial = (user?.display_name?.[0] || '?').toUpperCase();

    return (
        <PulseLayout>
            <div ref={rootRef} className="p-container pr-wrap">
                <header className="pr-head">
                    <div className="pr-avatar">
                        {avatarUrl
                            ? <img src={avatarUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                            : <span aria-hidden="true">{initial}</span>}
                    </div>
                    <div className="pr-id">
                        <h1 className="pr-name-wrap"><span className="pr-name">{user?.display_name}</span></h1>
                        <div className="pr-sub">
                            <span className="p-mono">{user?.email}</span>
                            {joined && <span className="p-mono p-dim">Member since {joined}</span>}
                        </div>
                        {user?.bio && <p className="pr-bio">{user.bio}</p>}
                    </div>
                    <div className="pr-stats">
                        <Stat label="Documents" value={stats?.documents} />
                        <Stat label="Chats" value={stats?.chat_sessions} />
                        <Stat label="Searches" value={stats?.searches} />
                        <Stat label="Saved" value={stats?.saved_results} />
                    </div>
                </header>

                <div className="pr-layout">
                    <nav className="pr-nav" aria-label="Profile sections">
                        {SECTIONS.map(s => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
                    </nav>

                    <div className="pr-sections">
                        <section id="account" className="pr-section">
                            <h2>Account</h2>
                            <form className="p-form pr-form" onSubmit={handleProfileSave}>
                                <div className="p-field">
                                    <label htmlFor="pr-name">Display name</label>
                                    <input id="pr-name" className="p-input" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={120} required />
                                </div>
                                <div className="p-field">
                                    <label htmlFor="pr-bio">Bio</label>
                                    <textarea id="pr-bio" className="p-input" rows={3} style={{ resize: 'vertical' }} value={bio} onChange={e => setBio(e.target.value)} maxLength={500} />
                                    <span className="p-hint">Optional, up to 500 characters.</span>
                                </div>
                                <div className="p-field">
                                    <span className="pr-label">Profile photo</span>
                                    <input
                                        ref={avatarInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        hidden
                                        onChange={handleAvatarPick}
                                    />
                                    <div className="pr-photo">
                                        {avatarUrl && <img src={avatarUrl} alt="Current profile" />}
                                        <button type="button" className="p-btn p-btn-ghost" onClick={() => avatarInputRef.current?.click()} disabled={avatarBusy}>
                                            {avatarBusy
                                                ? <><i className="fa-solid fa-circle-notch p-spin" aria-hidden="true" /> Uploading</>
                                                : <><i className="fa-solid fa-image" aria-hidden="true" /> {avatarUrl ? 'Replace photo' : 'Upload photo'}</>}
                                        </button>
                                        {avatarUrl && !avatarBusy && (
                                            <button type="button" className="p-text-btn" onClick={handleAvatarRemove}>Remove</button>
                                        )}
                                    </div>
                                    <span className="p-hint">PNG, JPG, WEBP or GIF, up to 5 MB.</span>
                                </div>
                                <button type="submit" className="p-btn p-btn-accent" disabled={profileBusy}>
                                    {profileBusy ? <><i className="fa-solid fa-circle-notch p-spin" aria-hidden="true" /> Saving</> : 'Save changes'}
                                </button>
                                <Status toast={profileToast} />
                            </form>
                        </section>

                        <section id="password" className="pr-section">
                            <h2>Password</h2>
                            <form className="p-form pr-form" onSubmit={handlePasswordChange}>
                                <div className="p-field">
                                    <label htmlFor="pw-current">Current password</label>
                                    <input id="pw-current" className="p-input" type="password" name="current" autoComplete="current-password" required />
                                </div>
                                <div className="pr-two">
                                    <div className="p-field">
                                        <label htmlFor="pw-next">New password</label>
                                        <input id="pw-next" className="p-input" type="password" name="next" autoComplete="new-password" required minLength={8} />
                                        <span className="p-hint">At least 8 characters.</span>
                                    </div>
                                    <div className="p-field">
                                        <label htmlFor="pw-confirm">Confirm new password</label>
                                        <input id="pw-confirm" className="p-input" type="password" name="confirm" autoComplete="new-password" required minLength={8} />
                                    </div>
                                </div>
                                <button type="submit" className="p-btn p-btn-accent" disabled={pwBusy}>
                                    {pwBusy ? <><i className="fa-solid fa-circle-notch p-spin" aria-hidden="true" /> Saving</> : 'Update password'}
                                </button>
                                <Status toast={pwToast} />
                            </form>
                        </section>

                        <section id="history" className="pr-section">
                            <div className="pr-section-head">
                                <h2>Search history</h2>
                                {history.length > 0 && (confirmClear ? (
                                    <span className="pr-confirm">
                                        <span className="p-hint">Clear all {history.length}?</span>
                                        <button type="button" className="p-btn pr-danger" onClick={clearAllHistory}>Clear</button>
                                        <button type="button" className="p-btn p-btn-ghost" onClick={() => setConfirmClear(false)}>Keep</button>
                                    </span>
                                ) : (
                                    <button type="button" className="p-btn p-btn-ghost" onClick={() => setConfirmClear(true)}>Clear all</button>
                                ))}
                            </div>
                            {listsLoading ? (
                                <div className="pr-list">{[1, 2, 3].map(i => <div key={i} className="pr-row p-skel" style={{ height: 56 }} />)}</div>
                            ) : history.length === 0 ? (
                                <div className="p-empty">
                                    <h3>No searches yet.</h3>
                                    <p>Searches you run while signed in show up here, so you can run them again.</p>
                                </div>
                            ) : (
                                <ul className="pr-list">
                                    {history.map(h => (
                                        <li key={h.id} className="pr-row">
                                            <span className="pr-mod p-mono">{h.modality}</span>
                                            <button type="button" className="pr-query" onClick={() => rerun(h.query_text)} title="Run this search again">
                                                {h.query_text}
                                            </button>
                                            <span className="p-mono p-dim pr-count">{h.result_count} results</span>
                                            <button type="button" className="pr-x" onClick={() => removeHistory(h.id)} aria-label={`Remove ${h.query_text} from history`}>
                                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section id="saved" className="pr-section">
                            <h2>Saved results</h2>
                            {listsLoading ? (
                                <div className="pr-saved">{[1, 2].map(i => <div key={i} className="pr-card p-skel" style={{ height: 88 }} />)}</div>
                            ) : saved.length === 0 ? (
                                <div className="p-empty">
                                    <h3>Nothing saved.</h3>
                                    <p>Use the bookmark button on any search result to keep it here.</p>
                                </div>
                            ) : (
                                <ul className="pr-saved">
                                    {saved.map(s => (
                                        <li key={s.id} className="pr-card">
                                            {(s.image_url || s.thumbnail_url) && (
                                                <img src={s.image_url || s.thumbnail_url} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                            )}
                                            <div className="pr-card-body">
                                                <span className="p-mono p-dim">{s.category}</span>
                                                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a>
                                                {s.source && <span className="p-mono p-dim">{s.source}</span>}
                                            </div>
                                            <button type="button" className="pr-x" onClick={() => removeSaved(s.id)} aria-label={`Remove ${s.title || 'saved result'}`}>
                                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </PulseLayout>
    );
}
