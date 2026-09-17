import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setPendingFiles, clearPendingFiles } from '../fileStore';
import { transcribe as transcribeApi } from '../services/searchApi';

/* Recording formats in preference order. We must record in a container the
   browser actually supports AND label the Blob/file with that same type —
   forcing "audio/webm" onto e.g. Safari's MP4 output produces a file the
   server cannot decode, which is why playback and transcription both failed. */
const AUDIO_FORMATS = [
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/webm', ext: 'webm' },
    { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
    { mime: 'audio/mp4', ext: 'm4a' },
    { mime: 'audio/mpeg', ext: 'mp3' },
];

function pickAudioFormat() {
    if (typeof MediaRecorder === 'undefined') return null;
    for (const format of AUDIO_FORMATS) {
        if (MediaRecorder.isTypeSupported?.(format.mime)) return format;
    }
    // Let the browser choose; we still need a sane extension for the upload.
    return { mime: '', ext: 'webm' };
}

/* ─── Upload type definitions ───────────────────────────────────── */
const UPLOAD_TYPES = [
    { id: 'all', accept: 'image/*,video/*,audio/*', title: 'Any media file', faClass: 'fa-solid fa-paperclip' },
    { id: 'image', accept: 'image/*', title: 'Image', faClass: 'fa-regular fa-image' },
    { id: 'video', accept: 'video/*', title: 'Video', faClass: 'fa-solid fa-film' },
    { id: 'audio', accept: 'audio/*', title: 'Audio', faClass: 'fa-solid fa-microphone-lines' },
];

/* Stable-ish id for attachment tracking. */
function makeId() {
    return (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
}

function fileKind(file) {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';
    return 'file';
}

/* ═══ SEARCHBAR ════════════════════════════════════════════════════ */
export default function SearchBar({ compact = false, initialQuery = '', loading: externalLoading = false, autoFocus = false, id = 'neuron-search' }) {
    const [query, setQuery] = useState(initialQuery);
    // Each attachment: { id, file, previewUrl (images only), kind }
    const [attachments, setAttachments] = useState([]);
    const [focused, setFocused] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    // Voice Modal State
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioURL, setAudioURL] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioInstance, setAudioInstance] = useState(null);
    const [voiceError, setVoiceError] = useState(null);
    const [transcribing, setTranscribing] = useState(false);
    // Live input level (0–1) so the user can *see* whether the mic hears them,
    // plus which device the browser actually picked and how loud the take was.
    const [micLevel, setMicLevel] = useState(0);
    const [micLabel, setMicLabel] = useState('');
    const [micMuted, setMicMuted] = useState(false);
    const [clipInfo, setClipInfo] = useState(null);   // { durationMs, peak }

    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const menuRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const formatRef = useRef(null);
    const audioCtxRef = useRef(null);
    const rafRef = useRef(null);
    const peakRef = useRef(0);
    const startedAtRef = useRef(0);

    const hasFiles = attachments.length > 0;

    /* Release the microphone — the recording indicator stays on until every
       track is stopped, so this must run on every exit path. */
    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }, []);

    /* Tear down the level meter's AudioContext / rAF loop. Safe to call twice. */
    const stopMeter = useCallback(() => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => { /* already closed */ });
            audioCtxRef.current = null;
        }
        setMicLevel(0);
    }, []);

    /* Tap the live stream with an AnalyserNode and publish an RMS level each
       frame. This is the only way to tell "mic is muted / wrong device" apart
       from "server didn't understand me" — a silent take looks identical
       otherwise, and Opus compresses silence down to a couple of KB. */
    const startMeter = useCallback((stream) => {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            audioCtxRef.current = ctx;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            ctx.createMediaStreamSource(stream).connect(analyser);
            const buf = new Float32Array(analyser.fftSize);

            const tick = () => {
                analyser.getFloatTimeDomainData(buf);
                let sum = 0;
                for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
                const rms = Math.sqrt(sum / buf.length);
                if (rms > peakRef.current) peakRef.current = rms;
                // Real samples are arriving — whatever the track flag said, the
                // mic is live, so retract the mute warning.
                if (rms > 0.005) setMicMuted(false);
                // Scale for display: normal speech sits around 0.05–0.2 RMS.
                setMicLevel(Math.min(1, rms * 8));
                rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
        } catch (err) {
            console.warn('Level meter unavailable:', err);
        }
    }, []);

    /* ── close menu on outside click ────────────────────────────── */
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target) && !event.target.closest('.p-plus')) {
                setShowMenu(false);
            }
        }
        function handleKey(event) { if (event.key === 'Escape') setShowMenu(false); }
        if (showMenu) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKey);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKey);
        };
    }, [showMenu]);

    /* ── revoke ALL preview object URLs on unmount ──────────────── */
    useEffect(() => {
        return () => {
            attachments.forEach(a => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
            if (audioURL) URL.revokeObjectURL(audioURL);
            // Never leave the mic hot after the component goes away.
            streamRef.current?.getTracks().forEach(track => track.stop());
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            audioCtxRef.current?.close().catch(() => { /* already closed */ });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── append chosen Files (multiple) ─────────────────────────── */
    const applyFiles = useCallback((selectedList) => {
        const incoming = Array.from(selectedList || []).filter(Boolean);
        if (!incoming.length) return;
        setAttachments(prev => [
            ...prev,
            ...incoming.map(file => ({
                id: makeId(),
                file,
                kind: fileKind(file),
                previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
            })),
        ]);
    }, []);

    /* ── remove a single attachment ─────────────────────────────── */
    const removeFile = useCallback((id) => {
        setAttachments(prev => {
            const target = prev.find(a => a.id === id);
            if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
            const next = prev.filter(a => a.id !== id);
            if (!next.length) clearPendingFiles();
            return next;
        });
    }, []);

    /* ── icon button click ──────────────────────────────────────── */
    const handleUploadClick = (type) => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = type.accept;
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e) => {
        applyFiles(e.target.files);
        e.target.value = '';
    };

    /* ── mic click handler ──────────────────────────────────────── */
    const handleMicClick = async () => {
        if (audioInstance) {
            audioInstance.pause();
            setAudioInstance(null);
        }
        setIsPlaying(false);
        setAudioBlob(null);
        setVoiceError(null);
        setTranscribing(false);
        setClipInfo(null);
        setMicLabel('');
        setMicMuted(false);
        peakRef.current = 0;
        if (audioURL) { URL.revokeObjectURL(audioURL); setAudioURL(null); }

        setShowVoiceModal(true);

        // getUserMedia only exists in a secure context. Over plain HTTP on a
        // LAN address `navigator.mediaDevices` is undefined, which previously
        // surfaced as a misleading "permission denied".
        if (!navigator.mediaDevices?.getUserMedia) {
            setVoiceError(
                window.isSecureContext
                    ? 'This browser does not support audio recording.'
                    : 'Recording needs a secure context. Open the app on http://localhost or over HTTPS.'
            );
            return;
        }

        try {
            // Ask for raw-ish audio: aggressive noise suppression on some
            // Windows drivers gates quiet speech down to digital silence.
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: false,
                    autoGainControl: true,
                },
            });
            streamRef.current = stream;

            const track = stream.getAudioTracks()[0];
            setMicLabel(track?.label || 'Default microphone');
            console.info('[voice] input device:', track?.label, track?.getSettings?.());
            // `track.muted` means the OS is delivering no samples (hardware mute
            // switch, or the device muted in Windows sound settings). It can read
            // true for a beat right after acquisition, so treat it as a live
            // warning that clears itself rather than a hard error.
            if (track) {
                setMicMuted(track.muted);
                track.onmute = () => { console.warn('[voice] track muted by OS'); setMicMuted(true); };
                track.onunmute = () => { console.info('[voice] track unmuted'); setMicMuted(false); };
            }
            startMeter(stream);

            const format = pickAudioFormat();
            formatRef.current = format;
            const recorder = format?.mime
                ? new MediaRecorder(stream, { mimeType: format.mime })
                : new MediaRecorder(stream);

            const chunks = [];
            chunksRef.current = chunks;

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            recorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                setVoiceError('Recording failed. Please try again.');
                setIsRecording(false);
                stopMeter();
                stopStream();
            };

            recorder.onstop = () => {
                // Always release the mic, even when the take was empty.
                const peak = peakRef.current;
                const durationMs = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
                stopMeter();
                stopStream();

                // Use the recorder's actual mimeType so the Blob is labelled
                // with the container that was really produced.
                const type = recorder.mimeType || format?.mime || 'audio/webm';
                const blob = new Blob(chunks, { type });
                setClipInfo({ durationMs, peak });
                console.info('[voice] take:', {
                    mimeType: type, bytes: blob.size, durationMs, peakRms: peak.toFixed(4),
                });

                if (blob.size === 0) {
                    setVoiceError('No audio was captured. Check your microphone and try again.');
                    return;
                }

                // Diagnose locally instead of burning a round-trip on a clip
                // that Whisper can only answer with "no speech detected".
                if (durationMs > 0 && durationMs < 700) {
                    setVoiceError('That take was under a second — hold the record button a little longer.');
                } else if (peak < 0.01) {
                    setVoiceError(
                        `The microphone captured near-silence (peak ${(peak * 100).toFixed(1)}%). ` +
                        `Check that “${track?.label || 'your mic'}” is the right input, is unmuted, ` +
                        'and that its input volume is up in Windows sound settings.'
                    );
                }

                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioURL(url);

                const newAudio = new Audio(url);
                newAudio.onended = () => setIsPlaying(false);
                newAudio.onerror = () => setVoiceError('This clip could not be played back.');
                setAudioInstance(newAudio);
            };

            // A timeslice makes the recorder emit chunks as it goes, so a very
            // short take still yields data instead of an empty blob.
            recorder.start(250);
            startedAtRef.current = Date.now();
            setMediaRecorder(recorder);
            setIsRecording(true);
        } catch (err) {
            console.error('Mic error:', err);
            stopMeter();
            stopStream();
            setVoiceError(
                err?.name === 'NotAllowedError'
                    ? 'Microphone permission was denied. Allow mic access in your browser settings.'
                    : err?.name === 'NotFoundError'
                        ? 'No microphone was found on this device.'
                        : 'Could not start recording. Please try again.'
            );
        }
    };

    /* ── stop recording ─────────────────────────────────────────── */
    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            // Flush any buffered audio before the final ondataavailable.
            try { mediaRecorder.requestData?.(); } catch { /* not fatal */ }
            mediaRecorder.stop();
            setIsRecording(false);
        }
    };

    /* ── playback (handles the rejected play() promise) ─────────── */
    const togglePlayback = () => {
        if (!audioInstance) return;
        if (isPlaying) {
            audioInstance.pause();
            setIsPlaying(false);
            return;
        }
        audioInstance.play().then(
            () => setIsPlaying(true),
            (err) => {
                console.error('Playback failed:', err);
                setVoiceError('Playback was blocked by the browser.');
                setIsPlaying(false);
            },
        );
    };

    /* ── transcribe the take and drop the text into the query ───── */
    const useAsText = async () => {
        if (!audioBlob || transcribing) return;
        setTranscribing(true);
        setVoiceError(null);
        try {
            const ext = formatRef.current?.ext || 'webm';
            const file = new File([audioBlob], `recording.${ext}`, { type: audioBlob.type });
            const { text } = await transcribeApi(file);
            setQuery(prev => (prev.trim() ? `${prev.trim()} ${text}` : text));
            closeVoiceModal();
        } catch (err) {
            setVoiceError(err.message || 'Could not transcribe that recording.');
        } finally {
            setTranscribing(false);
        }
    };

    /* ── tidy teardown shared by cancel / escape / success ──────── */
    const closeVoiceModal = useCallback(() => {
        setShowVoiceModal(false);
        setIsPlaying(false);
        setVoiceError(null);
        setTranscribing(false);
        if (audioInstance) audioInstance.pause();
        setAudioInstance(null);
        setAudioBlob(null);
        if (audioURL) { URL.revokeObjectURL(audioURL); setAudioURL(null); }
        setMediaRecorder(prev => {
            if (prev && prev.state === 'recording') {
                try { prev.stop(); } catch { /* already stopped */ }
            }
            return null;
        });
        setIsRecording(false);
        setClipInfo(null);
        setMicMuted(false);
        stopMeter();
        stopStream();
    }, [audioInstance, audioURL, stopStream, stopMeter]);

    /* ── drag & drop ────────────────────────────────────────────── */
    const handleDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        applyFiles(e.dataTransfer.files);
    };

    /* ── submit ─────────────────────────────────────────────────── */
    // The Search page owns the API call; the bar hands over the query text
    // (route state) and the File objects (in-memory fileStore).
    const handleSubmit = (e) => {
        e?.preventDefault();

        const q = (query || "").trim();
        if (!q && !hasFiles) return;

        const files = attachments.map(a => a.file);
        if (files.length) setPendingFiles(files);

        navigate("/search", {
            state: {
                query: q,
                files: attachments.map(a => ({ name: a.file.name, type: a.file.type })),
                at: Date.now(), // makes re-submitting the same query re-fetch
            },
        });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const isSubmitting = externalLoading;
    const canSubmit = (!!query.trim() || hasFiles) && !isSubmitting;

    const kindIcon = (kind) =>
        kind === 'audio' ? 'fa-solid fa-microphone'
            : kind === 'video' ? 'fa-solid fa-film'
                : 'fa-solid fa-file';

    const meterWeights = [0.5, 0.8, 1, 0.9, 0.65];
    const noteTone = micMuted ? 'warn' : micLevel > 0.06 ? 'ok' : undefined;

    return (
        <>
            <form
                role="search"
                className={`p-search${compact ? ' p-search--compact' : ''}`}
                onSubmit={handleSubmit}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
                onDrop={handleDrop}
            >
                <input type="file" multiple ref={fileInputRef} hidden onChange={handleFileChange} />

                <div className="p-search-box" data-focused={focused} data-dragging={dragging}>
                    {hasFiles && (
                        <ul className="p-attachments" aria-label="Attached files" style={{ listStyle: 'none', margin: 0 }}>
                            {attachments.map(att => (
                                <li key={att.id} className="p-attach">
                                    <span className="p-attach-thumb">
                                        {att.previewUrl
                                            ? <img src={att.previewUrl} alt="" />
                                            : <i className={kindIcon(att.kind)} aria-hidden="true" />}
                                    </span>
                                    <span className="p-attach-name" title={att.file.name}>{att.file.name}</span>
                                    <button
                                        type="button"
                                        className="p-attach-remove"
                                        onClick={() => removeFile(att.id)}
                                        aria-label={`Remove ${att.file.name}`}
                                    >
                                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="p-search-row">
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                className="p-icon-btn p-plus"
                                onClick={() => setShowMenu(prev => !prev)}
                                aria-label="Attach an image, video or audio file"
                                aria-haspopup="menu"
                                aria-expanded={showMenu}
                            >
                                <i className="fa-solid fa-plus" aria-hidden="true" />
                            </button>
                            {showMenu && (
                                <div ref={menuRef} className="p-menu" role="menu">
                                    {UPLOAD_TYPES.map(type => (
                                        <button
                                            key={type.id}
                                            type="button"
                                            role="menuitem"
                                            onClick={() => { handleUploadClick(type); setShowMenu(false); }}
                                        >
                                            <i className={type.faClass} aria-hidden="true" />
                                            {type.title}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <label htmlFor={id} className="p-sr-only">Search the web</label>
                        <input
                            id={id}
                            type="search"
                            className="p-search-input"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            placeholder={hasFiles ? 'Add words to refine your files' : 'Ask anything, or drop in a file'}
                            autoComplete="off"
                            enterKeyHint="search"
                            autoFocus={autoFocus}
                        />

                        <button type="button" className="p-icon-btn" onClick={handleMicClick} aria-label="Search by voice">
                            <i className="fa-solid fa-microphone" aria-hidden="true" />
                        </button>

                        <button type="submit" className="p-search-submit" disabled={!canSubmit} aria-label="Search">
                            {isSubmitting
                                ? <i className="fa-solid fa-circle-notch p-spin" aria-hidden="true" />
                                : <i className="fa-solid fa-arrow-right" aria-hidden="true" />}
                            {!compact && <span className="p-search-submit-label">Search</span>}
                        </button>
                    </div>

                    {dragging && (
                        <div className="p-drop-hint">
                            <span><i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" /> Drop to attach</span>
                        </div>
                    )}
                </div>
            </form>

            {showVoiceModal && (
                <div
                    className="p-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="p-voice-title"
                    onKeyDown={(e) => { if (e.key === 'Escape') closeVoiceModal(); }}
                >
                    <div className="p-modal-card">
                        {!audioBlob ? (
                            <>
                                <div className="p-meter" aria-hidden="true">
                                    {meterWeights.map((w, i) => (
                                        <i key={i} style={{ transform: `scaleY(${isRecording ? Math.max(0.08, micLevel * w) : 0.08})` }} />
                                    ))}
                                </div>
                                <h3 id="p-voice-title">
                                    {voiceError ? 'Can’t record' : isRecording ? 'Listening' : 'Connecting'}
                                </h3>
                                {isRecording && (
                                    <p className="p-modal-note" data-tone={noteTone} aria-live="polite">
                                        {micMuted
                                            ? 'Windows is sending no audio from this mic. Unmute it in Settings > System > Sound > Input, or on your headset.'
                                            : micLevel > 0.06 ? 'Hearing you' : 'No sound yet. Try speaking up.'}
                                        {micLabel && <span className="p-mono p-dim" style={{ display: 'block', marginTop: 4 }}>{micLabel}</span>}
                                    </p>
                                )}
                                {voiceError && <p className="p-modal-error" role="alert">{voiceError}</p>}
                                {voiceError ? (
                                    <div className="p-modal-actions">
                                        <button type="button" className="p-btn p-btn-accent" onClick={closeVoiceModal} autoFocus>Close</button>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            className="p-rec-btn"
                                            onClick={stopRecording}
                                            disabled={!isRecording}
                                            aria-label="Stop recording"
                                            autoFocus
                                        >
                                            <span />
                                        </button>
                                        <button type="button" className="p-text-btn" onClick={closeVoiceModal}>Cancel</button>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <h3 id="p-voice-title">Your recording</h3>
                                <div className="p-clip">
                                    <button type="button" onClick={togglePlayback} aria-label={isPlaying ? 'Pause' : 'Play recording'}>
                                        <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`} aria-hidden="true" />
                                    </button>
                                    <span>
                                        {isPlaying ? 'Playing' : 'Tap to play'}
                                        <span className="p-mono p-dim" style={{ display: 'block' }}>
                                            {Math.max(1, Math.round(audioBlob.size / 1024))} KB
                                            {clipInfo?.durationMs ? `, ${(clipInfo.durationMs / 1000).toFixed(1)}s` : ''}
                                            {clipInfo ? `, peak ${(clipInfo.peak * 100).toFixed(0)}%` : ''}
                                        </span>
                                    </span>
                                </div>
                                {voiceError && <p className="p-modal-error" role="alert">{voiceError}</p>}
                                <div className="p-modal-actions">
                                    <button type="button" className="p-btn p-btn-accent" onClick={useAsText} disabled={transcribing} autoFocus>
                                        {transcribing
                                            ? <><i className="fa-solid fa-circle-notch p-spin" aria-hidden="true" /> Transcribing</>
                                            : <><i className="fa-solid fa-font" aria-hidden="true" /> Use as text</>}
                                    </button>
                                    <div className="p-row">
                                        <button type="button" className="p-btn p-btn-ghost" onClick={closeVoiceModal}>Cancel</button>
                                        <button
                                            type="button"
                                            className="p-btn p-btn-ghost"
                                            onClick={() => {
                                                const ext = formatRef.current?.ext || 'webm';
                                                const audioFile = new File([audioBlob], `recording.${ext}`, { type: audioBlob.type });
                                                applyFiles([audioFile]);
                                                closeVoiceModal();
                                            }}
                                        >
                                            Attach clip
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
