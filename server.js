const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

const loadData = (file) => {
    try {
        return JSON.parse(fs.readFileSync(`./data/${file}.json`, 'utf8'));
    } catch (err) {
        console.error(`Error loading ${file}.json:`, err.message);
        if (err.code === 'ENOENT') {
            fs.writeFileSync(`./data/${file}.json`, '[]');
            return [];
        }
        throw err;
    }
};
const saveData = (file, data) => fs.writeFileSync(`./data/${file}.json`, JSON.stringify(data, null, 2));

let users = loadData('users');
let assignments = loadData('assignments');
let submissions = loadData('submissions');
let clubs = loadData('clubs');
let questionnaires = loadData('questionnaires');

// Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) res.json({ success: true, role: user.role, id: user.id });
    else res.json({ success: false, message: 'Invalid credentials' });
});

// Teacher: Create assignment
app.post('/assignment', (req, res) => {
    const { teacher_id, name, description, due_date } = req.body;
    if (!teacher_id || !name || !due_date) return res.status(400).json({ success: false, message: 'Missing required fields' });
    const assignment = { id: assignments.length + 1, teacher_id, name, description, due_date, points: 10, penalty: 5 };
    assignments.push(assignment);
    saveData('assignments', assignments);
    res.json({ success: true, assignment });
});

// Teacher: Assign student(s) to club
app.post('/assign-club', (req, res) => {
    console.log('Received /assign-club request:', req.body); // Log incoming request
    const { teacher_id, student_ids, club_id } = req.body;
    if (!teacher_id || !student_ids || !club_id) {
        console.log('Missing fields:', { teacher_id, student_ids, club_id });
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const club = clubs.find(c => c.id === parseInt(club_id));
    if (!club) return res.status(404).json({ success: false, message: 'Club not found' });
    
    const studentIdsArray = Array.isArray(student_ids) ? student_ids : student_ids.split(',').map(id => id.trim());
    studentIdsArray.forEach(student_id => {
        if (student_id !== teacher_id) {
            clubs.forEach(c => {
                c.members = c.members.filter(m => m !== student_id);
            });
            if (!club.members.includes(student_id)) club.members.push(student_id);
        }
    });
    saveData('clubs', clubs);
    res.json({ success: true });
});

// Student: Submit questionnaire
app.post('/questionnaire', (req, res) => {
    const { student_id, answers } = req.body;
    if (!student_id || !answers) return res.status(400).json({ success: false, message: 'Missing student_id or answers' });
    const existing = questionnaires.find(q => q.student_id === student_id);
    if (existing) return res.status(400).json({ success: false, message: 'Questionnaire already submitted' });
    const preferredClub = answers['best-subject'] === 'English' || answers['public-speaking'] === 'Yes' ? 'Press' : 'Jet';
    const questionnaire = { student_id, answers, preferredClub, timestamp: new Date().toISOString() };
    questionnaires.push(questionnaire);
    saveData('questionnaires', questionnaires);
    res.json({ success: true });
});

// Student: Get assignments
app.get('/assignments', (req, res) => res.json(assignments));

// Student: Submit assignment
app.post('/submit', (req, res) => {
    const { student_id, assignment_id, submission_time } = req.body;
    const assignment = assignments.find(a => a.id === parseInt(assignment_id));
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    const dueDate = new Date(assignment.due_date);
    const submitDate = new Date(submission_time);
    let score = assignment.points;
    if (submitDate > dueDate) score = Math.max(0, score - assignment.penalty);
    const submission = { student_id, assignment_id: parseInt(assignment_id), submission_time, score };
    submissions.push(submission);
    saveData('submissions', submissions);
    res.json({ success: true, score });
});

// Clubs: Get all clubs
app.get('/clubs', (req, res) => res.json(clubs));

// Clubs: Post message
app.post('/club-chat', (req, res) => {
    const { club_id, student_id, message } = req.body;
    const club = clubs.find(c => c.id === parseInt(club_id));
    if (!club) return res.status(404).json({ success: false, message: 'Club not found' });
    if (!club.members.includes(student_id)) return res.status(403).json({ success: false, message: 'Not a member' });
    club.chatroom.push({ student_id, message, timestamp: new Date().toISOString() });
    saveData('clubs', clubs);
    res.json({ success: true });
});

// Dashboard: Get student data
app.get('/dashboard/:student_id', (req, res) => {
    const student_id = req.params.student_id;
    const studentSubmissions = submissions.filter(s => s.student_id === student_id);
    const studentClub = clubs.find(c => c.members.includes(student_id));
    const questionnaire = questionnaires.find(q => q.student_id === student_id);
    res.json({ submissions: studentSubmissions, club: studentClub || null, questionnaire });
});

// Teacher: Get questionnaires
app.get('/questionnaires', (req, res) => res.json(questionnaires));

// Teacher: Get all users
app.get('/users', (req, res) => res.json(users.filter(u => u.role === 'student')));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));