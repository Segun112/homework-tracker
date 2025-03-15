// Login
function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const spinner = document.getElementById('spinner');
    const error = document.getElementById('error');

    btn.classList.add('hidden');
    spinner.classList.remove('hidden');
    error.textContent = '';

    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(res => {
        if (!res.ok) throw new Error(`Login fetch failed with status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        spinner.classList.add('hidden');
        btn.classList.remove('hidden');
        if (data.success) {
            btn.textContent = 'Success!';
            btn.classList.add('success');
            localStorage.setItem('user_id', data.id); // Ensure this sets correctly
            localStorage.setItem('role', data.role);
            console.log('Login success, user_id set to:', data.id); // Log to confirm
            setTimeout(() => {
                window.location.href = data.role === 'teacher' ? '/teacher.html' : '/dashboard.html';
            }, 600);
        } else {
            error.textContent = data.message || 'Login failed';
            btn.textContent = 'Login';
        }
    })
    .catch(err => {
        spinner.classList.add('hidden');
        btn.classList.remove('hidden');
        error.textContent = 'Login error: ' + err.message;
        console.error('Login error:', err);
    });
}

// Teacher: Create assignment
function createAssignment() {
    const teacher_id = localStorage.getItem('user_id');
    const name = document.getElementById('assignment-name').value;
    const description = document.getElementById('description').value;
    const due_date = document.getElementById('due_date').value;
    fetch('/assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id, name, description, due_date })
    })
    .then(res => res.json())
    .then(data => {
        const errorEl = document.getElementById('assignment-error');
        if (data.success) {
            errorEl.textContent = 'Assignment created!';
            errorEl.style.color = 'green';
        } else {
            errorEl.textContent = data.message || 'Failed to create assignment';
        }
    });
}

// Teacher: Load questionnaire results, students, and registered clubs
if (window.location.pathname.includes('teacher.html')) {
    window.refreshQuestionnaireResults = function() {
        Promise.all([
            fetch('/questionnaires').then(res => res.json()),
            fetch('/users').then(res => res.json())
        ])
        .then(([questionnaires, users]) => {
            const qList = document.getElementById('questionnaire-list');
            qList.innerHTML = '';
            questionnaires.forEach(q => {
                const user = users.find(u => u.id === q.student_id) || { username: `Student ${q.student_id}` };
                const li = document.createElement('li');
                li.textContent = `${user.username} - Preferred Club: ${q.preferredClub} (Submitted: ${new Date(q.timestamp).toLocaleString()})`;
                qList.appendChild(li);
            });
        })
        .catch(err => console.error('Teacher fetch error:', err));
    };

    let timeLeft = 30;
    const countdownEl = document.getElementById('countdown');
    function updateCountdown() {
        countdownEl.textContent = timeLeft;
        timeLeft--;
        if (timeLeft < 0) {
            refreshQuestionnaireResults();
            timeLeft = 30;
        }
    }

    refreshQuestionnaireResults();
    updateCountdown();
    setInterval(updateCountdown, 1000);

    fetch('/users')
    .then(res => res.json())
    .then(users => {
        const allStudentsList = document.getElementById('all-students-list');
        users.forEach(user => {
            const li = document.createElement('li');
            li.textContent = `${user.username} (ID: ${user.id})`;
            allStudentsList.appendChild(li);
        });
    })
    .catch(err => console.error('Users fetch error:', err));

    fetch('/clubs')
    .then(res => res.json())
    .then(clubs => {
        const registeredList = document.getElementById('registered-list');
        clubs.forEach(club => {
            club.members.forEach(memberId => {
                const user = users.find(u => u.id === memberId) || { username: `Student ${memberId}` };
                const li = document.createElement('li');
                li.textContent = `${user.username} - ${club.name}`;
                registeredList.appendChild(li);
            });
        });
    })
    .catch(err => console.error('Clubs fetch error:', err));
}

function registerStudentsToClub() {
    const teacher_id = localStorage.getItem('user_id');
    const student_ids = document.getElementById('student-ids').value.trim();
    const club_id = document.getElementById('club-select').value;
    const errorEl = document.getElementById('register-error');
    
    // Enhanced validation
    if (!teacher_id) {
        errorEl.textContent = 'Error: Teacher not logged in (no teacher_id)';
        console.error('No teacher_id in localStorage');
        return;
    }
    if (!student_ids) {
        errorEl.textContent = 'Enter at least one student ID (e.g., 2,3)';
        console.error('No student_ids entered');
        return;
    }
    if (!club_id || club_id === '') {
        errorEl.textContent = 'Please select a club';
        console.error('No club_id selected');
        return;
    }

    const payload = { teacher_id, student_ids, club_id };
    console.log('Sending to /assign-club:', payload);

    fetch('/assign-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => {
        console.log('Response status:', res.status); // Log status
        if (!res.ok) throw new Error(`Fetch failed with status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        console.log('Response data:', data); // Log server response
        if (data.success) {
            errorEl.textContent = 'Students registered successfully!';
            errorEl.style.color = 'green';
            setTimeout(() => location.reload(), 1000);
        } else {
            errorEl.textContent = data.message || 'Registration failed';
        }
    })
    .catch(err => {
        errorEl.textContent = 'Error: ' + err.message;
        console.error('Register fetch error:', err);
    });
}

// Dashboard: Load student data
if (window.location.pathname.includes('dashboard.html')) {
    const student_id = localStorage.getItem('user_id');
    fetch(`/dashboard/${student_id}`)
    .then(res => {
        if (!res.ok) throw new Error(`Fetch failed with status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        let totalPoints = data.submissions.reduce((sum, s) => sum + s.score, 0);
        document.getElementById('total-points').textContent = totalPoints;
        
        const clubCard = document.getElementById('view-club-card');
        const registerCard = document.getElementById('register-card');
        
        if (data.club) {
            document.getElementById('club-name').textContent = data.club.name;
            clubCard.onclick = () => window.location.href = '/clubs.html';
            clubCard.classList.remove('disabled');
            registerCard.style.display = 'none';
        } else {
            document.getElementById('club-name').textContent = 'Not assigned';
            clubCard.classList.add('disabled');
            clubCard.onclick = null;
            if (data.questionnaire) {
                registerCard.innerHTML = '<h2>View Club</h2><p>Pending approval</p>';
                registerCard.onclick = null;
            }
        }
    })
    .catch(err => console.error('Dashboard fetch error:', err));
}

// Questionnaire: Submit answers
if (window.location.pathname.includes('questionnaire.html')) {
    window.submitQuestionnaire = function() {
        const student_id = localStorage.getItem('user_id');
        const form = document.getElementById('questionnaire-form');
        const errorEl = document.getElementById('form-error');
        
        const answers = {
            'public-speaking': form['public-speaking'].value,
            'best-subject': form['best-subject'].value,
            'love-tech': form['love-tech'].value,
            'enjoy-writing': form['enjoy-writing'].value,
            'interest-engineering': form['interest-engineering'].value
        };

        fetch('/questionnaire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id, answers })
        })
        .then(res => {
            if (!res.ok) throw new Error(`Questionnaire fetch failed with status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.success) {
                errorEl.textContent = 'Submitted successfully! Redirecting to dashboard...';
                errorEl.style.color = 'green';
                setTimeout(() => {
                    window.location.href = '/dashboard.html';
                }, 1500);
            } else {
                errorEl.textContent = data.message || 'Submission failed';
                errorEl.style.color = 'red';
            }
        })
        .catch(err => {
            errorEl.textContent = 'Error submitting: ' + err.message;
            errorEl.style.color = 'red';
            console.error('Questionnaire fetch error:', err);
        });
    };
}

// Clubs: Load student’s club and chat
if (window.location.pathname.includes('clubs.html')) {
    const student_id = localStorage.getItem('user_id');
    let selectedClubId = null;
    fetch(`/dashboard/${student_id}`)
    .then(res => {
        if (!res.ok) throw new Error(`Fetch failed with status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        if (!data.club) {
            document.getElementById('club-title').textContent = 'Not assigned to a club';
            document.getElementById('chat').classList.add('hidden');
        } else {
            selectedClubId = data.club.id;
            document.getElementById('club-title').textContent = data.club.name;
            const messages = document.getElementById('chat-messages');
            data.club.chatroom.forEach(msg => {
                const p = document.createElement('p');
                p.textContent = `[${msg.student_id}] ${msg.message} (${new Date(msg.timestamp).toLocaleTimeString()})`;
                messages.appendChild(p);
            });
        }
    })
    .catch(err => console.error('Clubs fetch error:', err));

    window.sendMessage = function() {
        const student_id = localStorage.getItem('user_id');
        const message = document.getElementById('chat-input').value;
        fetch('/club-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ club_id: selectedClubId, student_id, message })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) location.reload();
            document.getElementById('chat-input').value = '';
        });
    };
}

// Assignments: Load pending and completed
if (window.location.pathname.includes('assignments.html')) {
    const student_id = localStorage.getItem('user_id');
    Promise.all([
        fetch('/assignments').then(res => res.json()),
        fetch(`/dashboard/${student_id}`).then(res => res.json())
    ])
    .then(([assignments, dashboard]) => {
        const pendingList = document.getElementById('pending-list');
        const completedList = document.getElementById('completed-list');
        const submittedIds = dashboard.submissions.map(s => s.assignment_id);

        assignments.forEach(a => {
            const li = document.createElement('li');
            if (submittedIds.includes(a.id)) {
                const submission = dashboard.submissions.find(s => s.assignment_id === a.id);
                li.textContent = `${a.name} - Score: ${submission.score} (Submitted: ${new Date(submission.submission_time).toLocaleString()})`;
                completedList.appendChild(li);
            } else {
                li.innerHTML = `${a.name} - Due: ${a.due_date} - 10 points (-5 late) 
                    <button onclick="submitAssignment(${a.id}, this)">Submit</button>`;
                pendingList.appendChild(li);
            }
        });
    })
    .catch(err => console.error('Assignments fetch error:', err));
}

function submitAssignment(assignment_id, button) {
    const student_id = localStorage.getItem('user_id');
    const submission_time = new Date().toISOString();
    fetch('/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id, assignment_id, submission_time })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(`Submitted! Score: ${data.score}`);
            button.parentElement.remove();
            location.reload();
        } else {
            alert('Submission failed: ' + (data.message || 'Unknown error'));
        }
    });
}