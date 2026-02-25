// ==============================================
// Configuration
// ==============================================

const CONFIG = {
    // Your Google Apps Script Web App URL
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxBF-s8j1z-W1pFNNlU2OG6M7d71K69D4uM0UVIlo986lbiL5DXe3mzMc4p2fKllRPc/exec',
    
    // Notion guide URL
    NOTION_URL: 'https://www.notion.so/English-collocations-katya-proeng-284ecf12da6e80d2a797cb7b92229792',
    
    // Redirect delay in milliseconds
    REDIRECT_DELAY: 3000
};

// ==============================================
// Initialize International Phone Input
// ==============================================

let phoneInput;

document.addEventListener('DOMContentLoaded', function() {
    const phoneInputElement = document.querySelector("#phone");
    
    phoneInput = window.intlTelInput(phoneInputElement, {
        initialCountry: "auto",
        geoIpLookup: function(success, failure) {
            fetch("https://ipapi.co/json")
                .then(res => res.json())
                .then(data => success(data.country_code))
                .catch(() => success("us"));
        },
        utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/js/utils.js",
        preferredCountries: ["us", "gb", "ru", "ua", "cz", "pl", "de"],
        separateDialCode: true,
        formatOnDisplay: true,
        nationalMode: false,
        autoPlaceholder: "aggressive"
    });
    
    initializeForm();
});

// ==============================================
// Form Validation
// ==============================================

const validators = {
    email: {
        validate: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Email обязателен';
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                return 'Введите корректный email';
            }
            return null;
        }
    },
    
    phone: {
        validate: (value) => {
            if (!phoneInput) {
                return 'Телефон не инициализирован';
            }
            if (!phoneInput.isValidNumber()) {
                return 'Введите корректный номер телефона';
            }
            return null;
        }
    }
};

function showError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    const inputElement = document.getElementById(fieldId);
    if (errorElement && inputElement) {
        errorElement.textContent = message;
        inputElement.classList.add('error');
    }
}

function clearError(fieldId) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    const inputElement = document.getElementById(fieldId);
    if (errorElement && inputElement) {
        errorElement.textContent = '';
        inputElement.classList.remove('error');
    }
}

function validateField(fieldId) {
    const input = document.getElementById(fieldId);
    const validator = validators[fieldId];
    if (!input || !validator) return true;
    const error = validator.validate(input.value);
    if (error) {
        showError(fieldId, error);
        return false;
    } else {
        clearError(fieldId);
        return true;
    }
}

function validateForm() {
    let isValid = true;
    ['email', 'phone'].forEach(fieldId => {
        if (!validateField(fieldId)) {
            isValid = false;
        }
    });
    return isValid;
}

// ==============================================
// Form Initialization
// ==============================================

function initializeForm() {
    const form = document.getElementById('leadForm');
    const inputs = ['email', 'phone'];
    
    inputs.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            input.addEventListener('blur', () => validateField(fieldId));
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    clearError(fieldId);
                }
            });
        }
    });
    
    form.addEventListener('submit', handleFormSubmit);
}

// ==============================================
// Form Submission
// ==============================================

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const honeypot = document.getElementById('website');
    if (honeypot && honeypot.value) {
        console.log('Spam detected');
        return;
    }
    
    if (!validateForm()) {
        const firstError = document.querySelector('.form-input.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    const formData = getFormData();
    showLoadingState();
    
    try {
        await submitToGoogleSheets(formData);
        showSuccessAndRedirect();
    } catch (error) {
        console.error('Error submitting form:', error);
        handleSubmissionError(error);
    }
}

function getFormData() {
    const email = document.getElementById('email').value.trim();
    const phoneNumber = phoneInput.getNumber();
    const countryCode = phoneInput.getSelectedCountryData().dialCode;
    const countryName = phoneInput.getSelectedCountryData().name;
    
    return {
        email,
        phone: phoneNumber,
        countryCode: `+${countryCode}`,
        country: countryName,
        timestamp: new Date().toISOString(),
        source: 'Instagram - 21 Collocations Lead Magnet'
    };
}

function showLoadingState() {
    const form = document.getElementById('leadForm');
    const loadingState = document.getElementById('loadingState');
    const submitBtn = document.getElementById('submitBtn');
    
    submitBtn.disabled = true;
    form.style.opacity = '0.5';
    form.style.pointerEvents = 'none';
    loadingState.style.display = 'block';
}

function hideLoadingState() {
    const form = document.getElementById('leadForm');
    const loadingState = document.getElementById('loadingState');
    const submitBtn = document.getElementById('submitBtn');
    
    submitBtn.disabled = false;
    form.style.opacity = '1';
    form.style.pointerEvents = 'auto';
    loadingState.style.display = 'none';
}

// ==============================================
// Google Sheets Integration
// ==============================================

async function submitToGoogleSheets(data) {
    const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Required for Google Apps Script
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    });
    
    // With mode: 'no-cors', response is always opaque — treat as success
    return { success: true };
}

// ==============================================
// Success Handling
// ==============================================

function showSuccessAndRedirect() {
    hideLoadingState();
    
    const successModal = document.getElementById('successModal');
    successModal.classList.add('active');
    successModal.style.display = 'flex';
    
    setTimeout(() => {
        redirectToNotion();
    }, CONFIG.REDIRECT_DELAY);
    
    const manualLink = document.getElementById('manualLink');
    if (manualLink) {
        manualLink.addEventListener('click', (e) => {
            e.preventDefault();
            redirectToNotion();
        });
    }
    
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', () => {
            redirectToNotion();
        });
    }
}

function redirectToNotion() {
    window.location.href = CONFIG.NOTION_URL;
}

// ==============================================
// Error Handling
// ==============================================

function handleSubmissionError(error) {
    hideLoadingState();
    alert('Произошла ошибка при отправке формы. Пожалуйста, попробуйте ещё раз или свяжитесь с нами напрямую через Instagram @katya.proeng');
}

// ==============================================
// Keyboard Navigation
// ==============================================

document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.id === 'phone') {
        e.preventDefault();
        const form = document.getElementById('leadForm');
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
    
    if (e.key === 'Escape') {
        const successModal = document.getElementById('successModal');
        if (successModal && successModal.style.display === 'flex') {
            redirectToNotion();
        }
    }
});

console.log('✅ Lead capture form initialized');

// ==============================================
// Scroll Reveal Animation
// ==============================================

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Once revealed, stop observing
            revealObserver.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
});

// Observe all elements with .reveal class
document.querySelectorAll('.reveal').forEach(el => {
    revealObserver.observe(el);
});
