import React, { useState, useEffect, useRef } from 'react';
import syncLearnLogo from './assets/logo.png';
import { socket } from './socket';
import './PreJoinModal.css';

function PreJoinModal({
  isOpen,
  onClose,
  onJoin,
  onOpenSettings,
  user,
  roomId,
  isInstructor = false,
  isStudentJoinLink = false,
  hostName = '',
}) {
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [blurBackground, setBlurBackground] = useState(false);
  const [realName, setRealName] = useState(() => {
    return user?.name || '';
  });
  const [nameError, setNameError] = useState('');
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [admissionStatus, setAdmissionStatus] = useState('idle'); // 'idle' | 'pending' | 'denied'
  const [admissionError, setAdmissionError] = useState('');

  const [resolvedHostName, setResolvedHostName] = useState(() => {
    if (isInstructor) return user?.name || '';
    if (hostName && hostName !== 'Instructor') return hostName;
    const cleanId = (roomId || '').trim();
    return localStorage.getItem('synclearn_host_' + cleanId) || localStorage.getItem('synclearn_host_' + cleanId.replace(/-/g, '')) || '';
  });

  // Keep realName synced if user logs in or switches
  useEffect(() => {
    if (user?.name) {
      setRealName(user.name);
    }
  }, [user?.name]);

  // Resolve instructor name dynamically for student join preview
  useEffect(() => {
    if (!isOpen) return;
    if (isInstructor) {
      setResolvedHostName(user?.name || realName || 'Instructor');
      return;
    }
    if (hostName && hostName !== 'Instructor') {
      setResolvedHostName(hostName);
      return;
    }

    const cleanId = (roomId || '').trim();
    if (!cleanId) return;

    const stored = localStorage.getItem('synclearn_host_' + cleanId) || localStorage.getItem('synclearn_host_' + cleanId.replace(/-/g, ''));
    if (stored) {
      setResolvedHostName(stored);
    }

    const apiBase = '';
    fetch(`${apiBase}/api/v1/rooms/${encodeURIComponent(cleanId)}/info`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.instructorName && data.instructorName !== 'Instructor') {
          setResolvedHostName(data.instructorName);
          try {
            localStorage.setItem('synclearn_host_' + cleanId, data.instructorName);
          } catch(e) {}
        }
      })
      .catch(() => {});
  }, [isOpen, roomId, hostName, isInstructor, user?.name, realName]);

  const [availableMics, setAvailableMics] = useState([]);
  const [availableCams, setAvailableCams] = useState([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCam, setSelectedCam] = useState('');

  const [alwaysShow, setAlwaysShow] = useState(() => {
    return localStorage.getItem('synclearn_always_show_preview') !== 'false';
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize camera & mic preview
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function setupPreviewStream() {
      try {
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (errCombined) {
          // If combined video+audio fails, try audio only then video only
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
            stream = new MediaStream();
            if (audioStream) audioStream.getAudioTracks().forEach((t) => stream.addTrack(t));
            if (videoStream) videoStream.getVideoTracks().forEach((t) => stream.addTrack(t));
          } catch (e) {
            console.warn('Fallback media failed:', e);
          }
        }

        if (!isMounted) {
          if (stream) stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (stream && stream.getTracks().length > 0) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }

          // Apply initial state
          stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
          stream.getVideoTracks().forEach((t) => (t.enabled = videoOn));
        }

        // Enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');

        setAvailableMics(
          audioInputs.length > 0
            ? audioInputs
            : [{ deviceId: 'default', label: 'Built-in Microphone and Speakers' }]
        );
        setAvailableCams(
          videoInputs.length > 0
            ? videoInputs
            : [{ deviceId: 'default', label: 'Integrated Camera' }]
        );

        if (audioInputs[0]?.deviceId) setSelectedMic(audioInputs[0].deviceId);
        if (videoInputs[0]?.deviceId) setSelectedCam(videoInputs[0].deviceId);
      } catch (err) {
        console.warn('Pre-join preview media setup failed (camera/mic permission):', err);
        // Fallback default labels
        setAvailableMics([{ deviceId: 'default', label: 'Built-in Microphone and Speakers' }]);
        setAvailableCams([{ deviceId: 'default', label: 'Integrated Camera' }]);
      }
    }

    setupPreviewStream();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  // Update realName if user changes
  useEffect(() => {
    if (user?.name && !realName) {
      setRealName(user.name);
    }
  }, [user?.name]);

  // Toggle Mic
  const toggleMic = async () => {
    const next = !micOn;
    setMicOn(next);
    let track = streamRef.current?.getAudioTracks()[0];
    if (next && (!track || track.readyState !== 'live')) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newTrack = audioStream.getAudioTracks()[0];
        if (newTrack) {
          newTrack.enabled = true;
          if (!streamRef.current) streamRef.current = new MediaStream();
          streamRef.current.addTrack(newTrack);
        }
      } catch (e) {
        console.warn('Pre-join mic permission error:', e);
      }
    } else if (track) {
      track.enabled = next;
    }
  };

  // Toggle Video
  const toggleVideo = () => {
    setVideoOn((prev) => {
      const next = !prev;
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((t) => (t.enabled = next));
      }
      return next;
    });
  };

  const handleAlwaysShowChange = (e) => {
    const checked = e.target.checked;
    setAlwaysShow(checked);
    localStorage.setItem('synclearn_always_show_preview', checked ? 'true' : 'false');
  };

    // Listen for instructor admission response
  useEffect(() => {
    if (!isOpen) return;

    const handleAdmissionGranted = () => {
      setAdmissionStatus('idle');
      const activeStream = streamRef.current;
      streamRef.current = null;
      if (onJoin) {
        onJoin({
          name: realName.trim() || 'Student',
          micOn,
          videoOn,
          blurBackground,
          initialStream: activeStream
        });
      }
    };

    const handleAdmissionDenied = (data) => {
      setAdmissionStatus('denied');
      setAdmissionError(data?.message || 'The instructor did not allow you to enter this class.');
    };

    const handleRoomLocked = (data) => {
      setAdmissionStatus('denied');
      setAdmissionError(data?.message || 'This room has been locked by the instructor.');
    };

    socket.on('admission-granted', handleAdmissionGranted);
    socket.on('admission-denied', handleAdmissionDenied);
    socket.on('room-locked-error', handleRoomLocked);

    return () => {
      socket.off('admission-granted', handleAdmissionGranted);
      socket.off('admission-denied', handleAdmissionDenied);
      socket.off('room-locked-error', handleRoomLocked);
    };
  }, [isOpen, onJoin, realName, micOn, videoOn, blurBackground]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    // If student, require real name
    const trimmedName = realName.trim();
    if (!isInstructor && !trimmedName) {
      setNameError('Please enter your real name to join the class.');
      return;
    }

    // Unlock Web Audio immediately on user gesture so mobile & desktop speakers are live
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!window.__synclearnGlobalAudioCtx || window.__synclearnGlobalAudioCtx.state === 'closed') {
          window.__synclearnGlobalAudioCtx = new AudioCtx();
        }
        const gCtx = window.__synclearnGlobalAudioCtx;
        if (gCtx.state === 'suspended') {
          gCtx.resume().catch(() => {});
        }
        // Play 1 sample of silence to unlock mobile audio hardware on iOS Safari & Android
        try {
          const silentBuf = gCtx.createBuffer(1, 1, 22050);
          const bSource = gCtx.createBufferSource();
          bSource.buffer = silentBuf;
          bSource.connect(gCtx.destination);
          bSource.start(0);
        } catch(be) {}
      }
    } catch (e) {}

    // If student, verify class passcode token for instant authorized access
    if (!isInstructor) {
      if (!passcode.trim()) {
        setPasscodeError('Please enter the class passcode to join.');
        return;
      }
      if (!socket.connected) {
        socket.connect();
      }
      setAdmissionStatus('pending');
      const cleanR = (roomId || '849-291-034').trim();
      socket.emit('verify-room-passcode', {
        roomId: cleanR,
        passcode: passcode.trim(),
        userName: trimmedName,
        userRole: 'student'
      });
      return;
    }

    // Instructor proceeds immediately
    const activeStream = streamRef.current;
    streamRef.current = null;

    if (onJoin) {
      onJoin({
        name: trimmedName || (isInstructor ? (user?.name || 'Instructor') : 'Student'),
        micOn,
        videoOn,
        blurBackground,
        initialStream: activeStream
      });
    }
  };

  if (!isOpen) return null;

  const meetingHostName = isInstructor
    ? (user?.name || realName || 'Instructor')
    : (resolvedHostName || hostName || 'Instructor');

  const showNameField = !isInstructor || isStudentJoinLink || !user?.name;

  const resolvedTopic = (() => {
    const cleanId = (roomId || '').trim();
    const stored = localStorage.getItem('synclearn_topic_' + cleanId) || 
                   localStorage.getItem('synclearn_topic_' + cleanId.replace(/-/g, '')) || 
                   localStorage.getItem('synclearn_meeting_topic') || '';
    if (stored && stored !== 'Live Classroom' && !stored.startsWith('Live Session') && stored !== 'Untitled Class') {
      return stored.trim();
    }
    return '';
  })();

  return (
    <div className="prejoin-overlay" onClick={onClose}>
      <div className="prejoin-window" onClick={(e) => e.stopPropagation()}>
        {/* ── Window Title Bar (Matching Image 1) ── */}
        <div className="prejoin-titlebar">
          <div className="prejoin-title-left">
            <img src={syncLearnLogo} alt="SyncLearn" className="prejoin-logo-img" />
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span className="prejoin-title-text">{meetingHostName}'s SyncLearn Classroom</span>
              {resolvedTopic && (
                <span style={{ fontSize: '0.72rem', color: '#06b6d4', fontWeight: 600 }}>
                  📚 Topic: {resolvedTopic}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="prejoin-close-btn"
              onClick={() => onOpenSettings && onOpenSettings('general')}
              title="Open Settings"
              style={{ fontSize: '1rem', display: 'flex', alignItems: 'center' }}
            >
              ⚙️
            </button>
            <button
              type="button"
              className="prejoin-close-btn"
              onClick={onClose}
              title="Close Preview"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {admissionStatus === 'pending' ? (
          <div className="prejoin-waiting-room" style={{ padding: '3.5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '90px', height: '90px', marginBottom: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '4px solid #06b6d4', borderTopColor: 'transparent', animation: 'spin 1.2s linear infinite' }} />
              <div style={{ fontSize: '2.6rem' }}>🔐</div>
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0284c7', marginBottom: '0.6rem' }}>
              Verifying Class Passcode...
            </h2>
            <p style={{ fontSize: '0.94rem', color: '#64748b', maxWidth: '440px', lineHeight: 1.6, marginBottom: '1.4rem' }}>
              Validating your secure enrollment token for <strong>{resolvedTopic}</strong> with host <strong>{meetingHostName}</strong>. You will be connected instantly.
            </p>
            <div style={{ background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: '10px', padding: '10px 18px', marginBottom: '2rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: '#0e7490', fontWeight: 600 }}>
                👤 Joining as: <strong>{realName}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAdmissionStatus('idle')}
              style={{
                background: 'transparent',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                padding: '9px 22px',
                color: '#64748b',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        ) : admissionStatus === 'denied' ? (
          <div className="prejoin-waiting-room" style={{ padding: '3.5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)', border: '2px solid #ef4444', marginBottom: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem' }}>
              ❌
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ef4444', marginBottom: '0.6rem' }}>
              Admission Denied
            </h2>
            <p style={{ fontSize: '0.94rem', color: '#64748b', maxWidth: '440px', lineHeight: 1.6, marginBottom: '2rem' }}>
              {admissionError || 'The instructor did not allow you to enter this class.'}
            </p>
            <div style={{ display: 'flex', gap: '14px' }}>
              <button
                type="button"
                onClick={() => setAdmissionStatus('idle')}
                style={{
                  background: '#0284c7',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 22px',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '10px 22px',
                  color: '#64748b',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Return Home
              </button>
            </div>
          </div>
        ) : (
          <div className="prejoin-body">
          {/* Video Preview Viewport */}
          <div className="prejoin-preview-viewport">
            {videoOn && streamRef.current?.getVideoTracks?.().some(t => t.readyState === 'live') ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`prejoin-video-feed ${blurBackground ? 'blurred' : ''}`}
              />
            ) : (
              <div
                className="prejoin-video-off-placeholder"
                onClick={() => onOpenSettings && onOpenSettings('account')}
                style={{ cursor: 'pointer', position: 'relative', width: '100%', height: '100%' }}
                title="Click to add or change profile picture"
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt="Profile"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div className="prejoin-avatar-circle">
                    {(meetingHostName || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  style={{
                    position: 'absolute',
                    bottom: '62px',
                    background: 'rgba(0, 0, 0, 0.78)',
                    color: '#ffffff',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }}
                >
                  📷 {user?.avatar ? 'Change Picture' : 'Add Profile Picture'}
                </span>
              </div>
            )}

            {/* Bottom-Center Floating Audio / Video Pill */}
            <div className="prejoin-overlay-pill">
              <button
                type="button"
                className={`prejoin-pill-btn ${!micOn ? 'muted' : ''}`}
                onClick={toggleMic}
                title={micOn ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                <div className="prejoin-pill-icon">
                  {micOn ? (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444" strokeWidth="2.5" />
                      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" stroke="#ffffff" />
                      <path d="M5 10v2a7 7 0 0 0 12 5" stroke="#ffffff" />
                      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" stroke="#ffffff" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" stroke="#ffffff" />
                    </svg>
                  )}
                </div>
                <span className="prejoin-pill-label">Audio</span>
              </button>

              <button
                type="button"
                className={`prejoin-pill-btn ${!videoOn ? 'muted' : ''}`}
                onClick={toggleVideo}
                title={videoOn ? 'Stop Video' : 'Start Video'}
              >
                <div className="prejoin-pill-icon">
                  {videoOn ? (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7" fill="currentColor" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  ) : (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444" strokeWidth="2.5" />
                      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m4 0h7a2 2 0 0 1 2 2v3.34" stroke="#ffffff" />
                      <polygon points="23 7 16 12 23 17 23 7" stroke="#ffffff" />
                    </svg>
                  )}
                </div>
                <span className="prejoin-pill-label">Video</span>
              </button>
            </div>

            {/* Bottom-Right Floating Backgrounds Button */}
            <button
              type="button"
              className={`prejoin-backgrounds-btn ${blurBackground ? 'active' : ''}`}
              onClick={() => setBlurBackground(!blurBackground)}
              title="Toggle Blur Background Effect"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>Backgrounds</span>
            </button>
          </div>

          {/* ── Dropdowns: Mic & Camera (Matching Image 1) ── */}
          <div className="prejoin-device-row">
            <div className="prejoin-select-wrap">
              <span className="prejoin-device-icon">🎙️</span>
              <select
                className="prejoin-device-select"
                value={selectedMic}
                onChange={(e) => setSelectedMic(e.target.value)}
              >
                {availableMics.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label || 'Built-in Microphone and Speakers'}
                  </option>
                ))}
              </select>
            </div>

            <div className="prejoin-select-wrap">
              <span className="prejoin-device-icon">📹</span>
              <select
                className="prejoin-device-select"
                value={selectedCam}
                onChange={(e) => setSelectedCam(e.target.value)}
              >
                {availableCams.map((c) => (
                  <option key={c.deviceId} value={c.deviceId}>
                    {c.label || 'Integrated Camera'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Student Real Name Input Field (User Requirement) ── */}
          {showNameField && (
            <div className="prejoin-name-section">
              <label className="prejoin-name-label">
                👤 Your Full Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="prejoin-name-input"
                placeholder="Enter your real name to join the class session..."
                value={realName}
                onChange={(e) => {
                  setRealName(e.target.value);
                  if (nameError) setNameError('');
                }}
                autoFocus={!isInstructor}
              />
              {nameError ? (
                <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                  ⚠️ {nameError}
                </span>
              ) : (
                <span className="prejoin-name-hint">
                  Your instructor and peers will identify you by this name in the class session.
                </span>
              )}
            </div>
          )}

          {/* ── Student Passcode / Access Token Input Field (Secure Access Control) ── */}
          {!isInstructor && (
            <div className="prejoin-name-section" style={{ marginTop: 12 }}>
              <label className="prejoin-name-label">
                🔑 Class Passcode / Access Token <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="prejoin-name-input"
                placeholder="Enter class passcode (e.g. JxkYHk) provided by teacher..."
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (passcodeError) setPasscodeError('');
                }}
              />
              {passcodeError ? (
                <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                  ⚠️ {passcodeError}
                </span>
              ) : (
                <span className="prejoin-name-hint">
                  Secure enrollment token: Authorized students with valid token join automatically.
                </span>
              )}
            </div>
          )}

          {/* ── Bottom Controls Row (Matching Image 1) ── */}
          <div className="prejoin-footer-row">
            <label className="prejoin-checkbox-wrap">
              <input
                type="checkbox"
                checked={alwaysShow}
                onChange={handleAlwaysShowChange}
              />
              <span>Always show this preview when joining</span>
              <span className="prejoin-info-icon" title="You can always adjust mic & camera before joining any live session.">ⓘ</span>
            </label>

            <button
              type="button"
              className="prejoin-start-btn"
              onClick={handleSubmit}
            >
              {isInstructor ? 'Start' : 'Join'}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default PreJoinModal;
