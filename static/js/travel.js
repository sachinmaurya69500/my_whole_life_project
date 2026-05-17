(async function(){
    const list = document.getElementById('expensesList');
    const modal = document.getElementById('expenseModal');
    const backdrop = document.getElementById('expenseBackdrop');
    const closeBtn = document.getElementById('closeExpenseModalBtn');
    const form = document.getElementById('expenseForm');
    const newBtn = document.getElementById('newExpenseBtn');
    const cancelBtn = document.getElementById('cancelExpenseBtn');
    const expenseIdInput = document.getElementById('expenseId');
    const expenseDateInput = document.getElementById('expenseDate');
    const expenseTypeInput = document.getElementById('expenseType');
    const expenseAmountInput = document.getElementById('expenseAmount');
    const expenseCurrencyInput = document.getElementById('expenseCurrency');
    const expenseVendorInput = document.getElementById('expenseVendor');
    const expenseNotesInput = document.getElementById('expenseNotes');
    const expenseModalTitle = document.getElementById('expenseModalTitle');

    function renderExpense(e, index = 0) {
        const notes = e.notes ? `<div class="text-xs text-slate-300 mt-2">${e.notes}</div>` : '';
        return `<div class="panel flex justify-between items-start hud-reveal hud-sweep" style="transition-delay:${Math.min(index, 8) * 60}ms"><div><div class="flex items-center gap-2"><strong>${e.type||'Expense'}</strong><span class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-slate-600 text-slate-300">${e.currency||'USD'}</span></div><div class="text-sm text-slate-400">${e.vendor||''}</div><div class="text-xs text-slate-400 mt-2">${e.date||''} • ${Number(e.amount || 0).toFixed(2)}</div>${notes}</div><div class="flex gap-2"><button data-id="${e._id}" class="edit-btn btn btn-secondary px-3 py-1.5 text-xs">Edit</button><button data-id="${e._id}" class="del-btn btn btn-secondary px-3 py-1.5 text-xs">Delete</button></div></div>`;
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
            list.querySelectorAll('.edit-btn').forEach(b=>b.addEventListener('click', onEdit));
            list.querySelectorAll('.del-btn').forEach(b=>b.addEventListener('click', onDelete));
        }catch(err){ console.error(err); }
    }
    function showForm(){
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    }
    function hideForm(){
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
        form.reset();
        expenseIdInput.value='';
        if (expenseModalTitle) expenseModalTitle.textContent = 'Add Expense';
    }

    function fillForm(expense) {
        expenseIdInput.value = expense._id || '';
        expenseDateInput.value = expense.date ? expense.date.slice(0, 10) : '';
        expenseTypeInput.value = expense.type || '';
        expenseAmountInput.value = expense.amount ?? '';
        expenseCurrencyInput.value = expense.currency || 'USD';
        expenseVendorInput.value = expense.vendor || '';
        expenseNotesInput.value = expense.notes || '';
    }

    newBtn.addEventListener('click', ()=>{ showForm(); });
    cancelBtn.addEventListener('click', hideForm);
    if (closeBtn) closeBtn.addEventListener('click', hideForm);
    if (backdrop) backdrop.addEventListener('click', hideForm);

    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            hideForm();
        }
    });

    async function onEdit(e){
        const id = e.currentTarget.dataset.id;
        try{
            const data = await api('/api/expenses');
            const expense = data.find(item => item._id === id);
            if(!expense) return;
            fillForm(expense);
            if (expenseModalTitle) expenseModalTitle.textContent = 'Edit Expense';
            showForm();
        }catch(err){ console.error(err); showToast(err.message || 'Edit failed', 'error'); }
    }

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
        const id = expenseIdInput.value;
        const payload = {
            date: expenseDateInput.value,
            type: expenseTypeInput.value.trim(),
            amount: expenseAmountInput.value.trim(),
            currency: expenseCurrencyInput.value.trim() || 'USD',
            vendor: expenseVendorInput.value.trim(),
            notes: expenseNotesInput.value.trim(),
        };
        try{
            const saved = await api(id ? `/api/expenses/${id}` : '/api/expenses', { method: id ? 'PUT' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
            hideForm();
            showToast('Expense saved');
            await load();
        }catch(err){ console.error(err); showToast(err.message || 'Save failed', 'error'); }
    });

    await load();
})();
