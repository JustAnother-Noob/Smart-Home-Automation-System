const tempEmail = require('disposable-email-domains'); // to check for disposable email
const disposableEmails = new Set(tempEmail);


// Validating email
const validateEmail = (email) => {

    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return false;
    }

    // Get domain from email and compare to disposable emails list
    const domain = email.split('@')[1].toLowerCase();
    return !disposableEmails.has(domain);
};

// ********************** Validate password *******************************
const validatePassword = (password) => {
    const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password),
        special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    return {
        valid: Object.values(requirements).every(Boolean),
        requirements
    };
};

module.exports = { validateEmail, validatePassword };
