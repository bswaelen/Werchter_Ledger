// --- 1. CONFIG ---
const FESTIVAL_YEAR = 2026;
const ADMIN_PASSWORD = 'werchter2026';

// Oude dummy seed-namen (Sarah, Thomas, Elise, Mike, Chloe, David) — niet meer automatisch aangemaakt

let transactions = [];
let members = [];

// --- 2. STATE & DOM CACHE ---
let db, collection, onSnapshot, addDoc, getDocs, getDoc, setDoc, doc, deleteDoc, query, where;

const DOM = {
    memberBoard: () => document.getElementById('member-board'),
    totalPintsCounter: () => document.getElementById('total-pints-counter'),
    payerSelect: () => document.getElementById('payer'),
    recipientsList: () => document.getElementById('recipients-list'),
    membersList: () => document.getElementById('members-list'),
    transactionsList: () => document.getElementById('transactions-list'),
    quantitySelect: () => document.getElementById('quantity'),
    adminPasswordInput: () => document.getElementById('admin-password'),
    newMemberName: () => document.getElementById('new-member-name'),
    newMemberRole: () => document.getElementById('new-member-role')
};

// --- 3. FIREBASE INTEGRATION ---
async function ensureFestival2026Ready() {
    const configRef = doc(db, 'config', 'app');
    const configSnap = await getDoc(configRef);

    if (configSnap.exists() && configSnap.data().festivalYear === FESTIVAL_YEAR) {
        return;
    }

    const [membersSnapshot, transactionsSnapshot] = await Promise.all([
        getDocs(collection(db, 'members')),
        getDocs(collection(db, 'transactions'))
    ]);

    await Promise.all([
        ...membersSnapshot.docs.map(d => deleteDoc(doc(db, 'members', d.id))),
        ...transactionsSnapshot.docs.map(d => deleteDoc(doc(db, 'transactions', d.id)))
    ]);

    await setDoc(configRef, {
        festivalYear: FESTIVAL_YEAR,
        migratedAt: Date.now()
    });
}

async function setupFirebaseListeners() {
    try {
        const membersRef = collection(db, 'members');
        const transactionsRef = collection(db, 'transactions');

        onSnapshot(membersRef, (snapshot) => {
            members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAll();
        });

        onSnapshot(transactionsRef, (snapshot) => {
            transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderAll();
        });
    } catch (error) {
        console.error("Firebase listener status error:", error);
    }
}

// --- 4. WATERDICHTE REKENLOGICA (NETTO-KOST ENGINE) ---
function getMemberStats(memberId) {
    let bought = 0;
    let received = 0;
    let cupsReturned = 0;
    let net = 0;

    if (!members || members.length === 0) {
        return { bought, received, net: 0, status: 'Balanced', coins: 0 };
    }

    const numMembers = members.length;

    transactions.forEach(tx => {
        const qty = tx.quantity || 0;
        
        // 1. Verwerk de Drankjes (Rondjes)
        if (tx.type !== 'leeggoed' && tx.recipients) {
            if (tx.payer === memberId) {
                const drinksForOthers = tx.recipients.filter(r => r !== memberId).length;
                bought += drinksForOthers;
                net += drinksForOthers * 1.0; // +1.0 credit per gegeven consumptie aan een ander
            }
            
            if (tx.recipients.includes(memberId) && tx.payer !== memberId) {
                received += 1;
                net -= 1.0; // -1.0 kosten per ontvangen drankje
            }
        }

        // 2. Verwerk het Leeggoed (De Beker-Correctie)
        // Bekers verminderen de out-of-pocket credit van de gever.
        if (qty > 0) {
            if (tx.payer === memberId) {
                cupsReturned += qty;
                net -= qty * 0.2; // Aftrek van je credit: je hebt met groepsbekers betaald!
            }
            // De waarde van de ingeleverde bekers wordt als compensatie verdeeld over de hele groep
            net += (qty * 0.2) / numMembers;
        }
    });

    const coins = cupsReturned * 0.2;
    
    let status = 'Balanced';
    if (net > 0.01) status = 'Giver';
    else if (net < -0.01) status = 'Receiver';

    return { bought, received, net, status, coins };
}

// --- 5. RENDERING & UI ---
function renderAll() {
    renderMemberBoard();
    updateTotalPintsCounter();
    if (!document.getElementById('admin-panel-modal').classList.contains('hidden')) {
        renderAdminPanel();
    }
}

function renderMemberBoard() {
    const board = DOM.memberBoard();
    if (!board) return;

    const uniqueMembers = Array.from(new Map(members.map(m => [m.name, m])).values());
    const membersWithNet = uniqueMembers.map(m => ({ ...m, ...getMemberStats(m.id) }));
    
    const coreMembers = membersWithNet.filter(m => m.role === 'Core').sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
    const guests = membersWithNet.filter(m => m.role === 'Guest').sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));

    const renderCard = (m) => {
        const emojis = { Giver: '🎉', Receiver: '🛑', Balanced: '⚖️' };
        const statusText = m.status === 'Giver' 
            ? `${m.net > 5 ? 'Gulle gever' : 'Gever'} (${m.net > 0 ? '+' : ''}${m.net.toFixed(1)})`
            : m.status === 'Receiver' ? `Ontvanger (${m.net.toFixed(1)})` : 'In balans (0)';

        return `
            <div class="bg-gray-800 rounded-xl p-4 shadow-lg mb-2">
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-4">
                        <span class="text-2xl">${emojis[m.status]}</span>
                        <div>
                            <h3 class="text-lg font-semibold">${m.name}</h3>
                            <p class="text-sm text-gray-400">${statusText}</p>
                        </div>
                    </div>
                    <div class="text-right text-sm sm:text-base">
                        <div class="flex items-center justify-end space-x-2">
                            <span class="text-green-400" title="Gegeven aan anderen">💸 ${m.bought}</span>
                            <span class="text-yellow-400 flex items-center" title="Coins via leeggoed">🥤 ${m.coins.toFixed(1)}</span>
                            <span class="text-red-400" title="Ontvangen van anderen">🍺 ${m.received}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    let html = '';
    if (members.length === 0) {
        html = `
            <div class="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
                <p class="text-lg font-medium text-white mb-2">Welkom bij Werchter ${FESTIVAL_YEAR}</p>
                <p>Nog geen leden. Voeg je vriendengroep toe via <span class="text-yellow-400">Admin Beheer</span>.</p>
            </div>
        `;
    } else {
        if (coreMembers.length > 0) {
            html += `<h2 class="text-xl font-bold text-yellow-400 mb-2">Core Members</h2>${coreMembers.map(renderCard).join('')}`;
        }
        if (guests.length > 0) {
            html += `<h2 class="text-xl font-bold text-yellow-400 mb-2 mt-4">Guests</h2>${guests.map(renderCard).join('')}`;
        }
    }
    board.innerHTML = html;
}

function openPurchaseModal() {
    if (members.length === 0) {
        return alert('Voeg eerst leden toe via Admin Beheer.');
    }

    showModal('purchase-modal');
    
    const qtySelect = DOM.quantitySelect();
    qtySelect.innerHTML = Array.from({length: 21}, (_, i) => `<option value="${i}">${i}</option>`).join('');
    qtySelect.value = 0;

    const sortedPayers = [...members].map(m => ({ ...m, net: getMemberStats(m.id).net }))
                                      .sort((a, b) => a.net - b.net || a.name.localeCompare(b.name));
    
    DOM.payerSelect().innerHTML = sortedPayers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

    const sortedRecipients = [...members].sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
    DOM.recipientsList().innerHTML = sortedRecipients.map(m => `
        <button type="button" data-member-id="${m.id}" class="recipient-btn w-full flex items-center justify-between px-4 py-3 mb-2 rounded-xl text-lg font-medium bg-gray-700 text-white border-2 border-gray-700 hover:border-yellow-400 transition">
            <span>${m.name}</span>
            <span class="checkmark text-green-500 text-2xl hidden">✔</span>
        </button>
    `).join('');

    DOM.recipientsList().querySelectorAll('.recipient-btn').forEach(btn => {
        btn.onclick = () => {
            btn.classList.toggle('bg-yellow-400');
            btn.classList.toggle('text-gray-900');
            btn.classList.toggle('border-yellow-400');
            btn.querySelector('.checkmark').classList.toggle('hidden');
        };
    });
}

async function handlePurchase() {
    const payer = DOM.payerSelect().value;
    const quantity = parseInt(DOM.quantitySelect().value, 10);
    const selectedBtns = DOM.recipientsList().querySelectorAll('.recipient-btn.bg-yellow-400');
    const recipients = Array.from(selectedBtns).map(btn => btn.dataset.memberId);

    if (!payer) return alert('Selecteer wie betaalt!');
    if (recipients.length === 0) return alert('Selecteer minstens één ontvanger!');

    try {
        await addDoc(collection(db, 'transactions'), { payer, recipients, quantity, timestamp: Date.now() });
        hideModal('purchase-modal');
    } catch (error) {
        alert('Fout bij opslaan transactie.');
    }
}

async function handleLeeggoed() {
    const payer = DOM.payerSelect().value;
    const quantity = parseInt(DOM.quantitySelect().value, 10);
    const hasRecipients = DOM.recipientsList().querySelectorAll('.recipient-btn.bg-yellow-400').length > 0;

    if (quantity > 0 && !hasRecipients) {
        try {
            await addDoc(collection(db, 'transactions'), { payer, recipients: [], quantity, timestamp: Date.now(), type: 'leeggoed' });
            hideModal('purchase-modal');
        } catch {
            alert('Fout bij opslaan leeggoed.');
        }
    } else {
        alert('Enkel leeggoed mag géén geselecteerde ontvangers hebben!');
    }
}

function renderAdminPanel() {
    DOM.membersList().innerHTML = members.map(m => {
        const { net } = getMemberStats(m.id);
        return `
            <div class="flex items-center justify-between bg-gray-700 p-3 rounded-lg mb-2">
                <div>
                    <p class="font-medium">${m.name} (${m.role})</p>
                    <p class="text-sm ${net < 0 ? 'text-red-400' : 'text-green-400'}">Saldo: ${net > 0 ? '+' : ''}${net.toFixed(1)}</p>
                </div>
                <button class="text-red-400 hover:text-red-300 text-xl" onclick="window.deleteMember('${m.id}', '${m.name}')">🗑️</button>
            </div>
        `;
    }).join('');

    DOM.transactionsList().innerHTML = transactions.slice(-10).reverse().map(tx => {
        const payer = members.find(m => m.id === tx.payer);
        const payerName = payer ? payer.name : 'Onbekend';
        const date = new Date(tx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        if (tx.type === 'leeggoed') {
            return `<div class="bg-gray-700 p-2 rounded mb-1 text-xs text-blue-300">[${date}] ${payerName} leverde ${tx.quantity} losse bekers in.</div>`;
        }
        const recNames = tx.recipients.map(id => members.find(m => m.id === id)?.name || '?').join(', ');
        return `<div class="bg-gray-700 p-2 rounded mb-1 text-xs">[${date}] ${payerName} gaf rondje (${tx.quantity} bekers mee) aan: ${recNames}</div>`;
    }).join('');
}

function updateTotalPintsCounter() {
    const total = transactions.reduce((sum, tx) => sum + (tx.type !== 'leeggoed' ? tx.recipients.length : 0), 0);
    const counter = DOM.totalPintsCounter();
    if (counter) counter.innerHTML = `<span class='text-5xl'>🍺</span><span>${total} Drankjes besteld</span>`;
}

async function resetAllBalances() {
    if (!confirm('Heel de stand wissen? Dit kan niet ongedaan worden gemaakt.')) return;
    try {
        const snapshot = await getDocs(collection(db, 'transactions'));
        await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, 'transactions', d.id))));
        alert('Saldi succesvol gereset!');
    } catch (error) {
        alert('Er ging iets mis bij het resetten.');
    }
}

window.deleteMember = async (id, name) => {
    if (confirm(`Weet je zeker dat je ${name} wilt verwijderen?`)) {
        try {
            await deleteDoc(doc(db, 'members', id));
        } catch (e) { alert('Fout bij verwijderen.'); }
    }
};

function showModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id)?.classList.add('hidden'); }

// --- 6. INITIALIZATION & LISTENERS ---
async function initializeApp() {
    try {
        const firebase = await window.initializeFirebase();
        db = firebase.db;
        collection = firebase.collection;
        onSnapshot = firebase.onSnapshot;
        addDoc = firebase.addDoc;
        getDocs = firebase.getDocs;
        getDoc = firebase.getDoc;
        setDoc = firebase.setDoc;
        doc = firebase.doc;
        deleteDoc = firebase.deleteDoc;
        query = firebase.query;
        where = firebase.where;

        await ensureFestival2026Ready();
        await setupFirebaseListeners();
        setupEventListeners();
    } catch (error) {
        console.error('Initialization crash:', error);
    }
}

function setupEventListeners() {
    // Alle event listeners netjes gecentraliseerd gekoppeld (voorkomt dubbele triggers)
    document.getElementById('log-purchase-btn').addEventListener('click', openPurchaseModal);
    document.getElementById('cancel-btn').addEventListener('click', () => hideModal('purchase-modal'));
    document.getElementById('confirm-btn').addEventListener('click', handlePurchase);
    document.getElementById('extra-btn').addEventListener('click', handleLeeggoed);
    
    document.getElementById('admin-btn').addEventListener('click', () => {
        DOM.adminPasswordInput().value = '';
        showModal('admin-password-modal');
    });
    document.getElementById('admin-cancel-btn').addEventListener('click', () => hideModal('admin-password-modal'));
    document.getElementById('admin-confirm-btn').addEventListener('click', () => {
        if (DOM.adminPasswordInput().value === ADMIN_PASSWORD) {
            hideModal('admin-password-modal');
            showModal('admin-panel-modal');
            renderAdminPanel();
        } else {
            alert('Fout wachtwoord!');
        }
    });

    document.getElementById('admin-panel-close-btn').addEventListener('click', () => hideModal('admin-panel-modal'));
    document.getElementById('reset-balances-btn').addEventListener('click', resetAllBalances);
    
    document.getElementById('add-member-btn').addEventListener('click', () => {
        DOM.newMemberName().value = '';
        showModal('add-member-modal');
    });
    document.getElementById('add-member-cancel-btn').addEventListener('click', () => hideModal('add-member-modal'));
    document.getElementById('add-member-confirm-btn').addEventListener('click', async () => {
        const name = DOM.newMemberName().value.trim();
        const role = DOM.newMemberRole().value;
        if (!name) return alert('Vul een naam in');
        
        await addDoc(collection(db, 'members'), { name, role, timestamp: Date.now() });
        hideModal('add-member-modal');
    });
}

document.addEventListener('DOMContentLoaded', initializeApp);