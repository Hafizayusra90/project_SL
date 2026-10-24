import React from 'react';
import './LandingPage.css';
import logoImg from './assets/logo.png';

function LandingPage({ onNavigate, onEnterWorkspace, theme, onToggleTheme }) {
  return (
    <div className="landing-container">
      {/* ── Sticky Navbar ── */}
      <nav className="landing-nav">
        <div className="logo-container">
          <button type="button" className="auth-back-btn" onClick={() => onNavigate && onNavigate('home')}>
          <img
            src={logoImg}
            alt="SyncLearn Logo"
            style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid #6366f1' }}
          />
          <span className="logo-text">SyncLearn</span>
        </button> 
        </div>

        <div className="nav-links">
          <div className="nav-links-left">
            <a className="nav-link" href="#features" onClick={e => { e.preventDefault(); onNavigate && onNavigate('features'); }}>
              Features
            </a>
            <a className="nav-link" href="#about" onClick={e => { e.preventDefault(); onNavigate && onNavigate('about'); }}>
              Our Vision
            </a>
          </div>
          <div className="nav-links-right">
            <button className="primary-btn" onClick={onEnterWorkspace}>
              Enter Workspace →
            </button>
            <button
              className="theme-icon-btn"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode ☀️' : 'Switch to Dark Mode 🌙'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="hero-section">
        <div className="hero-badge">
          <span>⚡</span> Powered by WebRTC + Socket.io + AI
        </div>

        <h1 className="hero-brand-title">
          <span className="hero-brand-gradient">SyncLearn</span>
        </h1>

        <h2 className="hero-title">
          AI-Powered Real-Time{' '}
          <span className="gradient-text">Collaborative Learning</span>
          {' '}Platform
        </h2>

        <p className="hero-subtitle">
          Connect seamlessly with peers and instructors. Experience real-time video calls,
          multi-user whiteboard collaboration, synchronized video annotation, and
          automated speech-to-text summaries — all in one place.
        </p>

        <div className="hero-cta">
          <button className="large-primary-btn" onClick={onEnterWorkspace}>
            Get Started <span>→</span>
          </button>
        </div>

        {/* Stats row */}
        <div className="hero-stats">
          <div className="stat-item">
            <span className="stat-value">WebRTC</span>
            <span className="stat-label">P2P Video</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">&lt;50ms</span>
            <span className="stat-label">Avg Latency</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">AI</span>
            <span className="stat-label">Transcription</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">3D</span>
            <span className="stat-label">Model Viewer</span>
          </div>
        </div>
      </header>
    </div>
  );
}

export default LandingPage;