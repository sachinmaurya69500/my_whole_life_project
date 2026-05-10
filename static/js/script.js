const state = {
	workflows: [],
	currentSection: 'dashboard',
	selectedFiles: [],
	chatBusy: false,
};

const el = {
	navButtons: document.querySelectorAll('.nav-btn'),
	mobileNavButtons: document.querySelectorAll('.mobile-nav-btn'),
	sections: {
		dashboard: document.getElementById('dashboardSection'),
		daily: document.getElementById('dailySection'),
		'long-term': document.getElementById('long-termSection'),
		manage: document.getElementById('manageSection'),
		profile: document.getElementById('profileSection'),
	},
	sectionTitle: document.getElementById('sectionTitle'),
	dailyGrid: document.getElementById('dailyGrid'),
	longTermGrid: document.getElementById('longTermGrid'),
	manageTableBody: document.getElementById('manageTableBody'),
	manageSearch: document.getElementById('manageSearch'),
	recentActivity: document.getElementById('recentActivity'),
	statTotal: document.getElementById('statTotal'),
	statDaily: document.getElementById('statDaily'),
	statLongTerm: document.getElementById('statLongTerm'),
	statAvg: document.getElementById('statAvg'),
	modal: document.getElementById('workflowModal'),
	modalTitle: document.getElementById('modalTitle'),
	openAddModalBtn: document.getElementById('openAddModalBtn'),
	closeModalBtn: document.getElementById('closeModalBtn'),
	cancelModalBtn: document.getElementById('cancelModalBtn'),
	modalBackdrop: document.getElementById('modalBackdrop'),
	workflowForm: document.getElementById('workflowForm'),
	workflowId: document.getElementById('workflowId'),
	wfTitle: document.getElementById('wfTitle'),
	wfType: document.getElementById('wfType'),
	wfDescription: document.getElementById('wfDescription'),
	wfProgress: document.getElementById('wfProgress'),
	wfProgressValue: document.getElementById('wfProgressValue'),
	wfStatus: document.getElementById('wfStatus'),
	wfStartDate: document.getElementById('wfStartDate'),
	wfDueDate: document.getElementById('wfDueDate'),
	wfNotes: document.getElementById('wfNotes'),
	wfPhotos: document.getElementById('wfPhotos'),
	dropZone: document.getElementById('dropZone'),
	selectedFiles: document.getElementById('selectedFiles'),
	cardTemplate: document.getElementById('workflowCardTemplate'),
	profileForm: document.getElementById('profileForm'),
	profileName: document.getElementById('profileName'),
	profileLocation: document.getElementById('profileLocation'),
	profileBio: document.getElementById('profileBio'),
	profileImage: document.getElementById('profileImage'),
	topProfileImage: document.getElementById('topProfileImage'),
	sidebarProfileImage: document.getElementById('sidebarProfileImage'),
	favicon: document.getElementById('appFavicon'),
	profilePhotoInput: document.getElementById('profilePhotoInput'),
	uploadProfileBtn: document.getElementById('uploadProfileBtn'),
	logoutBtn: document.getElementById('logoutBtn'),
	menuToggle: document.getElementById('menuToggle'),
	sidebar: document.getElementById('sidebar'),
	mobileBackdrop: document.getElementById('mobileBackdrop'),
	chatForm: document.getElementById('chatForm'),
	chatInput: document.getElementById('chatInput'),
	chatSendBtn: document.getElementById('chatSendBtn'),
	chatMessages: document.getElementById('chatMessages'),
};

function showToast(message, kind = 'ok') {
	let toast = document.getElementById('globalToast');
	if (!toast) {
		toast = document.createElement('div');
		toast.id = 'globalToast';
		toast.className = 'toast';
		document.body.appendChild(toast);
	}
	// Clean up previous timeout
	if (toast.timeoutId) clearTimeout(toast.timeoutId);
	
	toast.textContent = message;
	toast.classList.remove('success', 'error', 'info');
	toast.classList.add(kind === 'error' ? 'error' : kind === 'info' ? 'info' : 'success');
	
	// Add animation classes
	toast.style.animation = 'none';
	setTimeout(() => { toast.style.animation = 'slideInUp 0.3s ease, slideOutDown 0.3s ease 2.2s forwards'; }, 10);
	
	toast.timeoutId = setTimeout(() => toast.remove(), 2500);
}

async function api(path, options = {}) {
	try {
		const res = await fetch(path, options);
		const data = await res.json().catch(() => ({}));
		
		if (!res.ok) {
			if (res.status === 401) {
				window.location.href = '/login';
				return;
			}
			
			// Better error messages
			let errorMessage = data.error || data.message || 'Request failed';
			
			// Provide helpful context
			if (res.status === 0 || res.status === undefined) {
				errorMessage = '⚠️ Network error - Check your connection';
			} else if (res.status === 500) {
				errorMessage = data.error || '❌ Server error - Please contact support';
			} else if (res.status === 404) {
				errorMessage = '🔍 Not found - Check your data';
			} else if (res.status === 400) {
				errorMessage = data.error || '⚠️ Invalid request - Check your inputs';
			}
			
			const details = data.details ? ` (${data.details})` : '';
			throw new Error(`${errorMessage}${details}`);
		}
		return data;
	} catch (err) {
		// Handle network errors
		if (err instanceof TypeError) {
			throw new Error('🌐 Connection failed - Is the server running?');
		}
		throw err;
	}
}

/* ==================== THEME SWITCHING ==================== */

function setupThemeSwitcher() {
	const themeToggle = document.getElementById('themeToggle');
	const html = document.documentElement;
	
	if (!themeToggle) return;
	
	function setTheme(theme) {
		html.setAttribute('data-theme', theme);
		localStorage.setItem('swm-theme', theme);
		updateThemeIcon(theme);
	}
	
	function updateThemeIcon(theme) {
		if (!themeToggle) return;
		const icons = {
			'light': 'fa-moon',
			'dark': 'fa-sun',
			'jarvis': 'fa-microchip'
		};
		themeToggle.innerHTML = `<i class="fa-solid ${icons[theme] || 'fa-circle-half-stroke'}"></i>`;
		themeToggle.title = `Theme: ${theme.toUpperCase()}`;
	}
	
	themeToggle.addEventListener('click', () => {
		const current = html.getAttribute('data-theme') || 'light';
		const themes = ['light', 'dark', 'jarvis'];
		const nextIndex = (themes.indexOf(current) + 1) % themes.length;
		setTheme(themes[nextIndex]);
	});
	
	// Initialize with saved theme
	const savedTheme = localStorage.getItem('swm-theme') || 'dark';
	updateThemeIcon(savedTheme);
}

/* ==================== JARVIS EASTER EGG ==================== */

function initializeJarvisEasterEgg() {
	const html = document.documentElement;
	let jarvisCommand = '';
	let jarvisPanel = null;
	
	// Listen for "JARVIS" voice commands or key sequences
	document.addEventListener('keydown', (e) => {
		jarvisCommand += e.key.toLowerCase();
		
		// If user types "jarvis", activate the theme
		if (jarvisCommand.includes('jarvis')) {
			html.setAttribute('data-theme', 'jarvis');
			localStorage.setItem('swm-theme', 'jarvis');
			showJarvisActivated();
			jarvisCommand = '';
		}
		
		// Reset if too long
		if (jarvisCommand.length > 20) {
			jarvisCommand = jarvisCommand.slice(-10);
		}
	});
	
	function showJarvisActivated() {
		showToast('🤖 JARVIS: "Good morning, sir. Welcome to the system."', 'info');
		
		// Create voice command widget if Jarvis theme is active
		if (html.getAttribute('data-theme') === 'jarvis' && !document.querySelector('.jarvis-voice-command')) {
			const voiceWidget = document.createElement('div');
			voiceWidget.className = 'jarvis-voice-command';
			voiceWidget.innerHTML = `
				<div class="jarvis-mic-pulse"></div>
				<span>JARVIS System Online</span>
			`;
			voiceWidget.addEventListener('click', () => {
				showToast('🎤 JARVIS: "How may I assist you today?"', 'info');
			});
			document.body.appendChild(voiceWidget);
			
			// Animate entrance
			voiceWidget.style.animation = 'slideInUp 0.5s ease';
		}
	}
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
	setupThemeSwitcher();
	initializeJarvisEasterEgg();
});

function statusClass(status) {
	if (status === 'Completed') return 'chip-green';
	if (status === 'In Progress') return 'chip-cyan';
	return 'chip-amber';
}

function formatDue(dateStr) {
	if (!dateStr) return 'No due date';
	return `Due: ${dateStr}`;
}

function resetWorkflowForm() {
	el.workflowForm.reset();
	el.workflowId.value = '';
	el.wfProgress.value = 0;
	el.wfProgressValue.textContent = '0%';
	state.selectedFiles = [];
	refreshSelectedFilesLabel();
}

function openModal(editWorkflow = null) {
	if (editWorkflow) {
		el.modalTitle.textContent = 'Edit Workflow';
		el.workflowId.value = editWorkflow._id;
		el.wfTitle.value = editWorkflow.title;
		el.wfType.value = editWorkflow.type;
		el.wfDescription.value = editWorkflow.description;
		el.wfProgress.value = editWorkflow.progress;
		el.wfProgressValue.textContent = `${editWorkflow.progress}%`;
		el.wfStatus.value = editWorkflow.status;
		el.wfStartDate.value = editWorkflow.start_date || '';
		el.wfDueDate.value = editWorkflow.due_date || '';
		el.wfNotes.value = editWorkflow.notes;
	} else {
		el.modalTitle.textContent = 'Add New Workflow';
		resetWorkflowForm();
	}
	el.modal.classList.remove('hidden');
}

function closeModal() {
	el.modal.classList.add('hidden');
	resetWorkflowForm();
}

function setActiveSection(sectionKey) {
	state.currentSection = sectionKey;
	Object.entries(el.sections).forEach(([key, sectionEl]) => {
		sectionEl.classList.toggle('hidden', key !== sectionKey);
	});
	el.navButtons.forEach((btn) => {
		btn.classList.toggle('active', btn.dataset.section === sectionKey);
	});
	el.mobileNavButtons.forEach((btn) => {
		btn.classList.toggle('active', btn.dataset.section === sectionKey);
	});

	const titleMap = {
		dashboard: 'Dashboard',
		daily: 'Daily Projects',
		'long-term': 'Long-term Projects',
		manage: 'Manage Workflows',
		profile: 'Profile',
	};
	el.sectionTitle.textContent = titleMap[sectionKey] || 'Dashboard';
}

function renderCards(targetEl, workflows) {
	targetEl.innerHTML = '';
	if (!workflows.length) {
		targetEl.innerHTML = '<p class="hud-empty-state">No workflows found.</p>';
		return;
	}

	workflows.forEach((wf) => {
		const node = el.cardTemplate.content.cloneNode(true);
		const card = node.querySelector('.panel');
		if (card) {
			card.classList.add('hud-reveal', 'hud-sweep');
			card.style.transitionDelay = `${Math.min(workflows.indexOf(wf), 8) * 55}ms`;
			requestAnimationFrame(() => card.classList.add('is-visible'));
		}
		const titleLinkEl = node.querySelector('.title-link');
		titleLinkEl.textContent = wf.title;
		titleLinkEl.href = `/project/${wf._id}`;
		titleLinkEl.setAttribute('aria-label', `Open project details for ${wf.title}`);

		const statusChip = node.querySelector('.status-chip');
		statusChip.textContent = wf.status;
		statusChip.className = `status-chip ${statusClass(wf.status)}`;

		node.querySelector('.description').textContent = wf.description || 'No description added yet.';
		node.querySelector('.due-date').textContent = formatDue(wf.due_date);
		node.querySelector('.progress-label').textContent = `${wf.progress}%`;
		node.querySelector('.progress-fill').style.width = `${wf.progress}%`;
		node.querySelector('.notes').textContent = wf.notes ? `Notes: ${wf.notes}` : 'Notes: -';

		const projectThumb = node.querySelector('.project-thumb');
		projectThumb.src = (wf.photo_urls && wf.photo_urls.length)
			? wf.photo_urls[0]
			: '/static/img/project-placeholder.svg';

		node.querySelector('.delete-btn').addEventListener('click', async () => {
			if (!confirm(`Delete workflow "${wf.title}"?`)) return;
			await api(`/api/workflows/${wf._id}`, { method: 'DELETE' });
			showToast('Workflow deleted');
			await loadAll();
		});

		targetEl.appendChild(node);
	});
}

function renderManageTable(workflows) {
	el.manageTableBody.innerHTML = '';
	if (!workflows.length) {
		el.manageTableBody.innerHTML = '<tr><td colspan="6" class="py-4"><div class="hud-empty-state">No workflows found.</div></td></tr>';
		return;
	}

	workflows.forEach((wf, index) => {
		const tr = document.createElement('tr');
		tr.className = 'border-b border-slate-800 hud-reveal';
		tr.style.transitionDelay = `${Math.min(index, 10) * 45}ms`;
		tr.innerHTML = `
			<td class="py-3 pr-2"><input data-field="title" value="${escapeHtml(wf.title)}" class="table-input w-56" /></td>
			<td class="py-3 pr-2">
				<select data-field="type" class="table-input w-28">
					<option ${wf.type === 'Daily' ? 'selected' : ''}>Daily</option>
					<option ${wf.type === 'Long-term' ? 'selected' : ''}>Long-term</option>
				</select>
			</td>
			<td class="py-3 pr-2">
				<div class="flex items-center gap-2 w-48">
					<input data-field="progress" type="range" min="0" max="100" value="${wf.progress}" class="w-full" />
					<span class="progress-value text-xs text-slate-300 min-w-10 text-right">${wf.progress}%</span>
				</div>
			</td>
			<td class="py-3 pr-2">
				<select data-field="status" class="table-input w-36">
					<option ${wf.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
					<option ${wf.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
					<option ${wf.status === 'Completed' ? 'selected' : ''}>Completed</option>
				</select>
			</td>
			<td class="py-3 pr-2"><input data-field="due_date" type="date" value="${wf.due_date || ''}" class="table-input w-36" /></td>
			<td class="py-3 pr-2">
				<div class="flex gap-2">
					<button class="save-row-btn rounded-lg border border-cyan-700 text-cyan-300 px-3 py-1.5 text-xs">Save</button>
					<button class="edit-row-btn rounded-lg border border-slate-700 px-3 py-1.5 text-xs">Open</button>
					<button class="delete-row-btn rounded-lg border border-rose-800 text-rose-300 px-3 py-1.5 text-xs">Delete</button>
				</div>
			</td>
		`;

		const progressSlider = tr.querySelector('[data-field="progress"]');
		const progressValue = tr.querySelector('.progress-value');
		progressSlider.addEventListener('input', () => {
			progressValue.textContent = `${progressSlider.value}%`;
		});

		tr.querySelector('.save-row-btn').addEventListener('click', async () => {
			const payload = {};
			tr.querySelectorAll('[data-field]').forEach((input) => {
				payload[input.dataset.field] = input.value;
			});
			payload.progress = Number(payload.progress || 0);
			await api(`/api/workflows/${wf._id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			showToast('Workflow updated');
			await loadAll();
		});

		tr.querySelector('.edit-row-btn').addEventListener('click', () => {
			window.location.href = `/project/${wf._id}`;
		});
		tr.querySelector('.delete-row-btn').addEventListener('click', async () => {
			if (!confirm(`Delete workflow "${wf.title}"?`)) return;
			await api(`/api/workflows/${wf._id}`, { method: 'DELETE' });
			showToast('Workflow deleted');
			await loadAll();
		});

		el.manageTableBody.appendChild(tr);
		requestAnimationFrame(() => tr.classList.add('is-visible'));
	});
}

function renderRecentActivity(items) {
	el.recentActivity.innerHTML = '';
	if (!items.length) {
		el.recentActivity.innerHTML = '<p class="hud-empty-state">No activity yet.</p>';
		return;
	}

	items.forEach((item, index) => {
		const row = document.createElement('div');
		row.className = 'rounded-lg border border-slate-800 bg-slate-900/50 p-3 hud-reveal hud-sweep';
		row.style.transitionDelay = `${Math.min(index, 8) * 70}ms`;
		row.innerHTML = `
			<div class="flex justify-between gap-3">
				<p class="font-medium">${escapeHtml(item.title)}</p>
				<span class="status-chip ${statusClass(item.status)}">${item.status}</span>
			</div>
			<p class="text-xs text-slate-400 mt-1">Progress: ${item.progress}%</p>
		`;
		el.recentActivity.appendChild(row);
		requestAnimationFrame(() => row.classList.add('is-visible'));
	});
}

function refreshSelectedFilesLabel() {
	if (!state.selectedFiles.length) {
		el.selectedFiles.textContent = 'No photo selected.';
		return;
	}
	el.selectedFiles.textContent = `Selected: ${state.selectedFiles[0].name}`;
}

async function uploadWorkflowPhotos(workflowId, files) {
	if (!files.length) return;
	const fd = new FormData();
	fd.append('photo', files[0]);
	await api(`/api/workflows/${workflowId}/photos`, {
		method: 'POST',
		body: fd,
	});
}

async function loadDashboard() {
	if (el.recentActivity) {
		el.recentActivity.innerHTML = '<div class="hud-skeleton h-16 rounded-lg"></div><div class="hud-skeleton h-16 rounded-lg mt-3"></div>';
	}
	const data = await api('/api/dashboard');
	el.statTotal.textContent = data.total;
	el.statDaily.textContent = data.daily;
	el.statLongTerm.textContent = data.long_term;
	el.statAvg.textContent = `${data.avg_progress}%`;
	renderRecentActivity(data.recent_activity || []);
}

async function loadProfile() {
	const profile = await api('/api/profile');
	const imageVersion = profile.profile_image_updated_at ? encodeURIComponent(profile.profile_image_updated_at) : Date.now();
	const imageUrl = profile.profile_image_url
		? `${profile.profile_image_url}?v=${imageVersion}`
		: '/static/img/profile-placeholder.svg';
	el.profileName.value = profile.display_name || '';
	el.profileLocation.value = profile.location || '';
	el.profileBio.value = profile.bio || '';
	el.profileImage.src = imageUrl;
	if (el.topProfileImage) {
		el.topProfileImage.src = imageUrl;
	}
	if (el.sidebarProfileImage) {
		el.sidebarProfileImage.src = imageUrl;
	}
	if (el.favicon) {
		el.favicon.href = imageUrl;
	}
}

async function loadWorkflows(search = '') {
	const query = search ? `?q=${encodeURIComponent(search)}` : '';
	if (el.dailyGrid) el.dailyGrid.innerHTML = '<div class="hud-skeleton h-48 rounded-2xl"></div>';
	if (el.longTermGrid) el.longTermGrid.innerHTML = '<div class="hud-skeleton h-48 rounded-2xl"></div>';
	if (el.manageTableBody) el.manageTableBody.innerHTML = '<tr><td colspan="6" class="py-4"><div class="hud-skeleton h-10 rounded-lg"></div></td></tr>';
	state.workflows = await api(`/api/workflows${query}`);
	renderCards(el.dailyGrid, state.workflows.filter((w) => w.type === 'Daily'));
	renderCards(el.longTermGrid, state.workflows.filter((w) => w.type === 'Long-term'));
	renderManageTable(state.workflows);
}

async function loadAll() {
	await Promise.all([loadDashboard(), loadWorkflows(), loadProfile(), loadChatHistory()]);
}

function escapeHtml(value) {
	return String(value || '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function addChatMessage(role, text, opts = {}) {
	if (!el.chatMessages) return null;
	const bubble = document.createElement('div');
	bubble.className = `chat-bubble ${role === 'user' ? 'user' : 'bot'}`;
	if (opts.thinking) {
		bubble.classList.add('chat-thinking');
	}
	bubble.textContent = text;
	el.chatMessages.appendChild(bubble);
	el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
	return bubble;
}

function setChatBusy(isBusy) {
	state.chatBusy = isBusy;
	if (!el.chatInput || !el.chatSendBtn) return;
	el.chatInput.disabled = isBusy;
	el.chatSendBtn.disabled = isBusy;
	el.chatSendBtn.textContent = isBusy ? 'Thinking...' : 'Send';
}

async function loadChatHistory() {
	if (!el.chatMessages) return;
	el.chatMessages.innerHTML = '';

	try {
		const data = await api('/api/ai-chat/history');
		const messages = Array.isArray(data.messages) ? data.messages : [];

		if (!messages.length) {
			addChatMessage('bot', 'Hi! I am your Gemini assistant. Ask me to prioritize your workflows or plan your next steps.');
			return;
		}

		messages.forEach((msg) => {
			const role = msg.role === 'user' ? 'user' : 'bot';
			addChatMessage(role, msg.content || '');
		});
	} catch (err) {
		addChatMessage('bot', err.message || 'Unable to load chat history right now.');
	}
}

if (el.chatForm) {
	el.chatForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (state.chatBusy) return;

		const message = (el.chatInput.value || '').trim();
		if (!message) return;

		addChatMessage('user', message);
		el.chatInput.value = '';
		setChatBusy(true);

		const thinkingBubble = addChatMessage('bot', 'Thinking...', { thinking: true });

		try {
			const data = await api('/api/ai-chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message }),
			});

			if (thinkingBubble) thinkingBubble.remove();
			addChatMessage('bot', data.reply || 'I could not generate a response right now.');
		} catch (err) {
			if (thinkingBubble) thinkingBubble.remove();
			addChatMessage('bot', err.message || 'Something went wrong while contacting AI.');
		} finally {
			setChatBusy(false);
		}
	});
}

el.navButtons.forEach((btn) => {
	btn.addEventListener('click', () => {
		setActiveSection(btn.dataset.section);
		el.sidebar.classList.add('-translate-x-full');
		el.mobileBackdrop.classList.add('hidden');
	});
});

el.mobileNavButtons.forEach((btn) => {
	btn.addEventListener('click', () => {
		setActiveSection(btn.dataset.section);
	});
});

el.menuToggle.addEventListener('click', () => {
	el.sidebar.classList.toggle('-translate-x-full');
	el.mobileBackdrop.classList.toggle('hidden');
});

el.mobileBackdrop.addEventListener('click', () => {
	el.sidebar.classList.add('-translate-x-full');
	el.mobileBackdrop.classList.add('hidden');
});

el.wfProgress.addEventListener('input', () => {
	el.wfProgressValue.textContent = `${el.wfProgress.value}%`;
});

el.openAddModalBtn.addEventListener('click', () => openModal());
el.closeModalBtn.addEventListener('click', closeModal);
el.cancelModalBtn.addEventListener('click', closeModal);
el.modalBackdrop.addEventListener('click', closeModal);

el.workflowForm.addEventListener('submit', async (e) => {
	e.preventDefault();

	const payload = {
		title: el.wfTitle.value.trim(),
		type: el.wfType.value,
		description: el.wfDescription.value.trim(),
		progress: Number(el.wfProgress.value || 0),
		status: el.wfStatus.value,
		start_date: el.wfStartDate.value,
		due_date: el.wfDueDate.value,
		notes: el.wfNotes.value.trim(),
	};

	try {
		let workflow;
		if (el.workflowId.value) {
			workflow = await api(`/api/workflows/${el.workflowId.value}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
		} else {
			workflow = await api('/api/workflows', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
		}

		if (state.selectedFiles.length) {
			await uploadWorkflowPhotos(workflow._id, state.selectedFiles);
		}

		showToast('Workflow saved');
		closeModal();
		await loadAll();
	} catch (err) {
		showToast(err.message, 'error');
	}
});

el.wfPhotos.addEventListener('change', (e) => {
	const firstFile = e.target.files && e.target.files[0] ? [e.target.files[0]] : [];
	state.selectedFiles = firstFile;
	refreshSelectedFilesLabel();
});

el.dropZone.addEventListener('dragover', (e) => {
	e.preventDefault();
	el.dropZone.classList.add('drag-active');
});

el.dropZone.addEventListener('dragleave', () => {
	el.dropZone.classList.remove('drag-active');
});

el.dropZone.addEventListener('drop', (e) => {
	e.preventDefault();
	el.dropZone.classList.remove('drag-active');
	const files = [...(e.dataTransfer.files || [])].filter((f) => f.type.startsWith('image/'));
	state.selectedFiles = files.length ? [files[0]] : [];
	refreshSelectedFilesLabel();
});

el.manageSearch.addEventListener('input', async (e) => {
	const search = e.target.value.trim();
	const query = search ? `?q=${encodeURIComponent(search)}` : '';
	const workflows = await api(`/api/workflows${query}`);
	renderManageTable(workflows);
});

el.profileForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	await api('/api/profile', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			display_name: el.profileName.value.trim(),
			location: el.profileLocation.value.trim(),
			bio: el.profileBio.value.trim(),
		}),
	});
	showToast('Profile updated');
	await loadProfile();
});

el.uploadProfileBtn.addEventListener('click', async () => {
	const file = el.profilePhotoInput.files[0];
	if (!file) {
		showToast('Please select an image first', 'error');
		return;
	}
	const fd = new FormData();
	fd.append('photo', file);
	await api('/api/profile/photo', {
		method: 'POST',
		body: fd,
	});
	showToast('Profile photo updated');
	await loadProfile();
});

el.logoutBtn.addEventListener('click', async () => {
	await api('/logout', { method: 'POST' });
	window.location.href = '/login';
});

loadAll().catch((err) => showToast(err.message, 'error'));
