(function () {
	const launcher = document.getElementById('assistantLauncher');
	const panel = document.getElementById('assistantPanel');
	const closeBtn = document.getElementById('assistantClose');
	const messagesEl = document.getElementById('assistantMessages');
	const form = document.getElementById('assistantForm');
	const input = document.getElementById('assistantInput');
	const sendBtn = document.getElementById('assistantSend');

	// Tab elements
	const tabButtons = document.querySelectorAll('.assistant-tab');
	const chatTab = document.getElementById('chatTab');
	const addProjectTab = document.getElementById('addProjectTab');
	const editProjectTab = document.getElementById('editProjectTab');

	// Form elements
	const addProjectForm = document.getElementById('addProjectForm');
	const editProjectForm = document.getElementById('editProjectForm');
	const editProjectSelect = document.getElementById('editProjectSelect');
	const deleteProjectBtn = document.getElementById('deleteProjectBtn');

	if (!launcher || !panel || !messagesEl || !form || !input || !sendBtn) {
		return;
	}

	let isOpen = false;
	let isBusy = false;
	let historyLoaded = false;
	let isDragging = false;
	let suppressNextClick = false;
	let currentEditProjectId = null;
	const POSITION_KEY = 'swm-assistant-launcher-position';

	function addMessage(role, text) {
		const bubble = document.createElement('div');
		bubble.className = `assistant-bubble ${role}`;
		bubble.textContent = text;
		messagesEl.appendChild(bubble);
		messagesEl.scrollTop = messagesEl.scrollHeight;
		return bubble;
	}

	function setBusy(flag) {
		isBusy = flag;
		input.disabled = flag;
		sendBtn.disabled = flag;
		sendBtn.textContent = flag ? 'Thinking...' : 'Send';
	}

	function setOpen(flag) {
		isOpen = flag;
		panel.classList.toggle('hidden', !flag);
		panel.setAttribute('aria-hidden', flag ? 'false' : 'true');
		launcher.setAttribute('aria-expanded', flag ? 'true' : 'false');
		if (flag) {
			positionPanel();
			input.focus();
		}
	}

	function getLauncherRect() {
		return launcher.getBoundingClientRect();
	}

	function clamp(value, min, max) {
		return Math.max(min, Math.min(value, max));
	}

	function applyLauncherPosition(left, top) {
		const margin = 12;
		const maxLeft = Math.max(margin, window.innerWidth - launcher.offsetWidth - margin);
		const maxTop = Math.max(margin, window.innerHeight - launcher.offsetHeight - margin);
		const clampedLeft = clamp(left, margin, maxLeft);
		const clampedTop = clamp(top, margin, maxTop);

		launcher.style.left = `${clampedLeft}px`;
		launcher.style.top = `${clampedTop}px`;
		launcher.style.right = 'auto';
		launcher.style.bottom = 'auto';

		if (isOpen) {
			positionPanel();
		}
	}

	function saveLauncherPosition() {
		const rect = getLauncherRect();
		const position = { left: Math.round(rect.left), top: Math.round(rect.top) };
		localStorage.setItem(POSITION_KEY, JSON.stringify(position));
	}

	function restoreLauncherPosition() {
		try {
			const raw = localStorage.getItem(POSITION_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed.left !== 'number' || typeof parsed.top !== 'number') return;
			applyLauncherPosition(parsed.left, parsed.top);
		} catch (err) {
			// Ignore malformed saved positions.
		}
	}

	function positionPanel() {
		if (!isOpen) return;
		if (window.matchMedia('(max-width: 640px)').matches) {
			panel.style.left = '';
			panel.style.right = '';
			panel.style.top = '';
			panel.style.bottom = '';
			return;
		}

		const rect = getLauncherRect();
		const panelWidth = panel.offsetWidth || 390;
		const panelHeight = panel.offsetHeight || 520;
		const gap = 12;
		const margin = 12;

		let left = rect.right - panelWidth;
		left = clamp(left, margin, window.innerWidth - panelWidth - margin);

		let top = rect.top - panelHeight - gap;
		if (top < margin) {
			top = rect.bottom + gap;
		}
		top = clamp(top, margin, window.innerHeight - panelHeight - margin);

		panel.style.left = `${left}px`;
		panel.style.top = `${top}px`;
		panel.style.right = 'auto';
		panel.style.bottom = 'auto';
	}

	// Tab switching
	function switchTab(tabName) {
		tabButtons.forEach(btn => btn.classList.remove('active'));
		[chatTab, addProjectTab, editProjectTab].forEach(tab => tab.classList.remove('active'));

		const activeBtn = Array.from(tabButtons).find(btn => btn.getAttribute('data-tab') === tabName);
		if (activeBtn) activeBtn.classList.add('active');

		if (tabName === 'chat') {
			chatTab.classList.add('active');
			input.focus();
		} else if (tabName === 'add-project') {
			addProjectTab.classList.add('active');
			document.getElementById('projectTitle').focus();
		} else if (tabName === 'edit-project') {
			editProjectTab.classList.add('active');
			loadProjectsForEdit();
			document.getElementById('editProjectSelect').focus();
		}
	}

	tabButtons.forEach(btn => {
		btn.addEventListener('click', () => {
			const tabName = btn.getAttribute('data-tab');
			switchTab(tabName);
		});
	});

	// Load projects for edit dropdown
	async function loadProjectsForEdit() {
		try {
			const res = await fetch('/api/workflows', {
				method: 'GET',
				headers: { 'Accept': 'application/json' },
			});
			const projects = await res.json();

			editProjectSelect.innerHTML = '<option value="">-- Select a project --</option>';
			projects.forEach(proj => {
				const option = document.createElement('option');
				option.value = proj.id;
				option.textContent = proj.title;
				editProjectSelect.appendChild(option);
			});
		} catch (err) {
			editProjectSelect.innerHTML = '<option value="">Error loading projects</option>';
		}
	}

	// Populate edit form when project is selected
	editProjectSelect.addEventListener('change', async (e) => {
		const projectId = e.target.value;
		if (!projectId) {
			currentEditProjectId = null;
			return;
		}

		try {
			const res = await fetch(`/api/workflows/${projectId}`, {
				method: 'GET',
				headers: { 'Accept': 'application/json' },
			});
			if (!res.ok) throw new Error('Failed to load project');
			const proj = await res.json();

			currentEditProjectId = proj.id;
			document.getElementById('editProjectTitle').value = proj.title || '';
			document.getElementById('editProjectType').value = proj.type || 'Daily';
			document.getElementById('editProjectDescription').value = proj.description || '';
			document.getElementById('editProjectStatus').value = proj.status || 'Not Started';
			document.getElementById('editProjectProgress').value = proj.progress || 0;
			document.getElementById('editProjectStartDate').value = proj.start_date ? proj.start_date.split('T')[0] : '';
			document.getElementById('editProjectDueDate').value = proj.due_date ? proj.due_date.split('T')[0] : '';
			document.getElementById('editProjectNotes').value = proj.notes || '';
		} catch (err) {
			showMessage('editProjectMessage', `Error loading project: ${err.message}`, 'error');
		}
	});

	// Show message helper
	function showMessage(elementId, text, type) {
		const msgEl = document.getElementById(elementId);
		msgEl.textContent = text;
		msgEl.className = `project-message show ${type}`;
		setTimeout(() => {
			msgEl.classList.remove('show');
		}, 3500);
	}

	// Add project form submission
	addProjectForm.addEventListener('submit', async (e) => {
		e.preventDefault();

		const title = document.getElementById('projectTitle').value.trim();
		const type = document.getElementById('projectType').value;
		const description = document.getElementById('projectDescription').value.trim();
		const status = document.getElementById('projectStatus').value;
		const progress = parseInt(document.getElementById('projectProgress').value) || 0;
		const startDate = document.getElementById('projectStartDate').value;
		const dueDate = document.getElementById('projectDueDate').value;
		const notes = document.getElementById('projectNotes').value.trim();

		if (!title) {
			showMessage('addProjectMessage', 'Please enter a project title', 'error');
			return;
		}

		try {
			const res = await fetch('/api/workflows', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title,
					type,
					description,
					status,
					progress,
					start_date: startDate ? `${startDate}T00:00:00Z` : null,
					due_date: dueDate ? `${dueDate}T00:00:00Z` : null,
					notes,
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to create project');
			}

			showMessage('addProjectMessage', `✓ Project "${title}" created successfully!`, 'success');
			addProjectForm.reset();
			setTimeout(() => switchTab('chat'), 1000);
		} catch (err) {
			showMessage('addProjectMessage', `Error: ${err.message}`, 'error');
		}
	});

	// Edit project form submission
	editProjectForm.addEventListener('submit', async (e) => {
		e.preventDefault();

		if (!currentEditProjectId) {
			showMessage('editProjectMessage', 'Please select a project first', 'error');
			return;
		}

		const title = document.getElementById('editProjectTitle').value.trim();
		const type = document.getElementById('editProjectType').value;
		const description = document.getElementById('editProjectDescription').value.trim();
		const status = document.getElementById('editProjectStatus').value;
		const progress = parseInt(document.getElementById('editProjectProgress').value) || 0;
		const startDate = document.getElementById('editProjectStartDate').value;
		const dueDate = document.getElementById('editProjectDueDate').value;
		const notes = document.getElementById('editProjectNotes').value.trim();

		if (!title) {
			showMessage('editProjectMessage', 'Please enter a project title', 'error');
			return;
		}

		try {
			const res = await fetch(`/api/workflows/${currentEditProjectId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title,
					type,
					description,
					status,
					progress,
					start_date: startDate ? `${startDate}T00:00:00Z` : null,
					due_date: dueDate ? `${dueDate}T00:00:00Z` : null,
					notes,
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to update project');
			}

			showMessage('editProjectMessage', `✓ Project "${title}" updated successfully!`, 'success');
			setTimeout(() => loadProjectsForEdit(), 1000);
		} catch (err) {
			showMessage('editProjectMessage', `Error: ${err.message}`, 'error');
		}
	});

	// Delete project
	deleteProjectBtn.addEventListener('click', async () => {
		if (!currentEditProjectId) {
			showMessage('editProjectMessage', 'Please select a project first', 'error');
			return;
		}

		if (!confirm('Are you sure you want to delete this project?')) {
			return;
		}

		try {
			const res = await fetch(`/api/workflows/${currentEditProjectId}`, {
				method: 'DELETE',
				headers: { 'Accept': 'application/json' },
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to delete project');
			}

			showMessage('editProjectMessage', '✓ Project deleted successfully!', 'success');
			currentEditProjectId = null;
			setTimeout(() => loadProjectsForEdit(), 500);
		} catch (err) {
			showMessage('editProjectMessage', `Error: ${err.message}`, 'error');
		}
	});

	async function loadHistory() {
		if (historyLoaded) return;
		historyLoaded = true;
		messagesEl.innerHTML = '';

		try {
			const res = await fetch('/api/ai-chat/history', {
				method: 'GET',
				headers: { 'Accept': 'application/json' },
			});
			const data = await res.json().catch(() => ({}));

			if (res.status === 401) {
				addMessage('note', 'Login to use the Gemini assistant.');
				setBusy(true);
				return;
			}
			if (!res.ok) {
				throw new Error(data.error || 'Unable to load chat history');
			}

			const items = Array.isArray(data.messages) ? data.messages : [];
			if (!items.length) {
				addMessage('bot', 'Hi, I am your futuristic Gemini copilot. Ask me to plan, prioritize, or unblock your next move.');
				return;
			}

			items.forEach((item) => {
				const role = item.role === 'user' ? 'user' : 'bot';
				addMessage(role, item.content || '');
			});
		} catch (err) {
			addMessage('note', err.message || 'Unable to load chat history right now.');
		}
	}

	launcher.addEventListener('click', async () => {
		if (suppressNextClick) {
			suppressNextClick = false;
			return;
		}
		setOpen(!isOpen);
		if (isOpen) {
			switchTab('chat');
			await loadHistory();
		}
	});

	launcher.addEventListener('pointerdown', (e) => {
		if (e.button !== 0) return;

		const startX = e.clientX;
		const startY = e.clientY;
		const startRect = getLauncherRect();
		const startLeft = startRect.left;
		const startTop = startRect.top;
		let moved = false;

		launcher.classList.add('dragging');
		launcher.setPointerCapture(e.pointerId);

		function onMove(moveEvent) {
			const dx = moveEvent.clientX - startX;
			const dy = moveEvent.clientY - startY;
			if (!moved && Math.hypot(dx, dy) > 6) {
				moved = true;
				isDragging = true;
			}
			if (!moved) return;
			applyLauncherPosition(startLeft + dx, startTop + dy);
		}

		function onUp() {
			launcher.classList.remove('dragging');
			launcher.removeEventListener('pointermove', onMove);
			launcher.removeEventListener('pointerup', onUp);
			launcher.removeEventListener('pointercancel', onUp);

			if (moved) {
				saveLauncherPosition();
				suppressNextClick = true;
			}
			isDragging = false;
		}

		launcher.addEventListener('pointermove', onMove);
		launcher.addEventListener('pointerup', onUp);
		launcher.addEventListener('pointercancel', onUp);
	});

	closeBtn.addEventListener('click', () => setOpen(false));

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && isOpen) {
			setOpen(false);
		}
	});

	window.addEventListener('resize', () => {
		if (isDragging) return;
		const rect = getLauncherRect();
		applyLauncherPosition(rect.left, rect.top);
	});

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (isBusy) return;

		const message = (input.value || '').trim();
		if (!message) return;

		addMessage('user', message);
		input.value = '';
		setBusy(true);
		const thinkingBubble = addMessage('bot', 'Thinking...');

		try {
			const res = await fetch('/api/ai-chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message }),
			});
			const data = await res.json().catch(() => ({}));

			if (thinkingBubble) thinkingBubble.remove();

			if (res.status === 401) {
				addMessage('note', 'Login to chat with Gemini assistant.');
				return;
			}
			if (!res.ok) {
				const details = data.details ? `\n${data.details}` : '';
				throw new Error(`${data.error || 'Chat request failed'}${details}`);
			}

			addMessage('bot', data.reply || 'I could not generate a response right now.');
		} catch (err) {
			if (thinkingBubble && thinkingBubble.parentNode) {
				thinkingBubble.remove();
			}
			addMessage('note', err.message || 'Chat error. Check console.');
		} finally {
			setBusy(false);
		}
	});

	restoreLauncherPosition();
})();

	function addMessage(role, text) {
		const bubble = document.createElement('div');
		bubble.className = `assistant-bubble ${role}`;
		bubble.textContent = text;
		messagesEl.appendChild(bubble);
		messagesEl.scrollTop = messagesEl.scrollHeight;
		return bubble;
	}

	function setBusy(flag) {
		isBusy = flag;
		input.disabled = flag;
		sendBtn.disabled = flag;
		sendBtn.textContent = flag ? 'Thinking...' : 'Send';
	}

	function setOpen(flag) {
		isOpen = flag;
		panel.classList.toggle('hidden', !flag);
		panel.setAttribute('aria-hidden', flag ? 'false' : 'true');
		launcher.setAttribute('aria-expanded', flag ? 'true' : 'false');
		if (flag) {
			positionPanel();
			input.focus();
		}
	}

	function getLauncherRect() {
		return launcher.getBoundingClientRect();
	}

	function clamp(value, min, max) {
		return Math.max(min, Math.min(value, max));
	}

	function applyLauncherPosition(left, top) {
		const margin = 12;
		const maxLeft = Math.max(margin, window.innerWidth - launcher.offsetWidth - margin);
		const maxTop = Math.max(margin, window.innerHeight - launcher.offsetHeight - margin);
		const clampedLeft = clamp(left, margin, maxLeft);
		const clampedTop = clamp(top, margin, maxTop);

		launcher.style.left = `${clampedLeft}px`;
		launcher.style.top = `${clampedTop}px`;
		launcher.style.right = 'auto';
		launcher.style.bottom = 'auto';

		if (isOpen) {
			positionPanel();
		}
	}

	function saveLauncherPosition() {
		const rect = getLauncherRect();
		const position = { left: Math.round(rect.left), top: Math.round(rect.top) };
		localStorage.setItem(POSITION_KEY, JSON.stringify(position));
	}

	function restoreLauncherPosition() {
		try {
			const raw = localStorage.getItem(POSITION_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed.left !== 'number' || typeof parsed.top !== 'number') return;
			applyLauncherPosition(parsed.left, parsed.top);
		} catch (err) {
			// Ignore malformed saved positions.
		}
	}

	function positionPanel() {
		if (!isOpen) return;
		if (window.matchMedia('(max-width: 640px)').matches) {
			panel.style.left = '';
			panel.style.right = '';
			panel.style.top = '';
			panel.style.bottom = '';
			return;
		}

		const rect = getLauncherRect();
		const panelWidth = panel.offsetWidth || 390;
		const panelHeight = panel.offsetHeight || 520;
		const gap = 12;
		const margin = 12;

		let left = rect.right - panelWidth;
		left = clamp(left, margin, window.innerWidth - panelWidth - margin);

		let top = rect.top - panelHeight - gap;
		if (top < margin) {
			top = rect.bottom + gap;
		}
		top = clamp(top, margin, window.innerHeight - panelHeight - margin);

		panel.style.left = `${left}px`;
		panel.style.top = `${top}px`;
		panel.style.right = 'auto';
		panel.style.bottom = 'auto';
	}

	async function loadHistory() {
		if (historyLoaded) return;
		historyLoaded = true;
		messagesEl.innerHTML = '';

		try {
			const res = await fetch('/api/ai-chat/history', {
				method: 'GET',
				headers: { 'Accept': 'application/json' },
			});
			const data = await res.json().catch(() => ({}));

			if (res.status === 401) {
				addMessage('note', 'Login to use the Gemini assistant.');
				setBusy(true);
				return;
			}
			if (!res.ok) {
				throw new Error(data.error || 'Unable to load chat history');
			}

			const items = Array.isArray(data.messages) ? data.messages : [];
			if (!items.length) {
				addMessage('bot', 'Hi, I am your futuristic Gemini copilot. Ask me to plan, prioritize, or unblock your next move.');
				return;
			}

			items.forEach((item) => {
				const role = item.role === 'user' ? 'user' : 'bot';
				addMessage(role, item.content || '');
			});
		} catch (err) {
			addMessage('note', err.message || 'Unable to load chat history right now.');
		}
	}

	launcher.addEventListener('click', async () => {
		if (suppressNextClick) {
			suppressNextClick = false;
			return;
		}
		setOpen(!isOpen);
		if (isOpen) {
			await loadHistory();
		}
	});

	launcher.addEventListener('pointerdown', (e) => {
		if (e.button !== 0) return;

		const startX = e.clientX;
		const startY = e.clientY;
		const startRect = getLauncherRect();
		const startLeft = startRect.left;
		const startTop = startRect.top;
		let moved = false;

		launcher.classList.add('dragging');
		launcher.setPointerCapture(e.pointerId);

		function onMove(moveEvent) {
			const dx = moveEvent.clientX - startX;
			const dy = moveEvent.clientY - startY;
			if (!moved && Math.hypot(dx, dy) > 6) {
				moved = true;
				isDragging = true;
			}
			if (!moved) return;
			applyLauncherPosition(startLeft + dx, startTop + dy);
		}

		function onUp() {
			launcher.classList.remove('dragging');
			launcher.removeEventListener('pointermove', onMove);
			launcher.removeEventListener('pointerup', onUp);
			launcher.removeEventListener('pointercancel', onUp);

			if (moved) {
				saveLauncherPosition();
				suppressNextClick = true;
			}
			isDragging = false;
		}

		launcher.addEventListener('pointermove', onMove);
		launcher.addEventListener('pointerup', onUp);
		launcher.addEventListener('pointercancel', onUp);
	});

	closeBtn.addEventListener('click', () => setOpen(false));

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && isOpen) {
			setOpen(false);
		}
	});

	window.addEventListener('resize', () => {
		if (isDragging) return;
		const rect = getLauncherRect();
		applyLauncherPosition(rect.left, rect.top);
	});

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (isBusy) return;

		const message = (input.value || '').trim();
		if (!message) return;

		addMessage('user', message);
		input.value = '';
		setBusy(true);
		const thinkingBubble = addMessage('bot', 'Thinking...');

		try {
			const res = await fetch('/api/ai-chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message }),
			});
			const data = await res.json().catch(() => ({}));

			if (thinkingBubble) thinkingBubble.remove();

			if (res.status === 401) {
				addMessage('note', 'Login to chat with Gemini assistant.');
				return;
			}
			if (!res.ok) {
				const details = data.details ? `\n${data.details}` : '';
				throw new Error(`${data.error || 'Chat request failed'}${details}`);
			}

			addMessage('bot', data.reply || 'I could not generate a response right now.');
		} catch (err) {
			if (thinkingBubble && thinkingBubble.parentNode) {
				thinkingBubble.remove();
			}
			addMessage('note', err.message || 'Something went wrong while contacting the assistant.');
		} finally {
			setBusy(false);
		}
	});

	restoreLauncherPosition();
})();
