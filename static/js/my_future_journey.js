(function () {
	const el = {
		navButtons: document.querySelectorAll('.future-nav-btn'),
		sections: {
			home: document.getElementById('futureHomeSection'),
			roadmap: document.getElementById('futureRoadmapSection'),
			milestones: document.getElementById('futureMilestonesSection'),
		},
		northStarText: document.getElementById('northStarText'),
		northStarInput: document.getElementById('northStarInput'),
		saveNorthStarBtn: document.getElementById('saveNorthStarBtn'),
		clearNorthStarBtn: document.getElementById('clearNorthStarBtn'),
		roadmapForm: document.getElementById('roadmapForm'),
		roadmapItemId: document.getElementById('roadmapItemId'),
		roadmapTitle: document.getElementById('roadmapTitle'),
		roadmapDescription: document.getElementById('roadmapDescription'),
		roadmapHorizon: document.getElementById('roadmapHorizon'),
		roadmapStatus: document.getElementById('roadmapStatus'),
		saveRoadmapBtn: document.getElementById('saveRoadmapBtn'),
		cancelRoadmapEditBtn: document.getElementById('cancelRoadmapEditBtn'),
		roadmapList: document.getElementById('roadmapList'),
		importAiRoadmapBtn: document.getElementById('importAiRoadmapBtn'),
		milestoneForm: document.getElementById('milestoneForm'),
		milestoneId: document.getElementById('milestoneId'),
		milestoneTitle: document.getElementById('milestoneTitle'),
		milestoneTarget: document.getElementById('milestoneTarget'),
		milestoneStatus: document.getElementById('milestoneStatus'),
		saveMilestoneBtn: document.getElementById('saveMilestoneBtn'),
		cancelMilestoneEditBtn: document.getElementById('cancelMilestoneEditBtn'),
		milestoneList: document.getElementById('milestoneList'),
		milestoneCount: document.getElementById('milestoneCount'),
		roadmapCount: document.getElementById('roadmapCount'),
		domainCount: document.getElementById('domainCount'),
	};

	const state = {
		milestones: [],
		roadmapItems: [],
		editingRoadmapItemId: '',
		editingMilestoneId: '',
	};

	async function fjApi(path, options = {}) {
		const res = await fetch(path, options);
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			if (res.status === 401) {
				window.location.href = '/login';
				return null;
			}
			throw new Error(data.error || 'Request failed');
		}
		return data;
	}

	function renderRoadmapShell(isLoading = false) {
		if (!el.roadmapList) return;
		if (isLoading) {
			el.roadmapList.innerHTML = `
				<div id="roadmapColumns" class="roadmap-columns">
					<div class="roadmap-column" id="roadmapNear"><h4 class="roadmap-column-title">Near-term</h4><div class="roadmap-column-list"><div class="journey-skeleton" aria-hidden="true"></div></div></div>
					<div class="roadmap-column" id="roadmapMid"><h4 class="roadmap-column-title">Mid-term</h4><div class="roadmap-column-list"><div class="journey-skeleton" aria-hidden="true"></div></div></div>
					<div class="roadmap-column" id="roadmapLong"><h4 class="roadmap-column-title">Long-term</h4><div class="roadmap-column-list"><div class="journey-skeleton" aria-hidden="true"></div></div></div>
				</div>`;
			return;
		}
		if (!el.roadmapList.querySelector('#roadmapColumns')) {
			el.roadmapList.innerHTML = `
				<div id="roadmapColumns" class="roadmap-columns">
					<div class="roadmap-column" id="roadmapNear"><h4 class="roadmap-column-title">Near-term</h4><div class="roadmap-column-list"></div></div>
					<div class="roadmap-column" id="roadmapMid"><h4 class="roadmap-column-title">Mid-term</h4><div class="roadmap-column-list"></div></div>
					<div class="roadmap-column" id="roadmapLong"><h4 class="roadmap-column-title">Long-term</h4><div class="roadmap-column-list"></div></div>
				</div>`;
		}
	}

	// Draw SVG connectors inside each column block connecting roadmap-card centers
	function drawConnectors() {
		if (!el.roadmapList) return;
		const columnBlocks = el.roadmapList.querySelectorAll('.roadmap-column-block');
		columnBlocks.forEach((col) => {
			const svg = col.querySelector('svg.roadmap-svg');
			if (!svg) return;
			const cards = Array.from(col.querySelectorAll('.roadmap-card'));
			while (svg.firstChild) svg.removeChild(svg.firstChild);
			if (cards.length < 2) return;
			svg.setAttribute('width', col.clientWidth);
			svg.setAttribute('height', col.clientHeight);
			const pRect = col.getBoundingClientRect();
			const points = cards.map((card) => {
				const cRect = card.getBoundingClientRect();
				return { x: 12, y: cRect.top - pRect.top + cRect.height / 2 };
			});
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			const d = points.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');
			path.setAttribute('d', d);
			path.classList.add('roadmap-connector');
			svg.appendChild(path);
		});
	}

	function setFutureSection(sectionKey) {
		Object.entries(el.sections).forEach(([key, sectionEl]) => {
			if (!sectionEl) return;
			sectionEl.classList.toggle('hidden', key !== sectionKey);
		});
		el.navButtons.forEach((btn) => {
			btn.classList.toggle('active', btn.dataset.section === sectionKey);
		});
	}

	function renderRoadmapItems() {
		if (!el.roadmapList) return;
		if (el.roadmapCount) el.roadmapCount.textContent = String(state.roadmapItems.length);
		if (!state.roadmapItems.length) {
			el.roadmapList.innerHTML = '<div class="future-card text-sm text-slate-300">No roadmap items yet. Add your first theme.</div>';
			return;
		}

		// Group by horizon
		const near = state.roadmapItems.filter((i) => (i.horizon || 'Near-term') === 'Near-term');
		const mid = state.roadmapItems.filter((i) => (i.horizon || '') === 'Mid-term');
		const long = state.roadmapItems.filter((i) => (i.horizon || '') === 'Long-term');

		const renderCard = (item) => `
			<article class="roadmap-card" data-id="${item._id}" draggable="true" tabindex="0">
				<h5>${escapeHtml(item.title)}</h5>
				<p>${escapeHtml(item.description || '')}</p>
				<div class="roadmap-actions">
					<button class="btn btn-secondary edit-roadmap-btn" data-id="${item._id}">Edit</button>
					<button class="btn btn-secondary delete-roadmap-btn" data-id="${item._id}">Delete</button>
				</div>
			</article>`;

		const columnsHtml = `
			<div class="roadmap-columns-inner">
				<div class="roadmap-column-block">${near.map(renderCard).join('')}</div>
				<div class="roadmap-column-block">${mid.map(renderCard).join('')}</div>
				<div class="roadmap-column-block">${long.map(renderCard).join('')}</div>
			</div>`;

		let columnsContainer = el.roadmapList.querySelector('#roadmapColumns');
		if (!columnsContainer) {
			el.roadmapList.innerHTML = `
				<div id="roadmapColumns" class="roadmap-columns">
					<div class="roadmap-column" id="roadmapNear"><h4 class="roadmap-column-title">Near-term</h4><div class="roadmap-column-list"></div></div>
					<div class="roadmap-column" id="roadmapMid"><h4 class="roadmap-column-title">Mid-term</h4><div class="roadmap-column-list"></div></div>
					<div class="roadmap-column" id="roadmapLong"><h4 class="roadmap-column-title">Long-term</h4><div class="roadmap-column-list"></div></div>
				</div>`;
			columnsContainer = el.roadmapList.querySelector('#roadmapColumns');
		}
		if (!columnsContainer) return;
		columnsContainer.innerHTML = columnsHtml;

		// Ensure each column block has an SVG for connectors
		const columnBlocks = el.roadmapList.querySelectorAll('.roadmap-column-block');
		columnBlocks.forEach((col) => {
			let svg = col.querySelector('svg.roadmap-svg');
			if (!svg) {
				svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				svg.classList.add('roadmap-svg');
				col.insertBefore(svg, col.firstChild);
			}
			// clear existing
			while (svg.firstChild) svg.removeChild(svg.firstChild);
		});

		// After DOM painted, draw connectors
		requestAnimationFrame(() => {
			drawConnectors();
		});

		// Attach handlers by data-id
		el.roadmapList.querySelectorAll('.edit-roadmap-btn').forEach((btn) => {
			btn.addEventListener('click', () => {
				const id = btn.dataset.id;
				const item = state.roadmapItems.find((x) => x._id === id);
				if (!item) return;
				state.editingRoadmapItemId = item._id;
				if (el.roadmapItemId) el.roadmapItemId.value = item._id;
				if (el.roadmapTitle) el.roadmapTitle.value = item.title || '';
				if (el.roadmapDescription) el.roadmapDescription.value = item.description || '';
				if (el.roadmapHorizon) el.roadmapHorizon.value = item.horizon || 'Near-term';
				if (el.roadmapStatus) el.roadmapStatus.value = item.status || 'Planned';
				if (el.saveRoadmapBtn) el.saveRoadmapBtn.textContent = 'Update';
				if (el.cancelRoadmapEditBtn) el.cancelRoadmapEditBtn.classList.remove('hidden');
			});
		});

		el.roadmapList.querySelectorAll('.delete-roadmap-btn').forEach((btn) => {
			btn.addEventListener('click', async () => {
				const id = btn.dataset.id;
				const item = state.roadmapItems.find((x) => x._id === id);
				if (!item || !item._id) return;
				if (!confirm(`Delete roadmap item "${item.title}"?`)) return;
				try {
					await fjApi(`/api/future-journey/roadmap-items/${item._id}`, { method: 'DELETE' });
					if (typeof showToast === 'function') showToast('Roadmap item deleted');
					await loadRoadmapItems();
				} catch (err) {
					if (typeof showToast === 'function') showToast(err.message || 'Delete failed', 'error');
				}
			});
		});

		// Setup drag-and-drop and keyboard handlers
		const cardEls = el.roadmapList.querySelectorAll('.roadmap-card');
		cardEls.forEach((card) => {
			card.addEventListener('dragstart', (e) => {
				card.classList.add('dragging');
				e.dataTransfer.setData('text/plain', card.dataset.id);
				e.dataTransfer.effectAllowed = 'move';
			});
			card.addEventListener('dragend', () => {
				card.classList.remove('dragging');
			});
			// keyboard move handlers
			card.addEventListener('keydown', async (ev) => {
				const id = card.dataset.id;
				const item = state.roadmapItems.find((x) => x._id === id);
				if (!item) return;
				if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
					ev.preventDefault();
					const horizons = ['Near-term', 'Mid-term', 'Long-term'];
					const cur = horizons.indexOf(item.horizon || 'Near-term');
					const next = ev.key === 'ArrowLeft' ? Math.max(0, cur - 1) : Math.min(horizons.length - 1, cur + 1);
					const newHorizon = horizons[next];
					if (newHorizon === item.horizon) return;
					try {
						await fjApi(`/api/future-journey/roadmap-items/${item._id}`, {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ horizon: newHorizon }),
						});
						await loadRoadmapItems();
						card.focus();
						if (typeof showToast === 'function') showToast('Moved roadmap item');
					} catch (err) {
						if (typeof showToast === 'function') showToast(err.message || 'Move failed', 'error');
					}
				} else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
					// reorder within column
					ev.preventDefault();
					const col = (item.horizon || 'Near-term');
					const colItems = state.roadmapItems.filter((x) => (x.horizon || 'Near-term') === col).sort((a,b)=> (a.position||0)-(b.position||0));
					const idx = colItems.findIndex((x) => x._id === id);
					if (idx === -1) return;
					const newIdx = ev.key === 'ArrowUp' ? Math.max(0, idx - 1) : Math.min(colItems.length - 1, idx + 1);
					if (newIdx === idx) return;
					// swap positions
					const target = colItems[newIdx];
					try {
						await Promise.all([
							fjApi(`/api/future-journey/roadmap-items/${item._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: newIdx }) }),
							fjApi(`/api/future-journey/roadmap-items/${target._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: idx }) })
						]);
						await loadRoadmapItems();
						if (typeof showToast === 'function') showToast('Reordered roadmap item');
					} catch (err) {
						if (typeof showToast === 'function') showToast(err.message || 'Reorder failed', 'error');
					}
				}
			});
		});

		const columnBlocks = el.roadmapList.querySelectorAll('.roadmap-column-block');
		columnBlocks.forEach((col, idx) => {
			col.addEventListener('dragover', (e) => {
				e.preventDefault();
				col.classList.add('over');
				e.dataTransfer.dropEffect = 'move';
			});
			col.addEventListener('dragleave', () => col.classList.remove('over'));
			col.addEventListener('drop', async (e) => {
				e.preventDefault();
				col.classList.remove('over');
				const id = e.dataTransfer.getData('text/plain');
				if (!id) return;
				const item = state.roadmapItems.find((x) => x._id === id);
				if (!item) return;
				// determine target horizon by column index
				const horizon = idx === 0 ? 'Near-term' : idx === 1 ? 'Mid-term' : 'Long-term';

				// determine drop index by y position
				const children = Array.from(col.querySelectorAll('.roadmap-card'));
				let targetIndex = children.length; // default append
				const rect = col.getBoundingClientRect();
				const y = e.clientY - rect.top;
				for (let i = 0; i < children.length; i++) {
					const cRect = children[i].getBoundingClientRect();
					const relY = cRect.top - rect.top + cRect.height / 2;
					if (y < relY) { targetIndex = i; break; }
				}

				// build new ordering for target column
				const targetColItems = state.roadmapItems.filter((x) => (x.horizon || 'Near-term') === horizon).sort((a,b)=> (a.position||0)-(b.position||0));

				// remove from original column list if exists
				const originalColItems = state.roadmapItems.filter((x) => (x.horizon || 'Near-term') === (item.horizon || 'Near-term')).sort((a,b)=> (a.position||0)-(b.position||0));

				// if moving within same column we will reposition
				if (item.horizon === horizon) {
					const curIdx = originalColItems.findIndex((x) => x._id === item._id);
					if (curIdx !== -1) originalColItems.splice(curIdx, 1);
				}

				// insert into target array at targetIndex
				targetColItems.splice(targetIndex, 0, item);

				// prepare updates: set new positions for target column items
				const updates = targetColItems.map((it, i) => ({ id: it._id, position: i, horizon }));

				try {
					// send updates in parallel
					await Promise.all(updates.map((u) => fjApi(`/api/future-journey/roadmap-items/${u.id}`, {
						method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: u.position, horizon: u.horizon })
					})));
					await loadRoadmapItems();
					if (typeof showToast === 'function') showToast('Moved and reordered roadmap items');
				} catch (err) {
					if (typeof showToast === 'function') showToast(err.message || 'Move failed', 'error');
				}
			});
		});
	}

	function renderMilestones() {
		if (!el.milestoneList) return;
		if (!state.milestones.length) {
			el.milestoneList.innerHTML = '<div class="future-card text-sm text-slate-300">No milestones yet. Add your first future checkpoint.</div>';
			if (el.milestoneCount) el.milestoneCount.textContent = '0';
			return;
		}

		el.milestoneList.innerHTML = state.milestones
			.map((item, index) => `
				<article class="journey-list-item flex items-start justify-between gap-3">
					<div>
						<h4 class="font-semibold text-slate-100">${escapeHtml(item.title)}</h4>
						<p class="text-xs text-slate-400 mt-1">Target: ${escapeHtml(item.target_date || '')}</p>
						<p class="text-xs mt-1"><span class="future-chip">${escapeHtml(item.status || 'Planned')}</span></p>
					</div>
					<div class="flex gap-2">
						<button class="btn btn-secondary text-xs px-2 py-1 edit-milestone-btn" data-index="${index}">Edit</button>
						<button class="btn btn-secondary text-xs px-2 py-1 delete-milestone-btn" data-index="${index}">Delete</button>
					</div>
				</article>
			`)
			.join('');

		el.milestoneList.querySelectorAll('.edit-milestone-btn').forEach((btn) => {
			btn.addEventListener('click', () => {
				const index = Number(btn.dataset.index);
				const item = state.milestones[index];
				if (!item) return;
				state.editingMilestoneId = item._id;
				if (el.milestoneId) el.milestoneId.value = item._id;
				if (el.milestoneTitle) el.milestoneTitle.value = item.title || '';
				if (el.milestoneTarget) el.milestoneTarget.value = item.target_date || '';
				if (el.milestoneStatus) el.milestoneStatus.value = item.status || 'Planned';
				if (el.saveMilestoneBtn) el.saveMilestoneBtn.textContent = 'Update';
				if (el.cancelMilestoneEditBtn) el.cancelMilestoneEditBtn.classList.remove('hidden');
			});
		});

		el.milestoneList.querySelectorAll('.delete-milestone-btn').forEach((btn) => {
			btn.addEventListener('click', async () => {
				const index = Number(btn.dataset.index);
				const item = state.milestones[index];
				if (!item || !item._id) return;
				if (Number.isNaN(index)) return;
				if (!confirm(`Delete milestone "${item.title}"?`)) return;
				try {
					await fjApi(`/api/future-journey/milestones/${item._id}`, { method: 'DELETE' });
					if (typeof showToast === 'function') showToast('Milestone deleted');
					await loadMilestones();
				} catch (err) {
					if (typeof showToast === 'function') showToast(err.message || 'Delete failed', 'error');
				}
			});
		});

		if (el.milestoneCount) el.milestoneCount.textContent = String(state.milestones.length);
	}

	function resetMilestoneForm() {
		state.editingMilestoneId = '';
		if (el.milestoneForm) el.milestoneForm.reset();
		if (el.milestoneId) el.milestoneId.value = '';
		if (el.milestoneStatus) el.milestoneStatus.value = 'Planned';
		if (el.saveMilestoneBtn) el.saveMilestoneBtn.textContent = 'Add';
		if (el.cancelMilestoneEditBtn) el.cancelMilestoneEditBtn.classList.add('hidden');
	}

	function resetRoadmapForm() {
		state.editingRoadmapItemId = '';
		if (el.roadmapForm) el.roadmapForm.reset();
		if (el.roadmapItemId) el.roadmapItemId.value = '';
		if (el.roadmapHorizon) el.roadmapHorizon.value = 'Near-term';
		if (el.roadmapStatus) el.roadmapStatus.value = 'Planned';
		if (el.saveRoadmapBtn) el.saveRoadmapBtn.textContent = 'Add';
		if (el.cancelRoadmapEditBtn) el.cancelRoadmapEditBtn.classList.add('hidden');
	}

	async function loadMilestones() {
		const items = await fjApi('/api/future-journey/milestones');
		if (!items) return;
		state.milestones = Array.isArray(items) ? items : [];
		renderMilestones();
	}

	async function loadNorthStar() {
		const data = await fjApi('/api/future-journey/north-star');
		if (!data) return;
		if (el.northStarText && data.north_star) {
			el.northStarText.textContent = data.north_star;
		}
	}

	async function loadRoadmapItems() {
		renderRoadmapShell(true);
		const items = await fjApi('/api/future-journey/roadmap-items');
		if (!items) return;
		state.roadmapItems = Array.isArray(items) ? items : [];
		renderRoadmapItems();
	}

	function escapeHtml(value) {
		return String(value || '')
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	function getInspiredAiRoadmap() {
		return [
			{ title: 'Programming & Software Engineering', description: 'Python, testing, data structures, algorithms, software design and Git.', horizon: 'Near-term', status: 'Planned' },
			{ title: 'Math Foundations', description: 'Linear algebra, probability, statistics, and optimization for ML.', horizon: 'Near-term', status: 'Planned' },
			{ title: 'Data Engineering', description: 'Data pipelines, ETL, databases, data cleaning and feature stores.', horizon: 'Near-term', status: 'Planned' },
			{ title: 'Machine Learning Fundamentals', description: 'Supervised/unsupervised learning, model selection, evaluation metrics.', horizon: 'Mid-term', status: 'Planned' },
			{ title: 'Deep Learning', description: 'Neural networks, CNNs, RNNs/Transformers, architectures and training techniques.', horizon: 'Mid-term', status: 'Planned' },
			{ title: 'Model Evaluation & Experimentation', description: 'A/B testing, experiment tracking, bias/variance analysis and reproducibility.', horizon: 'Mid-term', status: 'Planned' },
			{ title: 'MLOps & Deployment', description: 'Containerization, CI/CD, model serving, monitoring and versioning.', horizon: 'Mid-term', status: 'Planned' },
			{ title: 'Cloud Platforms & Infrastructure', description: 'AWS/GCP/Azure fundamentals for ML workloads and managed services.', horizon: 'Mid-term', status: 'Planned' },
			{ title: 'Tools & Frameworks', description: 'TensorFlow/PyTorch, scikit-learn, MLflow, kubeflow and helpful libraries.', horizon: 'Near-term', status: 'Planned' },
			{ title: 'Security, Privacy & Ethics', description: 'Data privacy, secure model serving, fairness and ethical considerations.', horizon: 'Long-term', status: 'Planned' },
			{ title: 'Specializations', description: 'Choose a focus: NLP, Computer Vision, Reinforcement Learning, or Systems.', horizon: 'Long-term', status: 'Planned' },
			{ title: 'Research & Advanced Topics', description: 'Read, reproduce, and contribute to current ML research.', horizon: 'Long-term', status: 'Planned' }
		];
	}

	if (el.navButtons) {
		el.navButtons.forEach((btn) => {
			btn.addEventListener('click', () => {
				setFutureSection(btn.dataset.section || 'home');
			});
		});
	}

	if (el.saveNorthStarBtn && el.northStarInput && el.northStarText) {
		el.saveNorthStarBtn.addEventListener('click', async () => {
			const value = (el.northStarInput.value || '').trim();
			if (!value) return;
			try {
				await fjApi('/api/future-journey/north-star', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ north_star: value }),
				});
				el.northStarText.textContent = value;
				el.northStarInput.value = '';
				if (typeof showToast === 'function') showToast('North star updated');
			} catch (err) {
				if (typeof showToast === 'function') showToast(err.message || 'Update failed', 'error');
			}
		});
	}

	if (el.clearNorthStarBtn && el.northStarText) {
		el.clearNorthStarBtn.addEventListener('click', async () => {
			try {
				await fjApi('/api/future-journey/north-star', { method: 'DELETE' });
				el.northStarText.textContent = 'Set your north star statement to guide every major decision.';
				if (typeof showToast === 'function') showToast('North star cleared');
			} catch (err) {
				if (typeof showToast === 'function') showToast(err.message || 'Clear failed', 'error');
			}
		});
	}

	if (el.cancelRoadmapEditBtn) {
		el.cancelRoadmapEditBtn.addEventListener('click', () => {
			resetRoadmapForm();
		});
	}

	if (el.roadmapForm && el.roadmapTitle && el.roadmapHorizon && el.roadmapStatus) {
		el.roadmapForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const payload = {
				title: (el.roadmapTitle.value || '').trim(),
				description: (el.roadmapDescription.value || '').trim(),
				horizon: (el.roadmapHorizon.value || 'Near-term').trim() || 'Near-term',
				status: (el.roadmapStatus.value || 'Planned').trim() || 'Planned',
			};
			if (!payload.title) return;

			try {
				if (state.editingRoadmapItemId) {
					await fjApi(`/api/future-journey/roadmap-items/${state.editingRoadmapItemId}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload),
					});
					if (typeof showToast === 'function') showToast('Roadmap item updated');
				} else {
					await fjApi('/api/future-journey/roadmap-items', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload),
					});
					if (typeof showToast === 'function') showToast('Roadmap item added');
				}
				resetRoadmapForm();
				await loadRoadmapItems();
			} catch (err) {
				if (typeof showToast === 'function') showToast(err.message || 'Save failed', 'error');
			}
		});
	}

	// Import inspired AI Engineer roadmap (client-side only, original wording)
	if (el.importAiRoadmapBtn) {
		el.importAiRoadmapBtn.addEventListener('click', async () => {
			if (!confirm('Import an AI-engineer-style roadmap (inspired) and save to your roadmap?')) return;
			const originalText = el.importAiRoadmapBtn.textContent;
			try {
				el.importAiRoadmapBtn.disabled = true;
				el.importAiRoadmapBtn.textContent = 'Importing...';
				const items = getInspiredAiRoadmap();
				// Persist each item to the server
				for (const it of items) {
					const payload = {
						title: it.title,
						description: it.description,
						horizon: it.horizon,
						status: it.status,
					};
					await fjApi('/api/future-journey/roadmap-items', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload),
					});
				}
				// Reload from server to get canonical IDs
				await loadRoadmapItems();
				if (el.roadmapCount) el.roadmapCount.textContent = String(state.roadmapItems.length);
				if (typeof showToast === 'function') showToast('Imported and saved AI-engineer-inspired roadmap');
			} catch (err) {
				if (typeof showToast === 'function') showToast(err.message || 'Import failed', 'error');
			} finally {
				el.importAiRoadmapBtn.disabled = false;
				el.importAiRoadmapBtn.textContent = originalText;
			}
		});
	}

	if (el.cancelMilestoneEditBtn) {
		el.cancelMilestoneEditBtn.addEventListener('click', () => {
			resetMilestoneForm();
		});
	}

	if (el.milestoneForm && el.milestoneTitle && el.milestoneTarget && el.milestoneStatus) {
		el.milestoneForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			const title = (el.milestoneTitle.value || '').trim();
			const targetDate = (el.milestoneTarget.value || '').trim();
			const status = (el.milestoneStatus.value || 'Planned').trim() || 'Planned';
			if (!title || !targetDate) return;

			try {
				if (state.editingMilestoneId) {
					await fjApi(`/api/future-journey/milestones/${state.editingMilestoneId}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ title, target_date: targetDate, status }),
					});
					if (typeof showToast === 'function') showToast('Milestone updated');
				} else {
					await fjApi('/api/future-journey/milestones', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ title, target_date: targetDate, status }),
					});
					if (typeof showToast === 'function') showToast('Milestone added');
				}
				resetMilestoneForm();
				await loadMilestones();
			} catch (err) {
				if (typeof showToast === 'function') showToast(err.message || 'Save failed', 'error');
			}
		});
	}

	if (el.domainCount) el.domainCount.textContent = '4';
	setFutureSection('home');
	resetRoadmapForm();
	resetMilestoneForm();
	loadNorthStar().catch((err) => {
		if (typeof showToast === 'function') showToast(err.message || 'Unable to load north star', 'error');
	});
	loadRoadmapItems().catch((err) => {
		if (typeof showToast === 'function') showToast(err.message || 'Unable to load roadmap', 'error');
	});
	loadMilestones().catch((err) => {
		if (typeof showToast === 'function') showToast(err.message || 'Unable to load milestones', 'error');
	});
})();
