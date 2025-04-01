import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { FaSpinner } from 'react-icons/fa';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [recaptchaError, setRecaptchaError] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [showVerificationStatus, setShowVerificationStatus] = useState(false);
  const navigate = useNavigate();

  // Check for verification success
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.has('verified')) {
      setShowVerificationStatus(true);
      setTimeout(() => setShowVerificationStatus(false), 5000);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!recaptchaToken) {
      setRecaptchaError('Please complete the security check');
      return;
    }

    setLoading(true);
    setStatusMessage({ text: '', type: '' });

    try {
      // Replace with your actual API call
      const response = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, recaptchaToken }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatusMessage({ text: 'Login successful! Redirecting...', type: 'success' });
        setTimeout(() => navigate('/'), 1500);
      } else {
        setStatusMessage({ text: data.message || 'Login failed', type: 'error' });
      }
    } catch (error) {
      setStatusMessage({ text: 'Connection error. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
      setRecaptchaToken(''); // Reset reCAPTCHA
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 sm:p-8 transition-all hover:transform hover:-translate-y-1">
        {/* Logo - Update with your actual logo path */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 uppercase tracking-wide">
            Smart Living
          </h1>
        </div>

        {showVerificationStatus && (
          <div className="mb-6 p-3 bg-green-50 text-green-700 rounded-lg border border-green-200 text-center">
            Email verified successfully! You can now login.
          </div>
        )}

        <h2 className="text-gray-800 text-xl text-center font-semibold mb-8">
          Welcome Back
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-gray-700 font-medium mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-gray-700 font-medium mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              required
            />
          </div>

          <ReCAPTCHA
            sitekey="6LdHU_0qAAAAAPeJGSJhhVigGOoMTRv5peDU9uG4"
            onChange={(token) => {
              setRecaptchaToken(token);
              setRecaptchaError('');
            }}
            onExpired={() => setRecaptchaError('reCAPTCHA expired. Please complete it again.')}
            onErrored={() => setRecaptchaError('reCAPTCHA encountered an error. Please refresh the page.')}
            className="[&>div]:mx-auto"
          />
          {recaptchaError && (
            <p className="text-red-600 text-sm text-center">{recaptchaError}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors relative"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" />
                Authenticating...
              </span>
            ) : (
              'Login'
            )}
          </button>

          {statusMessage.text && (
            <div
              className={`p-3 rounded-lg text-center ${
                statusMessage.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {statusMessage.text}
            </div>
          )}
        </form>

        <div className="mt-6 text-center space-x-3">
          <a
            href="/forgot-password"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            Forgot Password?
          </a>
          <span className="text-gray-300">|</span>
          <a
            href="/signup"
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            Create Account
          </a>
        </div>
      </div>
    </div>
  );
}