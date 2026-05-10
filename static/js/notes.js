(async function(){
const list = document.getElementById('notesList');
const form = document.getElementById('noteForm');
const newBtn = document.getElementById('newNoteBtn');
const cancelBtn = document.getElementById('cancelNoteBtn');
const toggleBtn = document.getElementById('toggleEditorBtn');
const preview = document.getElementById('notePreview');
const previewTitle = document.getElementById('previewTitle');
const previewContent = document.getElementById('previewContent');
const previewMeta = document.getElementById('previewMeta');
const attachmentsArea = document.getElementById('attachmentsArea');
const searchInput = document.getElementById('searchNotes');
const exportBtn = document.getElementById('exportNoteBtn');
const viewModal = document.getElementById('viewModal');
const closeViewModal = document.getElementById('closeViewModal');
const viewModalTitle = document.getElementById('viewModalTitle');
const viewModalMeta = document.getElementById('viewModalMeta');
const viewModalContent = document.getElementById('viewModalContent');

let allNotes = [];
let currentNote = null;

function mdToHtml(md){
if(!md) return '';
let html = md
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/\n/g, '<br/>')
.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
.replace(/\*(.*?)\*/g, '<em>$1</em>')
.replace(/`([^`]*)`/g, '<code>$1</code>')
.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="nofollow noopener noreferrer">$1</a>');
return html;
}

function getNoteMeta(note) {
const wordCount = (note.content || '').split(/\s+/).filter(w => w).length;
const created = note.created_at ? new Date(note.created_at).toLocaleDateString() : 'N/A';
const modified = note.updated_at ? new Date(note.updated_at).toLocaleDateString() : created;
return `${wordCount} words • Created: ${created} • Modified: ${modified}`;
}

async function load(){
try{
allNotes = await api('/api/notes');
renderNotesList(allNotes);
}catch(err){ 
console.error(err); 
showToast(err.message || 'Unable to load notes', 'error'); 
}
}

function renderNotesList(notes){
if(!Array.isArray(notes) || !notes.length){ 
list.innerHTML = '<p class="text-slate-400">No notes yet.</p>'; 
return; 
}
list.innerHTML = notes.map(n => `
<div class="panel p-3 space-y-2">
<div class="flex justify-between items-start gap-2">
<button class="flex-1 text-left note-item-edit hover:text-cyan-300 transition" data-id="${n._id}">
<strong>${n.title || 'Untitled'}</strong>
<div class="text-xs text-slate-400">${(n.tags||[]).join(', ')}</div>
</button>
<button class="note-item-view text-xs text-slate-400 hover:text-cyan-300 transition" data-id="${n._id}" title="Quick view">
<i class="fa-solid fa-eye"></i>
</button>
</div>
<div class="flex gap-2">
<button class="note-item-delete text-xs text-rose-400 hover:text-rose-300 transition" data-id="${n._id}" title="Delete note">
<i class="fa-solid fa-trash"></i>
</button>
</div>
</div>
`).join('');

document.querySelectorAll('.note-item-edit').forEach(b => b.addEventListener('click', onOpen));
document.querySelectorAll('.note-item-view').forEach(b => b.addEventListener('click', onQuickView));
document.querySelectorAll('.note-item-delete').forEach(b => b.addEventListener('click', onDelete));
}

function filterNotes(){
const query = (searchInput.value || '').toLowerCase();
const filtered = allNotes.filter(n => {
const title = (n.title || '').toLowerCase();
const tags = (n.tags || []).join(' ').toLowerCase();
const content = (n.content || '').toLowerCase();
return title.includes(query) || tags.includes(query) || content.includes(query);
});
renderNotesList(filtered);
}

function resetForm(){
document.getElementById('noteId').value='';
document.getElementById('noteTitle').value='';
document.getElementById('noteTags').value='';
document.getElementById('noteFolder').value='';
document.getElementById('noteContent').value='';
document.getElementById('attachFileInput').value='';
currentNote = null;
}

newBtn.addEventListener('click', ()=>{ 
resetForm(); 
preview.classList.add('hidden'); 
document.getElementById('noteEditor').scrollIntoView(); 
});
cancelBtn.addEventListener('click', ()=>{ resetForm(); });
toggleBtn.addEventListener('click', ()=>{ preview.classList.toggle('hidden'); });
searchInput.addEventListener('input', filterNotes);
closeViewModal.addEventListener('click', ()=>{ viewModal.classList.add('hidden'); });
viewModal.addEventListener('click', (e) => {
if(e.target === viewModal) viewModal.classList.add('hidden');
});

async function onOpen(e){
const id = e.currentTarget.dataset.id;
try{
const n = await api(`/api/notes/${id}`);
currentNote = n;
document.getElementById('noteId').value = n._id;
document.getElementById('noteTitle').value = n.title||'';
document.getElementById('noteTags').value = (n.tags||[]).join(',');
document.getElementById('noteFolder').value = n.folder||'';
document.getElementById('noteContent').value = n.content||'';

previewTitle.textContent = n.title||'';
previewMeta.textContent = getNoteMeta(n);
previewContent.innerHTML = mdToHtml(n.content||'');
attachmentsArea.innerHTML = '';
if(Array.isArray(n.attachment_file_ids) && n.attachment_file_ids.length){
attachmentsArea.innerHTML = '<strong>Attachments:</strong>' + n.attachment_file_ids.map(fid=>`<div><a href="/image/${fid}" target="_blank">${fid}</a></div>`).join('');
}
preview.classList.remove('hidden');
document.getElementById('noteEditor').scrollIntoView();
}catch(err){
console.error(err);
showToast('Failed to load note', 'error');
}
}

async function onQuickView(e){
e.stopPropagation();
const id = e.currentTarget.dataset.id;
try{
const n = await api(`/api/notes/${id}`);
viewModalTitle.textContent = n.title || 'Untitled';
viewModalMeta.textContent = getNoteMeta(n);
viewModalContent.innerHTML = mdToHtml(n.content || '');
viewModal.classList.remove('hidden');
}catch(err){
console.error(err);
showToast('Failed to load note', 'error');
}
}

async function onDelete(e){
e.stopPropagation();
const id = e.currentTarget.dataset.id;
if(!confirm('Delete this note?')) return;
try{
await api(`/api/notes/${id}`, { method: 'DELETE' });
showToast('Note deleted');
await load();
resetForm();
preview.classList.add('hidden');
}catch(err){
console.error(err);
showToast('Failed to delete note', 'error');
}
}

exportBtn.addEventListener('click', async ()=>{
if(!currentNote) return showToast('No note selected', 'error');
try{
const markdown = `# ${currentNote.title || 'Untitled'}\n\n${currentNote.tags && currentNote.tags.length ? `**Tags:** ${currentNote.tags.join(', ')}\n\n` : ''}${currentNote.content || ''}`;
const blob = new Blob([markdown], { type: 'text/markdown' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `${(currentNote.title || 'note').replace(/\s+/g, '_')}.md`;
a.click();
URL.revokeObjectURL(url);
showToast('Note exported');
}catch(err){
console.error(err);
showToast('Export failed', 'error');
}
});

// Templates integration
async function loadTemplates(){
try{
const t = await api('/api/templates');
const area = document.createElement('div');
area.className = 'mt-3';
area.innerHTML = '<h4 class="font-semibold">Templates</h4>';
const listWrap = document.createElement('div');
listWrap.className = 'space-y-1';
if(Array.isArray(t) && t.length){
t.forEach((x)=>{
const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'apply-template text-cyan-300 text-sm';
btn.dataset.id = x._id;
btn.dataset.content = x.content || '';
btn.textContent = x.name || 'Template';
const row = document.createElement('div');
row.className = 'text-sm';
row.appendChild(btn);
listWrap.appendChild(row);
});
} else {
listWrap.innerHTML = '<div class="text-slate-400">No templates</div>';
}
area.appendChild(listWrap);
const editor = document.getElementById('noteEditor');
const existing = document.getElementById('templateArea');
if(existing) existing.remove();
area.id = 'templateArea';
editor.prepend(area);
area.querySelectorAll('.apply-template').forEach(b=>b.addEventListener('click', (ev)=>{
const content = ev.currentTarget.dataset.content || '';
document.getElementById('noteContent').value = content || document.getElementById('noteContent').value;
}));
}catch(err){console.error(err);}
}

await loadTemplates();

form.addEventListener('submit', async (ev)=>{
ev.preventDefault();
const id = document.getElementById('noteId').value;
const payload = {
title: document.getElementById('noteTitle').value.trim(),
content: document.getElementById('noteContent').value,
tags: document.getElementById('noteTags').value.split(',').map(s=>s.trim()).filter(Boolean),
folder: document.getElementById('noteFolder').value.trim(),
};
try{
const saved = await api(id? `/api/notes/${id}` : '/api/notes', { 
method: id? 'PUT' : 'POST', 
headers:{'Content-Type':'application/json'}, 
body:JSON.stringify(payload) 
});
const fileInput = document.getElementById('attachFileInput');
if(fileInput.files && fileInput.files[0]){
const fd = new FormData(); 
fd.append('file', fileInput.files[0]);
await api(`/api/notes/${saved._id}/attachments`, { method: 'POST', body: fd });
}
await load();
resetForm();
showToast('Note saved');
}catch(err){ 
console.error(err); 
showToast(err.message || 'Save failed', 'error'); 
}
});

// Template creation handlers
const templateEditor = document.getElementById('templateEditor');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
document.getElementById('toggleEditorBtn').addEventListener('click', ()=>{ templateEditor.classList.toggle('hidden'); });
saveTemplateBtn.addEventListener('click', async ()=>{
const name = document.getElementById('templateName').value.trim();
const content = document.getElementById('templateContent').value;
if(!name) return showToast('Template name required', 'error');
try{
await api('/api/templates', { 
method: 'POST', 
headers:{'Content-Type':'application/json'}, 
body:JSON.stringify({name, content}) 
});
document.getElementById('templateName').value='';
document.getElementById('templateContent').value='';
templateEditor.classList.add('hidden');
await loadTemplates();
showToast('Template saved');
}catch(err){ 
console.error(err); 
showToast(err.message || 'Failed to save template', 'error'); 
}
});

await load();
})();
