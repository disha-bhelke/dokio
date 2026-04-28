import React, { useState } from 'react';
import api from '../services/api';
import { FileText, Shield, Zap } from 'lucide-react';
import './Landing.css';

const Landing = ({ setAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';

      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : {
            username: formData.username,
            email: formData.email,
            password: formData.password,
            confirmPassword: formData.confirmPassword,
          };

      const { data } = await api.post(endpoint, payload);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      setAuth(true);
    } catch (err) {
      console.error('Auth Error:', err);
      setError(
        err.response?.data?.message || 
        err.message || 
        'An error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setFormData({ username: '', email: '', password: '', confirmPassword: '' });
    setError('');
  };

  return (
    <div className="landing-container">
      <nav className="navbar">
        <div className="logo">
          <FileText size={"2rem"} color="#2563eb" />
          <span>Dokio</span>
        </div>
      </nav>

      <main className="hero-section">
        <div className="auth-wrapper">
          <div className="auth-form-container">
            <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
              {!isLogin && (
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Enter your username"
                    required={!isLogin}
                    disabled={loading}
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
              </div>

              {!isLogin && (
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm your password"
                    required={!isLogin}
                    disabled={loading}
                  />
                </div>
              )}

              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
              </button>
            </form>

            <div className="auth-toggle">
              <p>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={toggleAuthMode}
                  className="toggle-button"
                  disabled={loading}
                >
                  {isLogin ? 'Sign Up' : 'Login'}
                </button>
              </p>
            </div>
          </div>

          <div className="features-section">
            <h1 className="hero-title">Manage Documents with Elegance.</h1>
            <p className="hero-subtitle">Store, organize, scan, and convert your important files into professional PDFs in seconds.</p>

            <div className="features-grid">
              <div className="feature-card">
                <Zap size={"2rem"} color="#2563eb" className="feature-icon" />
                <h3>Lightning Fast</h3>
                <p>Upload and organize documents instantly.</p>
              </div>
              <div className="feature-card">
                <Shield size={"2rem"} color="#2563eb" className="feature-icon" />
                <h3>Secure Storage</h3>
                <p>Your files are protected with enterprise-grade security.</p>
              </div>
              <div className="feature-card">
                <FileText size={"2rem"} color="#2563eb" className="feature-icon" />
                <h3>PDF Generation</h3>
                <p>Convert and combine your scans into professional PDFs.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Landing;
