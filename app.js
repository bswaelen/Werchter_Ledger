// --- 1. INITIAL DATA ---
const initialMembers = [
    { id: '1', name: 'You (Sarah)', role: 'Core' },
    { id: '2', name: 'Thomas', role: 'Core' },
    { id: '3', name: 'Elise', role: 'Core' },
    { id: '4', name: 'Mike', role: 'Core' },
    { id: '5', name: 'Chloe (Guest)', role: 'Guest' },
    { id: '6', name: 'David (1-Day)', role: '1-Day' }
];

let transactions = [];
let members = [...initialMembers];
const currentUserId = '1';

// Admin password (in a real app, this would be stored securely)
const ADMIN_PASSWORD = 'werchter2025';

// --- 2. FIREBASE INTEGRATION ---
let db, collection, onSnapshot, addDoc, deleteDoc, doc;

async function initializeApp() {
    try {
        const firebase = await window.initializeFirebase();
        db = firebase.db;
        collection = firebase.collection;
        onSnapshot = firebase.onSnapshot;
        addDoc = firebase.addDoc;
        deleteDoc = firebase.deleteDoc;
        doc = firebase.doc;

        const transactionsCol = collection(db, 'groups/werchter25/transactions');
        const membersCol = collection(db, 'groups/werchter25/members');

        // Listen for realtime updates
        onSnapshot(transactionsCol, (snapshot) => {
            transactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderMemberBoard();
            if (document.getElementById('admin-panel-modal').classList.contains('hidden') === false) {
                renderAdminPanel();
            }
        });

        // Listen for member updates
        onSnapshot(membersCol, (snapshot) => {
            members = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderMemberBoard();
            if (document.getElementById('admin-panel-modal').classList.contains('hidden') === false) {
                renderAdminPanel();
            }
        });

        // Initial render
        renderMemberBoard();
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        alert("Er is een fout opgetreden bij het verbinden met de database. Ververs de pagina en probeer het opnieuw.");
    }
}

// Save new transactions
async function saveTransactionToFirebase(tx) {
    try {
        const transactionsCol = collection(db, 'groups/werchter25/transactions');
        await addDoc(transactionsCol, tx);
        console.log("Transaction saved!");
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("Er is een fout opgetreden bij het opslaan van de transactie. Probeer het opnieuw.");
    }
}

// Save new member
async function saveMemberToFirebase(member) {
    try {
        const membersCol = collection(db, 'groups/werchter25/members');
        await addDoc(membersCol, member);
        console.log("Member saved!");
    } catch (e) {
        console.error("Error adding member: ", e);
        alert("Er is een fout opgetreden bij het toevoegen van het lid. Probeer het opnieuw.");
    }
}

// Delete member
async function deleteMemberFromFirebase(memberId) {
    try {
        const memberDoc = doc(db, 'groups/werchter25/members', memberId);
        await deleteDoc(memberDoc);
        console.log("Member deleted!");
    } catch (e) {
        console.error("Error deleting member: ", e);
        alert("Er is een fout opgetreden bij het verwijderen van het lid. Probeer het opnieuw.");
    }
}

// Settle member's account
async function settleMemberAccount(memberId) {
    try {
        const transactionsCol = collection(db, 'groups/werchter25/transactions');
        const memberTransactions = transactions.filter(tx => 
            tx.payerId === memberId || tx.recipients.includes(memberId)
        );

        // Delete all transactions for this member
        for (const tx of memberTransactions) {
            const txDoc = doc(db, 'groups/werchter25/transactions', tx.id);
            await deleteDoc(txDoc);
        }

        // Delete the member
        await deleteMemberFromFirebase(memberId);
        
        console.log("Account settled!");
    } catch (e) {
        console.error("Error settling account: ", e);
        alert("Er is een fout opgetreden bij het vereffenen van de rekening. Probeer het opnieuw.");
    }
}

// --- 3. CORE LOGIC ---
function calculateStatus() {
    const stats = members.map(member => ({ id: member.id, name: member.name, role: member.role, bought: 0, received: 0 }));

    transactions.forEach(tx => {
        // Increment bought count for the payer
        const payerStat = stats.find(s => s.id === tx.payerId);
        if (payerStat) {
            // Only count drinks bought for others, not for self
            const recipientsExcludingSelf = tx.recipients.filter(id => id !== tx.payerId);
            payerStat.bought += recipientsExcludingSelf.length * tx.quantity;
        }

        // Increment received count for each recipient
        tx.recipients.forEach(recipientId => {
            const recipientStat = stats.find(s => s.id === recipientId);
            if (recipientStat) {
                recipientStat.received += tx.quantity;
            }
        });
    });

    const memberStatus = stats.map(stat => {
        const net = stat.bought - stat.received;
        let status;
        if (net > 0) status = 'Giver';
        else if (net < 0) status = 'Receiver';
        else status = 'Balanced';
        
        return { ...stat, net, status };
    });

    return memberStatus;
}

// --- 4. RENDERING / UI UPDATES ---
function renderMemberBoard() {
    const board = document.getElementById('member-board');
    const memberStatus = calculateStatus();
    
    // Separate Core members and Guests
    const coreMembers = memberStatus.filter(m => m.role === 'Core');
    const guestMembers = memberStatus.filter(m => m.role === 'Guest');

    // Sort Core members: Receivers first, then Balanced, then Givers
    coreMembers.sort((a, b) => a.net - b.net);

    board.innerHTML = ''; // Clear the board before rendering

    // Render Core Members
    coreMembers.forEach(member => {
        board.appendChild(createMemberCard(member));
    });
    
    // Render Guests header if any exist
    if(guestMembers.length > 0) {
        const guestHeader = document.createElement('h4');
        guestHeader.className = "text-gray-500 font-bold pt-4 pb-2 text-sm uppercase tracking-wider";
        guestHeader.textContent = "Guests";
        board.appendChild(guestHeader);
    }

    // Render Guests (unsorted)
    guestMembers.forEach(guest => {
        board.appendChild(createMemberCard(guest, true));
    });
}

function createMemberCard(member, isGuest = false) {
    const card = document.createElement('div');
    const statusIndicator = {
        Giver: 'bg-green-500',
        Receiver: 'bg-red-500',
        Balanced: 'bg-gray-500'
    };
    const statusText = {
        Giver: `Generous Soul (+${member.net})`,
        Receiver: `Owes a round (${member.net})`,
        Balanced: 'All square'
    };
    
    const shadowColor = statusIndicator[member.status].replace('bg-', 'shadow-');

    card.className = `p-4 rounded-xl flex items-center justify-between transition-all bg-gray-800 shadow-md ${isGuest ? 'opacity-60' : ''}`;
    
    card.innerHTML = `
        <div class="flex items-center space-x-4">
            <div class="w-3 h-3 rounded-full ${statusIndicator[member.status]}"></div>
            <div>
                <p class="font-bold text-lg">${member.name}</p>
                <p class="text-sm text-gray-400">${isGuest ? 'Guest Member' : statusText[member.status]}</p>
            </div>
        </div>
        <div class="text-right">
            <p class="font-mono text-sm">💸 ${member.bought}</p>
            <p class="font-mono text-sm">🍺 ${member.received}</p>
        </div>
    `;
    return card;
}

function populateModal() {
    const payerSelect = document.getElementById('payer');
    const recipientsList = document.getElementById('recipients-list');
    
    payerSelect.innerHTML = '';
    recipientsList.innerHTML = '';

    members.forEach(member => {
        // Populate payer dropdown
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        if (member.id === currentUserId) {
            option.selected = true;
        }
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
    document.getElementById('log-purchase-btn').addEventListener('click', () => {
        populateModal();
        toggleModal();
    });
    
    document.getElementById('admin-btn').addEventListener('click', toggleAdminPasswordModal);
    document.getElementById('admin-cancel-btn').addEventListener('click', toggleAdminPasswordModal);
    document.getElementById('admin-confirm-btn').addEventListener('click', handleAdminPassword);
    document.getElementById('admin-panel-close-btn').addEventListener('click', toggleAdminPanel);
    document.getElementById('add-member-btn').addEventListener('click', toggleAddMemberModal);
    document.getElementById('add-member-cancel-btn').addEventListener('click', toggleAddMemberModal);
    document.getElementById('add-member-confirm-btn').addEventListener('click', handleAddMember);
    document.getElementById('settle-account-cancel-btn').addEventListener('click', () => toggleSettleAccountModal());
    document.getElementById('settle-account-confirm-btn').addEventListener('click', handleSettleAccount);
    document.getElementById('cancel-btn').addEventListener('click', toggleModal);
    document.getElementById('confirm-btn').addEventListener('click', handlePurchase);
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
    addMemberModal.classList.toggle('hidden');
    if (addMemberModal.classList.contains('hidden')) {
        newMemberNameInput.value = '';
        newMemberRoleSelect.value = 'Core';
    }
}

function toggleSettleAccountModal(memberId = null) {
    const settleAccountModal = document.getElementById('settle-account-modal');
    let currentSettleMemberId = null;

    if (memberId) {
        const member = members.find(m => m.id === memberId);
        const status = calculateStatus().find(s => s.id === memberId);
        document.getElementById('settle-member-name').textContent = member.name;
        document.getElementById('settle-member-balance').textContent = `Current balance: ${status.net}`;
        currentSettleMemberId = memberId;
    }
    settleAccountModal.classList.toggle('hidden');
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

function handleAddMember() {
    const newMemberNameInput = document.getElementById('new-member-name');
    const newMemberRoleSelect = document.getElementById('new-member-role');
    const name = newMemberNameInput.value.trim();
    const role = newMemberRoleSelect.value;

    if (!name) {
        alert("Please enter a name for the new member.");
        return;
    }

    const newMember = {
        name,
        role,
        timestamp: Date.now()
    };

    try {
        saveMemberToFirebase(newMember);
        toggleAddMemberModal();
    } catch (error) {
        console.error("Error adding member:", error);
        alert("Er is een fout opgetreden bij het toevoegen van het lid. Probeer het opnieuw.");
    }
}

function handleSettleAccount() {
    if (currentSettleMemberId) {
        try {
            settleMemberAccount(currentSettleMemberId);
            toggleSettleAccountModal();
        } catch (error) {
            console.error("Error settling account:", error);
            alert("Er is een fout opgetreden bij het vereffenen van de rekening. Probeer het opnieuw.");
        }
    }
}

function handlePurchase() {
    const payerId = document.getElementById('payer').value;
    const quantity = parseInt(document.getElementById('quantity').value, 10);
    const recipientCheckboxes = document.querySelectorAll('input[name="recipients"]:checked');
    
    const recipients = Array.from(recipientCheckboxes).map(cb => cb.value);

    if (recipients.length === 0 || !quantity || !payerId) {
        alert("Please select who paid, how many drinks, and at least one recipient.");
        return;
    }

    const newTransaction = {
        payerId,
        recipients,
        quantity,
        timestamp: Date.now()
    };

    try {
        saveTransactionToFirebase(newTransaction);
        toggleModal();
    } catch (error) {
        console.error("Error saving transaction:", error);
        alert("Er is een fout opgetreden bij het opslaan van de transactie. Probeer het opnieuw.");
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