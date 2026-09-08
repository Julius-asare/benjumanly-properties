document.getElementById('signin-form').addEventListener('submit', function(e){
    e.preventDefault();
    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;
    if(!email || !password){ showToast('Please fill in both fields.', 'error'); return; }

    var submitBtn = this.querySelector('button[type="submit"]');
    var originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
    })
    .then(function(res){ return res.json().then(function(data){ return { ok: res.ok, data: data }; }); })
    .then(function(result){
        if(!result.ok){ showToast(result.data.error || 'Sign in failed.', 'error'); submitBtn.disabled = false; submitBtn.textContent = originalText; return; }
        localStorage.setItem('bjml_token', result.data.token);
        localStorage.setItem('bjml_user', JSON.stringify(result.data.user));
        showToast('Welcome back, ' + result.data.user.name + '.', 'success');
        setTimeout(function(){ location.href = result.data.user.role === 'admin' ? 'admin.html' : '../index.html'; }, 600);
    })
    .catch(function(){ showToast('Could not reach the server. Please try again.', 'error'); submitBtn.disabled = false; submitBtn.textContent = originalText; });
});
