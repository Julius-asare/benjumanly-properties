document.getElementById('signup-form').addEventListener('submit', function(e){
    e.preventDefault();
    var name = document.getElementById('name').value.trim();
    var email = document.getElementById('email').value.trim();
    var pw = document.getElementById('password').value;
    var confirm = document.getElementById('confirm').value;
    var terms = document.getElementById('terms').checked;
    if(!name || !email || !pw || !confirm){ showToast('Please complete all fields.', 'error'); return; }
    if(pw !== confirm){ showToast('Passwords do not match.', 'error'); return; }
    if(pw.length < 8){ showToast('Password must be at least 8 characters.', 'error'); return; }
    if(!terms){ showToast('Please accept the terms.', 'error'); return; }

    var submitBtn = this.querySelector('button[type="submit"]');
    var originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, password: pw })
    })
    .then(function(res){ return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
    .then(function(result){
        if(!result.ok){ showToast(result.data.error || 'Could not create account.', 'error'); submitBtn.disabled = false; submitBtn.textContent = originalText; return; }
        localStorage.setItem('bjml_token', result.data.token);
        localStorage.setItem('bjml_user', JSON.stringify(result.data.user));
        showToast('Account created — welcome, ' + result.data.user.name + '.', 'success');
        setTimeout(function(){ location.href = result.data.user.role === 'admin' ? 'admin.html' : '../index.html'; }, 600);
    })
    .catch(function(){ showToast('Could not reach the server. Please try again.', 'error'); submitBtn.disabled = false; submitBtn.textContent = originalText; });
});
