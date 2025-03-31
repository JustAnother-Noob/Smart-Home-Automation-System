import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaSpinner } from 'react-icons/fa';

export default function OtpVerify() {
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const email = searchParams.get('email');

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('http://localhost:5001/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });

      const data = await response.json();

      if (response.ok) {
        setMessageType('success');
        setMessage('Verification successful! Redirecting...');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setMessageType('error');
        setMessage(data.message || 'Verification failed');
      }
    } catch (error) {
      setMessageType('error');
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResendDisabled(true);
    setMessage('Sending new OTP...');
    setMessageType('info');

    try {
      const response = await fetch('http://localhost:5001/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setMessageType('success');
        setMessage('New OTP sent successfully!');
        setCountdown(60); // 1 minute countdown
      } else {
        setMessageType('error');
        setMessage(data.message || 'Failed to resend OTP');
        if (response.status === 429) setCountdown(300); // 5 minutes if rate limited
      }
    } catch (error) {
      setMessageType('error');
      setMessage('Failed to resend OTP');
    } finally {
      setTimeout(() => setResendDisabled(false), countdown * 1000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-gray-800 text-center mb-8">
          Verify Your Email
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="number"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="000000"
            className="w-full text-3xl text-center tracking-[1rem] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors relative"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <FaSpinner className="animate-spin mr-2" />
                Verifying...
              </span>
            ) : (
              'Verify Account'
            )}
          </button>

          {message && (
            <div
              className={`p-3 rounded-lg text-center ${
                messageType === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : messageType === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {message}
            </div>
          )}

          <div className="text-center text-gray-600 mt-6">
            Didn't receive the code?{' '}
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={resendDisabled || countdown > 0}
              className="text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}