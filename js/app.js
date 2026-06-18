
    /* ---------- FIREBASE CONFIG ---------- */
    const firebaseConfig = {
        apiKey: "AIzaSyBfXsa-oT_gJJjhI42euD5HyBNoc3FHwkI",
        authDomain: "projetoderenda-9a4f1.firebaseapp.com",
        projectId: "projetoderenda-9a4f1",
        storageBucket: "projetoderenda-9a4f1.firebasestorage.app",
        messagingSenderId: "400536033296",
        appId: "1:400536033296:web:a060b620c5d53e03a69295"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    /* ---------- STATE ---------- */
    const renderedPages = {};
    let currentUser = null;
    let simChartInstance = null;
    let chartInstances = {};
    let profiles = [];
    let currentProfileId = localStorage.getItem('nexusProfileId') || 'default';

    /* ---------- UTILITY ---------- */
    function formatBRL(v) {
        return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatDate(dateStr) {
        const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
        return d.toLocaleDateString('pt-BR');
    }

    function getMonthName(monthIndex) {
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        return months[monthIndex];
    }

    function getCurrentMonth() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    function chartDefaults() {
        Chart.defaults.color = '#94A3B8';
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.1)';
    }

    function destroyChart(id) {
        if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
    }

    function navigate(pageId, el) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        if (el) el.classList.add('active');
        chartDefaults();
        renderPage(pageId);
    }

    /* ---------- AUTH ---------- */
    function showLogin() {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    }

    function showRegister() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    }

    function handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const remember = document.getElementById('rememberMe').checked;
        if (!email || !password) { alert('Preencha todos os campos.'); return; }
        const persistence = remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION;
        auth.setPersistence(persistence).then(() => {
            return auth.signInWithEmailAndPassword(email, password);
        }).catch(err => alert(err.message));
    }

    function handleRegister() {
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        if (!name || !email || !password) { alert('Preencha todos os campos.'); return; }
        auth.createUserWithEmailAndPassword(email, password).then(result => {
            return result.user.updateProfile({ displayName: name });
        }).then(async () => {
            await criarPerfilPadrao();
        }).catch(err => alert('Erro ao cadastrar: ' + err.message));
    }

    function handleLogout() {
        auth.signOut();
    }

    /* ---------- PROFILE SYSTEM ---------- */
    async function criarPerfilPadrao() {
        const ref = db.collection('users').doc(currentUser.uid).collection('profiles');
        const snap = await ref.get();
        if (snap.empty) {
            await ref.doc('default').set({ nome: 'Pessoal', tipo: 'Pessoal', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
        currentProfileId = 'default';
        localStorage.setItem('nexusProfileId', 'default');
    }

    async function loadProfiles() {
        if (!currentUser) return;
        const ref = db.collection('users').doc(currentUser.uid).collection('profiles');
        const snap = await ref.get();
        profiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (profiles.length === 0) {
            await criarPerfilPadrao();
            return loadProfiles();
        }
        const exists = profiles.find(p => p.id === currentProfileId);
        if (!exists) {
            currentProfileId = profiles[0].id;
            localStorage.setItem('nexusProfileId', currentProfileId);
        }
        renderProfileUI();
    }

    function renderProfileUI() {
        const current = profiles.find(p => p.id === currentProfileId);
        document.getElementById('currentProfileName').textContent = current ? current.nome : 'Perfil';
        const list = document.getElementById('profileList');
        list.innerHTML = '';
        profiles.forEach(p => {
            const colors = { Pessoal: 'var(--success)', PJ: 'var(--accent)', Investidor: 'var(--purple)', Outro: 'var(--warning)' };
            const dotColor = colors[p.tipo] || 'var(--text-sec)';
            const div = document.createElement('div');
            div.className = 'profile-dropdown-item' + (p.id === currentProfileId ? ' active' : '');
            div.innerHTML = '<span class="profile-dot" style="background:' + dotColor + ';"></span><span class="profile-item-name">' + p.nome + '</span><span class="profile-item-type">' + p.tipo + '</span>';
            if (p.id !== currentProfileId) {
                div.onclick = function() { switchProfile(p.id); };
            }
            list.appendChild(div);
        });
    }

    function toggleProfileDropdown() {
        const dd = document.getElementById('profileDropdown');
        dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
    }

    document.addEventListener('click', function(e) {
        const sel = document.getElementById('profileSelector');
        if (sel && !sel.contains(e.target)) {
            document.getElementById('profileDropdown').style.display = 'none';
        }
    });

    function switchProfile(profileId) {
        currentProfileId = profileId;
        localStorage.setItem('nexusProfileId', profileId);
        document.getElementById('profileDropdown').style.display = 'none';
        for (let k in renderedPages) delete renderedPages[k];
        renderPage('dashboard');
    }

    function updateAvatar() {
        if (!currentUser) return;
        const initial = (currentUser.displayName || 'U').charAt(0).toUpperCase();
        document.getElementById('topbarAvatar').textContent = initial;
    }

    function checkAuth() {
        auth.onAuthStateChanged(async user => {
            if (user) {
                currentUser = user;
                document.getElementById('authOverlay').style.display = 'none';
                updateAvatar();
                await loadProfiles();
                loadAllData();
                setupSearch();
                setupNotifications();
            } else {
                currentUser = null;
                document.getElementById('authOverlay').style.display = 'flex';
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                document.getElementById('dashboard').classList.add('active');
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                document.querySelector('.nav-item').classList.add('active');
                for (let k in renderedPages) delete renderedPages[k];
                showLogin();
            }
        });
    }

    /* ---------- DATA SERVICE ---------- */
    function getUserRef() {
        if (!currentUser) return null;
        return db.collection('users').doc(currentUser.uid).collection('profiles').doc(currentProfileId);
    }

    async function loadAllData() {
        const activePage = document.querySelector('.page.active');
        const activeId = activePage ? activePage.id : 'dashboard';
        for (let k in renderedPages) delete renderedPages[k];
        renderPage(activeId);
        calcularJurosCompostos();
        calcularEmprestimo();
    }

    async function loadTransactions() {
        const ref = getUserRef();
        if (!ref) return [];
        try {
            const snap = await ref.collection('transactions').orderBy('data', 'desc').get();
            const transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth();
            const today = now.getDate();
            const extras = [];
            transactions.forEach(t => {
                if (t.recorrencia !== 'Mensal') return;
                const orig = new Date(t.data + (t.data.includes('T') ? '' : 'T12:00:00'));
                const origDay = orig.getDate();
                const monthsSince = (currentYear - orig.getFullYear()) * 12 + (currentMonth - orig.getMonth());
                if (monthsSince <= 0) return;
                const alreadyExists = transactions.some(e => {
                    const ed = new Date(e.data + (e.data.includes('T') ? '' : 'T12:00:00'));
                    return e.tipo === t.tipo && e.descricao === t.descricao && ed.getDate() === origDay && ed.getMonth() === currentMonth && ed.getFullYear() === currentYear;
                });
                if (alreadyExists) return;
                const virtualDate = currentYear + '-' + String(currentMonth + 1).padStart(2, '0') + '-' + String(origDay).padStart(2, '0');
                extras.push({
                    id: 'virt_' + t.id,
                    descricao: t.descricao,
                    valor: t.valor,
                    data: virtualDate,
                    categoria: t.categoria,
                    recorrencia: 'Mensal',
                    status: 'Pendente',
                    tipo: t.tipo,
                    virtual: true
                });
            });
            return [...extras, ...transactions];
        } catch (e) {
            console.warn('Erro ao carregar transacoes (verifique regras do Firestore):', e.message);
            return [];
        }
    }

    async function addTransaction(data) {
        const ref = getUserRef();
        if (!ref) return;
        await ref.collection('transactions').add(data);
    }

    async function loadBudgets() {
        const ref = getUserRef();
        if (!ref) return [];
        try { const snap = await ref.collection('budgets').get(); return snap.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { return []; }
    }

    async function saveBudgetData(data) {
        const ref = getUserRef();
        if (!ref) return;
        if (data.id) { await ref.collection('budgets').doc(data.id).update(data); } else { await ref.collection('budgets').add(data); }
    }

    async function loadGoals() {
        const ref = getUserRef();
        if (!ref) return [];
        try { const snap = await ref.collection('goals').get(); return snap.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { return []; }
    }

    async function saveGoalData(data) {
        const ref = getUserRef();
        if (!ref) return;
        if (data.id) { await ref.collection('goals').doc(data.id).update(data); } else { await ref.collection('goals').add(data); }
    }

    async function loadInvestments() {
        const ref = getUserRef();
        if (!ref) return [];
        try { const snap = await ref.collection('investments').get(); return snap.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { return []; }
    }

    async function saveInvestmentData(data) {
        const ref = getUserRef();
        if (!ref) return;
        if (data.id) { await ref.collection('investments').doc(data.id).update(data); } else { await ref.collection('investments').add(data); }
    }

    async function loadDebts() {
        const ref = getUserRef();
        if (!ref) return [];
        try { const snap = await ref.collection('debts').get(); return snap.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { return []; }
    }

    async function saveDebtData(data) {
        const ref = getUserRef();
        if (!ref) return;
        if (data.id) { await ref.collection('debts').doc(data.id).update(data); } else { await ref.collection('debts').add(data); }
    }

    /* ---------- PROFILE MODAL ---------- */
    function openProfileModal(editId) {
        document.getElementById('profileModal').classList.add('open');
        document.getElementById('profileId').value = editId || '';
        document.getElementById('profileNome').value = '';
        document.getElementById('profileTipo').value = 'Pessoal';
        document.getElementById('profileModalTitle').textContent = editId ? 'Editar Perfil' : 'Novo Perfil';
    }

    function closeProfileModal() {
        document.getElementById('profileModal').classList.remove('open');
    }

    async function saveProfile() {
        const id = document.getElementById('profileId').value;
        const nome = document.getElementById('profileNome').value;
        const tipo = document.getElementById('profileTipo').value;
        if (!nome) { alert('Informe o nome do perfil.'); return; }
        const ref = db.collection('users').doc(currentUser.uid).collection('profiles');
        try {
            if (id) { await ref.doc(id).update({ nome, tipo }); } else { await ref.add({ nome, tipo, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
            closeProfileModal();
            await loadProfiles();
        } catch (e) { alert('Erro ao salvar perfil: ' + e.message); }
    }

    document.getElementById('profileModal').addEventListener('click', function(e) {
        if (e.target === this) closeProfileModal();
    });

    /* ---------- CONFIRM MODAL ---------- */
    let confirmCallback = null;
    function showConfirm(msg, callback) {
        document.getElementById('confirmMsg').textContent = msg;
        document.getElementById('confirmModal').classList.add('open');
        confirmCallback = callback;
        document.getElementById('confirmBtn').onclick = function() {
            closeConfirmModal();
            if (confirmCallback) confirmCallback();
        };
    }
    function closeConfirmModal() {
        document.getElementById('confirmModal').classList.remove('open');
        confirmCallback = null;
    }
    document.getElementById('confirmModal').addEventListener('click', function(e) {
        if (e.target === this) closeConfirmModal();
    });

    /* ---------- RENDER ---------- */
    async function renderPage(pageId) {
        if (renderedPages[pageId]) return;
        renderedPages[pageId] = true;
        chartDefaults();
        if (pageId === 'dashboard') await renderDashboard();
        if (pageId === 'receitas') await renderReceitas();
        if (pageId === 'despesas') await renderDespesas();
        if (pageId === 'orcamentos') await renderOrcamentos();
        if (pageId === 'metas') await renderMetas();
        if (pageId === 'investimentos') await renderInvestimentos();
        if (pageId === 'dividas') await renderDividas();
        if (pageId === 'calendario') await renderCalendario();
        if (pageId === 'config') renderConfig();
    }

    async function renderDashboard() {
        const transactions = await loadTransactions();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const confirmedTxs = transactions.filter(t => (t.status || 'Confirmado') === 'Confirmado');
        const monthTxs = transactions.filter(t => {
            const d = new Date(t.data + (t.data.includes('T') ? '' : 'T12:00:00'));
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        const monthConfirmed = monthTxs.filter(t => (t.status || 'Confirmado') === 'Confirmado');
        const totalIncome = monthConfirmed.filter(t => t.tipo === 'receita').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
        const totalExpense = monthConfirmed.filter(t => t.tipo === 'despesa').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
        const balance = totalIncome - totalExpense;
        const savings = totalIncome > 0 ? (balance / totalIncome * 100) : 0;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const dailyAvg = totalExpense / daysInMonth;

        document.getElementById('kpiSaldoVal').textContent = formatBRL(balance);
        document.getElementById('kpiReceitaVal').textContent = formatBRL(totalIncome);
        document.getElementById('kpiDespesaVal').textContent = formatBRL(totalExpense);
        document.getElementById('kpiEconomiaVal').textContent = formatBRL(balance > 0 ? balance : 0);
        document.getElementById('kpiSaldoTrend').innerHTML = (balance >= 0 ? '<i class="fa-solid fa-arrow-up"></i> ' : '<i class="fa-solid fa-arrow-down"></i> ') + 'Saldo ' + (balance >= 0 ? 'positivo' : 'negativo');
        document.getElementById('kpiReceitaTrend').innerHTML = '<i class="fa-solid fa-arrow-up"></i> ' + totalIncome.toLocaleString('pt-BR') + ' no mês';
        document.getElementById('kpiDespesaTrend').innerHTML = '<i class="fa-solid fa-arrow-down"></i> ' + totalExpense.toLocaleString('pt-BR') + ' no mês';
        document.getElementById('kpiEconomiaTrend').innerHTML = savings.toFixed(1) + '% taxa de poupança';

        const recentBody = document.getElementById('recentTransactionsBody');
        recentBody.innerHTML = '';
        transactions.slice(0, 10).forEach(t => {
            const isIncome = t.tipo === 'receita';
            const st = t.status || 'Confirmado';
            const stClass = st === 'Confirmado' ? 'status-success' : 'status-warning';
            const stIcon = st === 'Confirmado' ? 'fa-check' : 'fa-clock';
            const row = document.createElement('tr');
            row.innerHTML = '<td><i class="fa-solid fa-' + (isIncome ? 'arrow-trend-up' : 'arrow-trend-down') + '" style="color: ' + (isIncome ? 'var(--success)' : 'var(--error)') + '; margin-right: 8px;"></i>' + (t.descricao || '') + '</td>' +
                '<td><span class="tag">' + (t.categoria || '') + '</span></td>' +
                '<td>' + formatDate(t.data) + '</td>' +
                '<td><span class="status-badge ' + stClass + '"><i class="fa-solid ' + stIcon + '"></i> ' + st + '</span></td>' +
                '<td style="color: ' + (isIncome ? 'var(--success)' : 'var(--error)') + '; font-weight: 600;">' + (isIncome ? '+ ' : '- ') + formatBRL(parseFloat(t.valor) || 0) + '</td>';
            recentBody.appendChild(row);
        });

        destroyChart('cashFlowChart');
        destroyChart('expenseCategoryChart');

        const months = [];
        const incomeByMonth = [];
        const expenseByMonth = [];
        for (let i = 5; i >= 0; i--) {
            const m = new Date(currentYear, currentMonth - i, 1);
            months.push(m.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''));
            const ms = confirmedTxs.filter(t => {
                const d = new Date(t.data + (t.data.includes('T') ? '' : 'T12:00:00'));
                return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
            });
            incomeByMonth.push(ms.filter(t => t.tipo === 'receita').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0));
            expenseByMonth.push(ms.filter(t => t.tipo === 'despesa').reduce((s, t) => s + (parseFloat(t.valor) || 0), 0));
        }

        chartInstances['cashFlowChart'] = new Chart(document.getElementById('cashFlowChart'), {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    { label: 'Receitas', data: incomeByMonth, borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.08)', tension: 0.4, fill: true },
                    { label: 'Despesas', data: expenseByMonth, borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)', tension: 0.4, fill: true }
                ]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { grid: { color: 'rgba(148,163,184,0.08)' } }, x: { grid: { display: false } } } }
        });

        const catLabels = [...new Set(monthConfirmed.filter(t => t.tipo === 'despesa').map(t => t.categoria))];
        const catData = catLabels.map(c => monthConfirmed.filter(t => t.tipo === 'despesa' && t.categoria === c).reduce((s, t) => s + (parseFloat(t.valor) || 0), 0));
        chartInstances['expenseCategoryChart'] = new Chart(document.getElementById('expenseCategoryChart'), {
            type: 'doughnut',
            data: {
                labels: catLabels,
                datasets: [{ data: catData, backgroundColor: ['#818CF8', '#F59E0B', '#38BDF8', '#EF4444', '#22C55E', '#94A3B8', '#8B5CF6', '#EC4899'], borderWidth: 0 }]
            },
            options: { responsive: true, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } } }
        });
    }

    async function renderReceitas() {
        const transactions = await loadTransactions();
        const now = new Date();
        const monthTxs = transactions.filter(t => {
            if (t.tipo !== 'receita') return false;
            const d = new Date(t.data + (t.data.includes('T') ? '' : 'T12:00:00'));
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const allTxs = transactions.filter(t => t.tipo === 'receita');
        const monthConfirmed = monthTxs.filter(t => (t.status || 'Confirmado') === 'Confirmado');
        const total = monthConfirmed.reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dailyAvg = total / daysInMonth;

        let biggestSource = '-';
        let biggestVal = 0;
        const srcMap = {};
        monthConfirmed.forEach(t => {
            const v = parseFloat(t.valor) || 0;
            srcMap[t.categoria] = (srcMap[t.categoria] || 0) + v;
            if (srcMap[t.categoria] > biggestVal) { biggestVal = srcMap[t.categoria]; biggestSource = t.categoria; }
        });
        const pct = total > 0 ? ((biggestVal / total) * 100).toFixed(1) : 0;

        document.getElementById('kpiReceitaTotalVal').textContent = formatBRL(total);
        document.getElementById('kpiMaiorFonteVal').textContent = biggestSource;
        document.getElementById('kpiMediaDiariaVal').textContent = formatBRL(dailyAvg);
        document.getElementById('kpiReceitaTotalTrend').innerHTML = '<i class="fa-solid fa-arrow-up"></i> ' + total.toLocaleString('pt-BR') + ' no mês';
        document.getElementById('kpiMaiorFonteTrend').textContent = (pct > 0 ? pct : 0) + '% da receita total';
        document.getElementById('kpiMediaDiariaTrend').innerHTML = '<i class="fa-solid fa-arrow-up"></i> Média do mês';

        const tbody = document.getElementById('incomeTableBody');
        tbody.innerHTML = '';
        allTxs.forEach(t => {
            const st = t.status || 'Confirmado';
            const stClass = st === 'Confirmado' ? 'status-success' : 'status-warning';
            const tr = document.createElement('tr');
            tr.innerHTML = '<td>' + (t.descricao || '') + '</td><td><span class="tag">' + (t.categoria || '') + '</span></td><td>' + formatDate(t.data) + '</td><td>' + (t.recorrencia || 'Única') + '</td>' +
                '<td><span class="status-badge ' + stClass + '">' + st + '</span></td>' +
                '<td style="color:var(--success); font-weight:600;">' + formatBRL(parseFloat(t.valor) || 0) + '</td>' +
                '<td><button class="action-btn" onclick="editTransaction(\'' + t.id + '\')" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>' +
                '<button class="action-btn" onclick="deleteTransaction(\'' + t.id + '\')" title="Excluir" style="margin-left:8px;"><i class="fa-solid fa-trash-can"></i></button></td>';
            tbody.appendChild(tr);
        });

        destroyChart('incomeSourceChart');
        const srcLabels = Object.keys(srcMap);
        const srcData = Object.values(srcMap);
        chartInstances['incomeSourceChart'] = new Chart(document.getElementById('incomeSourceChart'), {
            type: 'doughnut',
            data: {
                labels: srcLabels.length ? srcLabels : ['Sem dados'],
                datasets: [{ data: srcData.length ? srcData : [1], backgroundColor: ['#38BDF8', '#818CF8', '#22C55E', '#F59E0B', '#94A3B8', '#EF4444', '#8B5CF6'], borderWidth: 0 }]
            },
            options: { responsive: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } } }
        });
    }

    async function renderDespesas() {
        const transactions = await loadTransactions();
        const now = new Date();
        const monthTxs = transactions.filter(t => {
            if (t.tipo !== 'despesa') return false;
            const d = new Date(t.data + (t.data.includes('T') ? '' : 'T12:00:00'));
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const allTxs = transactions.filter(t => t.tipo === 'despesa');
        const monthConfirmed = monthTxs.filter(t => (t.status || 'Confirmado') === 'Confirmado');
        const total = monthConfirmed.reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dailyAvg = total / daysInMonth;

        let biggestCat = '-';
        let biggestVal = 0;
        const catMap = {};
        monthConfirmed.forEach(t => {
            const v = parseFloat(t.valor) || 0;
            catMap[t.categoria] = (catMap[t.categoria] || 0) + v;
            if (catMap[t.categoria] > biggestVal) { biggestVal = catMap[t.categoria]; biggestCat = t.categoria; }
        });
        const pct = total > 0 ? ((biggestVal / total) * 100).toFixed(1) : 0;

        document.getElementById('kpiDespesaTotalVal').textContent = formatBRL(total);
        document.getElementById('kpiMaiorCategoriaVal').textContent = biggestCat;
        document.getElementById('kpiGastoMedioVal').textContent = formatBRL(dailyAvg);
        document.getElementById('kpiDespesaTotalTrend').innerHTML = '<i class="fa-solid fa-arrow-down"></i> ' + total.toLocaleString('pt-BR') + ' no mês';
        document.getElementById('kpiMaiorCategoriaTrend').textContent = (pct > 0 ? pct : 0) + '% das despesas';
        document.getElementById('kpiGastoMedioTrend').innerHTML = '<i class="fa-solid fa-arrow-down"></i> Média do mês';

        const tbody = document.getElementById('expenseTableBody');
        tbody.innerHTML = '';
        allTxs.forEach(t => {
            const st = t.status || 'Confirmado';
            const stClass = st === 'Confirmado' ? 'status-success' : 'status-warning';
            const tr = document.createElement('tr');
            tr.innerHTML = '<td>' + (t.descricao || '') + '</td><td><span class="tag">' + (t.categoria || '') + '</span></td><td>' + formatDate(t.data) + '</td><td>' + (t.recorrencia || 'Única') + '</td>' +
                '<td><span class="status-badge ' + stClass + '">' + st + '</span></td>' +
                '<td style="color:var(--error); font-weight:600;">' + formatBRL(parseFloat(t.valor) || 0) + '</td>' +
                '<td><button class="action-btn" onclick="editTransaction(\'' + t.id + '\')" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>' +
                '<button class="action-btn" onclick="deleteTransaction(\'' + t.id + '\')" title="Excluir" style="margin-left:8px;"><i class="fa-solid fa-trash-can"></i></button></td>';
            tbody.appendChild(tr);
        });

        destroyChart('expenseBreakdownChart');
        const catLabels = Object.keys(catMap);
        const catData = Object.values(catMap);
        chartInstances['expenseBreakdownChart'] = new Chart(document.getElementById('expenseBreakdownChart'), {
            type: 'bar',
            data: {
                labels: catLabels.length ? catLabels : ['Sem dados'],
                datasets: [{ data: catData.length ? catData : [0], backgroundColor: '#38BDF8', borderRadius: 6 }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(148,163,184,0.08)' } }, x: { grid: { display: false } } } }
        });
    }

    async function renderOrcamentos() {
        const budgets = await loadBudgets();
        const transactions = await loadTransactions();
        const now = new Date();
        const container = document.getElementById('budgetsContainer');
        container.innerHTML = '';

        budgets.forEach(b => {
            const spent = transactions.filter(t => {
                if (t.tipo !== 'despesa') return false;
                if (t.categoria !== b.categoria) return false;
                const d = new Date(t.data + (t.data.includes('T') ? '' : 'T12:00:00'));
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);

            const limit = parseFloat(b.limite) || 1;
            const pct = Math.min(100, (spent / limit) * 100);
            const barColor = pct >= 100 ? 'var(--error)' : pct >= 80 ? 'var(--warning)' : 'var(--success)';
            const remaining = Math.max(0, limit - spent);

            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = '<div style="display:flex; justify-content: space-between; margin-bottom: 4px;">' +
                '<span style="font-weight: 600;"><i class="fa-solid fa-tag" style="color: var(--accent); margin-right: 8px;"></i>' + b.categoria + '</span>' +
                '<span style="color: var(--text-sec); font-size: 13px;">' + formatBRL(spent) + ' / ' + formatBRL(limit) + '</span></div>' +
                '<div class="progress-container"><div class="progress-bar" style="width: ' + pct + '%; background: ' + barColor + ';"></div></div>' +
                '<p class="kpi-trend" style="margin-top: 10px; color: ' + (pct >= 80 ? 'var(--warning)' : 'var(--text-sec)') + ';">' + pct.toFixed(0) + '% utilizado · ' + formatBRL(remaining) + ' restantes</p>';
            container.appendChild(card);
        });

        if (!budgets.length) {
            container.innerHTML = '<div class="card" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-sec);">Nenhum orçamento definido. Clique em "Novo Orçamento" para começar.</div>';
        }
    }

    async function renderMetas() {
        const goals = await loadGoals();
        const container = document.getElementById('goalsContainer');
        container.innerHTML = '';

        goals.forEach(g => {
            const current = parseFloat(g.valorAtual) || 0;
            const target = parseFloat(g.valorAlvo) || 1;
            const pct = Math.min(100, (current / target) * 100);
            const icon = g.icone || 'fa-bullseye';
            const deadline = g.prazo ? formatDate(g.prazo) : 'Sem prazo';
            const status = pct >= 100 ? 'Concluída' : 'Em dia';

            const card = document.createElement('div');
            card.className = 'card goal-card';
            card.innerHTML = '<div class="goal-header"><div class="goal-icon" style="background: rgba(56,189,248,0.12); color: var(--accent);"><i class="fa-solid ' + icon + '"></i></div>' +
                '<span class="status-badge ' + (pct >= 100 ? 'status-success' : 'status-success') + '">' + status + '</span></div>' +
                '<div><h2 style="margin-bottom: 4px;">' + (g.titulo || 'Meta') + '</h2>' +
                '<div class="progress-container"><div class="progress-bar" style="width: ' + pct + '%; background: ' + (pct >= 100 ? 'var(--success)' : 'var(--accent)') + ';"></div></div></div>' +
                '<div class="goal-meta"><span>' + formatBRL(current) + ' de ' + formatBRL(target) + '</span><span>' + pct.toFixed(0) + '%</span></div>' +
                '<div class="goal-deadline"><i class="fa-regular fa-calendar"></i> ' + (pct >= 100 ? 'Concluída' : 'Meta') + ': ' + deadline + '</div>';
            container.appendChild(card);
        });

        const addCard = document.createElement('div');
        addCard.className = 'card goal-card';
        addCard.style.cssText = 'align-items: center; justify-content: center; border: 1px dashed var(--border-color); background: transparent; box-shadow: none; cursor: pointer;';
        addCard.onclick = function() { openGoalModal(); };
        addCard.innerHTML = '<i class="fa-solid fa-plus" style="font-size: 24px; color: var(--text-sec);"></i><span style="color: var(--text-sec); font-size: 14px;">Criar nova meta</span>';
        container.appendChild(addCard);
    }

    async function renderInvestimentos() {
        const investments = await loadInvestments();
        const total = investments.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0);
        const monthlyContrib = investments.reduce((s, i) => s + (parseFloat(i.aporteMensal) || 0), 0);
        const dividendos = investments.reduce((s, i) => s + (parseFloat(i.dividendos) || 0), 0);

        document.getElementById('kpiPatrimonioVal').textContent = formatBRL(total);
        document.getElementById('kpiRentabilidadeVal').textContent = total > 0 ? '+12.5%' : '0%';
        document.getElementById('kpiAportesVal').textContent = formatBRL(monthlyContrib || total * 0.02);
        document.getElementById('kpiDividendosVal').textContent = formatBRL(dividendos);
        document.getElementById('kpiPatrimonioTrend').innerHTML = '<i class="fa-solid fa-arrow-up"></i> ' + total.toLocaleString('pt-BR') + ' investidos';
        document.getElementById('kpiRentabilidadeTrend').innerHTML = '<i class="fa-solid fa-arrow-up"></i> acima do CDI';
        document.getElementById('kpiAportesTrend').textContent = 'total em aportes';
        document.getElementById('kpiDividendosTrend').innerHTML = '<i class="fa-solid fa-arrow-up"></i> recebidos no mês';

        const tbody = document.getElementById('investmentsTableBody');
        tbody.innerHTML = '';
        investments.forEach(i => {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td>' + (i.nome || '') + '</td><td><span class="tag">' + (i.classe || '') + '</span></td><td>' + formatBRL(parseFloat(i.valor) || 0) + '</td><td style="color: var(--success);">+12.5%</td>';
            tbody.appendChild(tr);
        });

        destroyChart('investmentAllocationChart');
        const classMap = {};
        investments.forEach(i => { classMap[i.classe] = (classMap[i.classe] || 0) + (parseFloat(i.valor) || 0); });
        const labels = Object.keys(classMap);
        const data = Object.values(classMap);
        chartInstances['investmentAllocationChart'] = new Chart(document.getElementById('investmentAllocationChart'), {
            type: 'doughnut',
            data: {
                labels: labels.length ? labels : ['Sem dados'],
                datasets: [{ data: data.length ? data : [1], backgroundColor: ['#38BDF8', '#22C55E', '#818CF8', '#F59E0B', '#EF4444'], borderWidth: 0 }]
            },
            options: { responsive: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } } }
        });
    }

    async function renderDividas() {
        const debts = await loadDebts();
        const total = debts.reduce((s, d) => s + (parseFloat(d.valorTotal) || 0), 0);
        const monthlyTotal = debts.reduce((s, d) => s + (parseFloat(d.pagamentoMensal) || 0), 0);

        let minMonths = 0;
        debts.forEach(d => {
            const bal = parseFloat(d.valorTotal) || 0;
            const pmt = parseFloat(d.pagamentoMensal) || 1;
            const rate = (parseFloat(d.taxaJuros) || 0) / 100;
            let m = 0, tmp = bal;
            while (tmp > 0 && m < 600) {
                tmp = tmp * (1 + rate) - pmt;
                m++;
            }
            minMonths = Math.max(minMonths, m);
        });

        document.getElementById('kpiDividaTotalVal').textContent = formatBRL(total);
        document.getElementById('kpiPagamentoMensalVal').textContent = formatBRL(monthlyTotal);
        document.getElementById('kpiPrevisaoQuitacaoVal').textContent = minMonths > 0 ? minMonths + ' meses' : '—';
        document.getElementById('kpiDividaTotalTrend').innerHTML = '<i class="fa-solid fa-arrow-down"></i> ' + total.toLocaleString('pt-BR') + ' em aberto';
        document.getElementById('kpiPagamentoMensalTrend').textContent = 'comprometendo parte da renda';
        document.getElementById('kpiPrevisaoQuitacaoTrend').textContent = 'mantendo o ritmo atual';

        const tbody = document.getElementById('debtsTableBody');
        tbody.innerHTML = '';
        debts.forEach(d => {
            const tr = document.createElement('tr');
            const totalVal = parseFloat(d.valorTotal) || 0;
            const progress = Math.min(100, (monthlyTotal > 0 ? (totalVal / (totalVal + monthlyTotal * 12)) * 100 : 0));
            tr.innerHTML = '<td><i class="fa-solid fa-credit-card" style="margin-right: 8px; color: var(--accent);"></i>' + (d.nome || '') + '</td>' +
                '<td>' + formatBRL(totalVal) + '</td>' +
                '<td>' + (d.taxaJuros || '0') + '% a.m.</td>' +
                '<td>' + formatBRL(parseFloat(d.pagamentoMensal) || 0) + '</td>' +
                '<td style="min-width: 140px;"><div class="progress-container"><div class="progress-bar" style="width: ' + (100 - progress).toFixed(0) + '%; background: var(--accent);"></div></div></td>';
            tbody.appendChild(tr);
        });
    }

    async function renderCalendario() {
        const transactions = await loadTransactions();
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const today = now.getDate();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthName = getMonthName(month);

        document.querySelector('#calendario .subtitle').textContent = monthName + ' de ' + year + ' — vencimentos, recebimentos e aportes.';

        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = '';

        const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        weekdays.forEach(d => {
            const el = document.createElement('div');
            el.className = 'calendar-weekday';
            el.textContent = d;
            grid.appendChild(el);
        });

        for (let i = 0; i < firstDay; i++) {
            const el = document.createElement('div');
            el.className = 'calendar-day empty';
            grid.appendChild(el);
        }

        const monthTxs = transactions.filter(t => {
            const d = new Date(t.data + (t.data.includes('T') ? '' : 'T12:00:00'));
            return d.getMonth() === month && d.getFullYear() === year;
        });

        for (let day = 1; day <= daysInMonth; day++) {
            const el = document.createElement('div');
            el.className = 'calendar-day' + (day === today ? ' today' : '');
            let html = '<span class="day-num">' + day + '</span>';

            const dayTxs = monthTxs.filter(t => {
                const d = new Date(t.data + (t.data.includes('T') ? '' : 'T12:00:00'));
                return d.getDate() === day;
            });

            dayTxs.forEach(t => {
                if (t.tipo === 'receita') {
                    html += '<div class="day-event event-income">' + (t.descricao || 'Receita') + '</div>';
                } else if (t.tipo === 'despesa') {
                    html += '<div class="day-event event-expense">' + (t.descricao || 'Despesa') + '</div>';
                } else {
                    html += '<div class="day-event event-invest">' + (t.descricao || 'Investimento') + '</div>';
                }
            });

            el.innerHTML = html;
            grid.appendChild(el);
        }
    }

    function renderConfig() {
        if (currentUser) {
            const initials = currentUser.displayName ? currentUser.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
            document.getElementById('configAvatar').textContent = initials;
            document.getElementById('configName').value = currentUser.displayName || '';
            document.getElementById('configEmail').value = currentUser.email || '';
        }
        const list = document.getElementById('profileSettingsList');
        if (!list) return;
        list.innerHTML = '';
        profiles.forEach(p => {
            const colors = { Pessoal: 'var(--success)', PJ: 'var(--accent)', Investidor: 'var(--purple)', Outro: 'var(--warning)' };
            const div = document.createElement('div');
            div.className = 'toggle-row';
            div.innerHTML = '<div class="toggle-row-text"><strong>' + p.nome + '</strong><span>' + (p.tipo || '') + '</span></div>' +
                '<div style="display:flex; gap:8px; align-items:center;">' +
                (p.id !== 'default' ? '<button class="action-btn" onclick="deleteCustomProfile(\'' + p.id + '\')" title="Excluir"><i class="fa-solid fa-trash-can"></i></button>' : '') +
                '<span class="status-badge ' + (p.id === currentProfileId ? 'status-success' : 'status-warning') + '">' + (p.id === currentProfileId ? 'Ativo' : 'Inativo') + '</span></div>';
            if (p.id !== currentProfileId) {
                div.style.cursor = 'pointer';
                div.onclick = function() { switchProfile(p.id); };
            }
            list.appendChild(div);
        });
    }

    /* ---------- CHART FUNCTIONS ---------- */
    function drawCashFlowChart(incomeData, expenseData) {
        destroyChart('cashFlowChart');
        const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
        chartInstances['cashFlowChart'] = new Chart(document.getElementById('cashFlowChart'), {
            type: 'line',
            data: { labels: labels, datasets: [{ label: 'Receitas', data: incomeData, borderColor: '#22C55E', backgroundColor: 'rgba(34,197,94,0.08)', tension: 0.4, fill: true }, { label: 'Despesas', data: expenseData, borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)', tension: 0.4, fill: true }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { grid: { color: 'rgba(148,163,184,0.08)' } }, x: { grid: { display: false } } } }
        });
    }

    function drawExpenseCategoryChart(categoryData) {
        destroyChart('expenseCategoryChart');
        chartInstances['expenseCategoryChart'] = new Chart(document.getElementById('expenseCategoryChart'), {
            type: 'doughnut',
            data: { labels: Object.keys(categoryData), datasets: [{ data: Object.values(categoryData), backgroundColor: ['#818CF8', '#F59E0B', '#38BDF8', '#EF4444', '#22C55E', '#94A3B8'], borderWidth: 0 }] },
            options: { responsive: true, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } } }
        });
    }

    function drawIncomeSourceChart(sourceData) {
        destroyChart('incomeSourceChart');
        chartInstances['incomeSourceChart'] = new Chart(document.getElementById('incomeSourceChart'), {
            type: 'doughnut',
            data: { labels: Object.keys(sourceData), datasets: [{ data: Object.values(sourceData), backgroundColor: ['#38BDF8', '#818CF8', '#22C55E', '#F59E0B', '#94A3B8'], borderWidth: 0 }] },
            options: { responsive: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } } }
        });
    }

    function drawExpenseBreakdownChart(categoryData) {
        destroyChart('expenseBreakdownChart');
        chartInstances['expenseBreakdownChart'] = new Chart(document.getElementById('expenseBreakdownChart'), {
            type: 'bar',
            data: { labels: Object.keys(categoryData), datasets: [{ data: Object.values(categoryData), backgroundColor: '#38BDF8', borderRadius: 6 }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(148,163,184,0.08)' } }, x: { grid: { display: false } } } }
        });
    }

    function drawInvestmentAllocationChart(allocationData) {
        destroyChart('investmentAllocationChart');
        chartInstances['investmentAllocationChart'] = new Chart(document.getElementById('investmentAllocationChart'), {
            type: 'doughnut',
            data: { labels: Object.keys(allocationData), datasets: [{ data: Object.values(allocationData), backgroundColor: ['#38BDF8', '#22C55E', '#818CF8', '#F59E0B', '#EF4444'], borderWidth: 0 }] },
            options: { responsive: true, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12 } } } }
        });
    }

    function drawReportsSummaryChart(incomeData, expenseData) {
        destroyChart('reportsSummaryChart');
        chartInstances['reportsSummaryChart'] = new Chart(document.getElementById('reportsSummaryChart'), {
            type: 'bar',
            data: {
                labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
                datasets: [{ label: 'Receitas', data: incomeData, backgroundColor: '#22C55E', borderRadius: 6 }, { label: 'Despesas', data: expenseData, backgroundColor: '#EF4444', borderRadius: 6 }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { grid: { color: 'rgba(148,163,184,0.08)' } }, x: { grid: { display: false } } } }
        });
    }

    /* ---------- TRANSACTION MODAL ---------- */
    function openTransactionModal(type, editId, editData) {
        document.getElementById('transactionModal').classList.add('open');
        document.getElementById('transactionId').value = editId || '';
        document.getElementById('tDescricao').value = editData ? editData.descricao : '';
        document.getElementById('tValor').value = editData ? editData.valor : '';
        document.getElementById('tData').value = editData ? editData.data : new Date().toISOString().split('T')[0];
        document.getElementById('tCategoria').value = editData ? editData.categoria : 'Salário';
        document.getElementById('tRecorrencia').value = editData ? editData.recorrencia : 'Única';
        document.getElementById('tStatus').value = editData ? (editData.status || 'Confirmado') : 'Pendente';
        document.getElementById('transactionModalTitle').textContent = editId ? 'Editar ' + (type === 'receita' ? 'Receita' : 'Despesa') : (type === 'receita' ? 'Nova Receita' : type === 'despesa' ? 'Nova Despesa' : 'Nova Transação');
        if (type) setTransactionType(type, true);
    }

    function closeTransactionModal() {
        document.getElementById('transactionModal').classList.remove('open');
    }

    function setTransactionType(type, force) {
        const labels = document.querySelectorAll('#typeToggle label');
        labels.forEach(l => l.classList.remove('checked'));
        const idx = type === 'receita' ? 0 : 1;
        labels[idx].classList.add('checked');
        labels[idx].querySelector('input').checked = true;
    }

    async function saveTransaction() {
        const rawId = document.getElementById('transactionId').value;
        const id = rawId && !rawId.startsWith('virt_') ? rawId : '';
        const descricao = document.getElementById('tDescricao').value;
        const valor = document.getElementById('tValor').value;
        const data = document.getElementById('tData').value;
        const categoria = document.getElementById('tCategoria').value;
        const recorrencia = document.getElementById('tRecorrencia').value;
        const status = document.getElementById('tStatus').value;
        const tipo = document.querySelector('#typeToggle input:checked').value;

        if (!descricao || !valor || !data) { alert('Preencha todos os campos obrigatórios.'); return; }
        try {
            const payload = { descricao, valor: parseFloat(valor), data, categoria, recorrencia, status, tipo };
            if (id) {
                const ref = getUserRef();
                if (ref) await ref.collection('transactions').doc(id).update(payload);
            } else {
                payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await addTransaction(payload);
            }
            closeTransactionModal();
            for (let k in renderedPages) delete renderedPages[k];
            await loadAllData();
        } catch (e) {
            alert('Erro ao salvar. Verifique as regras de segurança do Firestore.\n\nDetalhes: ' + e.message);
        }
    }

    document.getElementById('transactionModal').addEventListener('click', function(e) {
        if (e.target === this) closeTransactionModal();
    });

    /* ---------- GOAL MODAL ---------- */
    function openGoalModal(editId) {
        document.getElementById('goalModal').classList.add('open');
        document.getElementById('goalId').value = editId || '';
        document.getElementById('goalTitulo').value = '';
        document.getElementById('goalAlvo').value = '';
        document.getElementById('goalAtual').value = '';
        document.getElementById('goalPrazo').value = '';
        document.getElementById('goalIcone').value = 'fa-plane';
        document.getElementById('goalModalTitle').textContent = editId ? 'Editar Meta' : 'Nova Meta';
    }

    function closeGoalModal() {
        document.getElementById('goalModal').classList.remove('open');
    }

    async function saveGoal() {
        const id = document.getElementById('goalId').value;
        const titulo = document.getElementById('goalTitulo').value;
        const valorAlvo = document.getElementById('goalAlvo').value;
        const valorAtual = document.getElementById('goalAtual').value;
        const prazo = document.getElementById('goalPrazo').value;
        const icone = document.getElementById('goalIcone').value;

        if (!titulo || !valorAlvo) { alert('Preencha os campos obrigatórios.'); return; }
        try {
            const data = { titulo, valorAlvo: parseFloat(valorAlvo), valorAtual: parseFloat(valorAtual) || 0, prazo, icone };
            if (id) data.id = id;
            await saveGoalData(data);
            closeGoalModal();
            renderedPages['metas'] = false;
            await renderMetas();
        } catch (e) { alert('Erro ao salvar meta: ' + e.message); }
    }

    document.getElementById('goalModal').addEventListener('click', function(e) {
        if (e.target === this) closeGoalModal();
    });

    /* ---------- BUDGET MODAL ---------- */
    function openBudgetModal(editId) {
        document.getElementById('budgetModal').classList.add('open');
        document.getElementById('budgetId').value = editId || '';
        document.getElementById('budgetCategoria').value = 'Alimentação';
        document.getElementById('budgetLimite').value = '';
    }

    function closeBudgetModal() {
        document.getElementById('budgetModal').classList.remove('open');
    }

    async function saveBudget() {
        const id = document.getElementById('budgetId').value;
        const categoria = document.getElementById('budgetCategoria').value;
        const limite = document.getElementById('budgetLimite').value;
        if (!limite) { alert('Defina um limite.'); return; }
        try {
            const data = { categoria, limite: parseFloat(limite) };
            if (id) data.id = id;
            await saveBudgetData(data);
            closeBudgetModal();
            renderedPages['orcamentos'] = false;
            await renderOrcamentos();
        } catch (e) { alert('Erro ao salvar orçamento: ' + e.message); }
    }

    document.getElementById('budgetModal').addEventListener('click', function(e) {
        if (e.target === this) closeBudgetModal();
    });

    /* ---------- INVESTMENT MODAL ---------- */
    function openInvestmentModal(editId) {
        document.getElementById('investmentModal').classList.add('open');
        document.getElementById('investmentId').value = editId || '';
        document.getElementById('invNome').value = '';
        document.getElementById('invClasse').value = 'Renda Fixa';
        document.getElementById('invValor').value = '';
    }

    function closeInvestmentModal() {
        document.getElementById('investmentModal').classList.remove('open');
    }

    async function saveInvestment() {
        const id = document.getElementById('investmentId').value;
        const nome = document.getElementById('invNome').value;
        const classe = document.getElementById('invClasse').value;
        const valor = document.getElementById('invValor').value;
        if (!nome || !valor) { alert('Preencha os campos obrigatórios.'); return; }
        try {
            const data = { nome, classe, valor: parseFloat(valor) };
            if (id) data.id = id;
            await saveInvestmentData(data);
            closeInvestmentModal();
            renderedPages['investimentos'] = false;
            await renderInvestimentos();
        } catch (e) { alert('Erro ao salvar investimento: ' + e.message); }
    }

    document.getElementById('investmentModal').addEventListener('click', function(e) {
        if (e.target === this) closeInvestmentModal();
    });

    /* ---------- DEBT MODAL ---------- */
    function openDebtModal(editId) {
        document.getElementById('debtModal').classList.add('open');
        document.getElementById('debtId').value = editId || '';
        document.getElementById('debtNome').value = '';
        document.getElementById('debtTotal').value = '';
        document.getElementById('debtTaxa').value = '';
        document.getElementById('debtMensal').value = '';
    }

    function closeDebtModal() {
        document.getElementById('debtModal').classList.remove('open');
    }

    async function saveDebt() {
        const id = document.getElementById('debtId').value;
        const nome = document.getElementById('debtNome').value;
        const valorTotal = document.getElementById('debtTotal').value;
        const taxaJuros = document.getElementById('debtTaxa').value;
        const pagamentoMensal = document.getElementById('debtMensal').value;
        if (!nome || !valorTotal) { alert('Preencha os campos obrigatórios.'); return; }
        try {
            const data = { nome, valorTotal: parseFloat(valorTotal), taxaJuros: parseFloat(taxaJuros) || 0, pagamentoMensal: parseFloat(pagamentoMensal) || 0 };
            if (id) data.id = id;
            await saveDebtData(data);
            closeDebtModal();
            renderedPages['dividas'] = false;
            await renderDividas();
        } catch (e) { alert('Erro ao salvar dívida: ' + e.message); }
    }

    document.getElementById('debtModal').addEventListener('click', function(e) {
        if (e.target === this) closeDebtModal();
    });

    /* ---------- EDIT ---------- */
    async function editTransaction(id) {
        const ref = getUserRef();
        if (!ref) return;
        try {
            if (id.startsWith('virt_')) {
                const realId = id.replace('virt_', '');
                const doc = await ref.collection('transactions').doc(realId).get();
                if (!doc.exists) return;
                const t = { ...doc.data(), id: '' };
                openTransactionModal(t.tipo, '', t);
                return;
            }
            const doc = await ref.collection('transactions').doc(id).get();
            if (!doc.exists) return;
            const t = { id: doc.id, ...doc.data() };
            openTransactionModal(t.tipo, t.id, t);
        } catch (e) { alert('Erro ao carregar transação: ' + e.message); }
    }

    /* ---------- DELETE ---------- */
    async function deleteTransaction(id) {
        try {
            const ref = getUserRef();
            if (ref) {
                await ref.collection('transactions').doc(id).delete();
                for (let k in renderedPages) delete renderedPages[k];
                await loadAllData();
            }
        } catch (e) { alert('Erro ao excluir: ' + e.message); }
    }

    async function deleteBudget(id) {
        try {
            const ref = getUserRef();
            if (ref) {
                await ref.collection('budgets').doc(id).delete();
                renderedPages['orcamentos'] = false;
                await renderOrcamentos();
            }
        } catch (e) { alert('Erro ao excluir: ' + e.message); }
    }

    async function deleteCustomProfile(id) {
        showConfirm('Excluir o perfil "' + (profiles.find(p => p.id === id)?.nome || '') + '"? Os dados deste perfil serão perdidos.', async () => {
            try {
                await db.collection('users').doc(currentUser.uid).collection('profiles').doc(id).delete();
                await loadProfiles();
                renderConfig();
            } catch (e) { alert('Erro ao excluir perfil: ' + e.message); }
        });
    }

    /* ---------- SIMULATORS ---------- */
    function calcularJurosCompostos() {
        const inicial = parseFloat(document.getElementById('simValorInicial').value) || 0;
        const aporte = parseFloat(document.getElementById('simAporte').value) || 0;
        const taxaAnual = parseFloat(document.getElementById('simTaxa').value) || 0;
        const meses = parseInt(document.getElementById('simMeses').value) || 0;
        const taxaMensal = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;

        let saldo = inicial;
        let investido = inicial;
        const series = [saldo];
        for (let i = 1; i <= meses; i++) {
            saldo = saldo * (1 + taxaMensal) + aporte;
            investido += aporte;
            series.push(saldo);
        }
        const juros = saldo - investido;

        document.getElementById('simInvestido').textContent = formatBRL(investido);
        document.getElementById('simJuros').textContent = formatBRL(juros);
        document.getElementById('simFinal').textContent = formatBRL(saldo);

        const labels = series.map((_, i) => i === 0 ? 'Início' : 'Mês ' + i);
        const sampledLabels = [];
        const sampledData = [];
        const step = Math.max(1, Math.floor(series.length / 24));
        for (let i = 0; i < series.length; i += step) {
            sampledLabels.push(labels[i]);
            sampledData.push(Math.round(series[i]));
        }

        chartDefaults();
        if (simChartInstance) simChartInstance.destroy();
        simChartInstance = new Chart(document.getElementById('simChart'), {
            type: 'line',
            data: { labels: sampledLabels, datasets: [{ label: 'Saldo projetado', data: sampledData, borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.08)', tension: 0.35, fill: true, pointRadius: 0 }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(148,163,184,0.08)' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } } } }
        });
    }

    function calcularEmprestimo() {
        const valor = parseFloat(document.getElementById('loanValor').value) || 0;
        const taxaMensal = (parseFloat(document.getElementById('loanTaxa').value) || 0) / 100;
        const n = parseInt(document.getElementById('loanParcelas').value) || 1;

        let parcela;
        if (taxaMensal === 0) {
            parcela = valor / n;
        } else {
            parcela = valor * taxaMensal / (1 - Math.pow(1 + taxaMensal, -n));
        }
        const totalPago = parcela * n;
        const totalJuros = totalPago - valor;

        document.getElementById('loanParcela').textContent = formatBRL(parcela);
        document.getElementById('loanJuros').textContent = formatBRL(totalJuros);
        document.getElementById('loanTotal').textContent = formatBRL(totalPago);
    }

    /* ---------- SEARCH ---------- */
    function setupSearch() {
        const input = document.querySelector('.search-bar input');
        if (!input) return;
        input.addEventListener('input', function() {
            const q = this.value.toLowerCase().trim();
            const active = document.querySelector('.page.active');
            if (!active) return;
            const rows = active.querySelectorAll('tbody tr');
            rows.forEach(tr => {
                const text = tr.textContent.toLowerCase();
                tr.style.display = (!q || text.includes(q)) ? '' : 'none';
            });
            if (!q) return;
            const containers = active.querySelectorAll('[id$="Container"], [id$="container"]');
            containers.forEach(c => {
                const cards = c.querySelectorAll('.card');
                cards.forEach(card => {
                    const text = card.textContent.toLowerCase();
                    card.style.display = text.includes(q) ? '' : 'none';
                });
            });
        });
    }

    /* ---------- NOTIFICATIONS ---------- */
    function setupNotifications() {
        const btn = document.querySelector('.notification-btn');
        const popup = document.getElementById('notifPopup');
        if (!btn || !popup) return;

        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            if (popup.classList.contains('open')) {
                popup.classList.remove('open');
                return;
            }
            await updateNotifications();
            popup.classList.add('open');
        });

        document.addEventListener('click', function(e) {
            if (popup.classList.contains('open') && !popup.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                popup.classList.remove('open');
            }
        });
    }

    async function updateNotifications() {
        const list = document.getElementById('notifList');
        const countEl = document.getElementById('notifCount');
        if (!list) return;
        const transactions = await loadTransactions();
        const now = new Date();
        const items = [];
        transactions.forEach(t => {
            const d = new Date(t.data + (t.data.includes('T') ? '' : 'T12:00:00'));
            const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
            const st = t.status || 'Confirmado';
            if (st === 'Pendente' && diffDays < 0) {
                items.push({ icon: 'fa-triangle-exclamation', color: 'var(--error)', text: t.descricao + ' (' + (t.tipo === 'despesa' ? 'Despesa' : 'Receita') + ')', small: 'Vencida em ' + formatDate(t.data) });
            } else if (st === 'Pendente' && diffDays >= 0 && diffDays <= 7) {
                items.push({ icon: 'fa-clock', color: 'var(--warning)', text: t.descricao + ' (' + (t.tipo === 'despesa' ? 'Despesa' : 'Receita') + ')', small: 'Vence em ' + formatDate(t.data) + ' (' + (diffDays === 0 ? 'hoje' : diffDays + ' dias') + ')' });
            } else if (t.recorrencia === 'Mensal' && diffDays >= 0 && diffDays <= 3) {
                items.push({ icon: 'fa-arrows-rotate', color: 'var(--accent)', text: t.descricao + ' (' + (t.tipo === 'despesa' ? 'Despesa' : 'Receita') + ')', small: 'Recorrência em ' + formatDate(t.data) });
            }
        });
        items.sort((a, b) => a.small.localeCompare(b.small));
        countEl.textContent = items.length;
        list.innerHTML = items.length ? items.map(i =>
            '<div class="notif-item"><div class="notif-icon"><i class="fa-solid ' + i.icon + '" style="color:' + i.color + '"></i></div><div class="notif-text">' + i.text + '<small>' + i.small + '</small></div></div>'
        ).join('') : '<div class="notif-empty">Nenhuma notificação</div>';
    }

    /* ---------- INIT ---------- */
    chartDefaults();
    checkAuth();
