// ==============================================
// Configuration
// ==============================================

const CONFIG = {
    // ВАЖНО: Замени этот URL на Web App URL из твоего Google Apps Script
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxBF-s8j1z-W1pFNNlU2OG6M7d71K69D4uM0UVIlo986lbiL5DXe3mzMc4p2fKllRPc/exec',
    
    // URL бесплатного материала
    NOTION_URL: 'https://www.notion.so/English-collocations-katya-proeng-284ecf12da6e80d2a797cb7b92229792',
    
    // Время задержки перед редиректом (в миллисекундах)
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
                .catch(() => success("cz"));
        },
        utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/js/utils.js",
        preferredCountries: ["cz", "us", "gb", "ru", "ua", "pl", "de", "kr", "dk"],
        separateDialCode: true,
        formatOnDisplay: true,
        nationalMode: false,
        autoPlaceholder: "aggressive",
        customContainer: "iti-width-full",
        dropdownContainer: document.body
    });
    
    // Инициализация обработчиков формы
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

// Показать ошибку
function showError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    const inputElement = document.getElementById(fieldId);
    
    if (errorElement && inputElement) {
        errorElement.textContent = message;
        inputElement.classList.add('error');
    }
}

// Очистить ошибку
function clearError(fieldId) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    const inputElement = document.getElementById(fieldId);
    
    if (errorElement && inputElement) {
        errorElement.textContent = '';
        inputElement.classList.remove('error');
    }
}

// Валидация одного поля
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

// Валидация всей формы
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
    
    // Валидация при потере фокуса
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
    
    // Обработка отправки формы
    form.addEventListener('submit', handleFormSubmit);
}

// ==============================================
// Form Submission
// ==============================================

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Проверка honeypot (защита от спама)
    const honeypot = document.getElementById('website');
    if (honeypot && honeypot.value) {
        console.log('Spam detected');
        return;
    }
    
    // Валидация формы
    if (!validateForm()) {
        // Прокрутка к первой ошибке
        const firstError = document.querySelector('.form-input.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    // Получение данных формы
    const formData = getFormData();
    
    // Показать состояние загрузки
    showLoadingState();
    
    // Отправка данных в Google Sheets
    try {
        await submitToGoogleSheets(formData);
        showSuccessAndRedirect();
    } catch (error) {
        console.error('Error submitting form:', error);
        handleSubmissionError(error);
    }
}

// Получить данные формы
function getFormData() {
    const email = document.getElementById('email').value.trim();
    const phoneNumber = phoneInput.getNumber(); // Полный номер с кодом страны
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

// Показать состояние загрузки
function showLoadingState() {
    const form = document.getElementById('leadForm');
    const loadingState = document.getElementById('loadingState');
    const submitBtn = document.getElementById('submitBtn');
    
    submitBtn.disabled = true;
    form.style.opacity = '0.5';
    form.style.pointerEvents = 'none';
    loadingState.style.display = 'block';
}

// Скрыть состояние загрузки
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
    // Проверка конфигурации
    if (!CONFIG.GOOGLE_SCRIPT_URL || CONFIG.GOOGLE_SCRIPT_URL.includes('YOUR_GOOGLE')) {
        console.warn('Google Apps Script URL not configured. Using mock submission.');
        // Имитация задержки сети для тестирования
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { success: true, mock: true };
    }
    
    const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Важно для Google Apps Script
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    });
    
    // При mode: 'no-cors' response всегда opaque, поэтому считаем успешным
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
    
    // Автоматический редирект через заданное время
    setTimeout(() => {
        redirectToNotion();
    }, CONFIG.REDIRECT_DELAY);
    
    // Обработка ручного клика
    const manualLink = document.getElementById('manualLink');
    if (manualLink) {
        manualLink.addEventListener('click', (e) => {
            e.preventDefault();
            redirectToNotion();
        });
    }
    
    // Закрытие модалки при клике на overlay
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
// Analytics & Tracking (Optional)
// ==============================================

function trackEvent(eventName, eventData) {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, eventData);
    }
    
    // Facebook Pixel
    if (typeof fbq !== 'undefined') {
        fbq('track', eventName, eventData);
    }
    
    console.log('Event tracked:', eventName, eventData);
}

// Отслеживание просмотра формы
trackEvent('form_view', {
    form_name: '21 Collocations Lead Magnet',
    page_url: window.location.href
});

// ==============================================
// Keyboard Navigation
// ==============================================

document.addEventListener('keydown', function(e) {
    // Enter на последнем поле отправляет форму
    if (e.key === 'Enter' && e.target.id === 'phone') {
        e.preventDefault();
        const form = document.getElementById('leadForm');
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
    
    // Escape закрывает success modal
    if (e.key === 'Escape') {
        const successModal = document.getElementById('successModal');
        if (successModal && successModal.style.display === 'flex') {
            redirectToNotion();
        }
    }
});

console.log('✅ Lead capture form initialized');
console.log('📝 Remember to update CONFIG.GOOGLE_SCRIPT_URL with your Google Apps Script URL');
