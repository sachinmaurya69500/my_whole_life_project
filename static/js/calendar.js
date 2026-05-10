(function(){
    // Minimal calendar time-blocking + drag to move implementation
    const container = document.getElementById('eventsList');
    if(!container) return;

    function render(events){
        container.innerHTML = '';
        events.forEach(e=>{
            const el = document.createElement('div');
            el.className = 'panel event-block';
            el.draggable = true;
            el.dataset.id = e._id;
            el.innerHTML = `<div class="flex justify-between"><strong>${e.title}</strong><span class="text-xs text-slate-400">${e.start_at?e.start_at.split('T')[0]:''}</span></div><div class="text-sm text-slate-400">${e.description||''}</div>`;
            // drag start
            el.addEventListener('dragstart', (ev)=>{
                ev.dataTransfer.setData('text/plain', e._id);
                ev.dataTransfer.effectAllowed = 'move';
            });
            container.appendChild(el);
        });
    }

    async function load(){
        const res = await fetch('/api/events', {credentials:'same-origin'});
        const events = await res.json();
        render(events);
    }

    // Drop target: container; when user drops, prompt for new datetime
    container.addEventListener('dragover', (ev)=>{ ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; });
    container.addEventListener('drop', async (ev)=>{
        ev.preventDefault();
        const id = ev.dataTransfer.getData('text/plain');
        if(!id) return;
        const newStart = prompt('New start datetime (ISO or YYYY-MM-DDThh:mm):');
        if(!newStart) return;
        // naive: keep same duration
        try{
            const res = await fetch(`/api/events/${id}`, {method:'PUT', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({start_at:newStart})});
            if(!res.ok) throw new Error('Failed to move');
            await load();
        }catch(err){ alert('Unable to reschedule event'); }
    });

    // Time-block creation: double-click to create
    container.addEventListener('dblclick', async ()=>{
        const title = prompt('Block title');
        if(!title) return;
        const start = prompt('Start datetime (YYYY-MM-DDThh:mm)');
        if(!start) return;
        const end = prompt('End datetime (YYYY-MM-DDThh:mm)');
        try{
            const res = await fetch('/api/events', {method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title, start_at:start, end_at:end})});
            if(!res.ok) throw new Error('Create failed');
            await load();
        }catch(err){ alert('Unable to create block'); }
    });

    load();
})();
