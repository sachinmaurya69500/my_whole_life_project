(async function(){
    const list = document.getElementById('notesList');
    const form = document.getElementById('noteForm');
    const newBtn = document.getElementById('newNoteBtn');
    const cancelBtn = document.getElementById('cancelNoteBtn');
    const toggleBtn = document.getElementById('toggleEditorBtn');
    const preview = document.getElementById('notePreview');
    const previewTitle = document.getElementById('previewTitle');
    const previewContent = document.getElementById('previewContent');
    const attachmentsArea = document.getElementById('attachmentsArea');

    function mdToHtml(md){
        // naive client-side markdown preview; backend stores raw markdown
        if(!md) return '';
        // minimal replacements for headings, bold, italics, code blocks, links
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

    async function load(){
        try{
            const data = await api('/api/notes');
            if(!Array.isArray(data)||!data.length){ list.innerHTML = '<p class="text-slate-400">No notes yet.</p>'; return; }
            list.innerHTML = data.map(n=>`<button class="w-full text-left panel p-3 note-item" data-id="${n._id}"><strong>${n.title||'Untitled'}</strong><div class="text-xs text-slate-400">${(n.tags||[]).join(', ')}</div></button>`).join('');
            document.querySelectorAll('.note-item').forEach(b=>b.addEventListener('click', onOpen));
        }catch(err){ console.error(err); showToast(err.message || 'Unable to load notes', 'error'); }
    }

    function resetForm(){
        document.getElementById('noteId').value='';
        document.getElementById('noteTitle').value='';
        document.getElementById('noteTags').value='';
        document.getElementById('noteFolder').value='';
        document.getElementById('noteContent').value='';
        document.getElementById('attachFileInput').value='';
    }

    newBtn.addEventListener('click', ()=>{ resetForm(); preview.classList.add('hidden'); document.getElementById('noteEditor').scrollIntoView(); });
    cancelBtn.addEventListener('click', ()=>{ resetForm(); });
    toggleBtn.addEventListener('click', ()=>{ preview.classList.toggle('hidden'); });

    async function onOpen(e){
        const id = e.currentTarget.dataset.id;
        try{
            const n = await api(`/api/notes/${id}`);
            document.getElementById('noteId').value = n._id;
            document.getElementById('noteTitle').value = n.title||'';
            document.getElementById('noteTags').value = (n.tags||[]).join(',');
            document.getElementById('noteFolder').value = n.folder||'';
            document.getElementById('noteContent').value = n.content||'';
            // preview
            previewTitle.textContent = n.title||'';
            previewContent.innerHTML = mdToHtml(n.content||'');
            attachmentsArea.innerHTML = '';
            if(Array.isArray(n.attachment_file_ids) && n.attachment_file_ids.length){
                attachmentsArea.innerHTML = '<strong>Attachments:</strong>' + n.attachment_file_ids.map(fid=>`<div><a href="/image/${fid}" target="_blank">${fid}</a></div>`).join('');
            }
            preview.classList.remove('hidden');
        }catch(err){console.error(err)}
    }

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
            const saved = await api(id? `/api/notes/${id}` : '/api/notes', { method: id? 'PUT' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
            // upload attachment if file selected
            const fileInput = document.getElementById('attachFileInput');
            if(fileInput.files && fileInput.files[0]){
                const fd = new FormData(); fd.append('file', fileInput.files[0]);
                await api(`/api/notes/${saved._id}/attachments`, { method: 'POST', body: fd });
            }
            await load();
            resetForm();
            showToast('Note saved');
        }catch(err){ console.error(err); showToast(err.message || 'Save failed', 'error'); }
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
            await api('/api/templates', { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, content}) });
            document.getElementById('templateName').value='';
            document.getElementById('templateContent').value='';
            templateEditor.classList.add('hidden');
            await loadTemplates();
            showToast('Template saved');
        }catch(err){ console.error(err); showToast(err.message || 'Failed to save template', 'error'); }
    });

    await load();
})();
