// --- 1. INITIAL DATA ---
const initialMembers = [
    { id: '1', name: 'Sarah', role: 'Core' },
    { id: '2', name: 'Thomas', role: 'Core' },
    { id: '3', name: 'Elise', role: 'Core' },
    { id: '4', name: 'Mike', role: 'Core' },
    { id: '5', name: 'Chloe (Guest)', role: 'Guest' },
    { id: '6', name: 'David (1-Day)', role: '1-Day' }
];

let transactions = [];
let members = [...initialMembers];

// Admin password (in a real app, this would be stored securely)
const ADMIN_PASSWORD = 'werchter2025';

// --- 1. STATE MANAGEMENT ---
let db, collection, onSnapshot, addDoc, getDocs, doc, deleteDoc, query, where, updateDoc;

// --- 2. FIREBASE INTEGRATION ---
async function setupFirebaseListeners() {
    try {
        // Listen for members changes
        const membersRef = collection(db, 'members');
        onSnapshot(membersRef, (snapshot) => {
            // Clear the members array before updating
            members = [];
            // Add each member only once
            snapshot.docs.forEach(doc => {
                members.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            console.log("Members updated from Firebase:", members);
            renderMemberBoard();
            if (!document.getElementById('admin-panel-modal').classList.contains('hidden')) {
                renderAdminMembersList();
            }
            updateTotalPintsCounter();
        });

        // Listen for transactions changes
        const transactionsRef = collection(db, 'transactions');
        onSnapshot(transactionsRef, (snapshot) => {
            // Clear the transactions array before updating
            transactions = [];
            // Add each transaction only once
            snapshot.docs.forEach(doc => {
                transactions.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            console.log("Transactions updated:", transactions);
            renderMemberBoard();
            updateTotalPintsCounter();
        });

        // Check if we need to add initial members
        const membersSnapshot = await getDocs(membersRef);
        if (membersSnapshot.empty) {
            console.log("No members found, adding initial members...");
            for (const member of initialMembers) {
                await saveMemberToFirebase(member);
            }
        }
    } catch (error) {
        console.error("Error setting up Firebase listeners:", error);
    }
}

// --- 3. CORE LOGIC ---
function calculateStatus(memberId) {
    let bought = 0;
    let received = 0;
    let totalCups = 0;

    transactions.forEach(transaction => {
        // Alleen drinks gekocht voor anderen tellen mee (1 per ontvanger)
        if (transaction.payer === memberId) {
            bought += transaction.recipients.filter(r => r !== memberId).length;
            totalCups += transaction.quantity; // quantity alleen voor coins
        }
        // Alleen drinks ontvangen van anderen tellen mee (1 per transactie)
        if (transaction.recipients.includes(memberId) && transaction.payer !== memberId) {
            received += 1;
        }
    });

    const coins = totalCups * 0.2;
    const net = bought - received - coins;
    let status;
    if (net > 0) status = 'Giver';
    else if (net < 0) status = 'Receiver';
    else status = 'Balanced';

    return { bought, received, net, status, coins };
}

// --- 4. RENDERING / UI UPDATES ---
function renderMemberBoard() {
    const board = document.getElementById('member-board');
    board.innerHTML = '';

    // Filter op unieke namen (laatste entry blijft)
    const uniqueMembersMap = new Map();
    members.forEach(member => {
        uniqueMembersMap.set(member.name, member);
    });
    const uniqueMembers = Array.from(uniqueMembersMap.values());

    // Voeg saldo toe aan elk lid
    const membersWithNet = uniqueMembers.map(member => {
        const status = calculateStatus(member.id);
        return { ...member, net: status.net };
    });

    // Sorteer core members en guests apart op saldo (hoogste eerst)
    const coreMembers = membersWithNet.filter(m => m.role === 'Core').sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));
    const guests = membersWithNet.filter(m => m.role === 'Guest').sort((a, b) => b.net - a.net || a.name.localeCompare(b.name));

    // Render each group with a header
    if (coreMembers.length > 0) {
        board.innerHTML += '<h2 class="text-xl font-bold text-yellow-400 mb-2">Core Members</h2>';
        coreMembers.forEach(member => {
            board.appendChild(createMemberCard(member));
        });
    }

    if (guests.length > 0) {
        board.innerHTML += '<h2 class="text-xl font-bold text-yellow-400 mb-2 mt-4">Guests</h2>';
        guests.forEach(member => {
            board.appendChild(createMemberCard(member));
        });
    }
}

function createMemberCard(member) {
    const card = document.createElement('div');
    const status = calculateStatus(member.id);
    
    const statusEmoji = {
        Giver: '🎉',
        Receiver: '🛑',
        Balanced: '⚖️'
    };
    const statusText = {
        Giver: `Gulle gever (${status.net.toFixed(1)})`,
        Receiver: `Ontvanger (${status.net.toFixed(1)})`,
        Balanced: 'Perfect in balans (0)'
    };

    card.className = 'bg-gray-800 rounded-xl p-4 shadow-lg';
    
    card.innerHTML = `
        <div class="flex justify-between items-center">
            <div class="flex items-center space-x-4">
                <span class="text-2xl">${statusEmoji[status.status]}</span>
                <div>
                    <h3 class="text-lg font-semibold">${member.name}</h3>
                    <p class="text-sm text-gray-400">${statusText[status.status]}</p>
                </div>
            </div>
            <div class="text-right">
                <div class="text-sm flex items-center space-x-2">
                    <span class="text-green-400">💸 ${status.bought}</span>
                    <span class="text-yellow-400 flex items-center"><span class="text-xl">🥤</span> ${(status.coins).toFixed(1)} coins</span>
                    <span class="text-red-400 ml-2">🍺 ${status.received}</span>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

function populateModal() {
    const payerSelect = document.getElementById('payer');
    const recipientsList = document.getElementById('recipients-list');
    
    payerSelect.innerHTML = '';
    recipientsList.innerHTML = '';

    // Calculate status for sorting
    const memberStatus = calculateStatus();
    
    // Sort members by net value (who owes the most first)
    const sortedMembers = [...members].sort((a, b) => {
        const aStatus = memberStatus.find(s => s.id === a.id);
        const bStatus = memberStatus.find(s => s.id === b.id);
        return (aStatus?.net || 0) - (bStatus?.net || 0);
    });

    sortedMembers.forEach(member => {
        // Populate payer dropdown
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        payerSelect.appendChild(option);

        // Populate recipients checklist
        const div = document.createElement('div');
        div.className = "flex items-center bg-gray-800 p-3 rounded-lg";
        div.innerHTML = `
            <input id="user-${member.id}" name="recipients" type="checkbox" value="${member.id}" class="h-5 w-5 rounded bg-gray-600 border-gray-500 text-yellow-400 focus:ring-yellow-500">
            <label for="user-${member.id}" class="ml-3 block text-md font-medium text-white">${member.name}</label>
        `;
        recipientsList.appendChild(div);
    });
    recipientsList.scrollTop = 0;
}

// --- 5. ADMIN FUNCTIONS ---
function renderAdminPanel() {
    const membersList = document.getElementById('members-list');
    const transactionsList = document.getElementById('transactions-list');
    
    // Render members
    membersList.innerHTML = members.map(member => {
        const status = calculateStatus().find(s => s.id === member.id);
        const isVisitor = member.role.includes('Day');
        
        return `
            <div class="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                <div>
                    <p class="font-medium">${member.name}</p>
                    <p class="text-sm text-gray-400">${member.role}</p>
                    ${status ? `<p class="text-sm ${status.net < 0 ? 'text-red-400' : 'text-green-400'}">Balance: ${status.net}</p>` : ''}
                </div>
                <div class="flex space-x-2">
                    ${isVisitor ? `
                        <button class="text-yellow-400 hover:text-yellow-300" onclick="showSettleAccountModal('${member.id}')">
                            Settle
                        </button>
                    ` : ''}
                    <button class="text-red-400 hover:text-red-300" onclick="deleteMember('${member.id}')">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Render transactions
    transactionsList.innerHTML = transactions.map(tx => {
        const payer = members.find(m => m.id === tx.payerId);
        const recipients = tx.recipients.map(id => members.find(m => m.id === id).name).join(', ');
        const date = new Date(tx.timestamp).toLocaleString();
        
        return `
            <div class="bg-gray-700 p-3 rounded-lg">
                <p class="font-medium">${payer.name} bought ${tx.quantity} drinks for:</p>
                <p class="text-sm text-gray-400">${recipients}</p>
                <p class="text-xs text-gray-500">${date}</p>
            </div>
        `;
    }).join('');
}

// --- 6. EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    // Add event listeners
    document.getElementById('log-purchase-btn').addEventListener('click', openPurchaseModal);
    
    document.getElementById('cancel-btn').addEventListener('click', () => {
        hideModal('purchase-modal');
    });

    document.getElementById('confirm-btn').addEventListener('click', handlePurchase);

    // Admin Panel Event Listeners
    document.getElementById('admin-btn').addEventListener('click', () => {
        showModal('admin-password-modal');
    });

    document.getElementById('admin-cancel-btn').addEventListener('click', () => {
        hideModal('admin-password-modal');
    });

    document.getElementById('admin-confirm-btn').addEventListener('click', handleAdminAccess);

    document.getElementById('admin-panel-close-btn').addEventListener('click', () => {
        hideModal('admin-panel-modal');
    });

    document.getElementById('add-member-btn').addEventListener('click', () => {
        showModal('add-member-modal');
        clearAddMemberForm();
    });

    document.getElementById('add-member-cancel-btn').addEventListener('click', () => {
        hideModal('add-member-modal');
    });

    document.getElementById('add-member-confirm-btn').addEventListener('click', handleAddMember);

    const resetBtn = document.getElementById('reset-balances-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetAllBalances);
    }
});

function toggleModal() {
    const modal = document.getElementById('purchase-modal');
    if(modal.classList.contains('hidden')) {
        populateModal();
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function toggleAdminPasswordModal() {
    const adminPasswordModal = document.getElementById('admin-password-modal');
    const adminPasswordInput = document.getElementById('admin-password');
    adminPasswordModal.classList.toggle('hidden');
    adminPasswordInput.value = '';
}

function toggleAdminPanel() {
    const adminPanelModal = document.getElementById('admin-panel-modal');
    adminPanelModal.classList.toggle('hidden');
    if (!adminPanelModal.classList.contains('hidden')) {
        renderAdminPanel();
    }
}

function toggleAddMemberModal() {
    const addMemberModal = document.getElementById('add-member-modal');
    const newMemberNameInput = document.getElementById('new-member-name');
    const newMemberRoleSelect = document.getElementById('new-member-role');
    
    if (addMemberModal.classList.contains('hidden')) {
        // Clear the form when opening
        newMemberNameInput.value = '';
        newMemberRoleSelect.value = 'Core';
    }
    
    addMemberModal.classList.toggle('hidden');
}

function toggleSettleAccountModal(memberId = null) {
    const settleAccountModal = document.getElementById('settle-account-modal');
    const settleMemberName = document.getElementById('settle-member-name');
    const settleMemberBalance = document.getElementById('settle-member-balance');
    
    if (memberId) {
        const member = members.find(m => m.id === memberId);
        const memberStatus = calculateStatus().find(s => s.id === memberId);
        
        if (member && memberStatus) {
            settleMemberName.textContent = member.name;
            settleMemberBalance.textContent = `Net: ${memberStatus.net} (Bought: ${memberStatus.bought}, Received: ${memberStatus.received})`;
            settleAccountModal.classList.remove('hidden');
        }
    } else {
        settleAccountModal.classList.add('hidden');
    }
}

function handleAdminPassword() {
    const adminPasswordInput = document.getElementById('admin-password');
    if (adminPasswordInput.value === ADMIN_PASSWORD) {
        toggleAdminPasswordModal();
        toggleAdminPanel();
    } else {
        alert('Incorrect password');
    }
}

// Save new member
async function saveMemberToFirebase(member) {
    try {
        console.log("Saving new member:", member);
        const membersRef = collection(db, 'members');
        const docRef = await addDoc(membersRef, {
            name: member.name,
            role: member.role,
            timestamp: Date.now()
        });
        console.log("Member saved successfully with ID:", docRef.id);
        return true;
    } catch (e) {
        console.error("Error adding member:", e);
        throw e;
    }
}

// Handle adding a new member
async function handleAddMember() {
    const name = document.getElementById('new-member-name').value.trim();
    const role = document.getElementById('new-member-role').value;

    if (!name) {
        alert('Vul een naam in');
        return;
    }

    try {
        const newMember = {
            name: name,
            role: role
        };

        await saveMemberToFirebase(newMember);
        hideModal('add-member-modal');
        clearAddMemberForm();
    } catch (error) {
        console.error('Error adding member:', error);
        alert('Er is een fout opgetreden bij het toevoegen van het lid.');
    }
}

async function handlePurchase() {
    const payerSelect = document.getElementById('payer');
    const payer = payerSelect ? payerSelect.value : '';
    const quantityInput = document.getElementById('quantity');
    const quantity = quantityInput ? parseInt(quantityInput.value, 10) : 1;
    const recipientsList = document.getElementById('recipients-list');
    const selectedBtns = recipientsList ? recipientsList.querySelectorAll('.recipient-btn.bg-yellow-400') : [];
    const recipients = Array.from(selectedBtns).map(btn => btn.dataset.memberId);

    if (!payer) {
        alert('Selecteer wie betaalt!');
        return;
    }
    if (recipients.length === 0) {
        alert('Selecteer minstens één ontvanger!');
        return;
    }

    try {
        const newTransaction = {
            payer,
            recipients,
            quantity,
            timestamp: Date.now()
        };
        await saveTransactionToFirebase(newTransaction);
        hideModal('purchase-modal');
    } catch (error) {
        console.error('Error saving transaction:', error);
        alert('Er is een fout opgetreden bij het opslaan van de transactie.');
    }
}

// Make functions available globally
window.deleteMember = async (memberId) => {
    if (confirm('Are you sure you want to delete this member?')) {
        try {
            await deleteMemberFromFirebase(memberId);
        } catch (error) {
            console.error("Error deleting member:", error);
            alert("Er is een fout opgetreden bij het verwijderen van het lid. Probeer het opnieuw.");
        }
    }
};

window.showSettleAccountModal = (memberId) => {
    toggleSettleAccountModal(memberId);
};

// Render members in admin panel
function renderAdminMembersList() {
    const membersList = document.getElementById('members-list');
    membersList.innerHTML = '';

    // Sort members by role and then by name
    const sortedMembers = [...members].sort((a, b) => {
        if (a.role !== b.role) {
            return a.role.localeCompare(b.role);
        }
        return a.name.localeCompare(b.name);
    });

    sortedMembers.forEach(member => {
        const memberElement = document.createElement('div');
        memberElement.className = 'flex items-center justify-between p-2 bg-gray-700 rounded-lg';
        
        const memberInfo = document.createElement('div');
        memberInfo.className = 'flex-1';
        memberInfo.innerHTML = `
            <div class="font-medium">${member.name}</div>
            <div class="text-sm text-gray-400">${member.role}</div>
        `;
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'ml-2 text-red-400 hover:text-red-300 transition-colors';
        deleteButton.innerHTML = '🗑️';
        deleteButton.title = 'Delete Member';
        deleteButton.onclick = async () => {
            if (confirm(`Weet je zeker dat je ${member.name} wilt verwijderen?`)) {
                try {
                    // Delete member from Firebase
                    const memberRef = doc(db, 'members', member.id);
                    await deleteDoc(memberRef);
                    
                    // Delete all transactions involving this member
                    const transactionsRef = collection(db, 'transactions');
                    const q = query(transactionsRef, 
                        where('payer', '==', member.id)
                    );
                    const querySnapshot = await getDocs(q);
                    
                    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
                    await Promise.all(deletePromises);
                    
                    // Update local state
                    members = members.filter(m => m.id !== member.id);
                    renderMemberBoard();
                    renderAdminMembersList();
                    
                    console.log('Member deleted successfully');
                } catch (error) {
                    console.error('Error deleting member:', error);
                    alert('Er is een fout opgetreden bij het verwijderen van het lid.');
                }
            }
        };
        
        memberElement.appendChild(memberInfo);
        memberElement.appendChild(deleteButton);
        membersList.appendChild(memberElement);
    });
}

// Modal functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Admin functions
async function handleAdminAccess() {
    const password = document.getElementById('admin-password').value;
    if (password === 'werchter2025') {
        hideModal('admin-password-modal');
        showModal('admin-panel-modal');
        renderAdminMembersList();
    } else {
        alert('Incorrect wachtwoord');
    }
}

function clearAddMemberForm() {
    document.getElementById('new-member-name').value = '';
    document.getElementById('new-member-role').value = 'Core';
}

// Populate the payer dropdown
function populatePayerDropdown() {
    const payerSelect = document.getElementById('payer');
    payerSelect.innerHTML = '';

    // Sorteer leden op saldo (meest negatief eerst), daarna op naam
    const membersWithNet = members.map(member => {
        const status = calculateStatus(member.id);
        return { ...member, net: status.net };
    });
    membersWithNet.sort((a, b) => {
        if (a.net !== b.net) return a.net - b.net; // meest negatief eerst
        return a.name.localeCompare(b.name);
    });

    membersWithNet.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        payerSelect.appendChild(option);
    });
}

// Populate the recipients list
function populateRecipientsList() {
    const recipientsList = document.getElementById('recipients-list');
    recipientsList.innerHTML = '';

    // Sorteer leden op rol en naam
    const sortedMembers = [...members].sort((a, b) => {
        if (a.role !== b.role) {
            return a.role.localeCompare(b.role);
        }
        return a.name.localeCompare(b.name);
    });

    sortedMembers.forEach(member => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'recipient-btn w-full flex items-center justify-between px-4 py-3 mb-2 rounded-xl text-lg font-medium bg-gray-700 text-white border-2 border-gray-700 hover:border-yellow-400 focus:outline-none transition';
        btn.dataset.memberId = member.id;
        btn.innerHTML = `<span>${member.name}</span><span class='checkmark text-green-500 text-2xl hidden'>✔</span>`;
        btn.onclick = function() {
            btn.classList.toggle('bg-yellow-400');
            btn.classList.toggle('text-gray-900');
            btn.classList.toggle('border-yellow-400');
            const checkmark = btn.querySelector('.checkmark');
            if (btn.classList.contains('bg-yellow-400')) {
                checkmark.classList.remove('hidden');
            } else {
                checkmark.classList.add('hidden');
            }
        };
        recipientsList.appendChild(btn);
    });
    recipientsList.scrollTop = 0;
}

// Voeg saveTransactionToFirebase toe
async function saveTransactionToFirebase(transaction) {
    try {
        const transactionsRef = collection(db, 'transactions');
        await addDoc(transactionsRef, transaction);
        console.log('Transactie succesvol opgeslagen:', transaction);
    } catch (error) {
        console.error('Fout bij opslaan transactie:', error);
        throw error;
    }
}

// Migratie: Zet alle dagbezoekers om naar 'Guest'
async function migrateDayVisitorsToGuests() {
    try {
        const membersRef = collection(db, 'members');
        const snapshot = await getDocs(membersRef);
        for (const docSnap of snapshot.docs) {
            const member = docSnap.data();
            if (member.role && (member.role.includes('Day') || member.role.match(/\d-Day/))) {
                await updateMemberRole(docSnap.id, 'Guest');
                console.log(`Lid ${member.name} omgezet naar Guest`);
            }
        }
    } catch (error) {
        console.error('Fout bij migratie dagbezoekers:', error);
    }
}

async function updateMemberRole(memberId, newRole) {
    const memberRef = doc(db, 'members', memberId);
    await updateDoc(memberRef, { role: newRole });
}

// Initialize the app
async function initializeApp() {
    try {
        const firebase = await window.initializeFirebase();
        db = firebase.db;
        collection = firebase.collection;
        onSnapshot = firebase.onSnapshot;
        addDoc = firebase.addDoc;
        getDocs = firebase.getDocs;
        doc = firebase.doc;
        deleteDoc = firebase.deleteDoc;
        query = firebase.query;
        where = firebase.where;
        updateDoc = firebase.updateDoc;

        // Set up real-time listeners
        await setupFirebaseListeners();
        
        // Add event listeners
        document.getElementById('log-purchase-btn').addEventListener('click', openPurchaseModal);

        document.getElementById('admin-btn').addEventListener('click', () => {
            showModal('admin-password-modal');
        });

        document.getElementById('admin-cancel-btn').addEventListener('click', () => {
            hideModal('admin-password-modal');
        });

        document.getElementById('admin-confirm-btn').addEventListener('click', handleAdminAccess);

        document.getElementById('admin-panel-close-btn').addEventListener('click', () => {
            hideModal('admin-panel-modal');
        });

        document.getElementById('add-member-btn').addEventListener('click', () => {
            showModal('add-member-modal');
            clearAddMemberForm();
        });

        document.getElementById('add-member-cancel-btn').addEventListener('click', () => {
            hideModal('add-member-modal');
        });

        document.getElementById('add-member-confirm-btn').addEventListener('click', handleAddMember);

        document.getElementById('cancel-btn').addEventListener('click', () => {
            hideModal('purchase-modal');
        });

        document.getElementById('confirm-btn').addEventListener('click', handlePurchase);

    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Start the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    await migrateDayVisitorsToGuests();
});

// Open purchase modal: reset aantal per persoon en populate lists
function openPurchaseModal() {
    showModal('purchase-modal');
    const quantitySelect = document.getElementById('quantity');
    quantitySelect.innerHTML = '';
    for (let i = 0; i <= 20; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        quantitySelect.appendChild(option);
    }
    quantitySelect.value = 0;
    populatePayerDropdown();
    populateRecipientsList();
}

// Pas de pinten counter aan: alleen aantal ontvangers per transactie telt
function updateTotalPintsCounter() {
    let total = 0;
    transactions.forEach(tx => {
        total += tx.recipients.length;
    });
    const counterDiv = document.getElementById('total-pints-counter');
    if (counterDiv) {
        counterDiv.innerHTML = `<span class='text-5xl'>🍺</span><span>${total}</span>`;
    }
}

// Reset alle transacties (en dus alle saldi en de counter)
async function resetAllBalances() {
    if (!confirm('Weet je zeker dat je alle transacties wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
    try {
        const transactionsRef = collection(db, 'transactions');
        const snapshot = await getDocs(transactionsRef);
        const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, 'transactions', docSnap.id)));
        await Promise.all(deletePromises);
        alert('Alle transacties zijn verwijderd. Iedereen staat weer op 0.');
    } catch (error) {
        console.error('Fout bij resetten transacties:', error);
        alert('Er is iets misgegaan bij het resetten. Probeer opnieuw.');
    }
}