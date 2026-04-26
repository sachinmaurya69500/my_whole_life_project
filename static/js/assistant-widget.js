(function () {
	const launcher = document.getElementById('assistantLauncher');
	const panel = document.getElementById('assistantPanel');
	const closeBtn = document.getElementById('assistantClose');
	const messagesEl = document.getElementById('assistantMessages');
	const form = document.getElementById('assistantForm');
	const input = document.getElementById('assistantInput');
	const sendBtn = document.getElementById('assistantSend');

	if (!launcher || !panel || !closeBtn || !messagesEl || !form || !input || !sendBtn) {
		return;
	}

	const tabButtons = document.querySelectorAll('.assistant-tab');
	const chatTab = document.getElementById('chatTab');
	const historyTab = document.getElementById('historyTab');
	const addProjectTab = document.getElementById('addProjectTab');
	const editProjectTab = document.getElementById('editProjectTab');
	const adviceTab = document.getElementById('adviceTab');

	const newChatBtn = document.getElementById('newChatBtn');
	const historyList = document.getElementById('historyList');
	const clearHistoryBtn = document.getElementById('clearHistoryBtn');

	const addProjectForm = document.getElementById('addProjectForm');
	const editProjectForm = document.getElementById('editProjectForm');
	const editProjectSelect = document.getElementById('editProjectSelect');
	const deleteProjectBtn = document.getElementById('deleteProjectBtn');

	const adviceForm = document.getElementById('adviceForm');
	const adviceProjectSelect = document.getElementById('adviceProjectSelect');
	const adviceText = document.getElementById('adviceText');

	let isOpen = false;
	let isBusy = false;
	let historyLoaded = false;
	let isDragging = false;
	let suppressNextClick = false;
	let currentEditProjectId = null;
	const POSITION_KEY = 'swm-assistant-launcher-position';

	function clamp(value, min, max) {
		return Math.max(min, Math.min(value, max));
	}

	function getLauncherRect() {
		return launcher.getBoundingClientRect();
	}

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

	function showMessage(elementId, text, type) {
		const el = document.getElementById(elementId);
		if (!el) return;
		el.textContent = text;
		el.className = `project-message show ${type}`;
		setTimeout(() => el.classList.remove('show'), 3000);
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
		localStorage.setItem(POSITION_KEY, JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
	}

	function restoreLauncherPosition() {
		try {
			const raw = localStorage.getItem(POSITION_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed.left !== 'number' || typeof parsed.top !== 'number') return;
			applyLauncherPosition(parsed.left, parsed.top);
		} catch (err) {
			// Ignore malformed value.
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
		const panelHeight = panel.offsetHeight || 560;
		const margin = 12;
		const gap = 12;

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

	function setOpen(flag) {
		isOpen = flag;
		panel.classList.toggle('hidden', !flag);
		panel.setAttribute('aria-hidden', flag ? 'false' : 'true');
		launcher.setAttribute('aria-expanded', flag ? 'true' : 'false');
		if (flag) {
			positionPanel();
		}
	}

	function switchTab(tabName) {
		tabButtons.forEach((btn) => btn.classList.remove('active'));
		[chatTab, historyTab, addProjectTab, editProjectTab, adviceTab]
			.filter(Boolean)
			.forEach((tab) => tab.classList.remove('active'));

		const activeBtn = Array.from(tabButtons).find((btn) => btn.getAttribute('data-tab') === tabName);
		if (activeBtn) activeBtn.classList.add('active');

		if (tabName === 'chat' && chatTab) {
			chatTab.classList.add('active');
			input.focus();
			return;
		}
		if (tabName === 'history' && historyTab) {
			historyTab.classList.add('active');
			loadHistoryList();
			return;
		}
		if (tabName === 'add-project' && addProjectTab) {
			addProjectTab.classList.add('active');
			const titleInput = document.getElementById('projectTitle');
			if (titleInput) titleInput.focus();
			return;
		}
		if (tabName === 'edit-project' && editProjectTab) {
			editProjectTab.classList.add('active');
			loadProjectsForEdit();
			if (editProjectSelect) editProjectSelect.focus();
			return;
		}
		if (tabName === 'advice' && adviceTab) {
			adviceTab.classList.add('active');
			loadProjectsForAdvice();
			if (adviceProjectSelect) adviceProjectSelect.focus();
		}
	}

	async function loadHistory() {
		if (historyLoaded) return;
		historyLoaded = true;
		messagesEl.innerHTML = '';

		try {
			const res = await fetch('/api/ai-chat/history', {
				method: 'GET',
				headers: { Accept: 'application/json' },
			});
			const data = await res.json().catch(() => ({}));

			if (res.status === 401) {
				addMessage('note', 'Login to use the assistant.');
				setBusy(true);
				return;
			}
			if (!res.ok) throw new Error(data.error || 'Unable to load chat history');

			const items = Array.isArray(data.messages) ? data.messages : [];
			if (!items.length) {
				addMessage('bot', 'Hi, I am your simple MongoDB assistant. Ask me about your projects or recent chats.');
				return;
			}

			items.forEach((item) => addMessage(item.role === 'user' ? 'user' : 'bot', item.content || ''));
		} catch (err) {
			addMessage('note', err.message || 'Unable to load chat history right now.');
		}
	}

	async function loadHistoryList() {
		if (!historyList) return;
		historyList.innerHTML = '';
		try {
			const res = await fetch('/api/ai-chat/history', {
				method: 'GET',
				headers: { Accept: 'application/json' },
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || 'Failed to load history');

			const items = Array.isArray(data.messages) ? data.messages : [];
			if (!items.length) {
				historyList.innerHTML = '<div class="history-empty">No chat history yet.</div>';
				return;
			}

			items.forEach((item, idx) => {
				const row = document.createElement('div');
				row.className = 'history-item';
				const role = item.role === 'user' ? 'You' : 'Assistant';
				const content = (item.content || '').trim();
				const preview = content.length > 100 ? `${content.slice(0, 100)}...` : content;
				row.innerHTML = `
					<div class="history-item-date">${role} · Message ${items.length - idx}</div>
					<div class="history-item-text">${preview || '(empty message)'}</div>
				`;
				row.addEventListener('click', () => switchTab('chat'));
				historyList.appendChild(row);
			});
		} catch (err) {
			historyList.innerHTML = `<div class="history-empty">${err.message || 'Unable to load history.'}</div>`;
		}
	}

	async function loadProjectsForEdit() {
		if (!editProjectSelect) return;
		try {
			const res = await fetch('/api/workflows', { method: 'GET', headers: { Accept: 'application/json' } });
			const projects = await res.json();
			editProjectSelect.innerHTML = '<option value="">-- Select a project --</option>';
			projects.forEach((proj) => {
				const option = document.createElement('option');
				option.value = proj.id;
				option.textContent = proj.title;
				editProjectSelect.appendChild(option);
			});
		} catch (err) {
			editProjectSelect.innerHTML = '<option value="">Error loading projects</option>';
		}
	}

	async function loadProjectsForAdvice() {
		if (!adviceProjectSelect) return;
		try {
			const res = await fetch('/api/workflows', { method: 'GET', headers: { Accept: 'application/json' } });
			const projects = await res.json();
			adviceProjectSelect.innerHTML = '<option value="">-- Select a project --</option>';
			projects.forEach((proj) => {
				const option = document.createElement('option');
				option.value = proj.id;
				option.textContent = proj.title;
				adviceProjectSelect.appendChild(option);
			});
		} catch (err) {
			adviceProjectSelect.innerHTML = '<option value="">Error loading projects</option>';
		}
	}

	if (editProjectSelect) {
		editProjectSelect.addEventListener('change', async (e) => {
			const projectId = e.target.value;
			if (!projectId) {
				currentEditProjectId = null;
				return;
			}
			try {
				const res = await fetch(`/api/workflows/${projectId}`, { method: 'GET', headers: { Accept: 'application/json' } });
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
				showMessage('editProjectMessage', err.message || 'Unable to load project', 'error');
			}
		});
	}

	if (adviceProjectSelect && adviceText) {
		adviceProjectSelect.addEventListener('change', async (e) => {
			const projectId = e.target.value;
			adviceText.value = '';
			if (!projectId) return;
			try {
				const res = await fetch(`/api/workflows/${projectId}/advice`, { method: 'GET', headers: { Accept: 'application/json' } });
				if (!res.ok) throw new Error('Failed to load advice');
				const data = await res.json();
				adviceText.value = data.advice || '';
			} catch (err) {
				showMessage('adviceMessage', err.message || 'Unable to load advice', 'error');
			}
		});
	}

	if (addProjectForm) {
		addProjectForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const title = (document.getElementById('projectTitle').value || '').trim();
			if (!title) {
				showMessage('addProjectMessage', 'Please enter a project title', 'error');
				return;
			}

			const payload = {
				title,
				type: document.getElementById('projectType').value,
				description: (document.getElementById('projectDescription').value || '').trim(),
				status: document.getElementById('projectStatus').value,
				progress: parseInt(document.getElementById('projectProgress').value || '0', 10),
				start_date: document.getElementById('projectStartDate').value ? `${document.getElementById('projectStartDate').value}T00:00:00Z` : null,
				due_date: document.getElementById('projectDueDate').value ? `${document.getElementById('projectDueDate').value}T00:00:00Z` : null,
				notes: (document.getElementById('projectNotes').value || '').trim(),
			};

			try {
				const res = await fetch('/api/workflows', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(data.error || 'Failed to create project');
				showMessage('addProjectMessage', 'Project created successfully', 'success');
				addProjectForm.reset();
			} catch (err) {
				showMessage('addProjectMessage', err.message || 'Unable to create project', 'error');
			}
		});
	}

	if (editProjectForm) {
		editProjectForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			if (!currentEditProjectId) {
				showMessage('editProjectMessage', 'Please select a project first', 'error');
				return;
			}

			const payload = {
				title: (document.getElementById('editProjectTitle').value || '').trim(),
				type: document.getElementById('editProjectType').value,
				description: (document.getElementById('editProjectDescription').value || '').trim(),
				status: document.getElementById('editProjectStatus').value,
				progress: parseInt(document.getElementById('editProjectProgress').value || '0', 10),
				start_date: document.getElementById('editProjectStartDate').value ? `${document.getElementById('editProjectStartDate').value}T00:00:00Z` : null,
				due_date: document.getElementById('editProjectDueDate').value ? `${document.getElementById('editProjectDueDate').value}T00:00:00Z` : null,
				notes: (document.getElementById('editProjectNotes').value || '').trim(),
			};

			try {
				const res = await fetch(`/api/workflows/${currentEditProjectId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(data.error || 'Failed to update project');
				showMessage('editProjectMessage', 'Project updated successfully', 'success');
				loadProjectsForEdit();
			} catch (err) {
				showMessage('editProjectMessage', err.message || 'Unable to update project', 'error');
			}
		});
	}

	if (deleteProjectBtn) {
		deleteProjectBtn.addEventListener('click', async () => {
			if (!currentEditProjectId) {
				showMessage('editProjectMessage', 'Please select a project first', 'error');
				return;
			}
			if (!window.confirm('Are you sure you want to delete this project?')) return;
			try {
				const res = await fetch(`/api/workflows/${currentEditProjectId}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(data.error || 'Failed to delete project');
				showMessage('editProjectMessage', 'Project deleted successfully', 'success');
				currentEditProjectId = null;
				loadProjectsForEdit();
			} catch (err) {
				showMessage('editProjectMessage', err.message || 'Unable to delete project', 'error');
			}
		});
	}

	if (adviceForm && adviceProjectSelect && adviceText) {
		adviceForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const projectId = adviceProjectSelect.value;
			if (!projectId) {
				showMessage('adviceMessage', 'Please select a project', 'error');
				return;
			}
			try {
				const res = await fetch(`/api/workflows/${projectId}/advice`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ advice: (adviceText.value || '').trim() }),
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(data.error || 'Failed to save advice');
				showMessage('adviceMessage', 'Advice saved successfully', 'success');
			} catch (err) {
				showMessage('adviceMessage', err.message || 'Unable to save advice', 'error');
			}
		});
	}

	tabButtons.forEach((btn) => {
		btn.addEventListener('click', () => {
			switchTab(btn.getAttribute('data-tab'));
		});
	});

	if (newChatBtn) {
		newChatBtn.addEventListener('click', () => {
			messagesEl.innerHTML = '';
			historyLoaded = false;
			input.value = '';
			addMessage('bot', 'New chat started. What do you want to focus on now?');
			switchTab('chat');
		});
	}

	if (clearHistoryBtn) {
		clearHistoryBtn.addEventListener('click', () => {
			if (!window.confirm('Clear chat from the current view?')) return;
			messagesEl.innerHTML = '';
			historyLoaded = false;
			if (historyList) {
				historyList.innerHTML = '<div class="history-empty">No chat history yet.</div>';
			}
			addMessage('bot', 'Chat view cleared.');
			switchTab('chat');
		});
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
				addMessage('note', 'Login to chat with the assistant.');
				return;
			}
			if (!res.ok) {
				const details = data.details ? `\n${data.details}` : '';
				throw new Error(`${data.error || 'Chat request failed'}${details}`);
			}

			addMessage('bot', data.reply || 'I could not generate a response right now.');
		} catch (err) {
			if (thinkingBubble && thinkingBubble.parentNode) thinkingBubble.remove();
			addMessage('note', err.message || 'Something went wrong while contacting the assistant.');
		} finally {
			setBusy(false);
		}
	});

	restoreLauncherPosition();
})();
