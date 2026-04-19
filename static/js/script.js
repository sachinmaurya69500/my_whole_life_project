const state = {
	workflows: [],
	currentSection: 'dashboard',
	selectedFiles: [],
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
	profilePhotoInput: document.getElementById('profilePhotoInput'),
	uploadProfileBtn: document.getElementById('uploadProfileBtn'),
	logoutBtn: document.getElementById('logoutBtn'),
	menuToggle: document.getElementById('menuToggle'),
	sidebar: document.getElementById('sidebar'),
	mobileBackdrop: document.getElementById('mobileBackdrop'),
};

function showToast(message, kind = 'ok') {
	let toast = document.getElementById('globalToast');
	if (!toast) {
		toast = document.createElement('div');
		toast.id = 'globalToast';
		toast.className = 'fixed bottom-4 right-4 z-[60] px-4 py-2 rounded-lg text-sm shadow-xl transition';
		document.body.appendChild(toast);
	}
	toast.textContent = message;
	toast.classList.remove('bg-rose-500', 'bg-emerald-500', 'opacity-0');
	toast.classList.add(kind === 'error' ? 'bg-rose-500' : 'bg-emerald-500');
	toast.classList.add('opacity-100');
	setTimeout(() => toast.classList.add('opacity-0'), 2200);
}

async function api(path, options = {}) {
	const res = await fetch(path, options);
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		if (res.status === 401) {
			window.location.href = '/login';
			return;
		}
		throw new Error(data.error || data.message || 'Request failed');
	}
	return data;
}

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
		targetEl.innerHTML = '<p class="text-slate-400">No workflows found.</p>';
		return;
	}

	workflows.forEach((wf) => {
		const node = el.cardTemplate.content.cloneNode(true);
		const titleEl = node.querySelector('.title');
		titleEl.textContent = wf.title;
		titleEl.classList.add('cursor-pointer', 'hover:text-cyan-300', 'transition');
		titleEl.addEventListener('click', () => {
			window.location.href = `/project/${wf._id}`;
		});

		const statusChip = node.querySelector('.status-chip');
		statusChip.textContent = wf.status;
		statusChip.className = `status-chip ${statusClass(wf.status)}`;

		node.querySelector('.description').textContent = wf.description || 'No description added yet.';
		node.querySelector('.due-date').textContent = formatDue(wf.due_date);
		node.querySelector('.progress-label').textContent = `${wf.progress}%`;
		node.querySelector('.progress-fill').style.width = `${wf.progress}%`;
		node.querySelector('.notes').textContent = wf.notes ? `Notes: ${wf.notes}` : 'Notes: -';

		const photoGrid = node.querySelector('.photo-grid');
		if (wf.photo_urls.length) {
			wf.photo_urls.forEach((url, idx) => {
				const imgWrap = document.createElement('div');
				imgWrap.className = 'relative group';
				imgWrap.innerHTML = `
					<img src="${url}" alt="Workflow photo ${idx + 1}" class="h-20 w-full rounded-lg object-cover border border-slate-700" />
					<button data-photo-id="${wf.photo_ids[idx]}" class="delete-photo-btn absolute top-1 right-1 h-6 w-6 grid place-items-center rounded-md bg-black/50 text-xs opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-xmark"></i></button>
				`;
				photoGrid.appendChild(imgWrap);
			});
		}

		node.querySelector('.edit-btn').addEventListener('click', () => openModal(wf));
		node.querySelector('.delete-btn').addEventListener('click', async () => {
			if (!confirm(`Delete workflow "${wf.title}"?`)) return;
			await api(`/api/workflows/${wf._id}`, { method: 'DELETE' });
			showToast('Workflow deleted');
			await loadAll();
		});

		node.querySelectorAll('.delete-photo-btn').forEach((btn) => {
			btn.addEventListener('click', async () => {
				const photoId = btn.dataset.photoId;
				await api(`/api/workflows/${wf._id}/photos/${photoId}`, { method: 'DELETE' });
				showToast('Photo deleted');
				await loadAll();
			});
		});

		targetEl.appendChild(node);
	});
}

function renderManageTable(workflows) {
	el.manageTableBody.innerHTML = '';
	if (!workflows.length) {
		el.manageTableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-slate-400">No workflows found.</td></tr>';
		return;
	}

	workflows.forEach((wf) => {
		const tr = document.createElement('tr');
		tr.className = 'border-b border-slate-800';
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
	});
}

function renderRecentActivity(items) {
	el.recentActivity.innerHTML = '';
	if (!items.length) {
		el.recentActivity.innerHTML = '<p class="text-slate-400 text-sm">No activity yet.</p>';
		return;
	}

	items.forEach((item) => {
		const row = document.createElement('div');
		row.className = 'rounded-lg border border-slate-800 bg-slate-900/50 p-3';
		row.innerHTML = `
			<div class="flex justify-between gap-3">
				<p class="font-medium">${escapeHtml(item.title)}</p>
				<span class="status-chip ${statusClass(item.status)}">${item.status}</span>
			</div>
			<p class="text-xs text-slate-400 mt-1">Progress: ${item.progress}%</p>
		`;
		el.recentActivity.appendChild(row);
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
		: 'https://via.placeholder.com/300x300?text=Profile';
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
}

async function loadWorkflows(search = '') {
	const query = search ? `?q=${encodeURIComponent(search)}` : '';
	state.workflows = await api(`/api/workflows${query}`);
	renderCards(el.dailyGrid, state.workflows.filter((w) => w.type === 'Daily'));
	renderCards(el.longTermGrid, state.workflows.filter((w) => w.type === 'Long-term'));
	renderManageTable(state.workflows);
}

async function loadAll() {
	await Promise.all([loadDashboard(), loadWorkflows(), loadProfile()]);
}

function escapeHtml(value) {
	return String(value || '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
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
