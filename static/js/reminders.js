(async function(){
    const list = document.getElementById('remindersList');
    const formWrap = document.getElementById('reminderFormWrap');
    const form = document.getElementById('reminderForm');
    const newBtn = document.getElementById('newReminderBtn');
    const cancelBtn = document.getElementById('cancelReminderBtn');

    async function load(){
        try{
            const data = await api('/api/reminders');
            if(!Array.isArray(data)||!data.length){ list.innerHTML = '<p class="text-slate-400">No reminders.</p>'; return; }
            list.innerHTML = data.map(r=>`<div class="panel flex justify-between items-start"><div><strong>${r.title}</strong><div class="text-sm text-slate-400">${r.message||''}</div><div class="text-xs text-slate-400 mt-2">Due: ${r.due_date||'—'} ${r.repeat_minutes?(' • repeat:'+r.repeat_minutes+'m'):''}</div></div><div class="flex gap-2"><button data-id="${r._id}" class="edit-btn rounded border px-2">Edit</button><button data-id="${r._id}" class="del-btn rounded border px-2">Delete</button></div></div>`).join('');
            list.querySelectorAll('.edit-btn').forEach(b=>b.addEventListener('click', onEdit));
            list.querySelectorAll('.del-btn').forEach(b=>b.addEventListener('click', onDelete));
        }catch(err){ console.error(err); }
    }
    function showForm(){ formWrap.classList.remove('hidden'); }
    function hideForm(){ formWrap.classList.add('hidden'); form.reset(); document.getElementById('reminderId').value=''; }

    newBtn.addEventListener('click', ()=>{ showForm(); });
    cancelBtn.addEventListener('click', hideForm);

    async function onEdit(e){
        const id = e.currentTarget.dataset.id;
        try{
            const all = await api('/api/reminders');
            const r = all.find(x=>x._id===id);
            if(!r) return;
            document.getElementById('reminderId').value = r._id;
            document.getElementById('reminderTitle').value = r.title;
            document.getElementById('reminderMessage').value = r.message||'';
            // convert ISO to datetime-local
            if(r.due_date){
                const dt = new Date(r.due_date);
                const iso = dt.toISOString().slice(0,16);
                document.getElementById('reminderDue').value = iso;
            }
            document.getElementById('reminderRepeat').value = r.repeat_minutes||'';
            showForm();
        }catch(err){console.error(err)}
    }
    async function onDelete(e){
        const id = e.currentTarget.dataset.id;
        if(!confirm('Delete this reminder?')) return;
        try{
            await api(`/api/reminders/${id}`, { method: 'DELETE' });
            showToast('Reminder deleted');
            await load();
        }catch(err){ console.error(err); showToast(err.message || 'Delete failed', 'error'); }
    }

    form.addEventListener('submit', async (ev)=>{
        ev.preventDefault();
        const id = document.getElementById('reminderId').value;
        const due = document.getElementById('reminderDue').value;
        const payload = {
            title: document.getElementById('reminderTitle').value.trim(),
            message: document.getElementById('reminderMessage').value.trim(),
            due_date: due || '',
            repeat_minutes: Number(document.getElementById('reminderRepeat').value || 0),
        };
        try{
            await api(id? `/api/reminders/${id}` : '/api/reminders', { method: id? 'PUT' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
            hideForm();
            showToast('Reminder saved');
            await load();
        }catch(err){ console.error(err); showToast(err.message || 'Save failed', 'error'); }
    });

    // Poll for due reminders every 60s
    async function pollDue(){
        try{
            try{
                const data = await api('/api/reminders/due');
                if(Array.isArray(data) && data.length){
                    data.forEach(r=>{
                        if(window.showToast) showToast(`${r.title}: ${r.message}`, 'ok');
                    });
                    await load();
                }
            }catch(err){
                // ignore polling errors
            }
        }
    }

    await load();
    setInterval(pollDue, 60000);
    // also poll immediately on page load
    pollDue().catch(()=>{});
})();
