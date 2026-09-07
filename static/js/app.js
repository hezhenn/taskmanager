// State & Token Management
const API_BASE = '/api/v1';

const TokenManager = {
    getAccess: () => localStorage.getItem('access_token'),
    getRefresh: () => localStorage.getItem('refresh_token'),
    setTokens: (access, refresh) => {
        if (access) localStorage.setItem('access_token', access);
        if (refresh) localStorage.setItem('refresh_token', refresh);
    },
    clear: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    },
    isAuthenticated: () => !!localStorage.getItem('access_token'),
};

// UI Elements
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const navUser = document.getElementById('navUser');
const userNameGreeting = document.getElementById('userNameGreeting');
const logoutBtn = document.getElementById('logoutBtn');
const authAlert = document.getElementById('authAlert');

const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// Helper to show/hide alerts
function showError(message) {
    authAlert.textContent = message;
    authAlert.classList.remove('hidden');
}

function clearError() {
    authAlert.textContent = '';
    authAlert.classList.add('hidden');
}

// Tab Switching
tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    clearError();
});

tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    clearError();
});

// Switch view between Authenticated App and Login Screen
function setAuthenticatedView(user) {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    navUser.classList.remove('hidden');
    userNameGreeting.textContent = `Hello, ${user.username}`;
}

function setAnonymousView() {
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    navUser.classList.add('hidden');
    userNameGreeting.textContent = '';
}

// Authentication API calls
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_BASE}/auth/token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Invalid username or password');
        }

        TokenManager.setTokens(data.access, data.refresh);
        await initApp();
    } catch (err) {
        showError(err.message);
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;

    try {
        const response = await fetch(`${API_BASE}/auth/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                email,
                password,
                password_confirm: passwordConfirm
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMsg = Object.entries(data)
                .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
                .join(' | ');
            throw new Error(errorMsg || 'Registration failed');
        }

        // Auto-login after successful registration
        const tokenResponse = await fetch(`${API_BASE}/auth/token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const tokenData = await tokenResponse.json();
        TokenManager.setTokens(tokenData.access, tokenData.refresh);
        await initApp();
    } catch (err) {
        showError(err.message);
    }
});

logoutBtn.addEventListener('click', () => {
    TokenManager.clear();
    setAnonymousView();
});

// App Initialization
async function initApp() {
    if (!TokenManager.isAuthenticated()) {
        setAnonymousView();
        return;
    }

    try {
        const profileResponse = await fetch(`${API_BASE}/auth/me/`, {
            headers: {
                'Authorization': `Bearer ${TokenManager.getAccess()}`
            }
        });

        if (profileResponse.status === 401) {
            // Token expired or invalid
            TokenManager.clear();
            setAnonymousView();
            return;
        }

        const user = await profileResponse.json();
        setAuthenticatedView(user);
    } catch (err) {
        TokenManager.clear();
        setAnonymousView();
    }
}

// Start on page load
document.addEventListener('DOMContentLoaded', initApp);