(async function(){
    const list = document.getElementById('expensesList');
    const formWrap = document.getElementById('expenseFormWrap');
    const form = document.getElementById('expenseForm');
    const newBtn = document.getElementById('newExpenseBtn');
    const cancelBtn = document.getElementById('cancelExpenseBtn');

    function renderExpense(e, index = 0) {
        const notes = e.notes ? `<div class="text-xs text-slate-300 mt-2">${e.notes}</div>` : '';
        return `<div class="panel flex justify-between items-start hud-reveal hud-sweep" style="transition-delay:${Math.min(index, 8) * 60}ms"><div><div class="flex items-center gap-2"><strong>${e.type||'Expense'}</strong><span class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-slate-600 text-slate-300">${e.currency||'USD'}</span></div><div class="text-sm text-slate-400">${e.vendor||''}</div><div class="text-xs text-slate-400 mt-2">${e.date||''} • ${Number(e.amount || 0).toFixed(2)}</div>${notes}</div><div class="flex gap-2"><button data-id="${e._id}" class="del-btn btn btn-secondary px-3 py-1.5 text-xs">Delete</button></div></div>`;
    }

    function renderLoading(){
        if (!list) return;
        list.innerHTML = '<div class="hud-skeleton h-20 rounded-2xl"></div><div class="hud-skeleton h-20 rounded-2xl mt-3"></div>';
    }

    async function load(){
        try{
            renderLoading();
            const data = await api('/api/expenses');
            if(!Array.isArray(data)||!data.length){ list.innerHTML = '<p class="hud-empty-state">No expenses recorded.</p>'; return; }
            list.innerHTML = data.map((e, index)=>renderExpense(e, index)).join('');
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
            const saved = await api('/api/expenses', { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
            hideForm();
            showToast('Expense saved');
            if (saved && saved._id) {
                const emptyState = list.querySelector('.hud-empty-state');
                if (emptyState) {
                    list.innerHTML = renderExpense(saved, 0);
                } else {
                    list.insertAdjacentHTML('afterbegin', renderExpense(saved, 0));
                }
                list.querySelectorAll('.del-btn').forEach(b=>b.addEventListener('click', onDelete));
            }
            await load();
        }catch(err){ console.error(err); showToast(err.message || 'Save failed', 'error'); }
    });

    await load();
})();
