import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { isValidRealEmail, isValidRealName, validatePasswordPolicy } from './utils/validation';
import './AuthPage.css';

function AuthPage({ onLoginSuccess, onNavigate, theme, onToggleTheme }) {
  // Modes: 'login' | 'signup' | 'forgot-password' | 'forgot-email'
  const [authMode, setAuthMode] = useState('login');
  const [role, setRole] = useState('student'); // 'student' | 'instructor'
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    recoveryEmail: '',
    password: '',
    newPassword: '',
    emailOrRecovery: ''
  });

  const [notice, setNotice] = useState({ show: false, message: '', type: 'info' });
  const [recoveredEmails, setRecoveredEmails] = useState([]);

  const showNotice = (message, type = 'info') => {
    setNotice({ show: true, message, type });
  };

  const parseJsonResponse = async (response) => {
    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return await response.json();
      }
      const text = await response.text();
      return { message: text?.slice(0, 150) || ("Server responded with status " + response.status) };
    } catch (e) {
      return { message: "Server connection error (" + response.status + ")" };
    }
  };

  // ── Handle Social Login (Google / GitHub) ──
  const handleSocialAuth = async (provider) => {
    const defaultName = provider === 'Google'
      ? (role === 'instructor' ? 'Prof. Google' : 'Google Student')
      : (role === 'instructor' ? 'Prof. GitHub' : 'GitHub Student');
    const defaultEmail = `${provider.toLowerCase()}-${Date.now().toString().slice(-4)}@example.com`;

    try {
      const response = await fetch('/api/v1/auth/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: defaultName, email: defaultEmail, role })
      });
      const data = await parseJsonResponse(response);
      if (response.ok) {
        showNotice(`✅ ${provider} login successful!`, 'success');
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data));
        setTimeout(() => onLoginSuccess(data), 500);
      } else {
        showNotice(data.message || 'Social login error', 'error');
      }
    } catch (err) {
      showNotice('Server connection error: ' + err.message, 'error');
    }
  };

  // ── Handle Submit for Login and Sign Up ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotice({ show: false, message: '', type: 'info' });

    if (authMode === 'signup') {
      if (!formData.name.trim() || !isValidRealName(formData.name)) {
        showNotice('❌ Please enter your real full name (at least 2 letters, no numbers).', 'error');
        return;
      }
      if (!formData.email.trim() || !isValidRealEmail(formData.email)) {
        showNotice('❌ Please enter a valid, active email address that exists (e.g. name@gmail.com, student@university.edu).', 'error');
        return;
      }
      if (formData.recoveryEmail && formData.recoveryEmail.trim()) {
        const cleanRec = formData.recoveryEmail.trim();
        if (!isValidRealEmail(cleanRec)) {
          showNotice('❌ Please enter a valid, active recovery email address.', 'error');
          return;
        }
        if (cleanRec.toLowerCase() === formData.email.trim().toLowerCase()) {
          showNotice('❌ Recovery email cannot be identical to your primary email address.', 'error');
          return;
        }
      }

      const policy = validatePasswordPolicy(formData.password);
      if (!policy.isValid) {
        showNotice(`❌ Password Policy Requirement: ${policy.missing.join(', ')}.`, 'error');
        return;
      }
    }

    if (authMode === 'login') {
      if (!formData.email.trim() || !isValidRealEmail(formData.email)) {
        showNotice('❌ Please enter a valid, active email address.', 'error');
        return;
      }
      if (!formData.password) {
        showNotice('❌ Please enter your password.', 'error');
        return;
      }
    }

    const endpoint = authMode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const payload = authMode === 'login' 
      ? { email: formData.email.trim(), password: formData.password, role }
      : { 
          name: formData.name.trim(), 
          email: formData.email.trim(), 
          recoveryEmail: formData.recoveryEmail.trim(), 
          password: formData.password, 
          role 
        };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await parseJsonResponse(response);

      if (response.ok) {
        showNotice(`🎉 ${authMode === 'login' ? 'Login' : 'Registration'} Successful!`, 'success');
        const effectiveUser = {
          email: data.email,
          recoveryEmail: data.recoveryEmail || formData.recoveryEmail || '',
          role: data.role || role,
          name: data.name || formData.name || (role === 'instructor' ? 'Instructor' : 'Student'),
          _id: data._id
        };
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(effectiveUser));
        setTimeout(() => onLoginSuccess(effectiveUser), 600);
      } else {
        showNotice(data.message || 'Authentication error', 'error');
      }
    } catch (err) {
      showNotice('Server Connection Error: ' + err.message, 'error');
    }
  };

  // ── Handle Forgot Password ──
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setNotice({ show: false, message: '', type: 'info' });

    if (!formData.emailOrRecovery.trim()) {
      showNotice('Please enter your account email or recovery email.', 'error');
      return;
    }
    const policy = validatePasswordPolicy(formData.newPassword);
    if (!policy.isValid) {
      showNotice(`❌ Password Policy Requirement: ${policy.missing.join(', ')}.`, 'error');
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrRecovery: formData.emailOrRecovery.trim(),
          newPassword: formData.newPassword
        })
      });
      const data = await parseJsonResponse(response);
      if (response.ok) {
        showNotice(data.message || 'Password reset successfully! You can now sign in.', 'success');
        setFormData(prev => ({ ...prev, email: data.email || prev.email, password: '' }));
        setTimeout(() => setAuthMode('login'), 1500);
      } else {
        showNotice(data.message || 'Failed to reset password.', 'error');
      }
    } catch (err) {
      showNotice('Connection error: ' + err.message, 'error');
    }
  };

  // ── Handle Forgot Email Lookup ──
  const handleForgotEmail = async (e) => {
    e.preventDefault();
    setNotice({ show: false, message: '', type: 'info' });
    setRecoveredEmails([]);

    if (!formData.recoveryEmail.trim()) {
      showNotice('Please enter your registered recovery email address.', 'error');
      return;
    }

    try {
      const response = await fetch('/api/v1/auth/forgot-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryEmail: formData.recoveryEmail.trim() })
      });
      const data = await parseJsonResponse(response);
      if (response.ok) {
        setRecoveredEmails(data.accounts || []);
        showNotice(`Account located! Found ${data.accounts?.length || 1} registered user(s).`, 'success');
      } else {
        showNotice(data.message || 'No account found with this recovery email.', 'error');
      }
    } catch (err) {
      showNotice('Connection error: ' + err.message, 'error');
    }
  };

  return (
    <div className="auth-container">
      {/* Top Bar */}
      <div className="auth-top-bar">
        <button type="button" className="auth-back-btn" onClick={() => onNavigate && onNavigate('home')}>
          ← Back to Home
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

      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-header">
          <img src="/logo.png" alt="SyncLearn" style={{ width: '48px', height: '48px', objectFit: 'contain', margin: '0 auto 8px', display: 'block' }} />
          <h1>SyncLearn</h1>
          {authMode === 'login' && <p>Welcome back! Sign in to continue.</p>}
          {authMode === 'signup' && <p>Create a secure account to get started.</p>}
          {authMode === 'forgot-password' && <p>Reset your password securely.</p>}
          {authMode === 'forgot-email' && <p>Find your account email via recovery email.</p>}
        </div>

        {/* Notice Banner */}
        {notice.show && (
          <div className={`auth-notice-banner ${notice.type === 'success' ? 'notice-success' : 'notice-error'}`}>
            {notice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notice.message}</span>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────── */}
        {/* VIEW 1: SIGN IN / SIGN UP                                   */}
        {/* ─────────────────────────────────────────────────────────── */}
        {(authMode === 'login' || authMode === 'signup') && (
          <>
            {/* Student / Instructor Role Toggle */}
            <div className="role-toggle">
              <button
                type="button"
                className={`role-btn ${role === 'student' ? 'active' : ''}`}
                onClick={() => setRole('student')}
              >
                🎓 Student
              </button>
              <button
                type="button"
                className={`role-btn ${role === 'instructor' ? 'active' : ''}`}
                onClick={() => setRole('instructor')}
              >
                👨‍🏫 Instructor
              </button>
            </div>
            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="auth-form">
              {authMode === 'signup' && (
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="auth-input"
                  />
                </div>
              )}

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Email Address</label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      className="auth-link-btn"
                      onClick={() => { setAuthMode('forgot-email'); setNotice({ show: false }); }}
                    >
                      Forgot Email?
                    </button>
                  )}
                </div>
                <input
                  type="email"
                  placeholder="Enter your email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="auth-input"
                />
              </div>

              {authMode === 'signup' && (
                <div className="form-group">
                  <label>Recovery Email Address <span style={{ fontWeight: 400, opacity: 0.7 }}>(Optional)</span></label>
                  <input
                    type="email"
                    placeholder="Enter recovery email (optional)"
                    value={formData.recoveryEmail}
                    onChange={(e) => setFormData({ ...formData, recoveryEmail: e.target.value })}
                    className="auth-input"
                  />
                </div>
              )}

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Password</label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      className="auth-link-btn"
                      onClick={() => { setAuthMode('forgot-password'); setNotice({ show: false }); }}
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 chars, A-Z, a-z, 0-9 & special char"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="auth-input password-field"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    <span style={{ fontSize: '0.74rem', fontWeight: 600 }}>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                {authMode === 'signup' && (
                  <div className="password-rules-hint">
                    <span className={formData.password.length >= 8 ? 'rule-met' : 'rule-unmet'}>
                      {formData.password.length >= 8 ? '✓' : '•'} 8+ chars
                    </span>
                    <span className={/[A-Z]/.test(formData.password) ? 'rule-met' : 'rule-unmet'}>
                      {/[A-Z]/.test(formData.password) ? '✓' : '•'} Uppercase (A-Z)
                    </span>
                    <span className={/[a-z]/.test(formData.password) ? 'rule-met' : 'rule-unmet'}>
                      {/[a-z]/.test(formData.password) ? '✓' : '•'} Lowercase (a-z)
                    </span>
                    <span className={/[0-9]/.test(formData.password) ? 'rule-met' : 'rule-unmet'}>
                      {/[0-9]/.test(formData.password) ? '✓' : '•'} Number (0-9)
                    </span>
                    <span className={/[!@#$%^&*(),.?":{}|<>_\-+=\\[\]`~]/.test(formData.password) ? 'rule-met' : 'rule-unmet'}>
                      {/[!@#$%^&*(),.?":{}|<>_\-+=\\[\]`~]/.test(formData.password) ? '✓' : '•'} Special char (@, #, $, !)
                    </span>
                  </div>
                )}
              </div>

              <button type="submit" className="submit-btn">
                {authMode === 'login'
                  ? `Sign In as ${role === 'student' ? 'Student' : 'Instructor'}`
                  : `Create ${role === 'student' ? 'Student' : 'Instructor'} Account`
                }
              </button>
            </form>

            <div className="divider">
              <span>OR</span>
            </div>

            {/* Social Logins */}
            <div className="social-buttons">
              <button 
                type="button"
                className="social-btn" 
                onClick={() => handleSocialAuth('Google')}
              >
                <span>🌐</span> Google
              </button>
              <button 
                type="button"
                className="social-btn" 
                onClick={() => handleSocialAuth('GitHub')}
              >
                <span>💻</span> GitHub
              </button>
            </div>

            {/* Bottom Toggle Sign In / Sign Up */}
            <div className="auth-footer">
              {authMode === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    className="toggle-mode-btn"
                    onClick={() => { setAuthMode('signup'); setNotice({ show: false }); }}
                  >
                    Sign Up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="toggle-mode-btn"
                    onClick={() => { setAuthMode('login'); setNotice({ show: false }); }}
                  >
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </>
        )}

        {/* ─────────────────────────────────────────────────────────── */}
        {/* VIEW 2: FORGOT PASSWORD                                     */}
        {/* ─────────────────────────────────────────────────────────── */}
        {authMode === 'forgot-password' && (
          <div className="auth-recovery-view">
            <form onSubmit={handleForgotPassword} className="auth-form">
              <div className="form-group">
                <label>Account Email or Recovery Email</label>
                <input
                  type="email"
                  placeholder="Enter registered email or recovery email"
                  required
                  value={formData.emailOrRecovery}
                  onChange={(e) => setFormData({ ...formData, emailOrRecovery: e.target.value })}
                  className="auth-input"
                />
              </div>

              <div className="form-group">
                <label>Set New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 8 chars + special char (e.g. NewPass#99)"
                    required
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    className="auth-input password-field"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    <span style={{ fontSize: '0.74rem', fontWeight: 600 }}>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <div className="password-rules-hint">
                  <span className={formData.newPassword.length >= 8 ? 'rule-met' : 'rule-unmet'}>
                    {formData.newPassword.length >= 8 ? '✓' : '•'} 8+ characters
                  </span>
                  <span className={/[!@#$%^&*(),.?":{}|<>_\-+=\\[\]`~]/.test(formData.newPassword) ? 'rule-met' : 'rule-unmet'}>
                    {/[!@#$%^&*(),.?":{}|<>_\-+=\\[\]`~]/.test(formData.newPassword) ? '✓' : '•'} Special char (@, #, $, %, !)
                  </span>
                </div>
              </div>

              <button type="submit" className="submit-btn">
                🔒 Update & Save New Password
              </button>
            </form>

            <div className="auth-footer" style={{ marginTop: '1.2rem' }}>
              <button
                type="button"
                className="toggle-mode-btn"
                onClick={() => { setAuthMode('login'); setNotice({ show: false }); }}
              >
                ← Return to Sign In
              </button>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────── */}
        {/* VIEW 3: FORGOT EMAIL                                        */}
        {/* ─────────────────────────────────────────────────────────── */}
        {authMode === 'forgot-email' && (
          <div className="auth-recovery-view">
            <form onSubmit={handleForgotEmail} className="auth-form">
              <div className="form-group">
                <label>Recovery Email Address</label>
                <input
                  type="email"
                  placeholder="Enter your recovery email"
                  required
                  value={formData.recoveryEmail}
                  onChange={(e) => setFormData({ ...formData, recoveryEmail: e.target.value })}
                  className="auth-input"
                />
              </div>

              <button type="submit" className="submit-btn">
                🔍 Find My Account Email
              </button>
            </form>

            {recoveredEmails.length > 0 && (
              <div className="recovered-emails-box">
                <h4>Registered Account(s) Found:</h4>
                {recoveredEmails.map((acc, idx) => (
                  <div key={idx} className="recovered-email-item">
                    <div>
                      <div className="recovered-email-name">{acc.name} ({acc.role})</div>
                      <code className="recovered-email-value">{acc.email}</code>
                    </div>
                    <button
                      type="button"
                      className="use-email-btn"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, email: acc.email }));
                        setAuthMode('login');
                        showNotice(`Selected email "${acc.email}". Enter password to sign in.`, 'info');
                      }}
                    >
                      Use Email →
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="auth-footer" style={{ marginTop: '1.2rem' }}>
              <button
                type="button"
                className="toggle-mode-btn"
                onClick={() => { setAuthMode('login'); setNotice({ show: false }); setRecoveredEmails([]); }}
              >
                ← Return to Sign In
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default AuthPage;