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
        try{
            const events = await api('/api/events');
            render(events);
        }catch(err){ console.error(err); showToast(err.message || 'Unable to load events', 'error'); }
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
            await api(`/api/events/${id}`, { method: 'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({start_at:newStart}) });
            showToast('Event rescheduled');
            await load();
        }catch(err){ console.error(err); showToast(err.message || 'Unable to reschedule event', 'error'); }
    });

    // Time-block creation: double-click to create
    container.addEventListener('dblclick', async ()=>{
        const title = prompt('Block title');
        if(!title) return;
        const start = prompt('Start datetime (YYYY-MM-DDThh:mm)');
        if(!start) return;
        const end = prompt('End datetime (YYYY-MM-DDThh:mm)');
        try{
            await api('/api/events', { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title, start_at:start, end_at:end}) });
            showToast('Time block created');
            await load();
        }catch(err){ console.error(err); showToast(err.message || 'Unable to create block', 'error'); }
    });

    load();
})();
