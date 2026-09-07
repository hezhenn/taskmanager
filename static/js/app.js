/**
 * TaskFlow — Personal Task Management Platform
 * Frontend Architecture & State Management
 * Connects to Django REST Framework API with JWT Authentication
 */

'use strict';

const API_BASE = '/api/v1';

// ==========================================================================
// 1. Token & Authentication Management
// ==========================================================================
const TokenManager = {
    getAccess: () => localStorage.getItem('tf_access_token'),
    getRefresh: () => localStorage.getItem('tf_refresh_token'),
    setTokens: (access, refresh) => {
        if (access) localStorage.setItem('tf_access_token', access);
        if (refresh) localStorage.setItem('tf_refresh_token', refresh);
    },
    clear: () => {
        localStorage.removeItem('tf_access_token');
        localStorage.removeItem('tf_refresh_token');
    },
    isAuthenticated: () => !!localStorage.getItem('tf_access_token'),
};

// Global Current User State
let currentUser = null;

// Authenticated fetch with automatic token refresh on 401
async function authFetch(url, options = {}) {
    let accessToken = TokenManager.getAccess();

    const makeHeaders = (token) => ({
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        'Authorization': `Bearer ${token}`
    });

    let response = await fetch(url, {
        ...options,
        headers: makeHeaders(accessToken)
    });

    // If unauthorized, attempt to exchange refresh token once
    if (response.status === 401) {
        const refreshToken = TokenManager.getRefresh();
        if (refreshToken) {
            try {
                const refreshRes = await fetch(`${API_BASE}/auth/token/refresh/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh: refreshToken })
                });

                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    TokenManager.setTokens(data.access, data.refresh || refreshToken);

                    // Retry original request with fresh access token
                    response = await fetch(url, {
                        ...options,
                        headers: makeHeaders(data.access)
                    });
                } else {
                    TokenManager.clear();
                    showAuthView();
                    showToast('Session expired. Please sign in again.', 'error');
                    throw new Error('Session expired');
                }
            } catch (err) {
                TokenManager.clear();
                showAuthView();
                throw err;
            }
        } else {
            TokenManager.clear();
            showAuthView();
            showToast('Please sign in to continue.', 'info');
            throw new Error('Unauthorized');
        }
    }

    return response;
}

// ==========================================================================
// 2. Toast Notifications System
// ==========================================================================
function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else if (type === 'error') {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
        iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.innerHTML = `
        <span class="toast-icon">${iconSvg}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 220);
    }, duration);
}

// ==========================================================================
// 3. View Routing & Navigation
// ==========================================================================
let currentView = 'dashboard';

function navigateToView(viewName) {
    if (!['dashboard', 'tasks', 'today', 'completed', 'profile', 'docs'].includes(viewName)) {
        viewName = 'dashboard';
    }
    currentView = viewName;

    // Update active panel
    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
    const targetPanel = document.getElementById(`view${capitalize(viewName)}`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    // Update active nav item
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Close mobile sidebar if open
    document.getElementById('sidebar')?.classList.remove('mobile-open');

    // Trigger data fetch for current view
    refreshCurrentView();
}

function refreshCurrentView() {
    loadDashboardStatistics();

    if (currentView === 'dashboard') {
        loadDashboardRecentTasks();
    } else if (currentView === 'tasks') {
        loadTasksPage();
    } else if (currentView === 'today') {
        loadTodayTasks();
    } else if (currentView === 'completed') {
        loadCompletedTasks();
    } else if (currentView === 'profile') {
        populateProfileView();
    }
}

function setupRouting() {
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        navigateToView(hash);
    });

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            window.location.hash = view;
        });
    });

    document.getElementById('brandLink')?.addEventListener('click', () => {
        window.location.hash = 'dashboard';
    });
}

// ==========================================================================
// 4. UI Layout & Collapsible Sidebar
// ==========================================================================
function setupSidebarAndTopbar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const mobileBtn = document.getElementById('mobileMenuBtn');

    // Restore saved sidebar state
    const isCollapsed = localStorage.getItem('tf_sidebar_collapsed') === 'true';
    if (isCollapsed && sidebar) {
        sidebar.classList.add('collapsed');
    }

    toggleBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('tf_sidebar_collapsed', sidebar.classList.contains('collapsed'));
    });

    mobileBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
    });

    // Close drawer / modals on backdrop click
    document.getElementById('drawerCloseBtn')?.addEventListener('click', closeTaskDetails);
    document.getElementById('closeModalBtn')?.addEventListener('click', closeTaskModal);
    document.getElementById('cancelModalBtn')?.addEventListener('click', closeTaskModal);
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeTaskDetails();
            closeTaskModal();
            closeDeleteModal();
            document.getElementById('sidebar')?.classList.remove('mobile-open');
        } else if (e.key === '/' && !isInputActive()) {
            e.preventDefault();
            const searchInput = document.getElementById('globalSearchInput') || document.getElementById('tasksSearchInput');
            searchInput?.focus();
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            sidebar?.classList.toggle('collapsed');
            localStorage.setItem('tf_sidebar_collapsed', sidebar.classList.contains('collapsed'));
        }
    });

    // Global search input redirects to tasks view
    const globalSearch = document.getElementById('globalSearchInput');
    globalSearch?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = globalSearch.value.trim();
            window.location.hash = 'tasks';
            const tasksSearch = document.getElementById('tasksSearchInput');
            if (tasksSearch) {
                tasksSearch.value = query;
                tasksQueryState.search = query;
                tasksQueryState.page = 1;
                loadTasksPage();
            }
        }
    });

    // Header "+ New Task" button
    document.getElementById('headerNewTaskBtn')?.addEventListener('click', () => openCreateTaskModal());

    // Header avatar clicks to profile
    document.getElementById('headerAvatar')?.addEventListener('click', () => {
        window.location.hash = 'profile';
    });
}

function isInputActive() {
    const active = document.activeElement;
    return active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
}

// ==========================================================================
// 5. Auth View Management (Login & Registration)
// ==========================================================================
const authSection = document.getElementById('authSection');
const appLayout = document.getElementById('appLayout');
const authAlert = document.getElementById('authAlert');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');

function showAuthError(message) {
    if (!authAlert) return;
    authAlert.textContent = message;
    authAlert.classList.remove('hidden');
}

function clearAuthError() {
    if (!authAlert) return;
    authAlert.textContent = '';
    authAlert.classList.add('hidden');
}

function showAuthView() {
    authSection?.classList.remove('hidden');
    appLayout?.classList.add('hidden');
    clearAuthError();
}

function showAppView(user) {
    authSection?.classList.add('hidden');
    appLayout?.classList.remove('hidden');

    currentUser = user;
    updateUserDisplays(user);

    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateToView(hash);
}

function updateUserDisplays(user) {
    const displayName = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.username;
    const initial = (user.username || 'U').charAt(0).toUpperCase();

    // Greeting according to time of day
    const hour = new Date().getHours();
    let timeGreeting = 'Welcome back';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 18) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    document.getElementById('topGreeting').textContent = `${timeGreeting}, ${displayName}`;
    document.getElementById('topSubtitle').textContent = `Here's what you have on your plate today`;

    document.getElementById('sidebarUsername').textContent = displayName;
    document.getElementById('sidebarEmail').textContent = user.email || `${user.username}@taskflow.local`;
    document.getElementById('sidebarAvatar').textContent = initial;
    document.getElementById('headerAvatar').textContent = initial;
}

function setupAuthForms() {
    tabLogin?.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        authTitle.textContent = 'Welcome back';
        authSubtitle.textContent = 'Sign in to your account to manage your tasks';
        clearAuthError();
    });

    tabRegister?.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        authTitle.textContent = 'Create your account';
        authSubtitle.textContent = 'Start organizing your tasks with TaskFlow';
        clearAuthError();
    });

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAuthError();
        const submitBtn = document.getElementById('loginSubmitBtn');
        setButtonLoading(submitBtn, true, 'Signing in...');

        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            const res = await fetch(`${API_BASE}/auth/token/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Invalid username or password.');
            }

            TokenManager.setTokens(data.access, data.refresh);
            await fetchUserProfileAndInit();
            showToast(`Welcome back, ${username}!`, 'success');
        } catch (err) {
            showAuthError(err.message);
        } finally {
            setButtonLoading(submitBtn, false, 'Sign In');
        }
    });

    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAuthError();
        const submitBtn = document.getElementById('registerSubmitBtn');
        setButtonLoading(submitBtn, true, 'Creating account...');

        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const passwordConfirm = document.getElementById('regPasswordConfirm').value;

        if (password !== passwordConfirm) {
            showAuthError('Passwords do not match.');
            setButtonLoading(submitBtn, false, 'Create Account');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/auth/register/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    password_confirm: passwordConfirm
                })
            });

            const data = await res.json();
            if (!res.ok) {
                const errorStr = Object.entries(data)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join(' | ');
                throw new Error(errorStr || 'Registration failed.');
            }

            // Auto-login upon registration
            const tokenRes = await fetch(`${API_BASE}/auth/token/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const tokenData = await tokenRes.json();
            TokenManager.setTokens(tokenData.access, tokenData.refresh);

            await fetchUserProfileAndInit();
            showToast('Account created successfully!', 'success');
        } catch (err) {
            showAuthError(err.message);
        } finally {
            setButtonLoading(submitBtn, false, 'Create Account');
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        TokenManager.clear();
        currentUser = null;
        showAuthView();
        showToast('Signed out successfully.', 'info');
    });
}

async function fetchUserProfileAndInit() {
    const res = await authFetch(`${API_BASE}/auth/me/`);
    if (res.ok) {
        const user = await res.json();
        showAppView(user);
    }
}

// ==========================================================================
// 6. Statistics & Dashboard View
// ==========================================================================
async function loadDashboardStatistics() {
    try {
        const res = await authFetch(`${API_BASE}/tasks/statistics/`);
        if (!res.ok) return;

        const stats = await res.json();

        // Update Stat Cards
        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statTodo').textContent = stats.by_status.todo;
        document.getElementById('statInProgress').textContent = stats.by_status.in_progress;
        document.getElementById('statDone').textContent = stats.by_status.done;
        document.getElementById('statRateBadge').textContent = `${stats.completion_rate_percentage}%`;
        document.getElementById('statOverdue').textContent = stats.overdue;

        // Overdue visual emphasis
        const overdueCard = document.getElementById('statOverdueCard');
        if (stats.overdue > 0) {
            overdueCard?.classList.add('has-overdue');
            document.getElementById('navTodayBadge')?.classList.remove('hidden');
        } else {
            overdueCard?.classList.remove('has-overdue');
            document.getElementById('navTodayBadge')?.classList.add('hidden');
        }

        // Priority Breakdown
        const totalPriority = (stats.by_priority.high + stats.by_priority.medium + stats.by_priority.low) || 1;
        const pctHigh = ((stats.by_priority.high / totalPriority) * 100).toFixed(1);
        const pctMedium = ((stats.by_priority.medium / totalPriority) * 100).toFixed(1);
        const pctLow = ((stats.by_priority.low / totalPriority) * 100).toFixed(1);

        document.getElementById('countHigh').textContent = stats.by_priority.high;
        document.getElementById('countMedium').textContent = stats.by_priority.medium;
        document.getElementById('countLow').textContent = stats.by_priority.low;

        document.getElementById('priorityBarHigh').style.width = `${pctHigh}%`;
        document.getElementById('priorityBarMedium').style.width = `${pctMedium}%`;
        document.getElementById('priorityBarLow').style.width = `${pctLow}%`;

        // Update sidebar count
        document.getElementById('navTasksCount').textContent = stats.total - stats.by_status.done;
    } catch (err) {
        console.error('Failed to load statistics:', err);
    }
}

async function loadDashboardRecentTasks() {
    const container = document.getElementById('dashboardRecentTasksList');
    if (!container) return;

    try {
        const res = await authFetch(`${API_BASE}/tasks/?ordering=due_date&status=IN_PROGRESS`);
        if (!res.ok) return;
        const data = await res.json();
        const tasks = (data.results || data).slice(0, 5);

        if (tasks.length === 0) {
            container.innerHTML = `
                <div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
                    No tasks currently in progress. Select a task to begin!
                </div>
            `;
            return;
        }

        container.innerHTML = tasks.map(task => renderTaskRowHtml(task)).join('');
        attachTaskRowListeners(container);
    } catch (err) {
        console.error('Failed to load recent tasks:', err);
    }
}

// ==========================================================================
// 7. My Tasks View (Search, Filters, Sorting, Pagination)
// ==========================================================================
const tasksQueryState = {
    page: 1,
    pageSize: 10,
    search: '',
    status: '',
    priority: '',
    ordering: '-created_at',
};

function setupTasksFilterControls() {
    const searchInput = document.getElementById('tasksSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const statusSelect = document.getElementById('tasksStatusFilter');
    const prioritySelect = document.getElementById('tasksPriorityFilter');
    const sortSelect = document.getElementById('tasksSortSelect');
    const resetBtn = document.getElementById('resetFiltersBtn');

    let debounceTimer;
    searchInput?.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const val = searchInput.value.trim();
        clearBtn?.classList.toggle('hidden', !val);

        debounceTimer = setTimeout(() => {
            tasksQueryState.search = val;
            tasksQueryState.page = 1;
            loadTasksPage();
        }, 280);
    });

    clearBtn?.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        tasksQueryState.search = '';
        tasksQueryState.page = 1;
        loadTasksPage();
    });

    statusSelect?.addEventListener('change', () => {
        tasksQueryState.status = statusSelect.value;
        tasksQueryState.page = 1;
        loadTasksPage();
    });

    prioritySelect?.addEventListener('change', () => {
        tasksQueryState.priority = prioritySelect.value;
        tasksQueryState.page = 1;
        loadTasksPage();
    });

    sortSelect?.addEventListener('change', () => {
        tasksQueryState.ordering = sortSelect.value;
        tasksQueryState.page = 1;
        loadTasksPage();
    });

    resetBtn?.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn?.classList.add('hidden');
        statusSelect.value = '';
        prioritySelect.value = '';
        sortSelect.value = '-created_at';

        tasksQueryState.search = '';
        tasksQueryState.status = '';
        tasksQueryState.priority = '';
        tasksQueryState.ordering = '-created_at';
        tasksQueryState.page = 1;
        loadTasksPage();
    });

    // Pagination handlers
    document.getElementById('prevPageBtn')?.addEventListener('click', () => {
        if (tasksQueryState.page > 1) {
            tasksQueryState.page -= 1;
            loadTasksPage();
        }
    });

    document.getElementById('nextPageBtn')?.addEventListener('click', () => {
        tasksQueryState.page += 1;
        loadTasksPage();
    });
}

async function loadTasksPage() {
    const listContainer = document.getElementById('tasksList');
    const skeleton = document.getElementById('tasksSkeleton');
    const emptyBox = document.getElementById('tasksEmpty');
    const paginationBar = document.getElementById('paginationBar');

    if (!listContainer) return;

    // Show loading skeleton
    skeleton?.classList.remove('hidden');
    emptyBox?.classList.add('hidden');
    listContainer.innerHTML = '';

    const params = new URLSearchParams();
    if (tasksQueryState.page > 1) params.append('page', tasksQueryState.page);
    if (tasksQueryState.search) params.append('search', tasksQueryState.search);
    if (tasksQueryState.status) params.append('status', tasksQueryState.status);
    if (tasksQueryState.priority) params.append('priority', tasksQueryState.priority);
    if (tasksQueryState.ordering) params.append('ordering', tasksQueryState.ordering);

    try {
        const res = await authFetch(`${API_BASE}/tasks/?${params.toString()}`);
        skeleton?.classList.add('hidden');

        if (!res.ok) {
            emptyBox?.classList.remove('hidden');
            return;
        }

        const data = await res.json();
        const tasks = data.results || data;
        const totalCount = data.count !== undefined ? data.count : tasks.length;

        if (tasks.length === 0) {
            emptyBox?.classList.remove('hidden');
            paginationBar?.classList.add('hidden');
            return;
        }

        emptyBox?.classList.add('hidden');
        listContainer.innerHTML = tasks.map(task => renderTaskRowHtml(task)).join('');
        attachTaskRowListeners(listContainer);

        // Update pagination bar
        if (paginationBar && data.count !== undefined) {
            paginationBar.classList.remove('hidden');
            const startIdx = (tasksQueryState.page - 1) * tasksQueryState.pageSize + 1;
            const endIdx = Math.min(startIdx + tasks.length - 1, totalCount);

            document.getElementById('pageRangeText').textContent = `${startIdx}-${endIdx}`;
            document.getElementById('totalTasksCount').textContent = totalCount;
            document.getElementById('pageIndicator').textContent = `Page ${tasksQueryState.page}`;

            const prevBtn = document.getElementById('prevPageBtn');
            const nextBtn = document.getElementById('nextPageBtn');
            if (prevBtn) prevBtn.disabled = !data.previous;
            if (nextBtn) nextBtn.disabled = !data.next;
        }
    } catch (err) {
        skeleton?.classList.add('hidden');
        emptyBox?.classList.remove('hidden');
        console.error('Failed to load tasks:', err);
    }
}

// ==========================================================================
// 8. Today View Logic
// ==========================================================================
async function loadTodayTasks() {
    const overdueList = document.getElementById('todayOverdueList');
    const dueList = document.getElementById('todayDueList');
    const doneList = document.getElementById('todayDoneList');
    const todayEmpty = document.getElementById('todayEmpty');
    const overdueGroup = document.getElementById('todayOverdueGroup');
    const dueGroup = document.getElementById('todayDueGroup');
    const doneGroup = document.getElementById('todayDoneGroup');

    // Display formatted date
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById('todayDateLabel').textContent = dateFormatted;

    try {
        const res = await authFetch(`${API_BASE}/tasks/`);
        if (!res.ok) return;

        const data = await res.json();
        const tasks = data.results || data;

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfToday = startOfToday + 86400000;

        const overdue = [];
        const dueToday = [];
        const doneToday = [];

        tasks.forEach(task => {
            if (task.status === 'DONE') {
                doneToday.push(task);
            } else if (task.due_date) {
                const dueTime = new Date(task.due_date).getTime();
                if (dueTime < startOfToday) {
                    overdue.push(task);
                } else if (dueTime >= startOfToday && dueTime <= endOfToday) {
                    dueToday.push(task);
                }
            }
        });

        document.getElementById('todayOverdueCount').textContent = overdue.length;
        document.getElementById('todayDueCount').textContent = dueToday.length;
        document.getElementById('todayDoneCount').textContent = doneToday.length;

        overdueGroup?.classList.toggle('hidden', overdue.length === 0);
        dueGroup?.classList.toggle('hidden', dueToday.length === 0);
        doneGroup?.classList.toggle('hidden', doneToday.length === 0);

        if (overdue.length === 0 && dueToday.length === 0 && doneToday.length === 0) {
            todayEmpty?.classList.remove('hidden');
        } else {
            todayEmpty?.classList.add('hidden');
        }

        if (overdueList) overdueList.innerHTML = overdue.map(t => renderTaskRowHtml(t)).join('');
        if (dueList) dueList.innerHTML = dueToday.map(t => renderTaskRowHtml(t)).join('');
        if (doneList) doneList.innerHTML = doneToday.map(t => renderTaskRowHtml(t)).join('');

        attachTaskRowListeners(document.getElementById('viewToday'));
    } catch (err) {
        console.error('Failed to load today tasks:', err);
    }
}

// ==========================================================================
// 9. Completed View Logic
// ==========================================================================
async function loadCompletedTasks() {
    const listContainer = document.getElementById('completedTasksList');
    const emptyBox = document.getElementById('completedEmpty');
    if (!listContainer) return;

    try {
        const res = await authFetch(`${API_BASE}/tasks/?status=DONE&ordering=-updated_at`);
        if (!res.ok) return;

        const data = await res.json();
        const tasks = data.results || data;

        if (tasks.length === 0) {
            emptyBox?.classList.remove('hidden');
            listContainer.innerHTML = '';
            return;
        }

        emptyBox?.classList.add('hidden');
        listContainer.innerHTML = tasks.map(task => renderTaskRowHtml(task)).join('');
        attachTaskRowListeners(listContainer);
    } catch (err) {
        console.error('Failed to load completed tasks:', err);
    }
}

// ==========================================================================
// 10. Profile View Logic
// ==========================================================================
function populateProfileView() {
    if (!currentUser) return;

    document.getElementById('profileBigAvatar').textContent = (currentUser.username || 'U').charAt(0).toUpperCase();
    document.getElementById('profileDisplayName').textContent = currentUser.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : currentUser.username;
    document.getElementById('profileDisplayEmail').textContent = currentUser.email || '—';
    document.getElementById('profileDisplayId').textContent = `#${currentUser.id}`;

    if (currentUser.date_joined) {
        const joinedDate = new Date(currentUser.date_joined).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        document.getElementById('profileDisplayJoined').textContent = joinedDate;
    }

    document.getElementById('profileFirstName').value = currentUser.first_name || '';
    document.getElementById('profileLastName').value = currentUser.last_name || '';
    document.getElementById('profileUsername').value = currentUser.username || '';
    document.getElementById('profileEmail').value = currentUser.email || '';
}

function setupProfileForm() {
    const profileForm = document.getElementById('profileForm');
    const alertBox = document.getElementById('profileFormAlert');

    profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        alertBox?.classList.add('hidden');
        const saveBtn = document.getElementById('saveProfileBtn');
        setButtonLoading(saveBtn, true, 'Saving...');

        const payload = {
            first_name: document.getElementById('profileFirstName').value.trim(),
            last_name: document.getElementById('profileLastName').value.trim(),
            username: document.getElementById('profileUsername').value.trim(),
            email: document.getElementById('profileEmail').value.trim(),
        };

        try {
            const res = await authFetch(`${API_BASE}/auth/me/`, {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) {
                const errorStr = Object.entries(data)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join(' | ');
                throw new Error(errorStr || 'Failed to update profile.');
            }

            currentUser = data;
            updateUserDisplays(data);
            populateProfileView();
            showToast('Profile updated successfully!', 'success');
        } catch (err) {
            if (alertBox) {
                alertBox.textContent = err.message;
                alertBox.classList.remove('hidden');
            }
        } finally {
            setButtonLoading(saveBtn, false, 'Save Changes');
        }
    });
}

// ==========================================================================
// 11. Task Row Rendering & Direct Actions
// ==========================================================================
function renderTaskRowHtml(task) {
    const isDone = task.status === 'DONE';
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isDone;

    const dueFormatted = task.due_date
        ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'No date';

    const checkIcon = isDone
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
        : '';

    return `
        <div class="task-row status-${task.status} priority-${task.priority}" data-id="${task.id}">
            <button class="task-status-btn" type="button" data-action="toggle-status" data-id="${task.id}" title="Toggle status">
                ${checkIcon}
            </button>
            <div class="task-main-info" data-action="open-details" data-id="${task.id}">
                <div class="task-row-title">${escapeHtml(task.title)}</div>
                ${task.description ? `<div class="task-row-desc">${escapeHtml(task.description)}</div>` : ''}
            </div>
            <div class="task-meta-group">
                <span class="badge badge-priority-${task.priority}">
                    <span class="badge-dot"></span>
                    ${task.priority}
                </span>
                <span class="badge badge-status-${task.status}">
                    ${task.status.replace('_', ' ')}
                </span>
                <span class="task-due-date ${isOverdue ? 'is-overdue' : ''}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ${dueFormatted}
                </span>
            </div>
            <div class="task-row-actions">
                <button class="btn-icon" type="button" data-action="edit" data-id="${task.id}" title="Edit task">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="btn-icon btn-icon-danger" type="button" data-action="delete" data-id="${task.id}" data-title="${escapeHtml(task.title)}" title="Delete task">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        </div>
    `;
}

function attachTaskRowListeners(container) {
    if (!container) return;

    container.querySelectorAll('.task-row').forEach(row => {
        row.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            const action = btn?.dataset.action;
            const taskId = row.dataset.id;

            if (action === 'toggle-status') {
                e.stopPropagation();
                cycleTaskStatus(taskId);
            } else if (action === 'edit') {
                e.stopPropagation();
                openEditTaskModal(taskId);
            } else if (action === 'delete') {
                e.stopPropagation();
                const title = btn.dataset.title || 'this task';
                openDeleteModal(taskId, title);
            } else {
                openTaskDetails(taskId);
            }
        });
    });
}

// Cycle status: TODO -> IN_PROGRESS -> DONE -> TODO
async function cycleTaskStatus(taskId) {
    try {
        const getRes = await authFetch(`${API_BASE}/tasks/${taskId}/`);
        if (!getRes.ok) return;
        const task = await getRes.json();

        let nextStatus = 'IN_PROGRESS';
        if (task.status === 'TODO') nextStatus = 'IN_PROGRESS';
        else if (task.status === 'IN_PROGRESS') nextStatus = 'DONE';
        else nextStatus = 'TODO';

        const patchRes = await authFetch(`${API_BASE}/tasks/${taskId}/`, {
            method: 'PATCH',
            body: JSON.stringify({ status: nextStatus })
        });

        if (patchRes.ok) {
            showToast(`Task marked as ${nextStatus.replace('_', ' ')}`, 'success');
            refreshCurrentView();
        }
    } catch (err) {
        console.error('Failed to cycle task status:', err);
    }
}

// ==========================================================================
// 12. Slide-over Task Details Drawer
// ==========================================================================
let activeDrawerTaskId = null;

async function openTaskDetails(taskId) {
    activeDrawerTaskId = taskId;
    const drawer = document.getElementById('taskDetailsDrawer');
    const backdrop = document.getElementById('taskDrawerBackdrop');

    try {
        const res = await authFetch(`${API_BASE}/tasks/${taskId}/`);
        if (!res.ok) return;

        const task = await res.json();

        document.getElementById('drawerTitle').textContent = task.title;
        document.getElementById('drawerDescription').textContent = task.description || 'No description provided.';
        document.getElementById('drawerTaskId').textContent = `#${task.id}`;
        document.getElementById('drawerOwner').textContent = task.owner || currentUser?.username || '—';

        if (task.created_at) {
            document.getElementById('drawerCreatedAt').textContent = new Date(task.created_at).toLocaleString();
        }
        if (task.updated_at) {
            document.getElementById('drawerUpdatedAt').textContent = new Date(task.updated_at).toLocaleString();
        }

        const dueFormatted = task.due_date ? new Date(task.due_date).toLocaleString() : 'No deadline';
        document.getElementById('drawerDueDate').textContent = dueFormatted;

        // Badges
        const statusBadge = document.getElementById('drawerStatusBadge');
        statusBadge.className = `drawer-badge badge badge-status-${task.status}`;
        statusBadge.textContent = task.status.replace('_', ' ');

        const priorityBadge = document.getElementById('drawerPriorityBadge');
        priorityBadge.className = `drawer-badge badge badge-priority-${task.priority}`;
        priorityBadge.textContent = `${task.priority} PRIORITY`;

        // Quick status selector
        const statusSelect = document.getElementById('drawerQuickStatusSelect');
        if (statusSelect) {
            statusSelect.value = task.status;
            statusSelect.onchange = async () => {
                const newStatus = statusSelect.value;
                await authFetch(`${API_BASE}/tasks/${task.id}/`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: newStatus })
                });
                showToast(`Status updated to ${newStatus.replace('_', ' ')}`, 'success');
                openTaskDetails(task.id);
                refreshCurrentView();
            };
        }

        // Drawer buttons
        document.getElementById('drawerEditBtn').onclick = () => {
            closeTaskDetails();
            openEditTaskModal(task.id);
        };

        document.getElementById('drawerDeleteBtn').onclick = () => {
            closeTaskDetails();
            openDeleteModal(task.id, task.title);
        };

        drawer?.classList.remove('hidden');
        backdrop?.classList.remove('hidden');
    } catch (err) {
        console.error('Failed to open task details:', err);
    }
}

function closeTaskDetails() {
    document.getElementById('taskDetailsDrawer')?.classList.add('hidden');
    document.getElementById('taskDrawerBackdrop')?.classList.add('hidden');
    activeDrawerTaskId = null;
}

// ==========================================================================
// 13. Modal: Create / Edit Task
// ==========================================================================
const taskModal = document.getElementById('taskModal');
const taskForm = document.getElementById('taskForm');
const modalTitle = document.getElementById('modalTitle');
const taskModalAlert = document.getElementById('taskModalAlert');

function openCreateTaskModal(defaultDate = null) {
    taskForm?.reset();
    document.getElementById('taskId').value = '';
    modalTitle.textContent = 'Create Task';
    clearTaskModalAlert();

    document.getElementById('taskStatusInput').value = 'TODO';
    document.getElementById('taskPriorityInput').value = 'MEDIUM';

    if (defaultDate) {
        document.getElementById('taskDueDateInput').value = `${defaultDate}T18:00`;
    }

    taskModal?.classList.remove('hidden');
    setTimeout(() => document.getElementById('taskTitleInput')?.focus(), 50);
}

async function openEditTaskModal(taskId) {
    taskForm?.reset();
    clearTaskModalAlert();
    modalTitle.textContent = 'Edit Task';

    try {
        const res = await authFetch(`${API_BASE}/tasks/${taskId}/`);
        if (!res.ok) return;
        const task = await res.json();

        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitleInput').value = task.title;
        document.getElementById('taskDescInput').value = task.description || '';
        document.getElementById('taskStatusInput').value = task.status;
        document.getElementById('taskPriorityInput').value = task.priority;

        if (task.due_date) {
            const dt = new Date(task.due_date);
            const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            document.getElementById('taskDueDateInput').value = localIso;
        } else {
            document.getElementById('taskDueDateInput').value = '';
        }

        taskModal?.classList.remove('hidden');
        setTimeout(() => document.getElementById('taskTitleInput')?.focus(), 50);
    } catch (err) {
        console.error('Failed to load task for edit:', err);
    }
}

function closeTaskModal() {
    taskModal?.classList.add('hidden');
    taskForm?.reset();
    clearTaskModalAlert();
}

function clearTaskModalAlert() {
    if (!taskModalAlert) return;
    taskModalAlert.textContent = '';
    taskModalAlert.classList.add('hidden');
}

function setupTaskForm() {
    taskForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearTaskModalAlert();

        const id = document.getElementById('taskId').value;
        const isEdit = !!id;
        const submitBtn = document.getElementById('saveTaskBtn');
        setButtonLoading(submitBtn, true, 'Saving...');

        const title = document.getElementById('taskTitleInput').value.trim();
        const description = document.getElementById('taskDescInput').value.trim();
        const status = document.getElementById('taskStatusInput').value;
        const priority = document.getElementById('taskPriorityInput').value;
        const dueDateVal = document.getElementById('taskDueDateInput').value;

        const payload = {
            title,
            description,
            status,
            priority,
            due_date: dueDateVal ? new Date(dueDateVal).toISOString() : null
        };

        try {
            const url = isEdit ? `${API_BASE}/tasks/${id}/` : `${API_BASE}/tasks/`;
            const method = isEdit ? 'PUT' : 'POST';

            const res = await authFetch(url, {
                method,
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) {
                const errStr = Object.entries(data)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join(' | ');
                throw new Error(errStr || 'Failed to save task.');
            }

            closeTaskModal();
            showToast(isEdit ? 'Task updated successfully!' : 'New task created!', 'success');
            refreshCurrentView();
        } catch (err) {
            if (taskModalAlert) {
                taskModalAlert.textContent = err.message;
                taskModalAlert.classList.remove('hidden');
            }
        } finally {
            setButtonLoading(submitBtn, false, 'Save Task');
        }
    });
}

// ==========================================================================
// 14. Modal: Delete Confirmation
// ==========================================================================
const deleteModal = document.getElementById('deleteModal');
let taskToDeleteId = null;

function openDeleteModal(taskId, taskTitle) {
    taskToDeleteId = taskId;
    document.getElementById('deleteTaskTitle').textContent = `"${taskTitle}"`;
    deleteModal?.classList.remove('hidden');
}

function closeDeleteModal() {
    deleteModal?.classList.add('hidden');
    taskToDeleteId = null;
}

function setupDeleteModal() {
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
        if (!taskToDeleteId) return;
        const btn = document.getElementById('confirmDeleteBtn');
        setButtonLoading(btn, true, 'Deleting...');

        try {
            const res = await authFetch(`${API_BASE}/tasks/${taskToDeleteId}/`, {
                method: 'DELETE'
            });

            if (res.ok || res.status === 204) {
                closeDeleteModal();
                closeTaskDetails();
                showToast('Task deleted successfully.', 'success');
                refreshCurrentView();
            } else {
                throw new Error('Failed to delete task.');
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setButtonLoading(btn, false, 'Delete Task');
        }
    });
}

// ==========================================================================
// 15. Helper Utilities
// ==========================================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function capitalize(s) {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function setButtonLoading(btn, isLoading, label) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.style.opacity = isLoading ? '0.7' : '1';
    btn.innerHTML = label;
}

// ==========================================================================
// 16. App Initialization on Page Load
// ==========================================================================
async function initApp() {
    setupAuthForms();
    setupSidebarAndTopbar();
    setupRouting();
    setupTasksFilterControls();
    setupTaskForm();
    setupDeleteModal();
    setupProfileForm();

    if (!TokenManager.isAuthenticated()) {
        showAuthView();
        return;
    }

    try {
        await fetchUserProfileAndInit();
    } catch (err) {
        showAuthView();
    }
}

document.addEventListener('DOMContentLoaded', initApp);
