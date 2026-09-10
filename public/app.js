const state = {
  problems: [],
  currentAttempt: null,
  currentProblem: null,
  pollTimer: null,
};

const $ = (sel) => document.querySelector(sel);

function learnerId() {
  const el = $('#learnerId');
  if (!el.value) el.value = localStorage.getItem('lld_learner_id') || 'learner-1';
  localStorage.setItem('lld_learner_id', el.value);
  return el.value.trim();
}
$('#learnerId').addEventListener('change', learnerId);

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $(`#${btn.dataset.tab}-tab`).classList.add('active');
    if (btn.dataset.tab === 'history') loadHistory();
  });
});

// ---------- Problem list ----------
async function loadProblems() {
  const res = await fetch('/api/problems');
  state.problems = await res.json();
  const grid = $('#problems');
  grid.innerHTML = '';
  state.problems.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'problem-card';
    card.innerHTML = `<h3>${p.title}</h3><p class="muted">${p.description.slice(0, 90)}...</p><span class="diff">${p.difficulty}</span>`;
    card.addEventListener('click', () => startAttempt(p));
    grid.appendChild(card);
  });
}

async function startAttempt(problem) {
  const res = await fetch('/api/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problemId: problem.id, learnerId: learnerId() }),
  });
  if (!res.ok) return alert((await res.json()).error);
  state.currentAttempt = await res.json();
  state.currentProblem = problem;

  $('#problem-list-view').classList.add('hidden');
  $('#attempt-view').classList.remove('hidden');
  $('#attempt-problem-title').textContent = problem.title;
  $('#attempt-problem-desc').textContent = problem.description;
  $('#attempt-requirements').innerHTML = problem.requirements.map((r) => `<li>${r}</li>`).join('');
  $('#submissionContent').value = '';
  $('#evaluation-result').classList.add('hidden');
  $('#evaluation-result').innerHTML = '';
}

$('#backToProblems').addEventListener('click', () => {
  clearTimeout(state.pollTimer);
  $('#attempt-view').classList.add('hidden');
  $('#problem-list-view').classList.remove('hidden');
});

// ---------- Submission ----------
$('#submitBtn').addEventListener('click', async () => {
  const content = $('#submissionContent').value.trim();
  if (!content) return alert('Write something before submitting.');
  const format = $('#submissionFormat').value;
  $('#submitBtn').disabled = true;
  $('#submitBtn').textContent = 'Submitting...';

  const res = await fetch(`/api/attempts/${state.currentAttempt.id}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, content, requestId: crypto.randomUUID() }),
  });
  const data = await res.json();
  $('#submitBtn').disabled = false;
  $('#submitBtn').textContent = 'Submit for feedback';

  if (!res.ok) return alert(data.error || 'Submission failed');

  $('#evaluation-result').classList.remove('hidden');
  pollEvaluation(data.evaluation.id);
});

async function pollEvaluation(evaluationId) {
  clearTimeout(state.pollTimer);
  const res = await fetch(`/api/evaluations/${evaluationId}`);
  const evaluation = await res.json();
  renderEvaluation(evaluation);
  if (evaluation.status === 'Pending' || evaluation.status === 'Evaluating') {
    state.pollTimer = setTimeout(() => pollEvaluation(evaluationId), 1200);
  }
}

function renderEvaluation(evaluation) {
  const container = $('#evaluation-result');
  const header = `
    <div class="eval-card">
      <span class="eval-status status-${evaluation.status}">${evaluation.status}</span>
      ${evaluation.overallScore !== null ? `<strong style="margin-left:10px">Overall: ${evaluation.overallScore}/5</strong>` : ''}
      <p class="muted">${evaluation.overallSummary || 'Waiting for evaluation to start...'}</p>
      ${evaluation.status === 'Failed' ? `<p style="color:var(--bad)">Error: ${evaluation.error || 'unknown'}</p><button class="retry-btn" onclick="retryEvaluation('${evaluation.id}')">Retry evaluation</button>` : ''}
    </div>`;

  const criteria = (evaluation.criteria || [])
    .map(
      (c) => `
    <div class="criterion">
      <div class="criterion-head">
        <span>${c.criterion}</span>
        <span class="score-pill">${c.score}/5</span>
      </div>
      <p class="evidence">${c.evidence}</p>
      ${c.concern ? `<p class="concern">⚠ ${c.concern}</p>` : ''}
      ${c.suggestion ? `<p class="suggestion">→ ${c.suggestion}</p>` : ''}
      ${c.confidence === 'low' ? '<p class="confidence-low">low confidence</p>' : ''}
    </div>`
    )
    .join('');

  container.innerHTML = header + (criteria ? `<div class="eval-card">${criteria}</div>` : '');
}

async function retryEvaluation(evaluationId) {
  await fetch(`/api/evaluations/${evaluationId}/retry`, { method: 'POST' });
  pollEvaluation(evaluationId);
}
window.retryEvaluation = retryEvaluation;

// ---------- History ----------
async function loadHistory() {
  const res = await fetch(`/api/attempts?learnerId=${encodeURIComponent(learnerId())}`);
  const items = await res.json();
  const list = $('#history-list');
  if (!items.length) {
    list.innerHTML = '<p class="muted">No attempts yet — go practice a problem!</p>';
    return;
  }
  list.innerHTML = items
    .map((item) => {
      const ev = item.evaluation;
      return `
      <div class="history-item">
        <h4>${item.problem ? item.problem.title : item.attempt.problemId}</h4>
        <p class="muted">Attempt started ${new Date(item.attempt.createdAt).toLocaleString()} — status: ${item.attempt.status}</p>
        ${ev ? `<p>Evaluation: <span class="eval-status status-${ev.status}">${ev.status}</span> ${ev.overallScore !== null ? `— ${ev.overallScore}/5` : ''}</p>` : '<p class="muted">No submission yet.</p>'}
      </div>`;
    })
    .join('');
}
$('#refreshHistory').addEventListener('click', loadHistory);

loadProblems();
