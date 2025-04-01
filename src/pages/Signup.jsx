import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { FaEye, FaEyeSlash, FaSpinner } from 'react-icons/fa';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });
  const [termsAccepted, setTermsAccepted] = useState(true);
  const navigate = useNavigate();

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePassword = (password) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };
    setPasswordRequirements(requirements);
    return Object.values(requirements).every(Boolean);
  };

  useEffect(() => {
    if (password) validatePassword(password);
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!validateEmail(email)) newErrors.email = 'Invalid email address';
    if (!validatePassword(password)) newErrors.password = 'Password does not meet requirements';
    if (password !== confirmPassword) newErrors.confirm = 'Passwords do not match';
    if (!termsAccepted) newErrors.terms = 'You must agree to the terms and conditions';
    if (!recaptchaToken) newErrors.recaptcha = 'Please complete the security check';

    if (Object.keys(newErrors).length > 0) return setErrors(newErrors);

    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:5001/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, recaptchaToken }),
      });

      const data = await response.json();
      if (response.ok) {
        navigate(`/otp-verify?email=${encodeURIComponent(email)}`);
      } else {
        setErrors({ form: data.message || 'Sign-up failed' });
      }
    } catch (error) {
      setErrors({ form: 'Connection error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 sm:p-8 transition-all hover:transform hover:-translate-y-1">
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">Sign Up</h2>
        
        {errors.form && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-center">
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 ${
                errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => document.getElementById('passwordRules').classList.remove('hidden')}
                onBlur={() => !password && document.getElementById('passwordRules').classList.add('hidden')}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 ${
                  errors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
            
            <div id="passwordRules" className="mt-2 p-3 bg-gray-50 rounded-lg transition-all duration-300 hidden">
              <ul className="space-y-1 text-sm">
                <li className={passwordRequirements.length ? 'text-green-600' : 'text-red-600'}>≥ 8 characters</li>
                <li className={passwordRequirements.uppercase ? 'text-green-600' : 'text-red-600'}>Uppercase letter</li>
                <li className={passwordRequirements.lowercase ? 'text-green-600' : 'text-red-600'}>Lowercase letter</li>
                <li className={passwordRequirements.number ? 'text-green-600' : 'text-red-600'}>Number</li>
                <li className={passwordRequirements.special ? 'text-green-600' : 'text-red-600'}>Special character</li>
              </ul>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 ${
                  errors.confirm ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {errors.confirm && <p className="text-red-500 text-sm mt-1">{errors.confirm}</p>}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-gray-600">
              I agree to the <a href="#" className="text-blue-600 hover:underline">terms and conditions</a>
            </span>
          </div>
          {errors.terms && <p className="text-red-500 text-sm mt-1">{errors.terms}</p>}

          <ReCAPTCHA
            sitekey="6LdHU_0qAAAAAPeJGSJhhVigGOoMTRv5peDU9uG4"
            onChange={(token) => setRecaptchaToken(token)}
            onExpired={() => setRecaptchaToken('')}
            onErrored={() => setErrors({...errors, recaptcha: 'reCAPTCHA error'})}
            className="[&>div]:mx-auto scale-90 md:scale-100"
          />
          {errors.recaptcha && <p className="text-red-500 text-sm mt-1">{errors.recaptcha}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed relative"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" />
                Creating Account...
              </span>
            ) : (
              'Sign Up'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="text-blue-600 hover:underline font-medium">
            Log in
          </a>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-white/90 flex items-center justify-center z-50">
            <div className="flex flex-col items-center">
              <FaSpinner className="animate-spin text-blue-600 text-4xl mb-4" />
              <p className="text-gray-600">Creating your account...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}