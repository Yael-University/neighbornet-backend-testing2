const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return { valid: false, message: 'Email is required' };
    }
    const trimmed = email.trim().toLowerCase();
    if (!emailRegex.test(trimmed)) {
        return { valid: false, message: 'Invalid email format' };
    }
    return { valid: true };
}

function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, message: 'Password is required' };
    }
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    // at least one letter and one number
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
        return { valid: false, message: 'Password must contain at least one letter and one number' };
    }
    return { valid: true };
}

function validateName(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, message: 'Name is required' };
    }
    const trimmed = name.trim();
    if (trimmed.length < 2) {
        return { valid: false, message: 'Name must be at least 2 characters' };
    }
    if (trimmed.length > 100) {
        return { valid: false, message: 'Name is too long' };
    }
    return { valid: true };
}

function sanitizeInput(value) {
    if (typeof value !== 'string') return value;
    return value.trim();
}

module.exports = {
    validateEmail,
    validatePassword,
    validateName,
    sanitizeInput
};
