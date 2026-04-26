(function () {
	const launcher = document.getElementById('assistantLauncher');
	const panel = document.getElementById('assistantPanel');
	const closeBtn = document.getElementById('assistantClose');
	const messagesEl = document.getElementById('assistantMessages');
	const form = document.getElementById('assistantForm');
	const input = document.getElementById('assistantInput');
	const sendBtn = document.getElementById('assistantSend');

	if (!launcher || !panel || !messagesEl || !form || !input || !sendBtn) {
		return;
	}

	let isOpen = false;
	let isBusy = false;
	let historyLoaded = false;
	let isDragging = false;
	let suppressNextClick = false;
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
