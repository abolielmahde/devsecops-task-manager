import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ShieldCheck,
  ListChecks,
  FolderKanban,
  UploadCloud,
  LogOut,
  LockKeyhole,
  GitBranch,
  Server,
  Cloud,
  PlusCircle,
  Trash2,
  CheckCircle2,
  CircleDotDashed,
  Sparkles,
  KeyRound
} from 'lucide-react';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', identifier: '', password: '', new_password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      let path;
      let payload;

      if (isLogin) {
        path = '/auth/login';
        payload = { identifier: form.identifier, password: form.password };
      } else if (isRegister) {
        path = '/auth/register';
        payload = { username: form.username, email: form.email, password: form.password };
      } else {
        path = '/auth/forgot-password';
        payload = { email: form.email, new_password: form.new_password };
      }

      const res = await api(path, { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Request failed. Check that the backend is running on port 5001.');
        return;
      }

      if (isForgot) {
        setMessage('Password reset successfully. You can login now.');
        setMode('login');
        setForm({ username: '', email: '', identifier: form.email, password: '', new_password: '' });
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.user.username);
      onAuth();
    } catch (err) {
      setError('Cannot connect to backend. Run: cd backend && python3 app.py');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="brand-badge"><ShieldCheck size={22} /> DevSecOps</div>
        <h1>University DevSecOps Portal</h1>
        <p>Academic-grade project management platform for React, Flask, CI/CD, Docker, security scanning and infrastructure documentation.</p>
        <div className="feature-grid">
          <span><LockKeyhole size={16} /> Secure Login</span>
          <span><GitBranch size={16} /> CI/CD Pipeline</span>
          <span><Server size={16} /> Backend API</span>
          <span><Cloud size={16} /> Cloud Ready</span>
        </div>
      </section>

      <section className="auth-card glass-card">
        <div className="auth-icon">{isForgot ? <KeyRound size={34} /> : <ShieldCheck size={34} />}</div>
        <h2>{isLogin ? 'Welcome back' : isRegister ? 'Create account' : 'Reset password'}</h2>
        <p>{isLogin ? 'Login to manage projects and tasks.' : isRegister ? 'Register a secure demo user.' : 'Enter your email and choose a new password.'}</p>

        <form onSubmit={submit}>
          {isRegister && <input required placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />}
          {(isRegister || isForgot) && <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />}
          {isLogin && <input required placeholder="Username or email" value={form.identifier} onChange={e => setForm({ ...form, identifier: e.target.value })} />}
          {!isForgot && <input required minLength="8" placeholder="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />}
          {isForgot && <input required minLength="8" placeholder="New password" type="password" value={form.new_password} onChange={e => setForm({ ...form, new_password: e.target.value })} />}
          <button className="primary-btn" disabled={loading}>{loading ? 'Please wait...' : isLogin ? 'Login' : isRegister ? 'Register' : 'Reset password'}</button>
        </form>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <div className="auth-links">
          {!isLogin && <button className="link-button" onClick={() => { setMode('login'); setError(''); setMessage(''); }}>Already have an account?</button>}
          {isLogin && <button className="link-button" onClick={() => { setMode('register'); setError(''); setMessage(''); }}>Create new account</button>}
          {isLogin && <button className="link-button" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}>Forgot password?</button>}
        </div>
      </section>
    </main>
  );
}

function StatusPill({ status }) {
  const labels = { todo: 'Todo', doing: 'In progress', done: 'Done' };
  return <span className={`badge ${status}`}>{labels[status] || status}</span>;
}

function PriorityPill({ priority }) {
  const labels = { high: 'High', medium: 'Medium', low: 'Low' };
  const value = priority || 'medium';
  return <span className={`priority-badge ${value}`}>{labels[value] || value}</span>;
}

function Dashboard({ onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', status: 'todo', priority: '', project_id: '' });
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');

  async function loadData() {
    try {
      const [taskRes, projectRes] = await Promise.all([api('/tasks'), api('/projects')]);
      if (taskRes.ok) setTasks(await taskRes.json());
      if (projectRes.ok) setProjects(await projectRes.json());
    } catch (err) {
      setError('Cannot load data. Make sure Flask backend is running.');
    }
  }

  useEffect(() => { loadData(); }, []);

  async function addProject(event) {
    event.preventDefault();
    setError('');
    const res = await api('/projects', { method: 'POST', body: JSON.stringify(projectForm) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Cannot create project');
      return;
    }
    setProjectForm({ name: '', description: '' });
    loadData();
  }

  async function addTask(event) {
    event.preventDefault();
    setError('');
    const formData = new FormData();
    Object.entries(taskForm).forEach(([key, value]) => value && formData.append(key, value));
    if (file) formData.append('file', file);
    const res = await api('/tasks', { method: 'POST', body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Cannot create task');
      return;
    }
    setTaskForm({ title: '', description: '', status: 'todo', priority: '', project_id: '' });
    setFile(null);
    event.target.reset();
    loadData();
  }

  async function updateStatus(task, status) {
    await api(`/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ ...task, status }) });
    loadData();
  }

  async function updatePriority(task, priority) {
    await api(`/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ ...task, priority }) });
    loadData();
  }

  async function deleteTask(taskId) {
    await api(`/tasks/${taskId}`, { method: 'DELETE' });
    loadData();
  }

  const counters = useMemo(() => ({
    todo: tasks.filter(t => t.status === 'todo').length,
    doing: tasks.filter(t => t.status === 'doing').length,
    done: tasks.filter(t => t.status === 'done').length,
  }), [tasks]);

  const cards = [
    { label: 'Total tasks', value: tasks.length, icon: ListChecks, hint: 'All created tasks' },
    { label: 'Projects', value: projects.length, icon: FolderKanban, hint: 'Active project spaces' },
    { label: 'Done', value: counters.done, icon: CheckCircle2, hint: 'Completed tasks' },
  ];

  const columns = [
    { key: 'todo', title: 'Todo', icon: CircleDotDashed },
    { key: 'doing', title: 'In progress', icon: Sparkles },
    { key: 'done', title: 'Done', icon: CheckCircle2 },
  ];

  return (
    <main className="dashboard-shell">
      <aside className="sidebar glass-card">
        <div className="logo"><ShieldCheck size={28} /><span>DevSecOps</span></div>
        <nav>
          <a className="active"><ListChecks size={18} /> Dashboard</a>
          <a><FolderKanban size={18} /> Projects</a>
          <a><GitBranch size={18} /> CI/CD</a>
          <a><LockKeyhole size={18} /> Security</a>
        </nav>
        <div className="pipeline-card">
          <span>Pipeline status</span>
          <strong>Ready</strong>
          <small>Code scan · Docker build · Tests</small>
        </div>
      </aside>

      <section className="dashboard-content">
        <header className="topbar glass-card">
          <div>
            <p className="eyebrow">Academic project workspace</p>
            <h1>University DevSecOps Dashboard</h1>
            <p>Welcome, {localStorage.getItem('username')}</p>
          </div>
          <button className="secondary" onClick={onLogout}><LogOut size={16} /> Logout</button>
        </header>

        {error && <p className="error floating-error">{error}</p>}

        <section className="hero-card">
          <div>
            <p className="eyebrow">Final project control center</p>
            <h2>Professional dashboard for university submission and live project demonstration.</h2>
            <p>Organize projects, tasks, priorities and files while presenting DevOps, DevSecOps, Docker, CI/CD and infrastructure requirements clearly.</p>
          </div>
          <div className="hero-icons">
            <span><Server /> API</span>
            <span><GitBranch /> CI/CD</span>
            <span><Cloud /> Cloud</span>
          </div>
        </section>

        <section className="stats">
          {cards.map(Card => (
            <article className="stat-card glass-card" key={Card.label}>
              <div className="stat-icon"><Card.icon size={22} /></div>
              <strong>{Card.value}</strong>
              <span>{Card.label}</span>
              <small>{Card.hint}</small>
            </article>
          ))}
        </section>

        <section className="grid">
          <form className="panel glass-card" onSubmit={addProject}>
            <div className="panel-title"><FolderKanban size={20} /><h2>Create Project</h2></div>
            <label className="field-label">Project name</label><input required placeholder="Example: DevSecOps Final Project" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} />
            <label className="field-label">Project description</label><textarea placeholder="Short academic description of the project" value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} />
            <button className="primary-btn"><PlusCircle size={17} /> Add project</button>
          </form>

          <form className="panel glass-card" onSubmit={addTask}>
            <div className="panel-title"><ListChecks size={20} /><h2>Create Task</h2></div>
            <label className="field-label">Task title</label><input required placeholder="Example: Configure GitHub Actions" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} />
            <label className="field-label">Task description</label><textarea placeholder="Explain what should be done in this task" value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
            <label className="field-label">Project</label><select value={taskForm.project_id} onChange={e => setTaskForm({ ...taskForm, project_id: e.target.value })}>
              <option value="">Select project / No project</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <label className="field-label">Status</label><select value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}>
              <option value="todo">Todo</option>
              <option value="doing">Doing</option>
              <option value="done">Done</option>
            </select>
            <label className="field-label">Priority</label><select required value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
              <option value="" disabled>Choose priority</option>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </select>
            {taskForm.priority && (
              <p className={`priority-help ${taskForm.priority}`}>
                {taskForm.priority === 'high' && 'High priority: urgent task that should be handled first.'}
                {taskForm.priority === 'medium' && 'Medium priority: normal task for the current workflow.'}
                {taskForm.priority === 'low' && 'Low priority: flexible task that can be handled later.'}
              </p>
            )}
            <label className="file-input"><UploadCloud size={17} /> {file ? file.name : 'Upload file'} <input type="file" onChange={e => setFile(e.target.files[0])} /></label>
            <button className="primary-btn"><PlusCircle size={17} /> Add task</button>
          </form>
        </section>

        <section className="kanban">
          {columns.map(column => {
            const Icon = column.icon;
            return (
              <article className="kanban-column glass-card" key={column.key}>
                <h3><Icon size={18} /> {column.title} <span>{counters[column.key]}</span></h3>
                {tasks.filter(task => task.status === column.key).map(task => (
                  <div className="task-card" key={task.id}>
                    <div className="task-header">
                      <strong>{task.title}</strong>
                      <div className="task-badges">
                        <StatusPill status={task.status} />
                        <PriorityPill priority={task.priority} />
                      </div>
                    </div>
                    <p>{task.description || 'No description'}</p>
                    {task.attachment && <span className="attachment"><UploadCloud size={14} /> {task.attachment}</span>}
                    <div className="task-actions">
                      <button className="mini" onClick={() => updateStatus(task, 'todo')}>Todo</button>
                      <button className="mini" onClick={() => updateStatus(task, 'doing')}>Doing</button>
                      <button className="mini" onClick={() => updateStatus(task, 'done')}>Done</button>
                      <button className="mini high" onClick={() => updatePriority(task, 'high')}>High</button>
                      <button className="mini medium" onClick={() => updatePriority(task, 'medium')}>Medium</button>
                      <button className="mini low" onClick={() => updatePriority(task, 'low')}>Low</button>
                      <button className="mini danger" onClick={() => deleteTask(task.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}

function App() {
  const [authed, setAuthed] = useState(Boolean(localStorage.getItem('token')));
  function logout() {
    localStorage.clear();
    setAuthed(false);
  }
  return authed ? <Dashboard onLogout={logout} /> : <Auth onAuth={() => setAuthed(true)} />;
}

createRoot(document.getElementById('root')).render(<App />);
