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
            const res = await fetch('/api/notes', {credentials:'same-origin'});
            const data = await res.json();
            if(!Array.isArray(data)||!data.length){ list.innerHTML = '<p class="text-slate-400">No notes yet.</p>'; return; }
            list.innerHTML = data.map(n=>`<button class="w-full text-left panel p-3 note-item" data-id="${n._id}"><strong>${n.title||'Untitled'}</strong><div class="text-xs text-slate-400">${(n.tags||[]).join(', ')}</div></button>`).join('');
            document.querySelectorAll('.note-item').forEach(b=>b.addEventListener('click', onOpen));
        }catch(err){ console.error(err); }
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
            const res = await fetch(`/api/notes/${id}`, {credentials:'same-origin'});
            if(!res.ok) return;
            const n = await res.json();
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
            const res = await fetch('/api/templates', {credentials:'same-origin'});
            const t = await res.json();
            const area = document.createElement('div');
            area.className = 'mt-3';
            area.innerHTML = '<h4 class="font-semibold">Templates</h4>' + (Array.isArray(t) && t.length ? t.map(x=>`<div class="text-sm"><button data-id="${x._id}" class="apply-template text-cyan-300">${x.name}</button></div>`).join('') : '<div class="text-slate-400">No templates</div>');
            const editor = document.getElementById('noteEditor');
            const existing = document.getElementById('templateArea');
            if(existing) existing.remove();
            area.id = 'templateArea';
            editor.prepend(area);
            area.querySelectorAll('.apply-template').forEach(b=>b.addEventListener('click', async (ev)=>{
                const id = ev.currentTarget.dataset.id;
                const res = await fetch('/api/templates', {credentials:'same-origin'});
                const all = await res.json();
                const tpl = all.find(x=>x._id===id);
                if(!tpl) return;
                document.getElementById('noteContent').value = tpl.content || document.getElementById('noteContent').value;
            }));
        }catch(err){console.error(err)}
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
        const url = id? `/api/notes/${id}` : '/api/notes';
        const method = id? 'PUT' : 'POST';
        const res = await fetch(url, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), credentials:'same-origin'});
        if(!res.ok){ alert('Save failed'); return; }
        const saved = await res.json();
        // upload attachment if file selected
        const fileInput = document.getElementById('attachFileInput');
        if(fileInput.files && fileInput.files[0]){
            const fd = new FormData(); fd.append('file', fileInput.files[0]);
            await fetch(`/api/notes/${saved._id}/attachments`, {method:'POST', body:fd, credentials:'same-origin'});
        }
        await load();
        resetForm();
    });

    // Template creation handlers
    const templateEditor = document.getElementById('templateEditor');
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    document.getElementById('toggleEditorBtn').addEventListener('click', ()=>{ templateEditor.classList.toggle('hidden'); });
    saveTemplateBtn.addEventListener('click', async ()=>{
        const name = document.getElementById('templateName').value.trim();
        const content = document.getElementById('templateContent').value;
        if(!name) return alert('Template name required');
        const res = await fetch('/api/templates', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, content}), credentials:'same-origin'});
        if(!res.ok) return alert('Failed to save template');
        document.getElementById('templateName').value='';
        document.getElementById('templateContent').value='';
        templateEditor.classList.add('hidden');
        await loadTemplates();
    });

    await load();
})();
