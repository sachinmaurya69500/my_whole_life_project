const researchEl = {
	navButtons: document.querySelectorAll('.research-nav-btn'),
	sections: {
		home: document.getElementById('portalHomeSection'),
		board: document.getElementById('portalBoardSection'),
		about: document.getElementById('portalAboutSection'),
	},
	rsStatTotal: document.getElementById('rsStatTotal'),
	rsStatActive: document.getElementById('rsStatActive'),
	rsStatPaused: document.getElementById('rsStatPaused'),
	siteSearch: document.getElementById('siteSearch'),
	siteTableBody: document.getElementById('siteTableBody'),
	openAddSiteModalBtn: document.getElementById('openAddSiteModalBtn'),
	siteModal: document.getElementById('siteModal'),
	siteModalTitle: document.getElementById('siteModalTitle'),
	closeSiteModalBtn: document.getElementById('closeSiteModalBtn'),
	cancelSiteModalBtn: document.getElementById('cancelSiteModalBtn'),
	siteModalBackdrop: document.getElementById('siteModalBackdrop'),
	siteForm: document.getElementById('siteForm'),
	siteId: document.getElementById('siteId'),
	siteName: document.getElementById('siteName'),
	siteUrl: document.getElementById('siteUrl'),
	siteCategory: document.getElementById('siteCategory'),
	siteStatus: document.getElementById('siteStatus'),
	siteFrequency: document.getElementById('siteFrequency'),
	siteNotes: document.getElementById('siteNotes'),
};

const researchState = {
	sites: [],
	currentSection: 'home',
};

function researchShowToast(message, kind = 'ok') {
	if (typeof showToast === 'function') {
		showToast(message, kind);
		return;
	}
	alert(message);
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

function researchEscapeHtml(value) {
	return String(value || '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function researchSiteStatusClass(status) {
	if (status === 'Paused') return 'chip-amber';
	return 'chip-green';
}

function researchFormatFrequency(value) {
	return value || 'Manual';
}

function setResearchSection(sectionKey) {
	researchState.currentSection = sectionKey;

	Object.entries(researchEl.sections).forEach(([key, sectionEl]) => {
		if (!sectionEl) return;
		sectionEl.classList.toggle('hidden', key !== sectionKey);
	});

	researchEl.navButtons.forEach((btn) => {
		const isActive = btn.dataset.section === sectionKey;
		btn.classList.toggle('active', isActive);
		btn.classList.toggle('border-cyan-700', isActive);
		btn.classList.toggle('bg-cyan-900/20', isActive);
		btn.classList.toggle('border-slate-700', !isActive);
		btn.classList.toggle('hover:bg-slate-800', !isActive);
	});
}

function renderResearchHomeStats(sites) {
	const total = sites.length;
	const active = sites.filter((site) => (site.status || 'Active') === 'Active').length;
	const paused = sites.filter((site) => (site.status || '') === 'Paused').length;

	if (researchEl.rsStatTotal) researchEl.rsStatTotal.textContent = String(total);
	if (researchEl.rsStatActive) researchEl.rsStatActive.textContent = String(active);
	if (researchEl.rsStatPaused) researchEl.rsStatPaused.textContent = String(paused);
}

function openResearchSiteModal(site = null) {
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
}

function closeResearchSiteModal() {
	researchEl.siteModal.classList.add('hidden');
	researchEl.siteForm.reset();
	researchEl.siteId.value = '';
	researchEl.siteStatus.value = 'Active';
	researchEl.siteFrequency.value = 'Manual';
}

function renderResearchSitesTable(sites) {
	researchEl.siteTableBody.innerHTML = '';
	if (!sites.length) {
		researchEl.siteTableBody.innerHTML = '<tr><td colspan="7" class="py-4"><div class="hud-empty-state">No tracked websites yet.</div></td></tr>';
		return;
	}

	sites.forEach((site, index) => {
		const tr = document.createElement('tr');
		tr.className = 'border-b border-slate-800 hud-reveal';
		tr.style.transitionDelay = `${Math.min(index, 10) * 60}ms`;
		tr.innerHTML = `
			<td class="py-3 pr-2 font-medium text-slate-100">${researchEscapeHtml(site.name)}</td>
			<td class="py-3 pr-2 max-w-[20rem] truncate"><a href="${researchEscapeHtml(site.url)}" target="_blank" rel="noreferrer" class="text-cyan-300 hover:underline">${researchEscapeHtml(site.url)}</a></td>
			<td class="py-3 pr-2">${researchEscapeHtml(site.category || 'General')}</td>
			<td class="py-3 pr-2"><span class="status-chip ${researchSiteStatusClass(site.status)}">${researchEscapeHtml(site.status || 'Active')}</span></td>
			<td class="py-3 pr-2">${researchEscapeHtml(researchFormatFrequency(site.check_frequency))}</td>
			<td class="py-3 pr-2 max-w-[18rem] text-slate-300">${researchEscapeHtml(site.notes || 'No notes added yet.')}</td>
			<td class="py-3 pr-2">
				<div class="flex gap-2">
					<button class="edit-site-btn rounded-lg border border-slate-700 px-3 py-1.5 text-xs">Edit</button>
					<button class="delete-site-btn rounded-lg border border-rose-800 text-rose-300 px-3 py-1.5 text-xs">Delete</button>
				</div>
			</td>
		`;

		tr.querySelector('.edit-site-btn').addEventListener('click', () => {
			openResearchSiteModal(site);
		});

		tr.querySelector('.delete-site-btn').addEventListener('click', async () => {
			if (!confirm(`Delete tracked website "${site.name}"?`)) return;
			try {
				await researchApi(`/api/tracked-sites/${site._id}`, { method: 'DELETE' });
				researchShowToast('Tracked website deleted');
				await loadResearchSites();
			} catch (err) {
				researchShowToast(err.message, 'error');
			}
		});

		researchEl.siteTableBody.appendChild(tr);
		requestAnimationFrame(() => tr.classList.add('is-visible'));
	});
}

async function loadResearchSites(search = '') {
	const query = search ? `?q=${encodeURIComponent(search)}` : '';
	researchEl.siteTableBody.innerHTML = '<tr><td colspan="7" class="py-4"><div class="hud-skeleton h-10 rounded-lg"></div></td></tr>';
	const sites = await researchApi(`/api/tracked-sites${query}`);
	if (!sites) return;
	researchState.sites = sites;
	renderResearchHomeStats(sites);
	renderResearchSitesTable(sites);
}

if (researchEl.navButtons) {
	researchEl.navButtons.forEach((btn) => {
		btn.addEventListener('click', () => {
			setResearchSection(btn.dataset.section || 'home');
		});
	});
}

if (researchEl.openAddSiteModalBtn) {
	researchEl.openAddSiteModalBtn.addEventListener('click', () => openResearchSiteModal());
}
if (researchEl.closeSiteModalBtn) {
	researchEl.closeSiteModalBtn.addEventListener('click', closeResearchSiteModal);
}
if (researchEl.cancelSiteModalBtn) {
	researchEl.cancelSiteModalBtn.addEventListener('click', closeResearchSiteModal);
}
if (researchEl.siteModalBackdrop) {
	researchEl.siteModalBackdrop.addEventListener('click', closeResearchSiteModal);
}

if (researchEl.siteSearch) {
	researchEl.siteSearch.addEventListener('input', async (e) => {
		const search = e.target.value.trim();
		try {
			await loadResearchSites(search);
		} catch (err) {
			researchShowToast(err.message, 'error');
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
				researchShowToast('Tracked website updated');
			} else {
				await researchApi('/api/tracked-sites', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				researchShowToast('Tracked website added');
			}
			closeResearchSiteModal();
			await loadResearchSites();
		} catch (err) {
			researchShowToast(err.message, 'error');
		}
	});
}

loadResearchSites().catch((err) => researchShowToast(err.message, 'error'));
setResearchSection('home');
