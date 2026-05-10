(async function(){
    const list = document.getElementById('contactsList');
    const formWrap = document.getElementById('contactFormWrap');
    const form = document.getElementById('contactForm');
    const newBtn = document.getElementById('newContactBtn');
    const cancelBtn = document.getElementById('cancelContactBtn');

    async function load(){
        try{
            const res = await fetch('/api/contacts', {credentials:'same-origin'});
            const data = await res.json();
            if(!Array.isArray(data)||!data.length){ list.innerHTML = '<p class="text-slate-400">No contacts yet.</p>'; return; }
            list.innerHTML = data.map(c=>`<div class="panel flex justify-between items-start"><div><strong>${c.name}</strong><div class="text-sm text-slate-400">${c.email||''}${c.phone?(' • '+c.phone):''}</div><div class="text-xs text-slate-400 mt-2">${c.company||''}</div></div><div class="flex gap-2"><button data-id="${c._id}" class="edit-btn rounded border px-2">Edit</button><button data-id="${c._id}" class="del-btn rounded border px-2">Delete</button></div></div>`).join('');
            list.querySelectorAll('.edit-btn').forEach(b=>b.addEventListener('click', onEdit));
            list.querySelectorAll('.del-btn').forEach(b=>b.addEventListener('click', onDelete));
        }catch(err){ console.error(err); }
    }
    function showForm(){ formWrap.classList.remove('hidden'); }
    function hideForm(){ formWrap.classList.add('hidden'); form.reset(); document.getElementById('contactId').value=''; }

    newBtn.addEventListener('click', ()=>{ showForm(); });
    cancelBtn.addEventListener('click', hideForm);

    async function onEdit(e){
        const id = e.currentTarget.dataset.id;
        try{
            const res = await fetch('/api/contacts', {credentials:'same-origin'});
            const all = await res.json();
            const c = all.find(x=>x._id===id);
            if(!c) return;
            document.getElementById('contactId').value = c._id;
            document.getElementById('contactName').value = c.name;
            document.getElementById('contactEmail').value = c.email||'';
            document.getElementById('contactPhone').value = c.phone||'';
            document.getElementById('contactCompany').value = c.company||'';
            document.getElementById('contactNotes').value = c.notes||'';
            showForm();
        }catch(err){console.error(err)}
    }
    async function onDelete(e){
        const id = e.currentTarget.dataset.id;
        if(!confirm('Delete this contact?')) return;
        await fetch(`/api/contacts/${id}`, {method:'DELETE', credentials:'same-origin'});
        await load();
    }

    form.addEventListener('submit', async (ev)=>{
        ev.preventDefault();
        const id = document.getElementById('contactId').value;
        const payload = {
            name: document.getElementById('contactName').value.trim(),
            email: document.getElementById('contactEmail').value.trim(),
            phone: document.getElementById('contactPhone').value.trim(),
            company: document.getElementById('contactCompany').value.trim(),
            notes: document.getElementById('contactNotes').value.trim(),
        };
        const opts = {method: id? 'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), credentials:'same-origin'};
        const url = id? `/api/contacts/${id}` : '/api/contacts';
        const res = await fetch(url, opts);
        if(!res.ok){ alert('Save failed'); return; }
        hideForm();
        await load();
    });

    await load();
})();
