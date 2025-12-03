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

function validateGroupCreation(data) {
    const errors = [];
    
    if (!data.name || typeof data.name !== 'string') {
        errors.push('Group name is required');
    } else if (data.name.trim().length < 2) {
        errors.push('Group name must be at least 2 characters');
    } else if (data.name.trim().length > 100) {
        errors.push('Group name is too long (max 100 characters)');
    }
    
    if (data.group_type && !['street', 'block', 'neighborhood', 'interest'].includes(data.group_type)) {
        errors.push('Invalid group type');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

function validateMessage(data) {
    const errors = [];
    
    if (!data.content || typeof data.content !== 'string') {
        errors.push('Message content is required');
    } else if (data.content.trim().length === 0) {
        errors.push('Message cannot be empty');
    } else if (data.content.length > 5000) {
        errors.push('Message is too long (max 5000 characters)');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

function validateDirectMessage(data) {
    const errors = [];
    
    if (!data.receiver_id) {
        errors.push('Receiver ID is required');
    } else if (typeof data.receiver_id !== 'number' || data.receiver_id <= 0) {
        errors.push('Invalid receiver ID');
    }
    
    if (!data.content || typeof data.content !== 'string') {
        errors.push('Message content is required');
    } else if (data.content.trim().length === 0) {
        errors.push('Message cannot be empty');
    } else if (data.content.length > 5000) {
        errors.push('Message is too long (max 5000 characters)');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    validateEmail,
    validatePassword,
    validateName,
    sanitizeInput,
    validateGroupCreation,
    validateMessage,
    validateDirectMessage
};
