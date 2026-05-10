(async function(){
    const list = document.getElementById('expensesList');
    const formWrap = document.getElementById('expenseFormWrap');
    const form = document.getElementById('expenseForm');
    const newBtn = document.getElementById('newExpenseBtn');
    const cancelBtn = document.getElementById('cancelExpenseBtn');

    async function load(){
        try{
            const res = await fetch('/api/expenses', {credentials:'same-origin'});
            const data = await res.json();
            if(!Array.isArray(data)||!data.length){ list.innerHTML = '<p class="text-slate-400">No expenses recorded.</p>'; return; }
            list.innerHTML = data.map(e=>`<div class="panel flex justify-between items-start"><div><strong>${e.type||'Expense'}</strong><div class="text-sm text-slate-400">${e.vendor||''}</div><div class="text-xs text-slate-400 mt-2">${e.date||''} • ${e.amount} ${e.currency||'USD'}</div></div><div class="flex gap-2"><button data-id="${e._id}" class="del-btn rounded border px-2">Delete</button></div></div>`).join('');
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
        await fetch(`/api/expenses/${id}`, {method:'DELETE', credentials:'same-origin'});
        await load();
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
        const opts = {method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), credentials:'same-origin'};
        const res = await fetch('/api/expenses', opts);
        if(!res.ok){ alert('Save failed'); return; }
        hideForm();
        await load();
    });

    await load();
})();
