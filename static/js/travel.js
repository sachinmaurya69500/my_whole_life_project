(async function(){
    const list = document.getElementById('expensesList');
    const formWrap = document.getElementById('expenseFormWrap');
    const form = document.getElementById('expenseForm');
    const newBtn = document.getElementById('newExpenseBtn');
    const cancelBtn = document.getElementById('cancelExpenseBtn');

    function renderLoading(){
        if (!list) return;
        list.innerHTML = '<div class="hud-skeleton h-20 rounded-2xl"></div><div class="hud-skeleton h-20 rounded-2xl mt-3"></div>';
    }

    async function load(){
        try{
            renderLoading();
            const data = await api('/api/expenses');
            if(!Array.isArray(data)||!data.length){ list.innerHTML = '<p class="hud-empty-state">No expenses recorded.</p>'; return; }
            list.innerHTML = data.map((e, index)=>`<div class="panel flex justify-between items-start hud-reveal hud-sweep" style="transition-delay:${Math.min(index, 8) * 60}ms"><div><strong>${e.type||'Expense'}</strong><div class="text-sm text-slate-400">${e.vendor||''}</div><div class="text-xs text-slate-400 mt-2">${e.date||''} • ${e.amount} ${e.currency||'USD'}</div></div><div class="flex gap-2"><button data-id="${e._id}" class="del-btn btn btn-secondary px-3 py-1.5 text-xs">Delete</button></div></div>`).join('');
            list.querySelectorAll('.del-btn').forEach(b=>b.addEventListener('click', onDelete));
        }catch(err){ console.error(err); }
    }
    function showForm(){ formWrap.classList.remove('hidden'); }
    function hideForm(){ formWrap.classList.add('hidden'); form.reset(); document.getElementById('expenseId').value=''; }

    newBtn.addEventListener('click', ()=>{ showForm(); });
    cancelBtn.addEventListener('click', hideForm);

    async function onDelete(e){
        const id = e.currentTarget.dataset.id;
        if(!confirm('Delete this expense?')) return;
        try{
            await api(`/api/expenses/${id}`, { method: 'DELETE' });
            showToast('Expense deleted');
            await load();
        }catch(err){ console.error(err); showToast(err.message || 'Delete failed', 'error'); }
    }

    form.addEventListener('submit', async (ev)=>{
        ev.preventDefault();
        const payload = {
            date: document.getElementById('expenseDate').value,
            type: document.getElementById('expenseType').value.trim(),
            amount: document.getElementById('expenseAmount').value.trim(),
            currency: document.getElementById('expenseCurrency').value.trim() || 'USD',
            vendor: document.getElementById('expenseVendor').value.trim(),
            notes: document.getElementById('expenseNotes').value.trim(),
        };
        try{
            await api('/api/expenses', { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
            hideForm();
            showToast('Expense saved');
            await load();
        }catch(err){ console.error(err); showToast(err.message || 'Save failed', 'error'); }
    });

    await load();
})();
