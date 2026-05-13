const researchEl = {
	body: document.body,
	navLinks: document.querySelectorAll('.site-nav-link'),
	sections: {
		home: document.getElementById('portalHomeSection'),
		board: document.getElementById('portalBoardSection'),
		about: document.getElementById('portalAboutSection'),
	},
	rsStatTotal: document.getElementById('rsStatTotal'),
	rsStatActive: document.getElementById('rsStatActive'),
	rsStatPaused: document.getElementById('rsStatPaused'),
	featuredSources: document.getElementById('featuredSources'),
	homeHighlightsList: document.getElementById('homeHighlightsList'),
	homeHighlightCount: document.getElementById('homeHighlightCount'),
	highlightForm: document.getElementById('highlightForm'),
	highlightId: document.getElementById('highlightId'),
	highlightTitle: document.getElementById('highlightTitle'),
	highlightSummary: document.getElementById('highlightSummary'),
	highlightLink: document.getElementById('highlightLink'),
	saveHighlightBtn: document.getElementById('saveHighlightBtn'),
	cancelHighlightEditBtn: document.getElementById('cancelHighlightEditBtn'),
	aboutItemsList: document.getElementById('aboutItemsList'),
	aboutItemCount: document.getElementById('aboutItemCount'),
	aboutItemForm: document.getElementById('aboutItemForm'),
	aboutItemId: document.getElementById('aboutItemId'),
	aboutItemTitle: document.getElementById('aboutItemTitle'),
	aboutItemContent: document.getElementById('aboutItemContent'),
	saveAboutItemBtn: document.getElementById('saveAboutItemBtn'),
	cancelAboutItemEditBtn: document.getElementById('cancelAboutItemEditBtn'),
	openAddSiteModalBtn: document.getElementById('openAddSiteModalBtn'),
	siteSearch: document.getElementById('siteSearch'),
	siteTableBody: document.getElementById('siteTableBody'),
	siteModal: document.getElementById('siteModal'),
	siteModalTitle: document.getElementById('siteModalTitle'),
	siteModalBackdrop: document.getElementById('siteModalBackdrop'),
	closeSiteModalBtn: document.getElementById('closeSiteModalBtn'),
	cancelSiteModalBtn: document.getElementById('cancelSiteModalBtn'),
	siteForm: document.getElementById('siteForm'),
	siteId: document.getElementById('siteId'),
	siteName: document.getElementById('siteName'),
	siteUrl: document.getElementById('siteUrl'),
	siteCategory: document.getElementById('siteCategory'),
	siteStatus: document.getElementById('siteStatus'),
	siteFrequency: document.getElementById('siteFrequency'),
	siteNotes: document.getElementById('siteNotes'),
	toast: document.getElementById('researchToast'),
};

const state = {
	currentSection: 'home',
	sites: [],
	highlights: [],
	aboutItems: [],
	editingHighlightId: '',
	editingAboutItemId: '',
};

function showToast(message, kind = 'ok') {
	if (!researchEl.toast) return;
	researchEl.toast.textContent = message;
	researchEl.toast.classList.remove('hidden', 'error');
	if (kind === 'error') researchEl.toast.classList.add('error');
	if (researchEl.toast.timeoutId) clearTimeout(researchEl.toast.timeoutId);
	researchEl.toast.timeoutId = setTimeout(() => {
		researchEl.toast.classList.add('hidden');
	}, 2200);
}

async function researchApi(path, options = {}) {
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

function escapeHtml(value) {
	return String(value || '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function renderLoadingSkeletons(target, count = 3) {
	if (!target) return;
	target.innerHTML = Array.from({ length: count })
		.map(() => '<article class="skeleton-card" aria-hidden="true"></article>')
		.join('');
}

function sectionToPath(section) {
	if (section === 'board') return '/my-research/board';
	if (section === 'about') return '/my-research/about';
	return '/my-research/home';
}

function setSection(section, updateUrl = true) {
	state.currentSection = section;
	Object.entries(researchEl.sections).forEach(([key, sectionEl]) => {
		if (!sectionEl) return;
		sectionEl.classList.toggle('hidden', key !== section);
	});

	researchEl.navLinks.forEach((link) => {
		link.classList.toggle('active', link.dataset.section === section);
	});

	if (updateUrl) {
		window.history.pushState({ section }, '', sectionToPath(section));
	}
}

function renderStats() {
	const total = state.sites.length;
	const active = state.sites.filter((site) => (site.status || 'Active') === 'Active').length;
	const paused = state.sites.filter((site) => (site.status || '') === 'Paused').length;
	if (researchEl.rsStatTotal) researchEl.rsStatTotal.textContent = String(total);
	if (researchEl.rsStatActive) researchEl.rsStatActive.textContent = String(active);
	if (researchEl.rsStatPaused) researchEl.rsStatPaused.textContent = String(paused);
}

function renderFeatured() {
	if (!researchEl.featuredSources) return;
	const featured = state.sites.slice(0, 3);
	if (!featured.length) {
		researchEl.featuredSources.innerHTML = '<article class="featured-item"><h4>No sources yet</h4><p>Add your first website from the Research Board section.</p></article>';
		return;
	}

	researchEl.featuredSources.innerHTML = featured
		.map((site) => {
			const statusClass = (site.status || 'Active') === 'Paused' ? 'paused' : 'active';
			return `
				<article class="featured-item">
					<h4>${escapeHtml(site.name)}</h4>
					<p>${escapeHtml(site.category || 'General')} · ${escapeHtml(site.check_frequency || 'Manual')}</p>
					<p><a href="${escapeHtml(site.url)}" target="_blank" rel="noreferrer">${escapeHtml(site.url)}</a></p>
					<span class="status-badge ${statusClass}">${escapeHtml(site.status || 'Active')}</span>
				</article>
			`;
		})
		.join('');
}

function renderTable(sites) {
	if (!researchEl.siteTableBody) return;
	researchEl.siteTableBody.innerHTML = '';
	if (!sites.length) {
		researchEl.siteTableBody.innerHTML = '<tr><td colspan="7"><div class="empty-state">No research sources found.</div></td></tr>';
		return;
	}

	sites.forEach((site) => {
		const tr = document.createElement('tr');
		tr.innerHTML = `
			<td>${escapeHtml(site.name)}</td>
			<td><a href="${escapeHtml(site.url)}" target="_blank" rel="noreferrer">${escapeHtml(site.url)}</a></td>
			<td>${escapeHtml(site.category || 'General')}</td>
			<td>${escapeHtml(site.status || 'Active')}</td>
			<td>${escapeHtml(site.check_frequency || 'Manual')}</td>
			<td>${escapeHtml(site.notes || 'No notes')}</td>
			<td>
				<div class="table-actions">
					<button class="table-btn edit-site-btn">Edit</button>
					<button class="table-btn danger delete-site-btn">Delete</button>
				</div>
			</td>
		`;

		tr.querySelector('.edit-site-btn').addEventListener('click', () => openModal(site));
		tr.querySelector('.delete-site-btn').addEventListener('click', async () => {
			if (!confirm(`Delete research source "${site.name}"?`)) return;
			try {
				await researchApi(`/api/research-links/${site._id}`, { method: 'DELETE' });
				showToast('Source deleted');
				await loadSites();
			} catch (err) {
				showToast(err.message || 'Delete failed', 'error');
			}
		});

		researchEl.siteTableBody.appendChild(tr);
	});
}

function renderHighlights() {
	if (!researchEl.homeHighlightsList) return;
	if (researchEl.homeHighlightCount) {
		researchEl.homeHighlightCount.textContent = String(state.highlights.length);
	}
	if (!state.highlights.length) {
		researchEl.homeHighlightsList.innerHTML = '<article class="featured-item"><h4>No highlights yet</h4><p>Add a highlight to enrich your Home page.</p></article>';
		return;
	}

	researchEl.homeHighlightsList.innerHTML = state.highlights
		.map((item) => `
			<article class="featured-item">
				<h4>${escapeHtml(item.title)}</h4>
				<p>${escapeHtml(item.summary || '')}</p>
				${item.link ? `<p><a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">${escapeHtml(item.link)}</a></p>` : ''}
				<div class="table-actions" style="margin-top:0.5rem;">
					<button class="table-btn edit-highlight-btn" data-id="${item._id}">Edit</button>
					<button class="table-btn danger delete-highlight-btn" data-id="${item._id}">Delete</button>
				</div>
			</article>
		`)
		.join('');

	researchEl.homeHighlightsList.querySelectorAll('.edit-highlight-btn').forEach((btn) => {
		btn.addEventListener('click', () => {
			const item = state.highlights.find((x) => x._id === btn.dataset.id);
			if (!item) return;
			state.editingHighlightId = item._id;
			researchEl.highlightId.value = item._id;
			researchEl.highlightTitle.value = item.title || '';
			researchEl.highlightSummary.value = item.summary || '';
			researchEl.highlightLink.value = item.link || '';
			researchEl.saveHighlightBtn.textContent = 'Update Highlight';
		});
	});

	researchEl.homeHighlightsList.querySelectorAll('.delete-highlight-btn').forEach((btn) => {
		btn.addEventListener('click', async () => {
			if (!confirm('Delete this highlight?')) return;
			try {
				await researchApi(`/api/research-home-highlights/${btn.dataset.id}`, { method: 'DELETE' });
				showToast('Highlight deleted');
				await loadHighlights();
			} catch (err) {
				showToast(err.message || 'Delete failed', 'error');
			}
		});
	});
}

function renderAboutItems() {
	if (!researchEl.aboutItemsList) return;
	if (researchEl.aboutItemCount) {
		researchEl.aboutItemCount.textContent = String(state.aboutItems.length);
	}
	if (!state.aboutItems.length) {
		researchEl.aboutItemsList.innerHTML = '<article class="featured-item"><h4>No about items yet</h4><p>Add items that describe this portal.</p></article>';
		return;
	}

	researchEl.aboutItemsList.innerHTML = state.aboutItems
		.map((item) => `
			<article class="featured-item">
				<h4>${escapeHtml(item.title)}</h4>
				<p>${escapeHtml(item.content)}</p>
				<div class="table-actions" style="margin-top:0.5rem;">
					<button class="table-btn edit-about-item-btn" data-id="${item._id}">Edit</button>
					<button class="table-btn danger delete-about-item-btn" data-id="${item._id}">Delete</button>
				</div>
			</article>
		`)
		.join('');

	researchEl.aboutItemsList.querySelectorAll('.edit-about-item-btn').forEach((btn) => {
		btn.addEventListener('click', () => {
			const item = state.aboutItems.find((x) => x._id === btn.dataset.id);
			if (!item) return;
			state.editingAboutItemId = item._id;
			researchEl.aboutItemId.value = item._id;
			researchEl.aboutItemTitle.value = item.title || '';
			researchEl.aboutItemContent.value = item.content || '';
			researchEl.saveAboutItemBtn.textContent = 'Update Item';
		});
	});

	researchEl.aboutItemsList.querySelectorAll('.delete-about-item-btn').forEach((btn) => {
		btn.addEventListener('click', async () => {
			if (!confirm('Delete this about item?')) return;
			try {
				await researchApi(`/api/research-about-items/${btn.dataset.id}`, { method: 'DELETE' });
				showToast('About item deleted');
				await loadAboutItems();
			} catch (err) {
				showToast(err.message || 'Delete failed', 'error');
			}
		});
	});
}

function resetHighlightForm() {
	state.editingHighlightId = '';
	if (researchEl.highlightForm) researchEl.highlightForm.reset();
	if (researchEl.highlightId) researchEl.highlightId.value = '';
	if (researchEl.saveHighlightBtn) researchEl.saveHighlightBtn.textContent = 'Add Highlight';
}

function resetAboutItemForm() {
	state.editingAboutItemId = '';
	if (researchEl.aboutItemForm) researchEl.aboutItemForm.reset();
	if (researchEl.aboutItemId) researchEl.aboutItemId.value = '';
	if (researchEl.saveAboutItemBtn) researchEl.saveAboutItemBtn.textContent = 'Add Item';
}

function openModal(site = null) {
	if (site) {
		researchEl.siteModalTitle.textContent = 'Edit Tracked Website';
		researchEl.siteId.value = site._id;
		researchEl.siteName.value = site.name || '';
		researchEl.siteUrl.value = site.url || '';
		researchEl.siteCategory.value = site.category || 'General';
		researchEl.siteStatus.value = site.status || 'Active';
		researchEl.siteFrequency.value = site.check_frequency || 'Manual';
		researchEl.siteNotes.value = site.notes || '';
	} else {
		researchEl.siteModalTitle.textContent = 'Add Tracked Website';
		researchEl.siteForm.reset();
		researchEl.siteId.value = '';
		researchEl.siteStatus.value = 'Active';
		researchEl.siteFrequency.value = 'Manual';
	}
	researchEl.siteModal.classList.remove('hidden');
	researchEl.siteModal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
	researchEl.siteModal.classList.add('hidden');
	researchEl.siteModal.setAttribute('aria-hidden', 'true');
	researchEl.siteForm.reset();
	researchEl.siteId.value = '';
}

async function loadSites(search = '') {
	const query = search ? `?q=${encodeURIComponent(search)}` : '';
	const sites = await researchApi(`/api/research-links${query}`);
	if (!sites) return;
	state.sites = sites;
	renderStats();
	renderFeatured();
	renderTable(sites);
}

async function loadHighlights() {
	renderLoadingSkeletons(researchEl.homeHighlightsList, 3);
	const items = await researchApi('/api/research-home-highlights');
	if (!items) return;
	state.highlights = Array.isArray(items) ? items : [];
	renderHighlights();
}

async function loadAboutItems() {
	renderLoadingSkeletons(researchEl.aboutItemsList, 2);
	const items = await researchApi('/api/research-about-items');
	if (!items) return;
	state.aboutItems = Array.isArray(items) ? items : [];
	renderAboutItems();
}

if (researchEl.navLinks) {
	researchEl.navLinks.forEach((link) => {
		link.addEventListener('click', (e) => {
			e.preventDefault();
			setSection(link.dataset.section || 'home');
		});
	});
}

window.addEventListener('popstate', (e) => {
	const section = e.state?.section || 'home';
	setSection(section, false);
});

if (researchEl.openAddSiteModalBtn) {
	researchEl.openAddSiteModalBtn.addEventListener('click', () => openModal());
}
if (researchEl.closeSiteModalBtn) {
	researchEl.closeSiteModalBtn.addEventListener('click', closeModal);
}
if (researchEl.cancelSiteModalBtn) {
	researchEl.cancelSiteModalBtn.addEventListener('click', closeModal);
}
if (researchEl.siteModalBackdrop) {
	researchEl.siteModalBackdrop.addEventListener('click', closeModal);
}

if (researchEl.siteSearch) {
	researchEl.siteSearch.addEventListener('input', async (e) => {
		const search = e.target.value.trim();
		try {
			await loadSites(search);
		} catch (err) {
			showToast(err.message || 'Unable to search', 'error');
		}
	});
}

if (researchEl.siteForm) {
	researchEl.siteForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const payload = {
			name: researchEl.siteName.value.trim(),
			url: researchEl.siteUrl.value.trim(),
			category: researchEl.siteCategory.value.trim(),
			status: researchEl.siteStatus.value,
			check_frequency: researchEl.siteFrequency.value,
			notes: researchEl.siteNotes.value.trim(),
		};

		try {
			if (researchEl.siteId.value) {
				await researchApi(`/api/research-links/${researchEl.siteId.value}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				showToast('Source updated');
			} else {
				await researchApi('/api/research-links', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				showToast('Source added');
			}
			closeModal();
			await loadSites();
		} catch (err) {
			showToast(err.message || 'Save failed', 'error');
		}
	});
}

if (researchEl.highlightForm) {
	researchEl.highlightForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const payload = {
			title: (researchEl.highlightTitle?.value || '').trim(),
			summary: (researchEl.highlightSummary?.value || '').trim(),
			link: (researchEl.highlightLink?.value || '').trim(),
		};
		if (!payload.title || !payload.summary) return;

		try {
			if (state.editingHighlightId) {
				await researchApi(`/api/research-home-highlights/${state.editingHighlightId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				showToast('Highlight updated');
			} else {
				await researchApi('/api/research-home-highlights', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				showToast('Highlight added');
			}
			resetHighlightForm();
			await loadHighlights();
		} catch (err) {
			showToast(err.message || 'Save failed', 'error');
		}
	});
}

if (researchEl.cancelHighlightEditBtn) {
	researchEl.cancelHighlightEditBtn.addEventListener('click', () => {
		resetHighlightForm();
	});
}

if (researchEl.aboutItemForm) {
	researchEl.aboutItemForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const payload = {
			title: (researchEl.aboutItemTitle?.value || '').trim(),
			content: (researchEl.aboutItemContent?.value || '').trim(),
		};
		if (!payload.title || !payload.content) return;

		try {
			if (state.editingAboutItemId) {
				await researchApi(`/api/research-about-items/${state.editingAboutItemId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				showToast('About item updated');
			} else {
				await researchApi('/api/research-about-items', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				showToast('About item added');
			}
			resetAboutItemForm();
			await loadAboutItems();
		} catch (err) {
			showToast(err.message || 'Save failed', 'error');
		}
	});
}

if (researchEl.cancelAboutItemEditBtn) {
	researchEl.cancelAboutItemEditBtn.addEventListener('click', () => {
		resetAboutItemForm();
	});
}

const initialSection = researchEl.body?.dataset.initialSection || 'home';
setSection(initialSection, false);
resetHighlightForm();
resetAboutItemForm();
Promise.all([loadSites(), loadHighlights(), loadAboutItems()]).catch((err) => {
	showToast(err.message || 'Unable to load research data', 'error');
});
