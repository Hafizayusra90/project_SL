import React, { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import './DashboardPage.css';
import logoImg from './assets/logo.png';

// ─── Zoom Meeting Helpers ──────────────────────────────────────────────────
const generateZoomMeetingId = () => {
  const p1 = Math.floor(100 + Math.random() * 900);
  const p2 = Math.floor(100 + Math.random() * 900);
  const p3 = Math.floor(100 + Math.random() * 900);
  return `${p1}-${p2}-${p3}`;
};

const getShareableHost = () => {
  if (typeof window === 'undefined') return '10.216.84.64';
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '10.216.84.64';
  }
  return window.location.hostname;
};

const formatMeetingIdWithDashes = (id) => {
  if (!id) return '';
  const str = String(id).trim();
  if (str.includes('-')) return str;
  const digitsOnly = str.replace(/\s+/g, '');
  if (/^\d{9}$/.test(digitsOnly)) {
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 9)}`;
  }
  if (/^\d{10}$/.test(digitsOnly)) {
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`;
  }
  if (/^\d{6}$/.test(digitsOnly)) {
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}`;
  }
  return str;
};

const generateMeetingPasscode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const buildZoomInvitationText = (topic, roomId, instructorName, passcode) => {
  const host = getShareableHost();
  const port = window.location.port || '5173';
  const hostParam = instructorName ? `&host=${encodeURIComponent(instructorName)}` : '';
  const joinUrl = `${window.location.protocol}//${host}:${port}?room=${encodeURIComponent(roomId)}${hostParam}`;
  const displayId = formatMeetingIdWithDashes(roomId);
  const activePasscode = passcode || (roomId ? localStorage.getItem('synclearn_passcode_' + roomId) : '') || generateMeetingPasscode();
  const nowStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return `🎓 SyncLearn Live Classroom Invitation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👨‍🏫 Instructor: ${instructorName || 'Teacher'}
📚 Topic: ${topic || 'Live Interactive Class Session'}
📅 Date: ${nowStr} (Live In Session)

🔗 Join Live Class (Mobile & PC):
${joinUrl}

🆔 Meeting ID: ${displayId}
🔐 Passcode: ${activePasscode}

💡 Student Guidelines:
1. Click the link above or open SyncLearn and enter Meeting ID: ${displayId}
2. Please join 5 minutes early with your camera and microphone enabled.
3. Access real-time dual whiteboard, lecture typing pad, and AI quizzes.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
};

// ─── Zoom-Style Invitation Preview Modal ─────────────────────────────────────
function ClassInviteModal({
  isOpen,
  onClose,
  topic,
  roomId,
  instructorName,
  passcode,
  onCopyInvite,
  onCopyLink,
  onShareWhatsApp,
  onShareEmail
}) {
  if (!isOpen) return null;
  const displayId = formatMeetingIdWithDashes(roomId);
  const activePasscode = passcode || (roomId ? localStorage.getItem('synclearn_passcode_' + roomId) : '') || generateMeetingPasscode();
  const hostParam = instructorName ? `&host=${encodeURIComponent(instructorName)}` : '';
  const joinUrl = `${window.location.origin}?room=${encodeURIComponent(roomId)}${hostParam}`;

  return (
    <div className="invite-modal-overlay" onClick={onClose}>
      <div className="invite-modal-card" onClick={e => e.stopPropagation()}>
        <div className="invite-modal-header">
          <div className="invite-modal-header-left">
            <span className="invite-brand-icon">🎓</span>
            <div>
              <h3>Classroom Meeting Invitation</h3>
              <p>Ready to share with students via WhatsApp, Slack, or Email before class</p>
            </div>
          </div>
          <button type="button" className="invite-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <div className="invite-card-preview">
          <div className="preview-top-badge">
            <span className="pulse-dot">●</span> SyncLearn Virtual Classroom
          </div>
          <h4 className="preview-topic">{topic || 'Live Interactive Class Session'}</h4>
          <div className="preview-meta-row">
            <span>👨‍🏫 Host: <strong>{instructorName || 'Instructor'}</strong></span>
            <span className="preview-live-pill">🟢 Live Session</span>
          </div>

          <div className="preview-box">
            <div className="preview-box-row">
              <span className="preview-box-label">🆔 Meeting ID:</span>
              <span className="preview-box-val">{displayId}</span>
            </div>
            <div className="preview-box-row">
              <span className="preview-box-label">🔗 Direct URL:</span>
              <span className="preview-box-url">{joinUrl}</span>
            </div>
            <div className="preview-box-row">
              <span className="preview-box-label">🔐 Passcode:</span>
              <span className="preview-box-val" style={{ color: '#38bdf8', fontWeight: 800 }}>{activePasscode}</span>
            </div>
          </div>
        </div>

        <div className="invite-modal-actions">
          <button type="button" className="dash-btn dash-primary-btn" onClick={onCopyInvite}>
            📋 Copy Class Invitation
          </button>
          <button type="button" className="dash-btn dash-secondary-btn" onClick={onCopyLink}>
            🔗 Copy Direct Link Only
          </button>
          <button type="button" className="dash-btn dash-whatsapp-btn" onClick={onShareWhatsApp}>
            💬 Share to WhatsApp
          </button>
          <button type="button" className="dash-btn dash-email-btn" onClick={onShareEmail}>
            ✉️ Email to Students
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Instructor Dashboard ─────────────────────────────────────────────────────
function InstructorDashboard({
  user,
  createdRoomId,
  setCreatedRoomId,
  createdPasscode,
  meetingTopic,
  setMeetingTopic,
  handleCreateRoom,
  handleRegenerateCode,
  handleCopyCreatedCode,
  handleCopyCreatedInvite,
  handleCopyZoomInvitation,
  handleShareWhatsApp,
  handleShareEmail,
  onOpenInviteModal,
  handleCopyHistoryLink,
  onJoinRoom,
  onOpenSettings,
  completedSessions = [],
  handleClearSessions,
  showToast,
  handleUploadLectureFile
}) {
  const sessionCount = completedSessions.length;
  const totalStudentsTaught = completedSessions.reduce((acc, curr) => acc + (curr.students || 1), 0);

  const handleDownloadAttendanceReport = (session) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 35;
      let y = 45;

      // Header Banner
      doc.setFillColor(15, 23, 42); // dark navy
      doc.rect(margin, y, pageWidth - margin * 2, 60, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(56, 189, 248); // sky cyan
      doc.text('SYNCLearn Virtual Classroom - Attendance Report', margin + 15, y + 26);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(203, 213, 225);
      doc.text(`Official Session Attendance & Certified Roster • Generated on ${new Date().toLocaleString()}`, margin + 15, y + 45);

      y += 80;

      // Clean Room Code
      const cleanCode = (session.code || 'session').replace(/[^a-zA-Z0-9_-]/g, '');

      // Load raw attendance records
      let rawAttendees = [];
      try {
        const raw = localStorage.getItem('synclearn_attendance_' + cleanCode) 
          || localStorage.getItem('synclearn_attendance_' + (session.code || ''))
          || localStorage.getItem('synclearn_attendance_' + cleanCode.replace(/-/g, ''));
        if (raw) rawAttendees = JSON.parse(raw);
      } catch (e) {}

      // Normalize string helper for deduplication
      const normalizeName = (s) => String(s || '').replace(/\(Instructor\)/gi, '').trim().toLowerCase();

      // Determine Host Name
      const hostRawName = (user?.role === 'instructor' && user?.name) ? user.name : (session.instructor || 'Instructor');
      const hostNorm = normalizeName(hostRawName);

      // Build strictly deduplicated attendee map
      const attendeeMap = new Map();

      // 1. Host is always entered first (only once)
      attendeeMap.set(hostNorm, {
        name: `${hostRawName} (Instructor)`,
        role: 'Instructor / Host',
        join: session.time || '10:00 AM',
        endSession: 'Completed',
        status: 'Host / Present',
        verified: 'Verified'
      });

      // 2. Add other participants from session.participants if available
      if (Array.isArray(session.participants) && session.participants.length > 0) {
        session.participants.forEach((p, idx) => {
          const pName = p.userName || `Student ${idx + 1}`;
          const norm = normalizeName(pName);
          if (norm && !attendeeMap.has(norm)) {
            const isInst = p.userRole === 'instructor' || norm === hostNorm;
            if (!isInst) {
              attendeeMap.set(norm, {
                name: pName,
                role: 'Student',
                join: session.time || '10:00 AM',
                endSession: 'Completed',
                status: 'Present',
                verified: 'Verified'
              });
            }
          }
        });
      }

      // 3. Add stored live attendee entries (updates join/leave times, deduplicates)
      if (Array.isArray(rawAttendees)) {
        rawAttendees.forEach(a => {
          const rawName = a.name || a.userName || a.rawName || '';
          const norm = normalizeName(rawName);
          if (!norm) return;

          const isHost = norm === hostNorm || a.role === 'Instructor' || rawName.includes('(Instructor)') || (a.status && a.status.includes('Host'));

          if (isHost) {
            const hostEntry = attendeeMap.get(hostNorm);
            if (hostEntry) {
              if (a.joinTime || a.join) hostEntry.join = a.joinTime || a.join;
              if (a.leaveTime && a.leaveTime !== '-') hostEntry.endSession = a.leaveTime;
            }
          } else {
            if (!attendeeMap.has(norm)) {
              attendeeMap.set(norm, {
                name: rawName.replace(/\(Instructor\)/gi, '').trim(),
                role: 'Student',
                join: a.joinTime || a.join || session.time || '10:00 AM',
                endSession: (a.leaveTime && a.leaveTime !== '-') ? a.leaveTime : 'Completed',
                status: 'Present',
                verified: a.verified || a.verification || 'Verified'
              });
            } else {
              const existing = attendeeMap.get(norm);
              if (a.joinTime || a.join) existing.join = a.joinTime || a.join;
              if (a.leaveTime && a.leaveTime !== '-') existing.endSession = a.leaveTime;
            }
          }
        });
      }

      const attendeesToRender = Array.from(attendeeMap.values());
      const totalAttendeesCount = attendeesToRender.length;

      // Session Metadata Card
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, y, pageWidth - margin * 2, 75, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Class Topic: ${session.title || 'Live Interactive Classroom'}`, margin + 15, y + 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Room Code: ${session.code}    |    Date & Time: ${session.date} (${session.time || 'Completed'})`, margin + 15, y + 40);
      doc.text(`Host: ${hostRawName}    |    Total Attendees: ${totalAttendeesCount} participant(s)`, margin + 15, y + 58);

      y += 95;

      // Roster Table Header
      doc.setFillColor(30, 41, 59);
      doc.rect(margin, y, pageWidth - margin * 2, 26, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      doc.text('#', margin + 8, y + 17);
      doc.text('Participant Name', margin + 28, y + 17);
      doc.text('Role', margin + 175, y + 17);
      doc.text('Join Time', margin + 265, y + 17);
      doc.text('End Session', margin + 345, y + 17);
      doc.text('Status', margin + 425, y + 17);
      doc.text('Verification', margin + 475, y + 17);

      y += 26;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      attendeesToRender.forEach((attendee, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, pageWidth - margin * 2, 22, 'F');
        }
        doc.setTextColor(30, 41, 59);
        doc.text(`${idx + 1}`, margin + 8, y + 15);
        doc.text(attendee.name.length > 25 ? attendee.name.substring(0, 24) + '...' : attendee.name, margin + 28, y + 15);
        
        doc.setTextColor(71, 85, 105);
        doc.text(attendee.role || 'Student', margin + 175, y + 15);
        doc.text(attendee.join || '10:00 AM', margin + 265, y + 15);
        doc.text(attendee.endSession || 'Completed', margin + 345, y + 15);

        // Status color
        if (attendee.status.includes('Host') || attendee.status.includes('Present')) {
          doc.setTextColor(22, 101, 52); // green
        } else {
          doc.setTextColor(185, 28, 28); // red
        }
        doc.text(attendee.status, margin + 425, y + 15);

        doc.setTextColor(71, 85, 105);
        doc.text(attendee.verified, margin + 475, y + 15);
        y += 22;
      });

      y += 30;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text('This is an electronically generated attendance record certified by SyncLearn Virtual Classroom Engine.', margin, y);

      doc.save(`Attendance_Report_${cleanCode}.pdf`);
      if (showToast) showToast('📄 Attendance Report PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('PDF error:', err);
      if (showToast) showToast('⚠️ Failed to generate PDF report', 'error');
    }
  };

  return (
    <>
      <div className="role-welcome-banner instructor-banner">
        <div
          className="role-banner-avatar-wrap"
          onClick={() => onOpenSettings && onOpenSettings('account')}
          title="Click to view & change profile picture"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="Profile" className="role-banner-avatar-img" />
          ) : (
            <div className="role-banner-avatar-circle">
              {(user?.name || 'I').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="role-banner-avatar-edit-badge" title="Change Photo">📷</span>
        </div>
        <div>
          <h2>{user?.name || 'Instructor'}</h2>
          <p>You are logged in as <span className="role-chip role-instructor">Instructor</span> — manage live sessions, track students, and conduct interactive classes.</p>
        </div>
      </div>

      <div className="role-stats-row">
        {[
          { icon: '📚', value: sessionCount > 0 ? 0 : 0, label: 'Active Live Room' },
          { icon: '👥', value: totalStudentsTaught, label: 'Students Connected' },
          { icon: '🎙️', value: sessionCount, label: 'Classes Completed' },
          { icon: '📊', value: sessionCount > 0 ? '98%' : '0%', label: 'Attendance Rate' },
        ].map((s, i) => (
          <div className="role-stat-card" key={i}>
            <span className="stat-icon">{s.icon}</span>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="role-section-title">🚀 Launch a Live Session</div>
      <div className="action-card instructor-card zoom-class-card">
        <div className="zoom-card-top-bar">
          <span className="card-badge badge-green">👨‍🏫 Instructor Classroom Hub</span>
          <span className="zoom-live-badge live-green">
            <span className="pulse-dot">●</span> Ready to Host
          </span>
        </div>

        <div className="zoom-card-heading-wrap">
          <h2>Create & Schedule Live Classroom</h2>
        </div>

        {/* Meeting Topic Input */}
        <div className="meeting-form-group">
          <label className="room-code-label">📚 Class Topic / Lecture Title:</label>
          <input
            type="text"
            className="dash-input topic-input"
            value={meetingTopic}
            onChange={(e) => setMeetingTopic(e.target.value)}
            placeholder="Enter instructor's lecture topic"
          />
        </div>

        {/* Meeting ID Input & Generation */}
       <div className="room-create-box">
  <label className="room-code-label">
    🆔 Class Meeting ID / Room Code:
  </label>

  <div className="room-code-input-row">
    <div className="zoom-id-display">
      <span className="zoom-id-hash">#</span>

      <input
        type="text"
        value={createdRoomId}
        onChange={(e) => setCreatedRoomId(e.target.value)}
        className="dash-input zoom-code-input"
        placeholder="e.g. 849-291-034"
      />
    </div>

    <button
      type="button"
      className="code-action-btn"
      onClick={handleRegenerateCode}
      title="Generate new Meeting ID and Passcode"
    >
      🎲 New ID
    </button>

    <button
      type="button"
      className="code-action-btn"
      onClick={handleCopyCreatedInvite}
      title="Copy classroom invitation link"
    >
      🔗 Copy Link
    </button>

    <button
      type="button"
      className="code-action-btn"
      onClick={handleCopyCreatedCode}
      title="Copy Meeting ID"
    >
      📋 Copy ID
    </button>
  </div>

  {/* Live Topic and Meeting ID Preview */}
  <div className="meeting-details-preview">
    <h3>📚 Class Information</h3>

    <p>
      <strong>Lecture Topic:</strong>{" "}
      {meetingTopic.trim() || "Enter a class topic above"}
    </p>

    <p>
      <strong>Meeting ID:</strong>{" "}
      <code>{formatMeetingIdWithDashes(createdRoomId) || "Not generated"}</code>
    </p>
    <p>
      <strong>Passcode:</strong>{" "}
      <code style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: '4px', color: '#0284c7', fontWeight: 800 }}>{createdPasscode}</code>
    </p>

    <button
      type="button"
      className="dash-btn dash-secondary-btn"
      onClick={handleCopyZoomInvitation}
    >
      📋 Copy Topic & Meeting Invitation
    </button>
  </div>
</div>

        {/* Action Buttons Grid (Just 2 Options: Launch Classroom & WhatsApp) */}
        <div className="zoom-action-buttons-row">
          <button type="button" className="dash-btn dash-primary-btn launch-btn" onClick={handleCreateRoom}>
            🚀 Launch Classroom
          </button>
          <button type="button" className="dash-btn dash-whatsapp-btn" onClick={handleShareWhatsApp} title="Share directly to WhatsApp group">
            💬 WhatsApp
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div className="role-section-title" style={{ margin: 0 }}>🕐 Completed Live Sessions ({sessionCount})</div>
        {sessionCount > 0 && (
          <button
            type="button"
            onClick={handleClearSessions}
            style={{
              background: 'transparent',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
            title="Reset and clear all session attendance history"
          >
            🗑️ Clear History
          </button>
        )}
      </div>

      <div className="history-section">
        {sessionCount === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.75rem', color: '#64748b', fontSize: '0.88rem' }}>
            No sessions completed yet. Launch a room above to conduct your first online class!
          </div>
        ) : (
          <div className="history-list">
            {completedSessions.map(s => (
              <div className="history-item" key={s.code}>
                <div className="history-info"> 
   {(() => {
  const roomCode = s.code || "";

  const storedTopic =
    localStorage.getItem("synclearn_topic_" + roomCode)?.trim() ||
    localStorage
      .getItem(
        "synclearn_topic_" + roomCode.replace(/-/g, "")
      )
      ?.trim() ||
    "";

  const isGenericTitle = (value) =>
    !value?.trim() ||
    /^Live Session(?:\s*\([^)]*\))?$/i.test(value.trim()) ||
    /^Live Classroom(?:\s*\([^)]*\))?$/i.test(value.trim()) ||
    /^Untitled Class$/i.test(value.trim());

  const topic = !isGenericTitle(storedTopic)
    ? storedTopic
    : !isGenericTitle(s.title)
      ? s.title.trim()
      : !isGenericTitle(s.topic)
        ? s.topic.trim()
        : "Untitled Class";

  return <h4>📚 Topic: {topic}</h4>;
})()}
                  <p>Room: <code>{s.code}</code> • {s.date} ({s.time || ''}) • <span style={{fontSize:'0.75rem',borderRadius:'99px',padding:'2px 8px',background:'rgba(34,197,94,0.12)',color:'#4ade80'}}>👥 {s.students} participants</span></p>
                  {s.recordedLecture && (
                    <div style={{ fontSize: '0.74rem', color: '#38bdf8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>📄 Material: <strong>{s.recordedLecture}</strong> ({s.recordedLectureSize || 'Ready'})</span>
                      {s.recordedLectureUrl && (
                        <a
                          href={s.recordedLectureUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#4ade80', textDecoration: 'underline', fontWeight: 600 }}
                        >
                          👁️ View / Download
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:'0.6rem', alignItems:'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="room-copy-btn"
                    onClick={() => handleDownloadAttendanceReport(s)}
                    title="Download certified PDF attendance report for this lecture"
                    style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.45)', color: '#38bdf8' }}
                  >
                    📄 Attendance Report
                  </button>
                  <label
                    className="rejoin-btn"
                    style={{
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'rgba(34, 197, 94, 0.15)',
                      borderColor: 'rgba(34, 197, 94, 0.45)',
                      color: '#4ade80'
                    }}
                    title="Upload lecture materials (Docs, PDF, Video, Zip files)"
                  >
                    📤 {s.recordedLecture ? 'Replace Material' : 'Upload Lecture Material'}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.rar,.mp4,.webm,.mkv,.txt,video/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleUploadLectureFile && handleUploadLectureFile(e, s)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function StudentDashboard({
  user, inputRoomId, setInputRoomId,
  handleJoinSubmit, handlePasteIntoJoin, handleCopyHistoryLink, onJoinRoom,
  onOpenSettings,
  completedSessions = [],
  handleClearSessions
}) {
  const attendedCount = completedSessions.length;
  const [remoteLectures, setRemoteLectures] = useState({});
  const [remoteTopics, setRemoteTopics] = useState({});

  useEffect(() => {
    if (!completedSessions || completedSessions.length === 0) return;

    completedSessions.forEach(s => {
      const roomCode = s.code;
      if (!roomCode) return;
      const clean = roomCode.replace(/[^a-zA-Z0-9_-]/g, '');

      // Fetch uploaded lecture material from backend for this room
      fetch(`/api/v1/rooms/${clean}/lectures`)
        .then(r => r.json())
        .then(d => {
          if (d?.success && Array.isArray(d.lectures) && d.lectures.length > 0) {
            const latest = d.lectures[d.lectures.length - 1];
            const fileUrl = latest.fileUrl;
            setRemoteLectures(prev => ({
              ...prev,
              [roomCode]: {
                name: latest.fileName,
                size: latest.fileSize || 'Ready',
                url: fileUrl,
                uploadedBy: latest.uploadedBy
              }
            }));
          }
        })
        .catch(err => console.warn('Fetch student lecture error:', err));

      // Fetch official topic and instructor from backend for this room
      fetch(`/api/v1/rooms/${clean}/info`)
        .then(r => r.json())
        .then(d => {
          if (d?.success && d.title) {
            setRemoteTopics(prev => ({
              ...prev,
              [roomCode]: {
                title: d.title,
                instructorName: d.instructorName
              }
            }));
          }
        })
        .catch(err => console.warn('Fetch student room info error:', err));
    });
  }, [completedSessions]);

  return (
    <>
      <div className="role-welcome-banner student-banner">
        <div
          className="role-banner-avatar-wrap"
          onClick={() => onOpenSettings && onOpenSettings('account')}
          title="Click to view & change profile picture"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="Profile" className="role-banner-avatar-img" />
          ) : (
            <div className="role-banner-avatar-circle">
              {(user?.name || 'S').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="role-banner-avatar-edit-badge" title="Change Photo">📷</span>
        </div>
        <div>
          <h2>{user?.name || 'Student'}</h2>
          <p>You are logged in as <span className="role-chip role-student">Student</span> — join your instructor's live room, ask doubts, and access your session notes.</p>
        </div>
      </div>

      <div className="role-stats-row">
        {[
          { icon: '📅', value: attendedCount, label: 'Sessions Attended' },
          { icon: '📝', value: attendedCount > 0 ? 1 : 0, label: 'Notes Saved' },
          { icon: '❓', value: 0, label: 'Doubts Pinned' },
          { icon: '⭐', value: attendedCount > 0 ? '92%' : '0%', label: 'Engagement Score' },
        ].map((s, i) => (
          <div className="role-stat-card" key={i}>
            <span className="stat-icon">{s.icon}</span>
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="role-section-title">🔗 Join a Live Class</div>
      <div className="action-card student-card zoom-class-card">
        <div className="zoom-card-top-bar">
          <span className="card-badge badge-green">🎓 Student Classroom Hub</span>
          <span className="zoom-live-badge live-green">
            <span className="pulse-dot">●</span> Live Rooms Open
          </span>
        </div>
        <div className="zoom-card-heading-wrap">
          <h2>Enter Online Classroom</h2>
        </div>
        <form onSubmit={handleJoinSubmit} className="join-form-custom">
          <label className="room-code-label">🆔 Meeting ID or Direct Join Link:</label>
          <div className="room-code-input-row">
            <div className="zoom-id-display">
              <span className="zoom-id-hash">#</span>
              <input
                type="text"
                placeholder="e.g. 849-291-034  or  paste full invite link"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
                className="dash-input zoom-code-input"
              />
            </div>
            <button type="button" className="code-action-btn paste-btn" onClick={handlePasteIntoJoin} title="Paste from clipboard">
              📋 Paste
            </button>
          </div>
          <button type="submit" className="dash-btn dash-primary-btn launch-btn">
            🎓 Enter Classroom →
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div className="role-section-title" style={{ margin: 0 }}>🕐 My Completed Sessions ({attendedCount})</div>
        {attendedCount > 0 && (
          <button
            type="button"
            onClick={handleClearSessions}
            style={{
              background: 'transparent',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
            title="Reset and clear all session attendance history"
          >
            🗑️ Clear History
          </button>
        )}
      </div>
      <div className="history-section">
        {attendedCount === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.75rem', color: '#64748b', fontSize: '0.88rem' }}>
            You haven't attended any online classes yet. Join using a Room Code or invite link above!
          </div>
        ) : (
          <div className="history-list">
            {completedSessions.map(s => (
              <div className="history-item" key={s.code}>
                <div className="history-info">
                  {(() => {
                    const roomCode = s.code || "";
                    const storedTopic =
                      localStorage.getItem("synclearn_topic_" + roomCode)?.trim() ||
                      localStorage
                        .getItem(
                          "synclearn_topic_" + roomCode.replace(/-/g, "")
                        )
                        ?.trim() ||
                      "";

                    const isGenericTitle = (value) =>
                      !value?.trim() ||
                      /^Live Session(?:\s*\([^)]*\))?$/i.test(value.trim()) ||
                      /^Live Classroom(?:\s*\([^)]*\))?$/i.test(value.trim()) ||
                      /^Untitled Class$/i.test(value.trim());

                    const topic = !isGenericTitle(storedTopic)
                      ? storedTopic
                      : !isGenericTitle(remoteTopics[roomCode]?.title)
                        ? remoteTopics[roomCode].title.trim()
                        : !isGenericTitle(s.title)
                          ? s.title.trim()
                          : !isGenericTitle(s.topic)
                            ? s.topic.trim()
                            : "Untitled Class";

                    const storedHost = localStorage.getItem('synclearn_host_' + roomCode) || 
                                       localStorage.getItem('synclearn_host_' + roomCode.replace(/-/g, ''));
                    const instructorName = (remoteTopics[roomCode]?.instructorName && remoteTopics[roomCode].instructorName !== 'Instructor')
                      ? remoteTopics[roomCode].instructorName
                      : (storedHost && storedHost !== 'Instructor')
                        ? storedHost
                        : (s.instructor && s.instructor !== 'Instructor' ? s.instructor : 'Instructor');

                    let lectureRec = remoteLectures[s.code] || (s.recordedLecture ? { name: s.recordedLecture, size: s.recordedLectureSize, url: s.recordedLectureUrl } : null);
                    if (!lectureRec) {
                      try {
                        const cleanC = (s.code || '').replace(/[^a-zA-Z0-9_-]/g, '');
                        const stored = localStorage.getItem('synclearn_recording_' + cleanC) || localStorage.getItem('synclearn_recording_' + cleanC.replace(/-/g, ''));
                        if (stored) lectureRec = JSON.parse(stored);
                      } catch(e) {}
                    }

                    return (
                      <>
                        <h4>📚 Topic: {topic}</h4>
                        <p>Room: <code>{s.code}</code> • {s.date} ({s.time || ''}) • <span style={{color:'#94a3b8'}}>Instructor: {instructorName}</span></p>
                        {lectureRec && lectureRec.name && (
                          <div className="history-material-box">
                            <span>📊 <strong>Material:</strong> <span>{lectureRec.name}</span> <span>({lectureRec.size || 'Ready'})</span></span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                {(() => {
                  let lectureRec = remoteLectures[s.code] || (s.recordedLecture ? { name: s.recordedLecture, size: s.recordedLectureSize, url: s.recordedLectureUrl } : null);
                  if (!lectureRec) {
                    try {
                      const cleanC = (s.code || '').replace(/[^a-zA-Z0-9_-]/g, '');
                      const stored = localStorage.getItem('synclearn_recording_' + cleanC) || localStorage.getItem('synclearn_recording_' + cleanC.replace(/-/g, ''));
                      if (stored) lectureRec = JSON.parse(stored);
                    } catch(e) {}
                  }

                  if (lectureRec && lectureRec.name && lectureRec.url) {
                    return (
                      <div style={{ display:'flex', gap:'0.6rem', alignItems:'center', flexWrap: 'wrap' }}>
                        <a
                          href={lectureRec.url}
                          target="_blank"
                          rel="noreferrer"
                          download={lectureRec.name}
                          className="lecture-action-btn lecture-download-btn"
                          title="Download uploaded lecture material"
                        >
                          <span>⬇️</span> <span>Download</span>
                        </a>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display:'flex', gap:'0.6rem', alignItems:'center' }}>
                      <span style={{ color: '#64748b', fontSize: '0.76rem', fontStyle: 'italic' }}>
                        (No lecture uploaded)
                      </span>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

function DashboardPage({ 
  user, 
  onNavigate, 
  onBackToHome, 
  onJoinRoom, 
  onOpenProfile, 
  onOpenAnalytics, 
  onOpenSettings,
  onLogout,
  theme,
  onToggleTheme,
  onUpdateRole
}) {
  const [inputRoomId, setInputRoomId] = useState('');
  const [createdRoomId, setCreatedRoomId] = useState(() => generateZoomMeetingId());
  const [createdPasscode, setCreatedPasscode] = useState(() => generateMeetingPasscode());
  const [meetingTopic, setMeetingTopic] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const toastTimeoutRef = useRef(null);

  const [dbStatus, setDbStatus] = useState({ connected: true, database: 'synclearn_db', usersCount: 5, roomsCount: 0 });

  useEffect(() => {
    const checkDb = () => {
      fetch('/api/v1/db-status')
        .then(res => res.json())
        .then(data => {
          if (data && data.connected) {
            setDbStatus(data);
          }
        })
        .catch(e => console.warn('DB status check:', e));
    };
    checkDb();
    const interval = setInterval(checkDb, 8000);
    return () => clearInterval(interval);
  }, []);

  const getUserSessionStorageKey = () => {
    if (user?.email) return `synclearn_completed_sessions_${user.email.toLowerCase().trim()}`;
    if (user?._id) return `synclearn_completed_sessions_${user._id}`;
    return null;
  };

  const getStoredSessions = () => {
    try {
      const key = getUserSessionStorageKey();
      if (!key) return [];
      const data = localStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }
      return [];
    } catch {
      return [];
    }
  };

  // Real-time completed sessions from actual class attendance (0 by default for new instructor/student)
  const [completedSessions, setCompletedSessions] = useState(() => getStoredSessions());

  // Keep dashboard stats up-to-date in real-time when returning from classroom
  useEffect(() => {
    const refreshSessions = () => {
      setCompletedSessions(getStoredSessions());
    };

    refreshSessions();
    window.addEventListener('storage', refreshSessions);
    window.addEventListener('focus', refreshSessions);
    return () => {
      window.removeEventListener('storage', refreshSessions);
      window.removeEventListener('focus', refreshSessions);
    };
  }, [user?.email, user?._id]);

  const handleClearSessions = () => {
    const key = getUserSessionStorageKey();
    if (key) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem('synclearn_completed_sessions');
    setCompletedSessions([]);
    showToast('Class history cleared. All session counts reset to 0.', 'info');
  };
const saveSessionToHistory = (roomId, topic, sessionDetails = {}) => {
  const cleanRoom = extractRoomCode(roomId);
  const cleanTopic =
    topic?.trim() ||
    localStorage.getItem("synclearn_topic_" + cleanRoom) ||
    localStorage.getItem(
      "synclearn_topic_" + cleanRoom.replace(/-/g, "")
    ) ||
    "Untitled Class";

  if (!cleanRoom) return;

  const key = getUserSessionStorageKey();
  if (!key) return;

  const existing = getStoredSessions();

  const sessionRecord = {
    ...sessionDetails,
    code: cleanRoom,
    title: cleanTopic,
    topic: cleanTopic,
    instructor: user?.name || "Instructor",
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    students: sessionDetails.students ?? 0
  };

  // Update the existing record for this room instead of duplicating it.
  const updated = existing.some(
    (session) => session.code === cleanRoom
  )
    ? existing.map((session) =>
        session.code === cleanRoom
          ? { ...session, ...sessionRecord }
          : session
      )
    : [...existing, sessionRecord];

  localStorage.setItem(key, JSON.stringify(updated));
  setCompletedSessions(updated);
};
  const showToast = (message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ show: true, message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3200);
  };

  const handleRegenerateCode = () => {
    const newCode = generateZoomMeetingId();
    setCreatedRoomId(newCode);
    const newPass = generateMeetingPasscode();
    setCreatedPasscode(newPass);
    try {
      localStorage.setItem('synclearn_passcode_' + newCode, newPass);
      localStorage.setItem('synclearn_passcode_' + newCode.replace(/-/g, ''), newPass);
    } catch(e) {}
    showToast(`🎲 Generated new Meeting ID: ${newCode} & Passcode: ${newPass}`);
  };

  const handleCopyCreatedCode = () => {
    if (!createdRoomId) return;
    navigator.clipboard.writeText(createdRoomId)
      .then(() => showToast(`📋 Meeting ID "${createdRoomId}" copied!`))
      .catch(() => showToast('Failed to copy code', 'error'));
  };

  const handleCopyCreatedInvite = () => {
    if (!createdRoomId) return;
    const host = getShareableHost();
    const port = window.location.port || '5173';
    const hostParam = user?.name ? `&host=${encodeURIComponent(user.name)}` : '';
    const inviteUrl = `${window.location.protocol}//${host}:${port}?room=${encodeURIComponent(createdRoomId)}${hostParam}`;
    navigator.clipboard.writeText(inviteUrl)
      .then(() => showToast(`🔗 Shareable Mobile & Wi-Fi invite link copied: ${inviteUrl}`, 'success'))
      .catch(() => showToast('Failed to copy link', 'error'));
  };
 
const handleCopyZoomInvitation = async () => {
  if (!createdRoomId) {
    showToast("Please enter a meeting ID.", "error");
    return;
  }

  if (!meetingTopic.trim()) {
    showToast("Please enter the class topic first.", "error");
    return;
  }

  const invitation = buildZoomInvitationText(
    meetingTopic.trim(),
    createdRoomId,
    user?.name,
    createdPasscode
  );

  try {
    await navigator.clipboard.writeText(invitation);
    showToast("Class topic and meeting invitation copied!", "success");
  } catch (error) {
    console.error("Copy invitation failed:", error);
    showToast("Unable to copy invitation. Check browser permissions.", "error");
  }
};

  const handleShareWhatsApp = () => {
    const text = buildZoomInvitationText(meetingTopic, createdRoomId, user?.name, createdPasscode);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    showToast('💬 Opening WhatsApp to share class invitation!');
  };

  const handleShareEmail = () => {
    const text = buildZoomInvitationText(meetingTopic, createdRoomId, user?.name, createdPasscode);
    const subject = `Live Class Invitation: ${meetingTopic || 'SyncLearn Online Session'}`;
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = mailto;
    showToast('✉️ Opening email client to send invitation!');
  };

  const handlePasteIntoJoin = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (text.includes('room=')) {
          const params = new URLSearchParams(text.split('?')[1]);
          const roomVal = params.get('room');
          if (roomVal) {
            setInputRoomId(roomVal.trim());
            showToast(`📋 Pasted room code: ${roomVal.trim()}`);
            return;
          }
        }
        setInputRoomId(text.trim());
        showToast(`📋 Pasted code: ${text.trim()}`);
      }
    } catch (err) {
      showToast('Please paste manually into the input box', 'error');
    }
  };

  const handleUploadLectureFile = async (e, session) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const hostname = window.location.hostname || 'localhost';
    const serverUrl = `http://${hostname}:5000`;
    const cleanCode = (session.code || '').replace(/[^a-zA-Z0-9_-]/g, '');

    const formData = new FormData();
    formData.append('lectureFile', file);
    formData.append('uploadedBy', user?.name || 'Instructor');

    showToast(`⏳ Uploading lecture material "${file.name}"...`, 'info');

    let fileUrl = '';
    const sizeStr = file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    try {
      const res = await fetch(`${serverUrl}/api/v1/rooms/${cleanCode}/upload-lecture`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data?.material?.fileUrl) {
        fileUrl = `${serverUrl}${data.material.fileUrl}`;
      }
    } catch (err) {
      console.warn('Backend lecture upload fallback:', err);
    }

    if (!fileUrl) {
      try {
        fileUrl = URL.createObjectURL(file);
      } catch (e) {}
    }

    const recData = {
      name: file.name,
      url: fileUrl,
      size: sizeStr,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Save for student access locally and across sessions
    localStorage.setItem('synclearn_recording_' + cleanCode, JSON.stringify(recData));
    localStorage.setItem('synclearn_recording_' + cleanCode.replace(/-/g, ''), JSON.stringify(recData));

    const key = getUserSessionStorageKey();
    if (key) {
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = existing.map(s => {
        if (s.code === session.code) {
          return {
            ...s,
            recordedLecture: file.name,
            recordedLectureUrl: fileUrl,
            recordedLectureSize: recData.size,
            recordedLectureTime: recData.time
          };
        }
        return s;
      });
      localStorage.setItem(key, JSON.stringify(updated));
      setCompletedSessions(updated);
    }
    showToast(`📤 Lecture material "${file.name}" uploaded successfully!`, 'success');
  };

  const handleCopyHistoryLink = (rId, instructor) => {
    const host = getShareableHost();
    const port = window.location.port || '5173';
    const hostName = instructor || (user?.role === 'instructor' ? user?.name : '');
    const hostParam = hostName ? `&host=${encodeURIComponent(hostName)}` : '';
    const inviteUrl = `${window.location.protocol}//${host}:${port}?room=${encodeURIComponent(rId)}${hostParam}`;
    navigator.clipboard.writeText(inviteUrl)
      .then(() => showToast(`🔗 Invite link for ${rId} copied!`))
      .catch(() => showToast('Failed to copy link', 'error'));
  };

  const extractRoomCode = (raw) => {
    if (!raw) return '';
    let val = String(raw).trim();
    if (val.includes('room=')) {
      try {
        const queryPart = val.includes('?') ? val.split('?')[1] : val;
        const params = new URLSearchParams(queryPart);
        const parsed = params.get('room');
        if (parsed) return parsed.trim();
      } catch (e) {}
    }
    val = val.replace(/^https?:\/\/[^/]+\/?/i, '');
    // Replace spaces in 9-digit format "849 291 034" -> "849-291-034"
    if (/^\d{3}\s+\d{3}\s+\d{3}$/.test(val.trim())) {
      return val.trim().replace(/\s+/g, '-');
    }
    return val.replace(/[^a-zA-Z0-9_-]/g, '').trim() || val.trim();
  };

const handleCreateRoom = async () => {
  const topic = meetingTopic.trim();
  const targetRoom =
    extractRoomCode(createdRoomId) || generateZoomMeetingId();

  if (!topic) {
    showToast("Please enter the class topic first.", "error");
    return;
  }

  try {
    // Save topic and instructor information for this room.
    localStorage.setItem(
      "synclearn_topic_" + targetRoom,
      topic
    );

    localStorage.setItem(
      "synclearn_topic_" + targetRoom.replace(/-/g, ""),
      topic
    );

    localStorage.setItem(
      "synclearn_host_" + targetRoom,
      user?.name || "Instructor"
    );
    localStorage.setItem("synclearn_passcode_" + targetRoom, createdPasscode);
    localStorage.setItem("synclearn_passcode_" + targetRoom.replace(/-/g, ""), createdPasscode); /*
    );

    */ setMeetingTopic(topic);
    setCreatedRoomId(targetRoom);

    // Register the room with the backend.
    const apiBase = "";

    try {
      const response = await fetch(
        `${apiBase}/api/v1/rooms/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            roomId: targetRoom,
            instructorName: user?.name || "Instructor",
            title: topic,
            passcode: createdPasscode
          })
        }
      );

      if (!response.ok) {
        console.warn(
          "Room registration returned:",
          response.status
        );
      }
    } catch (error) {
      console.warn("Room registration failed:", error);
    }

    // SAVE THE SESSION TO DASHBOARD HISTORY.
    saveSessionToHistory(targetRoom, topic, {
      students: 0
    });

    // Start the classroom.
    if (onJoinRoom) {
      onJoinRoom(targetRoom, user?.name);
    }

  } catch (error) {
    console.error("Class creation error:", error);
    showToast(
      "Unable to create the classroom.",
      "error"
    );
  }
};

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    const cleanRoom = extractRoomCode(inputRoomId);
    if (cleanRoom && onJoinRoom) {
      let detectedHost = '';
      if (inputRoomId.includes('host=')) {
        try {
          const q = inputRoomId.includes('?') ? inputRoomId.split('?')[1] : inputRoomId;
          const p = new URLSearchParams(q);
          if (p.get('host')) detectedHost = decodeURIComponent(p.get('host'));
        } catch (e) {}
      }
      if (!detectedHost) {
        detectedHost = localStorage.getItem('synclearn_host_' + cleanRoom) || localStorage.getItem('synclearn_host_' + cleanRoom.replace(/-/g, '')) || '';
      }
      onJoinRoom(cleanRoom, detectedHost);
    }
  };

  // Safe navigation handlers
  const handleAnalytics = () => {
    if (onOpenAnalytics) onOpenAnalytics();
    else if (onNavigate) onNavigate('analytics');
  };

  const handleProfile = () => {
    if (onOpenProfile) onOpenProfile();
    else if (onNavigate) onNavigate('profile');
  };

  const handleHome = () => {
    if (onLogout) onLogout();
    else if (onBackToHome) onBackToHome();
    else if (onNavigate) onNavigate('home');
  };

  const isInstructor = (user?.role === 'instructor');

  return (
    <div className="dashboard-container">
      {/* Floating Toast Notification */}
      {toast.show && (
        <div className={`dash-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Top Header Navigation */}
      <nav className="landing-nav">
        <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          <button type="button" className="auth-back-btn" onClick={() => onNavigate && onNavigate('home')}>
            <img
              src={logoImg}
              alt="SyncLearn Logo"
              style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid #6366f1' }}
            />
            <span className="logo-text">SyncLearn</span>
          </button> 
          <span className={`nav-role-chip ${isInstructor ? 'role-instructor' : 'role-student'}`}>
            {isInstructor ? '👨‍🏫 Instructor' : '🎓 Student'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          {/* {isInstructor && (
            <button type="button" className="back-btn" onClick={handleAnalytics} style={{ backgroundColor: '#334155', color: '#ffffff' }}>
              📊 Analytics
            </button>
          )}  */}

          <button
            type="button"
            className="back-btn logout-nav-btn"
            onClick={onLogout || handleHome}
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.22)', borderColor: 'rgba(239, 68, 68, 0.45)', color: '#fca5a5' }}
            title="Log out of SyncLearn session"
          >
            🚪 Logout
          </button>

          <button
            type="button"
            className="theme-icon-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode ☀️' : 'Switch to Dark Mode 🌙'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>

      {/* Role-based Dashboard Content */}
      <div className="dashboard-content">
        {isInstructor ? (
          <InstructorDashboard
            user={user}
            createdRoomId={createdRoomId}
            setCreatedRoomId={setCreatedRoomId}
            createdPasscode={createdPasscode}
            meetingTopic={meetingTopic}
            setMeetingTopic={setMeetingTopic}
            handleCreateRoom={handleCreateRoom}
            handleRegenerateCode={handleRegenerateCode}
            handleCopyCreatedCode={handleCopyCreatedCode}
            handleCopyCreatedInvite={handleCopyCreatedInvite}
            handleCopyZoomInvitation={handleCopyZoomInvitation}
            handleShareWhatsApp={handleShareWhatsApp}
            handleShareEmail={handleShareEmail}
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
            handleCopyHistoryLink={handleCopyHistoryLink}
            onJoinRoom={onJoinRoom}
            onOpenSettings={onOpenSettings}
            completedSessions={completedSessions}
            handleClearSessions={handleClearSessions}
            showToast={showToast}
            handleUploadLectureFile={handleUploadLectureFile}
          />
        ) : (
          <StudentDashboard
            user={user}
            inputRoomId={inputRoomId}
            setInputRoomId={setInputRoomId}
            handleJoinSubmit={handleJoinSubmit}
            handlePasteIntoJoin={handlePasteIntoJoin}
            handleCopyHistoryLink={handleCopyHistoryLink}
            onJoinRoom={onJoinRoom}
            onOpenSettings={onOpenSettings}
            completedSessions={completedSessions}
            handleClearSessions={handleClearSessions}
          />
        )}
      </div>

      {/* Zoom-Style Invitation Modal */}
      <ClassInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        topic={meetingTopic}
        roomId={createdRoomId}
        instructorName={user?.name}
        passcode={createdPasscode}
        onCopyInvite={handleCopyZoomInvitation}
        onCopyLink={handleCopyCreatedInvite}
        onShareWhatsApp={handleShareWhatsApp}
        onShareEmail={handleShareEmail}
      />

      {/* ── Image 1: Bottom Settings Option ── */}
      <div className="dashboard-bottom-settings-bar">
        <button
          type="button"
          className="zoom-settings-trigger-btn"
          onClick={() => onOpenSettings && onOpenSettings('general')}
          title="Account, Profile Picture & Hardware Settings"
        >
          <div className="zoom-settings-icon-square">⚙️</div>
          <span className="zoom-settings-trigger-label">Settings</span>
        </button>
      </div>
    </div>
  );
}

export default DashboardPage;