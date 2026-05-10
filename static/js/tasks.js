(async function(){
    const list = document.getElementById('tasksList');
    const formWrap = document.getElementById('taskFormWrap');
    const form = document.getElementById('taskForm');
    const newBtn = document.getElementById('newTaskBtn');
    const cancelBtn = document.getElementById('cancelTaskBtn');

    function iso(d){return d?new Date(d).toLocaleString():''}

    async function load(){
        try{
            const res = await fetch('/api/tasks', {credentials:'same-origin'});
            const data = await res.json();
            if(!Array.isArray(data)||!data.length){ list.innerHTML = '<p class="text-slate-400">No tasks yet.</p>'; return; }
            list.innerHTML = data.map(t=>`<div class="panel flex justify-between items-start"><div><strong>${t.title}</strong><div class="text-sm text-slate-400">${t.description||''}</div><div class="text-xs text-slate-400 mt-2">Priority: ${t.priority} • Status: ${t.status} • Due: ${t.due_date||'—'}</div></div><div class="flex gap-2"><button data-id="${t._id}" class="edit-btn rounded border px-2">Edit</button><button data-id="${t._id}" class="del-btn rounded border px-2">Delete</button></div></div>`).join('');
            list.querySelectorAll('.edit-btn').forEach(b=>b.addEventListener('click', onEdit));
            list.querySelectorAll('.del-btn').forEach(b=>b.addEventListener('click', onDelete));
        }catch(err){ console.error(err); }
    }
    function showForm(){ formWrap.classList.remove('hidden'); }
    function hideForm(){ formWrap.classList.add('hidden'); form.reset(); document.getElementById('taskId').value=''; }

    newBtn.addEventListener('click', ()=>{ showForm(); });
    cancelBtn.addEventListener('click', hideForm);

    async function onEdit(e){
        const id = e.currentTarget.dataset.id;
        try{
            const res = await fetch(`/api/tasks` , {credentials:'same-origin'});
            const all = await res.json();
            const t = all.find(x=>x._id===id);
            if(!t) return;
            document.getElementById('taskId').value = t._id;
            document.getElementById('taskTitle').value = t.title;
            document.getElementById('taskDescription').value = t.description||'';
            document.getElementById('taskPriority').value = t.priority||'Medium';
            document.getElementById('taskStatus').value = t.status||'Todo';
            document.getElementById('taskDueDate').value = t.due_date||'';
            showForm();
        }catch(err){console.error(err)}
    }
    async function onDelete(e){
        const id = e.currentTarget.dataset.id;
        if(!confirm('Delete this task?')) return;
        await fetch(`/api/tasks/${id}`, {method:'DELETE', credentials:'same-origin'});
        await load();
    }

    form.addEventListener('submit', async (ev)=>{
        ev.preventDefault();
        const id = document.getElementById('taskId').value;
        const payload = {
            title: document.getElementById('taskTitle').value.trim(),
            description: document.getElementById('taskDescription').value.trim(),
            priority: document.getElementById('taskPriority').value,
            status: document.getElementById('taskStatus').value,
            due_date: document.getElementById('taskDueDate').value,
        };
        const opts = {method: id? 'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), credentials:'same-origin'};
        const url = id? `/api/tasks/${id}` : '/api/tasks';
        const res = await fetch(url, opts);
        if(!res.ok){ alert('Save failed'); return; }
        hideForm();
        await load();
    });

    await load();
})();
