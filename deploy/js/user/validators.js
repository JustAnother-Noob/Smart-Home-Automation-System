

const validateName = (name) => {
  const NAME_REGEX = /^[a-zA-Z\s]{2,}$/;
  return NAME_REGEX.test(name.trim());
};

const validateEmail = (email) => {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return EMAIL_REGEX.test(email.trim());
};

const validatePassword = (passwordVal) => {
  return {
    length: passwordVal.length >= 8,
    uppercase: /[A-Z]/.test(passwordVal),
    lowercase: /[a-z]/.test(passwordVal),
    number: /\d/.test(passwordVal),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(passwordVal),
  };
};

const isPasswordValid = (requirements) => {
  return Object.values(requirements).every(Boolean);
};

export {
  validateName,
  validateEmail,
  validatePassword,
  isPasswordValid
};