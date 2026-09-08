(function() {
    var token = localStorage.getItem('bjml_token');
    var user = null;
    try { user = JSON.parse(localStorage.getItem('bjml_user')); } catch(e) {}

    if (!token || !user || user.role !== 'admin') {
        showToast('Admin access required. Please sign in.', 'error');
        setTimeout(function(){ location.href = 'signin.html'; }, 500);
        return;
    }

    function authHeaders() {
        return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function(c){
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

        document.querySelectorAll('.admin-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
                document.querySelectorAll('.admin-panel').forEach(function(p) { p.style.display = 'none'; });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                document.getElementById('panel-' + tab.dataset.tab).style.display = '';
            });
        });

    function loadListings() {
        fetch('/api/listings').then(function(r){ return r.json(); }).then(function(listings) {
            var el = document.getElementById('listings-list');
            if (!listings.length) { el.innerHTML = '<div class="admin-empty">No listings yet.</div>'; return; }
            el.innerHTML = listings.map(function(item) {
                return '<div class="admin-row">' +
                    '<div class="admin-row-main">' +
                        '<h4>' + escapeHtml(item.title) + '</h4>' +
                        '<p>' + escapeHtml(item.description).substring(0, 100) + '...</p>' +
                        '<div class="admin-row-meta">' + escapeHtml(item.badge) + ' &middot; ' + escapeHtml(item.meta_label) + '</div>' +
                    '</div>' +
                    '<div class="admin-row-actions">' +
                        '<button class="btn outline small" onclick="editListing(' + item.id + ')">Edit</button>' +
                        '<button class="btn danger small" onclick="deleteListing(' + item.id + ')">Delete</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        }).catch(function() {
            document.getElementById('listings-list').innerHTML = '<div class="admin-empty">Could not load listings.</div>';
        });
    }

    function loadContacts() {
        fetch('/api/admin/contacts', { headers: authHeaders() }).then(function(r){ return r.json(); }).then(function(contacts) {
            var el = document.getElementById('contacts-list');
            if (!contacts.length) { el.innerHTML = '<div class="admin-empty">No contact messages yet.</div>'; return; }
            el.innerHTML = contacts.map(function(item) {
                return '<div class="admin-row">' +
                    '<div class="admin-row-main">' +
                        '<h4>' + escapeHtml(item.name) + '</h4>' +
                        '<p>' + escapeHtml(item.message).substring(0, 120) + '</p>' +
                        '<div class="admin-row-meta">' + escapeHtml(item.email) + ' &middot; ' + item.created_at + '</div>' +
                    '</div>' +
                    '<div class="admin-row-actions">' +
                        '<button class="btn danger small" onclick="deleteContact(' + item.id + ')">Delete</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        }).catch(function() {
            document.getElementById('contacts-list').innerHTML = '<div class="admin-empty">Could not load contacts.</div>';
        });
    }

    function loadUsers() {
        fetch('/api/admin/users', { headers: authHeaders() }).then(function(r){ return r.json(); }).then(function(users) {
            var el = document.getElementById('users-list');
            if (!users.length) { el.innerHTML = '<div class="admin-empty">No users yet.</div>'; return; }
            el.innerHTML = users.map(function(item) {
                return '<div class="admin-row">' +
                    '<div class="admin-row-main">' +
                        '<h4>' + escapeHtml(item.name) + '</h4>' +
                        '<p>' + escapeHtml(item.email) + '</p>' +
                        '<div class="admin-row-meta">Role: ' + escapeHtml(item.role) + ' &middot; Joined: ' + item.created_at + '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        }).catch(function() {
            document.getElementById('users-list').innerHTML = '<div class="admin-empty">Could not load users.</div>';
        });
    }

    var modal = document.getElementById('listing-modal');
    var previousFocus = null;

    function openModal() {
        previousFocus = document.activeElement;
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        modal.querySelector('input, button').focus();
    }

    function closeModal() {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        if (previousFocus) previousFocus.focus();
    }

    document.getElementById('add-listing-btn').addEventListener('click', function() {
        document.getElementById('modal-title').textContent = 'Add New Listing';
        document.getElementById('listing-form').reset();
        document.getElementById('listing-id').value = '';
        openModal();
    });
    document.getElementById('cancel-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') closeModal();
    });

    document.getElementById('listing-form').addEventListener('submit', function(e) {
        e.preventDefault();
        var id = document.getElementById('listing-id').value;
        var data = {
            title: document.getElementById('listing-title').value.trim(),
            description: document.getElementById('listing-desc').value.trim(),
            badge: document.getElementById('listing-badge').value.trim(),
            meta_label: document.getElementById('listing-meta-label').value.trim(),
            meta_value: document.getElementById('listing-meta-value').value.trim(),
            image_url: document.getElementById('listing-image').value.trim()
        };
        var url = id ? '/api/listings/' + id : '/api/listings';
        var method = id ? 'PUT' : 'POST';
        fetch(url, { method: method, headers: authHeaders(), body: JSON.stringify(data) })
        .then(function(r){ return r.json(); })
        .then(function(result) {
            if (!result.error) { closeModal(); showToast(id ? 'Listing updated.' : 'Listing created.', 'success'); loadListings(); }
            else { showToast(result.error, 'error'); }
        })
        .catch(function(){ showToast('Error saving listing.', 'error'); });
    });

    window.editListing = function(id) {
        fetch('/api/listings').then(function(r){ return r.json(); }).then(function(listings) {
            var item = listings.find(function(l){ return l.id === id; });
            if (!item) return;
            document.getElementById('modal-title').textContent = 'Edit Listing';
            document.getElementById('listing-id').value = item.id;
            document.getElementById('listing-title').value = item.title;
            document.getElementById('listing-desc').value = item.description;
            document.getElementById('listing-badge').value = item.badge;
            document.getElementById('listing-meta-label').value = item.meta_label;
            document.getElementById('listing-meta-value').value = item.meta_value;
            document.getElementById('listing-image').value = item.image_url;
            openModal();
        });
    };

    window.deleteListing = function(id) {
        if (!confirm('Delete this listing?')) return;
        fetch('/api/listings/' + id, { method: 'DELETE', headers: authHeaders() })
        .then(function(r){ return r.json(); })
        .then(function(){ showToast('Listing deleted.', 'success'); loadListings(); })
        .catch(function(){ showToast('Error deleting listing.', 'error'); });
    };

    window.deleteContact = function(id) {
        if (!confirm('Delete this contact message?')) return;
        fetch('/api/admin/contacts/' + id, { method: 'DELETE', headers: authHeaders() })
        .then(function(r){ return r.json(); })
        .then(function(){ showToast('Contact deleted.', 'success'); loadContacts(); })
        .catch(function(){ showToast('Error deleting contact.', 'error'); });
    };

    loadListings();
    loadContacts();
    loadUsers();
})();
