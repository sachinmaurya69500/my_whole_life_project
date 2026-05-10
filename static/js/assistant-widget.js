(function () {
	// Minimal, immersive Jarvis assistant implementation
	const launcher = document.getElementById('assistantLauncher');
	const jarvisPanel = document.getElementById('jarvisPanel');
	const jarvisClose = document.getElementById('jarvisClose');
	const jarvisMessages = document.getElementById('jarvisMessages');
	const jarvisForm = document.getElementById('jarvisForm');
	const jarvisInput = document.getElementById('jarvisInput');
	const jarvisVoiceBtn = document.getElementById('jarvisVoiceBtn');
	const jarvisStatus = document.getElementById('jarvisStatus');
	const jarvisCanvas = document.getElementById('jarvisCanvas');

	if (!launcher || !jarvisPanel || !jarvisClose || !jarvisMessages || !jarvisForm || !jarvisInput) {
		return;
	}

	function openJarvis() {
		jarvisPanel.classList.remove('hidden');
		jarvisPanel.setAttribute('aria-hidden', 'false');
		document.documentElement.setAttribute('data-theme', localStorage.getItem('swm-theme') || document.documentElement.getAttribute('data-theme') || 'dark');
		jarvisInput.focus();
		checkAiStatus();
		startHolo();
	}

	function closeJarvis() {
		jarvisPanel.classList.add('hidden');
		jarvisPanel.setAttribute('aria-hidden', 'true');
		stopHolo();
	}

	launcher.addEventListener('click', (e) => {
		e.preventDefault();
		if (jarvisPanel.classList.contains('hidden')) openJarvis();
		else closeJarvis();
	});
	jarvisClose.addEventListener('click', closeJarvis);
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !jarvisPanel.classList.contains('hidden')) closeJarvis();
	});

	function addBubble(role, text) {
		const div = document.createElement('div');
		div.className = `assistant-bubble ${role}`;
		div.textContent = text;
		jarvisMessages.appendChild(div);
		jarvisMessages.scrollTop = jarvisMessages.scrollHeight;
		return div;
	}

	async function checkAiStatus() {
		if (!jarvisStatus) return;
		jarvisStatus.classList.remove('connected', 'checking', 'disconnected');
		jarvisStatus.classList.add('checking');
		jarvisStatus.textContent = 'Checking AI...';
		try {
			const data = await api('/api/ai-chat/status');
			if (data && data.api_key_configured && data.authenticated) {
				jarvisStatus.classList.remove('checking');
				jarvisStatus.classList.add('connected');
				jarvisStatus.textContent = 'JARVIS Online';
				return true;
			}
			jarvisStatus.classList.remove('checking');
			jarvisStatus.classList.add('disconnected');
			jarvisStatus.textContent = data && !data.api_key_configured ? 'API Key missing' : 'Login required';
			return false;
		} catch (err) {
			jarvisStatus.classList.remove('checking');
			jarvisStatus.classList.add('disconnected');
			jarvisStatus.textContent = 'AI unreachable';
			return false;
		}
	}

	jarvisForm.addEventListener('submit', async (ev) => {
		ev.preventDefault();
		const message = (jarvisInput.value || '').trim();
		if (!message) return;
		jarvisInput.value = '';
		addBubble('user', message);
		const thinking = addBubble('bot', 'Analyzing...');
		try {
			const reply = await api('/api/ai-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
			if (thinking && thinking.parentNode) thinking.remove();
			const text = reply.reply || 'JARVIS could not generate a response right now.';
			addBubble('bot', text);
			// speak the reply if available
			speak(text);
			// subtle response tone
			playTone(880, 0.08);
		} catch (err) {
			if (thinking && thinking.parentNode) thinking.remove();
			addBubble('note', err.message || 'Communication error with JARVIS');
		}
	});

	// Voice button: toggle speech recognition
	jarvisVoiceBtn && jarvisVoiceBtn.addEventListener('click', async () => {
		if (!window._jarvisRecognition) {
			initSpeech();
		}
		const rec = window._jarvisRecognition;
		if (!rec) {
			showToast('Speech recognition not supported in this browser.', 'error');
			return;
		}
		if (window._jarvisListening) {
			rec.stop();
			return;
		}
		try {
			playTone(1320, 0.06);
			rec.start();
		} catch (err) {
			showToast('Unable to start voice recognition', 'error');
		}
	});

	// Simple holographic canvas animation
	let holoAnim = null;
	function startHolo() {
		if (!jarvisCanvas) return;
		const ctx = jarvisCanvas.getContext('2d');
		let t = 0;
		function draw() {
			const w = jarvisCanvas.width = jarvisCanvas.clientWidth || 800;
			const h = jarvisCanvas.height = 180;
			ctx.clearRect(0, 0, w, h);
			for (let i = 0; i < 6; i++) {
				const y = h * (i + 1) / 7 + Math.sin((t + i) * 0.04) * 8;
				const grad = ctx.createLinearGradient(0, y - 6, w, y + 6);
				grad.addColorStop(0, 'rgba(0,212,255,0)');
				grad.addColorStop(0.5, 'rgba(0,212,255,0.15)');
				grad.addColorStop(1, 'rgba(0,212,255,0)');
				ctx.fillStyle = grad;
				ctx.fillRect(0, y - 6, w, 12);
			}
			const cx = w / 2;
			const cy = h / 2;
			const radius = 28 + Math.sin(t * 0.02) * 8;
			ctx.beginPath();
			const g = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 2);
			g.addColorStop(0, 'rgba(0,212,255,0.16)');
			g.addColorStop(1, 'rgba(0,212,255,0)');
			ctx.fillStyle = g;
			ctx.arc(cx, cy, radius * 2, 0, Math.PI * 2);
			ctx.fill();
			t++;
			holoAnim = requestAnimationFrame(draw);
		}
		if (!holoAnim) draw();
	}

	function stopHolo() {
		if (holoAnim) cancelAnimationFrame(holoAnim);
		holoAnim = null;
	}

	// Speech utilities
	function speak(text) {
		try {
			if (!('speechSynthesis' in window)) return;
			const utter = new SpeechSynthesisUtterance(text);
			utter.lang = 'en-US';
			utter.rate = 1.02;
			utter.pitch = 1.05;
			const voices = speechSynthesis.getVoices();
			if (voices && voices.length) {
				const preferred = voices.find((v) => /en[-_]?us/i.test(v.lang) || /google/i.test(v.name));
				if (preferred) utter.voice = preferred;
			}
			speechSynthesis.cancel();
			speechSynthesis.speak(utter);
		} catch (err) {
			// ignore TTS errors
		}
	}

	function playTone(freq, duration) {
		try {
			const Ctx = window.AudioContext || window.webkitAudioContext;
			if (!Ctx) return;
			const ctx = new Ctx();
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.type = 'sine';
			o.frequency.value = freq;
			g.gain.value = 0.0001;
			o.connect(g);
			g.connect(ctx.destination);
			o.start();
			g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
			g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
			setTimeout(() => {
				try { o.stop(); } catch (e) {}
				try { ctx.close(); } catch (e) {}
			}, duration * 1000 + 60);
		} catch (e) {
			// ignore audio errors
		}
	}

	function initSpeech() {
		const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
		if (!SR) {
			window._jarvisRecognition = null;
			return;
		}
		const rec = new SR();
		rec.lang = 'en-US';
		rec.interimResults = false;
		rec.maxAlternatives = 1;
		rec.onstart = () => {
			window._jarvisListening = true;
			jarvisVoiceBtn && jarvisVoiceBtn.classList && jarvisVoiceBtn.classList.add('listening');
			showToast('JARVIS listening...', 'info');
		};
		rec.onend = () => {
			window._jarvisListening = false;
			jarvisVoiceBtn && jarvisVoiceBtn.classList && jarvisVoiceBtn.classList.remove('listening');
			showToast('JARVIS stopped listening', 'info');
			playTone(880, 0.04);
		};
		rec.onerror = (e) => {
			window._jarvisListening = false;
			jarvisVoiceBtn && jarvisVoiceBtn.classList && jarvisVoiceBtn.classList.remove('listening');
			showToast('Voice error: ' + (e.error || 'unknown'), 'error');
		};
		rec.onresult = (ev) => {
			const t = (ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || '';
			if (t) {
				jarvisInput.value = t;
				// small tone to confirm capture
				playTone(1760, 0.05);
				// auto-submit
				jarvisForm.dispatchEvent(new Event('submit', { cancelable: true }));
			}
		};
		window._jarvisRecognition = rec;
	}

	// Initialize: hide old assistant elements if any and prepare Jarvis
	(function init() {
		const saved = localStorage.getItem('swm-theme');
		if (saved === 'jarvis') document.documentElement.setAttribute('data-theme', 'jarvis');
		const old = document.getElementById('assistantPanel');
		if (old) old.remove();
		// Prepare speech APIs if available
		try { initSpeech(); } catch (e) {}
	})();
})();
