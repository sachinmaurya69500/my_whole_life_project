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
		milestoneForm: document.getElementById('milestoneForm'),
		milestoneId: document.getElementById('milestoneId'),
		milestoneTitle: document.getElementById('milestoneTitle'),
		milestoneTarget: document.getElementById('milestoneTarget'),
		milestoneStatus: document.getElementById('milestoneStatus'),
		saveMilestoneBtn: document.getElementById('saveMilestoneBtn'),
		cancelMilestoneEditBtn: document.getElementById('cancelMilestoneEditBtn'),
		milestoneList: document.getElementById('milestoneList'),
		milestoneCount: document.getElementById('milestoneCount'),
		domainCount: document.getElementById('domainCount'),
	};

	const state = {
		milestones: [],
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

	function setFutureSection(sectionKey) {
		Object.entries(el.sections).forEach(([key, sectionEl]) => {
			if (!sectionEl) return;
			sectionEl.classList.toggle('hidden', key !== sectionKey);
		});
		el.navButtons.forEach((btn) => {
			btn.classList.toggle('active', btn.dataset.section === sectionKey);
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

	function escapeHtml(value) {
		return String(value || '')
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
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
	resetMilestoneForm();
	loadNorthStar().catch((err) => {
		if (typeof showToast === 'function') showToast(err.message || 'Unable to load north star', 'error');
	});
	loadMilestones().catch((err) => {
		if (typeof showToast === 'function') showToast(err.message || 'Unable to load milestones', 'error');
	});
})();
