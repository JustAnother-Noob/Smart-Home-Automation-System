

document.addEventListener('DOMContentLoaded', () => {
  
  if (!window.auth || typeof window.auth.checkAdminAuth !== 'function') {
    console.error('AuthService not properly initialized. Redirecting to login.');
    window.location.href = 'user_login.html?error=auth_service_missing';
    return;
  }

  try {
    const rawToken = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole');
    const userEmail = localStorage.getItem('userEmail');
    console.log('[AdminSettings] Auth Debug:', { 
      tokenPresent: !!rawToken, 
      role, 
      email: userEmail,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('[AdminSettings] Error checking auth status:', e);
  }

  if (!window.auth.checkAdminAuth()) {
    console.error('[AdminSettings] Admin auth check failed');
    return; 
  }

  if (!window.api || typeof window.api.request !== 'function') {
    console.warn('API service missing, creating enhanced fallback instance');
    window.api = {
      async request(endpoint, method = 'GET', data) {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('No authentication token available');
        }

        try {
          const response = await fetch(`${window.location.origin.replace(':3000', ':5000')}/api${endpoint}`, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: method === 'GET' ? undefined : JSON.stringify(data || {})
          });
          return await response.json();
        } catch (error) {
          console.error('API request failed:', error);
          throw error;
        }
      },
      async get(endpoint) { return this.request(endpoint, 'GET'); }
    };
  }

  bindSecurityForm();
  initializeDarkModeSettings();

  if (window.RefreshUtils && window.RefreshUtils.manager) {
    
    window.RefreshUtils.manager.register('refreshSettings', () => {
      
      return new Promise((resolve) => {
        setTimeout(() => {
          window.location.reload();
          resolve();
        }, 500);
      });
    }, {
      normalText: 'Settings',
      loadingText: 'Refreshing settings...',
      successText: 'Settings refreshed!',
      errorText: 'Failed to refresh'
    });
  }
});

function bindSecurityForm() {
  const form = document.getElementById('securityForm');
  if (!form) {
    console.warn('[AdminSettings] securityForm not found');
    return;
  }

  const strengthBadge = document.getElementById('passwordStrengthBadge');
  const strengthLabel = document.getElementById('passwordStrengthLabel');
  const strengthScore = document.getElementById('passwordStrengthScore');
  const strengthBar = document.getElementById('passwordStrengthBar');
  const overviewBar = document.getElementById('passwordStrengthOverviewBar');
  const strengthFeedback = document.getElementById('securityFeedback');
  const passwordLastChanged = document.getElementById('passwordLastChanged');
  const passwordLastChangedMeta = document.getElementById('passwordLastChangedMeta');
  const securityNextStep = document.getElementById('securityNextStep');

  const newPwdEl = document.getElementById('newPassword');
  const confirmPwdEl = document.getElementById('confirmPassword');
  const currentPwdEl = document.getElementById('currentPassword');
  const rulesPanel = document.getElementById('adminPasswordRules');

  const ruleMap = {
    length: document.getElementById('adm-length'),
    uppercase: document.getElementById('adm-uppercase'),
    lowercase: document.getElementById('adm-lowercase'),
    number: document.getElementById('adm-number'),
    special: document.getElementById('adm-special')
  };

  const toggleButtons = document.querySelectorAll('[data-toggle-password]');

  toggleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const inputId = btn.getAttribute('data-toggle-password');
      const input = document.getElementById(inputId);
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.setAttribute('aria-label', `${isPassword ? 'Hide' : 'Show'} ${btn.getAttribute('data-toggle-password')} password`);
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
      }
    });
  });

  const generateBtn = document.getElementById('generatePasswordBtn');
  const syncConfirmation = document.getElementById('syncConfirmation');

  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      const generated = generateStrongPassword();
      if (!newPwdEl) return;
      newPwdEl.value = generated;
      newPwdEl.dispatchEvent(new Event('input', { bubbles: true }));
      if (syncConfirmation?.checked && confirmPwdEl) {
        confirmPwdEl.value = generated;
        confirmPwdEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      showToast('Generated a strong password. Remember to store it securely.', 'info');
    });
  }

  let evaluator;

  async function hydrateSecurityOverview() {
    try {
      const response = await window.api.request('/admin/settings', 'GET');
      if (!response || !response.success || !response.data) return;

      const { data } = response;
      if (data.passwordChangedAt) {
        const changedDate = new Date(data.passwordChangedAt);
        if (!Number.isNaN(changedDate.valueOf()) && passwordLastChanged) {
          passwordLastChanged.textContent = changedDate.toLocaleString();
        }
        let days;
        if (passwordLastChangedMeta) {
          days = Math.floor((Date.now() - changedDate.getTime()) / (1000 * 60 * 60 * 24));
          passwordLastChangedMeta.textContent = days > 0
            ? `It has been ${days} day${days === 1 ? '' : 's'} since your last password update.`
            : 'Password was updated today.';
        }
        if ((days ?? daysSince(changedDate)) > 60 && securityNextStep) {
          securityNextStep.textContent = 'Update your password – it has been a while.';
        }
      }

      if (typeof data.passwordStrengthScore === 'number' && evaluator) {
        const sanitizedScore = Math.max(0, Math.min(5, data.passwordStrengthScore));
        evaluator.updateStrengthUI(sanitizedScore, false);
      }
    } catch (err) {
      console.warn('[AdminSettings] Unable to hydrate security overview', err);
    }
  }

  function daysSince(date) {
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  evaluator = new PasswordEvaluator({
    ruleMap,
    strengthBadge,
    strengthLabel,
    strengthScore,
    strengthBar,
    overviewBar,
    feedbackElement: strengthFeedback,
    rulesPanel
  });

  hydrateSecurityOverview();

  if (newPwdEl) {
    newPwdEl.addEventListener('focus', () => evaluator.showPanel());
    newPwdEl.addEventListener('blur', () => evaluator.hidePanel(newPwdEl.value));
    newPwdEl.addEventListener('input', () => evaluator.evaluate(newPwdEl.value, confirmPwdEl?.value));
  }

  if (confirmPwdEl) {
    confirmPwdEl.addEventListener('input', () => evaluator.evaluate(newPwdEl?.value || '', confirmPwdEl.value));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.auth.checkAdminAuth()) return;

    const payload = {
      currentPassword: currentPwdEl?.value || '',
      newPassword: newPwdEl?.value || '',
      confirmPassword: confirmPwdEl?.value || ''
    };

    const validation = evaluator.evaluate(payload.newPassword, payload.confirmPassword, { silent: true });
    if (!validation.success) {
      evaluator.showPanel(true);
      showToast(validation.message || 'Password requirements not met', 'error');
      return;
    }

    try {
      setFormLoadingState(form, true);
      AdminStatusMessage.show(strengthFeedback, 'Updating your admin credentials…', 'info');

      const res = await window.api.request('/admin/settings/password', 'PUT', payload);

      if (res?.success) {
        const successMessage = res.message || 'Password updated successfully';
        AdminStatusMessage.showSuccess(strengthFeedback, successMessage);
        showToast(successMessage, 'success');
        form.reset();
        evaluator.reset();
        hydrateSecurityOverview();
      } else {
        const message = res?.message || 'Failed to update password';
        AdminStatusMessage.showError(strengthFeedback, message);
        evaluator.applyServerFeedback(res?.requirements);
        showToast(message, 'error');
      }
    } catch (err) {
      console.error('Password update error', err);
      const message = err?.message || 'Password update failed';
      AdminStatusMessage.showError(strengthFeedback, message);
      showToast(message, 'error');
    } finally {
      setFormLoadingState(form, false);
    }
  });
}

class PasswordEvaluator {
  constructor(options = {}) {
    this.ruleMap = options.ruleMap || {};
    this.strengthBadge = options.strengthBadge;
    this.strengthLabel = options.strengthLabel;
    this.strengthScore = options.strengthScore;
    this.strengthBar = options.strengthBar;
    this.overviewBar = options.overviewBar;
    this.feedbackElement = options.feedbackElement;
    this.rulesPanel = options.rulesPanel;
    this.panelVisible = false;
    this.currentScore = 0;
  }

  evaluate(password = '', confirmation = '', { silent = false } = {}) {
    const results = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*]/.test(password)
    };

    const metCount = Object.values(results).filter(Boolean).length;
    const mismatch = confirmation && password !== confirmation;

    if (!silent) {
      this.updateRequirementUI(results);
      this.updateStrengthUI(metCount, mismatch);
    }

    if (mismatch) {
      return { success: false, message: 'Passwords do not match' };
    }

    const success = metCount === Object.keys(results).length;
    if (!success) {
      return { success: false, message: 'Password does not meet the security requirements' };
    }

    return { success: true, score: metCount };
  }

  updateRequirementUI(results = {}) {
    Object.entries(results).forEach(([key, isValid]) => {
      const element = this.ruleMap[key];
      if (!element) return;
      element.classList.toggle('is-valid', isValid);
      element.classList.toggle('invalid', !isValid);
      element.classList.toggle('valid', isValid);
      const icon = element.querySelector('i');
      if (icon) {
        icon.className = isValid ? 'fas fa-check-circle' : 'fas fa-circle-notch';
      }
    });
  }

  updateStrengthUI(score = 0, mismatch = false) {
    this.currentScore = score;
    const percent = Math.min(100, (score / 5) * 100);
    const color = this.mapScoreToColor(score, mismatch);
    const label = mismatch ? 'Passwords do not match' : this.mapScoreToLabel(score);

    if (this.strengthBadge) {
      this.strengthBadge.textContent = label;
    }
    if (this.strengthLabel) {
      const span = this.strengthLabel.querySelector('span');
      if (span) {
        span.textContent = label;
      } else {
        this.strengthLabel.textContent = label;
      }
    }
    if (this.strengthScore) {
      this.strengthScore.textContent = `${score} / 5 criteria met`;
    }
    if (this.strengthBar) {
      this.strengthBar.style.width = `${percent}%`;
      this.strengthBar.style.background = color;
    }
    if (this.overviewBar) {
      this.overviewBar.style.width = `${percent}%`;
      this.overviewBar.style.background = color;
    }
  }

  mapScoreToColor(score, mismatch) {
    if (mismatch) return '#ef4444';
    switch (score) {
      case 0:
      case 1:
        return '#ef4444';
      case 2:
        return '#f97316';
      case 3:
        return '#facc15';
      case 4:
        return '#38bdf8';
      case 5:
      default:
        return '#22c55e';
    }
  }

  mapScoreToLabel(score) {
    switch (score) {
      case 0:
      case 1:
        return 'Weak';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Strong';
      case 5:
        return 'Excellent';
      default:
        return 'Not evaluated';
    }
  }

  applyServerFeedback(requirements = {}) {
    if (!requirements || typeof requirements !== 'object') return;
    this.updateRequirementUI(requirements);
    const met = Object.values(requirements).filter(Boolean).length;
    this.updateStrengthUI(met, false);
  }

  reset() {
    this.updateRequirementUI({ length: false, uppercase: false, lowercase: false, number: false, special: false });
    this.updateStrengthUI(0, false);
    if (this.rulesPanel) {
      this.rulesPanel.style.display = 'none';
    }
    if (this.feedbackElement) {
      this.feedbackElement.style.display = 'none';
    }
  }

  showPanel(force = false) {
    if (this.rulesPanel) {
      this.rulesPanel.style.display = 'block';
    }
    if (this.feedbackElement) {
      this.feedbackElement.style.display = 'block';
    }
    this.panelVisible = true;
    if (force && this.feedbackElement) {
      this.feedbackElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  hidePanel(hasValue) {
    if (!hasValue && this.rulesPanel) {
      this.rulesPanel.style.display = 'none';
    }
  }
}

function generateStrongPassword() {
  const words = ['solar', 'matrix', 'quantum', 'fusion', 'nebula', 'zenith', 'apex', 'cipher'];
  const randomWord = () => words[Math.floor(Math.random() * words.length)];
  const randomNumber = () => Math.floor(100 + Math.random() * 900);
  const specialChars = '!@#$%^&*';
  const randomSpecial = () => specialChars[Math.floor(Math.random() * specialChars.length)];
  return `${capitalize(randomWord())}${randomNumber()}${randomSpecial()}${randomWord()}`;
}

function capitalize(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function setFormLoadingState(form, isLoading) {
  const submitBtn = form.querySelector('button[type="submit"]');
  if (!submitBtn) return;
  submitBtn.disabled = isLoading;
  const icon = submitBtn.querySelector('i');
  const textNode = submitBtn.querySelector('.button-text');
  if (isLoading) {
    if (icon) icon.className = 'fas fa-spinner fa-spin';
    if (textNode) textNode.textContent = 'Updating…';
  } else {
    if (icon) icon.className = 'fas fa-save';
    if (textNode) textNode.textContent = 'Update Password';
  }
}

function initializeDarkModeSettings() {
  
  const toggle = document.getElementById('darkModeToggle');
  if (toggle && window.darkModeManager) {
    toggle.checked = window.darkModeManager.isDarkMode();

    window.addEventListener('themeChanged', (e) => {
      toggle.checked = e.detail.theme === 'dark';
    });
  }
}

function showToast(message, type = 'info') {
  
  if (window.GlobalNotifier && typeof window.GlobalNotifier.notify === 'function') {
    try {
      window.GlobalNotifier.notify(message, type === 'info' ? 'info' : type, { timeout: 2500 });
      return;
    } catch (e) {
      
      console.warn('GlobalNotifier.notify failed, falling back to inline toast', e);
    }
  }

  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `position:fixed;bottom:20px;right:20px;padding:10px 16px;border-radius:4px;font-size:14px;color:#fff;z-index:9999;opacity:0;transition:opacity .3s ease;background:${type==='success' ? '#28a745' : type==='error' ? '#dc3545' : '#17a2b8'};box-shadow:0 2px 6px rgba(0,0,0,.2);`;
  document.body.appendChild(toast);
  requestAnimationFrame(()=> toast.style.opacity = '1');
  setTimeout(()=> { toast.style.opacity = '0'; setTimeout(()=> toast.remove(), 300); }, 2500);
}
