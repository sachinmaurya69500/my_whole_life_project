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
		researchEl.siteTableBody.innerHTML = '<tr><td colspan="7"><div class="empty-state">No tracked websites found.</div></td></tr>';
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
			if (!confirm(`Delete tracked website "${site.name}"?`)) return;
			try {
				await researchApi(`/api/tracked-sites/${site._id}`, { method: 'DELETE' });
				showToast('Source deleted');
				await loadSites();
			} catch (err) {
				showToast(err.message || 'Delete failed', 'error');
			}
		});

		researchEl.siteTableBody.appendChild(tr);
	});
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
	const sites = await researchApi(`/api/tracked-sites${query}`);
	if (!sites) return;
	state.sites = sites;
	renderStats();
	renderFeatured();
	renderTable(sites);
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
				await researchApi(`/api/tracked-sites/${researchEl.siteId.value}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				showToast('Source updated');
			} else {
				await researchApi('/api/tracked-sites', {
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

const initialSection = researchEl.body?.dataset.initialSection || 'home';
setSection(initialSection, false);
loadSites().catch((err) => showToast(err.message || 'Unable to load sources', 'error'));
