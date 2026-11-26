 // UPSC COMMANDER - v1.0
// Firebase config is intentionally blank. Demo mode works without Firebase.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, setDoc, addDoc, deleteDoc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBYf0Xh3RSLlxOEDoEEnyTPvw6ZYf9RreI",
  authDomain: "upsc-commander.firebaseapp.com",
  projectId: "upsc-commander",
  storageBucket: "upsc-commander.firebasestorage.app",
  messagingSenderId: "621957377517",
  appId: "1:621957377517:web:57060b9a2d26a7a7d48be4"
};
const SUBJECTS = [
  "Polity",
  "History",
  "Geography",
  "Economy",
  "Environment",
  "Science & Technology",
  "Current Affairs",
  "CSAT",
  "Ethics"
];
const $ = id => document.getElementById(id);
const today = () => new Date().toLocaleDateString("en-CA");
let user = null, demo = false, auth = null, db = null, taskUnsub = null;
let subjectGoals = {};
let tasks = [], sessions = [], subjectProgress = {}, dailyGoal = 6, view = "dashboard", authMode = "login";
let monthSessions = [];
let timerSeconds = 25*60, timerInterval = null, timerRunning = false, timerStartedAt = null;
let timerElapsedBeforePause = 0;
let timerSessionActive = false;
let selectedDate = today();

const localKey = () => "upsc_commander_demo_v1";
function readLocal(){
  try {
    return JSON.parse(localStorage.getItem(localKey())) || {
      tasks: [],
      sessions: [],
      subjectProgress: {},
      dailyGoal: 6
    };
  } catch {
    return {
      tasks: [],
      sessions: [],
      subjectProgress: {},
      dailyGoal: 6
    };
  }
}
function writeLocal(){
  localStorage.setItem(localKey(), JSON.stringify({
    tasks,
    sessions,
    subjectProgress,
    dailyGoal
  }));
}
function firebaseReady(){return FIREBASE_CONFIG.apiKey.startsWith("AIza") && !FIREBASE_CONFIG.projectId.startsWith("PASTE");}
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dateLabel(d){return new Date(d+"T12:00:00").toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"short"})}
function dayTasks(){return tasks.filter(t=>t.date===selectedDate)}
function todaySessions(){return sessions.filter(s=>s.date===today())}
function minutesToday(){return todaySessions().reduce((a,s)=>a+s.minutes,0)}
function fmtMinutes(m){return `${Math.floor(m/60)}h ${String(m%60).padStart(2,"0")}m`}
function setMode(name){demo=name==="demo";$("modePill").textContent=demo?"● DEMO MODE":"● CLOUD SYNC";$("avatar").textContent=(user?.email||"A")[0].toUpperCase()}
function showApp(){
  $("authScreen").classList.add("hidden");
  $("app").classList.remove("hidden");

  const data = readLocal();
dailyGoal = Number(data.dailyGoal) || 6;

  $("dailyGoalInput").value = dailyGoal;

  populateSubjects();
  renderAll();
}
function showAuth(){ $("app").classList.add("hidden");$("authScreen").classList.remove("hidden"); }
function populateSubjects(){["taskSubject","timerSubject"].forEach(id=>$(id).innerHTML=SUBJECTS.map(s=>`<option>${esc(s)}</option>`).join(""))}
async function loadCloud(){
  const tSnap=await getDocs(collection(db,"users",user.uid,"tasks")); tasks=tSnap.docs.map(d=>({id:d.id,...d.data()}));
  const sSnap=await getDocs(collection(db,"users",user.uid,"sessions")); sessions=sSnap.docs.map(d=>({id:d.id,...d.data()}));
  const pRef=doc(db,"users",user.uid,"settings","progress"); const {getDoc}=await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"); const pSnap=await getDoc(pRef); subjectProgress=pSnap.exists()?pSnap.data().values||{}:{};
}
async function saveProgress(){if(demo){writeLocal();return}await setDoc(doc(db,"users",user.uid,"settings","progress"),{values:subjectProgress},{merge:true})}
async function addTask(data){if(demo){tasks.unshift({id:crypto.randomUUID(),...data,done:false});writeLocal()}else{const r=await addDoc(collection(db,"users",user.uid,"tasks"),{...data,done:false});tasks.unshift({id:r.id,...data,done:false})}renderAll()}
async function updateTask(id,patch){const t=tasks.find(x=>x.id===id);if(!t)return;Object.assign(t,patch);if(demo)writeLocal();else await setDoc(doc(db,"users",user.uid,"tasks",id),patch,{merge:true});renderAll()}
async function removeTask(id){tasks=tasks.filter(t=>t.id!==id);if(demo)writeLocal();else await deleteDoc(doc(db,"users",user.uid,"tasks",id));renderAll();toast("Task deleted")}
async function recordSession(subject,minutes){const item={subject,minutes,date:today(),createdAt:Date.now()};if(demo){sessions.unshift({id:crypto.randomUUID(),...item});writeLocal()}else{const r=await addDoc(collection(db,"users",user.uid,"sessions"),item);sessions.unshift({id:r.id,...item})}renderAll()}
function taskHTML(t){return `<div class="task-row ${t.done?"done":""}"><input class="task-check" type="checkbox" data-task-check="${esc(t.id)}" ${t.done?"checked":""}><div class="task-info"><div class="task-name">${esc(t.title)}</div><div class="task-meta">${esc(t.subject)} · ${t.minutes} min · ${t.date===today()?"Today":esc(t.date)}</div></div><button class="task-delete" title="Delete task" data-task-delete="${esc(t.id)}">×</button></div>`}
function renderTasks(){const list=dayTasks();$("plannerTasks").innerHTML=list.length?list.map(taskHTML).join(""):`<div class="empty">No tasks for this date yet. Add your first task above.</div>`;$("dashboardTasks").innerHTML=tasks.filter(t=>t.date===today()).slice(0,5).map(taskHTML).join("")||`<div class="empty">No priorities added for today.</div>`;$("taskCount").textContent=`${list.filter(t=>t.done).length}/${list.length} completed`;$("statTasks").textContent=`${tasks.filter(t=>t.date===today()&&t.done).length} / ${tasks.filter(t=>t.date===today()).length}`}
function renderDashboard(){
  const mins = minutesToday();
  const hours = mins / 60;
  const pct = Math.min(100, (mins / (dailyGoal * 60)) * 100);

  $("todayHours").textContent = hours.toFixed(1) + "h";
  $("targetRing").style.background =
    `conic-gradient(var(--green) ${pct * 3.6}deg,#254456 0deg)`;

  $("statStudy").textContent = fmtMinutes(mins);

  const total = Object.values(subjectProgress).reduce((a,b) => a+b, 0);
  $("statSyllabus").textContent =
    Math.round(total / SUBJECTS.length) + "%";
    const goalMinutes = dailyGoal * 60;
  const goalPercent = Math.min(100, (mins / goalMinutes) * 100);
  const remainingMinutes = Math.max(0, goalMinutes - mins);

  $("dailyGoalProgress").style.width = goalPercent + "%";

  $("dailyGoalStatus").textContent =
    `${goalPercent.toFixed(0)}% of your daily goal completed.`;

  $("dailyGoalRemaining").textContent =
    remainingMinutes === 0
      ? "Daily study goal completed!"
      : `${(remainingMinutes / 60).toFixed(1)} hours remaining today.`;

  const studyDates = [...new Set(
    sessions.map(s => s.date).filter(Boolean)
  )].sort();

  const todayDate = today();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toLocaleDateString("en-CA");

  let currentStreak = 0;
  let checkDate = new Date();

  if (!studyDates.includes(todayDate) &&
      !studyDates.includes(yesterdayKey)) {
    currentStreak = 0;
  } else {
    if (!studyDates.includes(todayDate)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (studyDates.includes(checkDate.toLocaleDateString("en-CA"))) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  let longestStreak = 0;
  let runningStreak = 0;
  let previousDate = null;

  studyDates.forEach(date => {
    const currentDate = new Date(date + "T12:00:00");

    if (previousDate) {
      const difference =
        (currentDate - previousDate) / 86400000;

      runningStreak = difference === 1 ? runningStreak + 1 : 1;
    } else {
      runningStreak = 1;
    }

    longestStreak = Math.max(longestStreak, runningStreak);
    previousDate = currentDate;
  });
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const monthlyDays = studyDates.filter(date => {
    const d = new Date(date + "T12:00:00");
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;

  $("currentStreak").textContent = currentStreak + " days";
  $("longestStreak").textContent = longestStreak + " days";
  $("monthlyConsistency").textContent = monthlyDays + " days";
  
const goalHistory = [];

for (let i = 6; i >= 0; i--) {
  const d = new Date();
  d.setDate(d.getDate() - i);

  const dateKey = d.toLocaleDateString("en-CA");

  const dailyMinutes = sessions
    .filter(s => s.date === dateKey)
    .reduce((total, s) => total + Number(s.minutes || 0), 0);

  const percentage = Math.min(
    100,
    (dailyMinutes / (dailyGoal * 60)) * 100
  );

  goalHistory.push({
    label: d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short"
    }),
    hours: (dailyMinutes / 60).toFixed(1),
    percentage
  });
}

$("goalHistory").innerHTML = goalHistory.map(day => `
  <div class="task-row">
    <div class="task-info">
      <div class="task-name">${day.label} — ${day.hours} hours</div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${day.percentage}%"></div>
      </div>
    </div>
    <strong>${day.percentage.toFixed(0)}%</strong>
  </div>
`).join("");


// WEEKLY STUDY REPORT
const weeklyData = [];

for (let i = 6; i >= 0; i--) {
  const d = new Date();
  d.setDate(d.getDate() - i);

  const dateKey = d.toLocaleDateString("en-CA");

  const minutes = sessions
    .filter(s => s.date === dateKey)
    .reduce((total, s) => total + Number(s.minutes || 0), 0);

  weeklyData.push({
    date: dateKey,
    day: d.toLocaleDateString("en-IN", {
      weekday: "short"
    }),
    minutes
  });
}

const weeklyTotal = weeklyData.reduce(
  (total, day) => total + day.minutes,
  0
);

const bestDay = weeklyData.reduce(
  (best, day) => day.minutes > best.minutes ? day : best,
  { day: "--", minutes: 0 }
);

const completedGoals = weeklyData.filter(
  day => day.minutes >= dailyGoal * 60
).length;

$("weeklyTotalHours").textContent =
  (weeklyTotal / 60).toFixed(1) + "h";

$("weeklyAverageHours").textContent =
  (weeklyTotal / 7 / 60).toFixed(1) + "h";

$("weeklyBestDay").textContent =
  bestDay.minutes > 0 ? bestDay.day : "--";

$("weeklyGoalsCompleted").textContent =
  completedGoals + "/7";

// MONTHLY STUDY REPORT
const currentYear = year;
const currentMonth = month;

monthSessions = sessions.filter(s => {
  const d = new Date(s.date + "T00:00:00");
  return (
    d.getFullYear() === currentYear &&
    d.getMonth() === currentMonth
  );
});

const monthlyMinutes = monthSessions.reduce(
  (total, s) => total + Number(s.minutes || 0),
  0
);

const daysPassed = now.getDate();
const daysInMonth = new Date(
  currentYear,
  currentMonth + 1,
  0
).getDate();

const monthlyAverage = monthlyMinutes / daysPassed / 60;

const monthlyBest = {};

monthSessions.forEach(s => {
  monthlyBest[s.date] =
    (monthlyBest[s.date] || 0) + Number(s.minutes || 0);
});

const bestDate = Object.keys(monthlyBest).sort(
  (a, b) => monthlyBest[b] - monthlyBest[a]
)[0];

const completedMonthlyTasks = tasks.filter(t => {
  if (!t.done) return false;

  const d = new Date(t.completedAt || t.date);
  return (
    !isNaN(d) &&
    d.getFullYear() === currentYear &&
    d.getMonth() === currentMonth
  );
}).length;

const monthlyGoalDays = Object.values(monthlyBest)
  .filter(minutes => minutes >= dailyGoal * 60).length;

const goalAchievement = Math.round(
  (monthlyGoalDays / daysPassed) * 100
);

$("monthlyTotalHours").textContent =
  (monthlyMinutes / 60).toFixed(1) + "h";

$("monthlyAverageHours").textContent =
  monthlyAverage.toFixed(1) + "h";

$("monthlyCompletedTasks").textContent =
  completedMonthlyTasks;

$("monthlyGoalAchievement").textContent =
  goalAchievement + "%";

$("monthlyBestDay").textContent =
  bestDate
    ? new Date(bestDate + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
      })
    : "--";

// MONTHLY PERFORMANCE CHART
const monthlyChartBars = [];

let monthlyMaxHours = 1;

for (let day = 1; day <= daysInMonth; day++) {
  const chartDate = new Date(currentYear, currentMonth, day);

  const dateKey = chartDate.toLocaleDateString("en-CA");

  const minutes = monthlyBest[dateKey] || 0;
  const hours = minutes / 60;

  monthlyMaxHours = Math.max(monthlyMaxHours, hours);

  monthlyChartBars.push({
    day,
    hours
  });
}

$("monthlyPerformanceChart").innerHTML =
  monthlyChartBars.map(item => {
    const barHeight = Math.max(
      2,
      (item.hours / monthlyMaxHours) * 150
    );

    return `
      <div style="
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:flex-end;
        min-width:24px;
        flex:1;
        gap:6px;
      ">
        <span style="font-size:10px;color:#94a3b8;">
          ${item.hours.toFixed(1)}h
        </span>

        <div style="
          height:${barHeight}px;
          width:14px;
          background:#38bdf8;
          border-radius:5px 5px 0 0;
        "></div>

        <span style="font-size:10px;color:#94a3b8;">
          ${item.day}
        </span>
      </div>
    `;
  }).join("");

// STUDY CALENDAR
const calendarBox = $("studyCalendar");
const calendarDetailsBox = $("calendarDetails");

const calendarFirstDay = new Date(
  currentYear,
  currentMonth,
  1
).getDay();

const calendarCells = [];

const calendarWeekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

calendarWeekDays.forEach(day => {
  calendarCells.push(`
    <div style="text-align:center;padding:8px;color:#94a3b8;font-size:12px;">
      ${day}
    </div>
  `);
});

for (let i = 0; i < calendarFirstDay; i++) {
  calendarCells.push("<div></div>");
}

for (let day = 1; day <= daysInMonth; day++) {
  const calendarDate = new Date(currentYear, currentMonth, day);
  const calendarKey = calendarDate.toLocaleDateString("en-CA");

  const studyMinutes = monthlyBest[calendarKey] || 0;
  const studyHours = studyMinutes / 60;
  const goalReached = studyMinutes >= dailyGoal * 60;

  const cellColor = goalReached
    ? "#166534"
    : studyMinutes > 0
      ? "#1e40af"
      : "#1e293b";

  calendarCells.push(`
    <button
      type="button"
      data-calendar-date="${calendarKey}"
      style="
        width:100%;
        min-height:48px;
        border:1px solid #334155;
        border-radius:8px;
        background:${cellColor};
        color:white;
        cursor:pointer;
        padding:5px;
      "
    >
      <strong>${day}</strong>
      <div style="font-size:10px;">
        ${studyHours > 0 ? studyHours.toFixed(1) + "h" : "--"}
      </div>
    </button>
  `);
}

calendarBox.style.display = "grid";
calendarBox.style.gridTemplateColumns = "repeat(7, minmax(0, 1fr))";
calendarBox.style.gap = "6px";
calendarBox.innerHTML = calendarCells.join("");

calendarBox.onclick = event => {
  const selectedDate = event.target.closest("[data-calendar-date]");

  if (!selectedDate) return;

  const selectedKey = selectedDate.dataset.calendarDate;
  const selectedMinutes = monthlyBest[selectedKey] || 0;
  const selectedHours = (selectedMinutes / 60).toFixed(1);

  const formattedDate = new Date(
    selectedKey + "T00:00:00"
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  calendarDetailsBox.textContent =
    formattedDate +
    " | Study Time: " + selectedHours +
    " hours | Daily Goal: " +
    (selectedMinutes >= dailyGoal * 60 ? "Completed" : "Not Completed");
};

// STUDY INSIGHTS & RECOMMENDATIONS

// 1. Subject-wise study time
const insightSubjectTotals = {};

monthSessions.forEach(session => {
  const subjectName = session.subject || "Other";

  insightSubjectTotals[subjectName] =
    (insightSubjectTotals[subjectName] || 0) +
    Number(session.minutes || 0);
});

const insightTopSubject = Object.entries(insightSubjectTotals)
  .sort((a, b) => b[1] - a[1])[0];

$("insightTopSubject").textContent =
  insightTopSubject ? insightTopSubject[0] : "--";

// 2. Best study day
const insightBestDate = Object.entries(monthlyBest)
  .sort((a, b) => b[1] - a[1])[0];

$("insightBestDay").textContent = insightBestDate
  ? new Date(insightBestDate[0] + "T00:00:00")
      .toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
      })
  : "--";

// 3. Monthly goal completion
const insightGoalsCount = Object.values(monthlyBest)
  .filter(minutes => minutes >= dailyGoal * 60).length;

$("insightGoalsCompleted").textContent = insightGoalsCount;

// 4. Study consistency
const insightActiveDays = Object.keys(monthlyBest)
  .filter(date => monthlyBest[date] > 0).length;

const insightConsistencyScore = Math.round(
  (insightActiveDays / daysPassed) * 100
);

$("insightConsistency").textContent =
  insightConsistencyScore + "%";

// 5. Recommendations
const insightRecommendations = [];

if (insightConsistencyScore < 50) {
  insightRecommendations.push(
    "Try to maintain a more regular daily study routine."
  );
} else {
  insightRecommendations.push(
    "Good consistency! Keep following your study routine."
  );
}

if (insightGoalsCount < 3) {
  insightRecommendations.push(
    "Focus on completing your daily study goal more regularly."
  );
} else {
  insightRecommendations.push(
    "You are completing your study goals. Keep it up."
  );
}

if (!insightTopSubject) {
  insightRecommendations.push(
    "Record study sessions to get subject-wise insights."
  );
} else {
  insightRecommendations.push(
    "Your top subject this month is " +
    insightTopSubject[0] + "."
  );
}

$("studyRecommendations").innerHTML =
  insightRecommendations.map(message =>
    `<p class="muted">• ${message}</p>`
  ).join("");

// UPSC SUBJECT PERFORMANCE COMPARISON
const subjectPerformanceTotals = {};

monthSessions.forEach(session => {
  const subject = session.subject || "Other";
  const minutes = Number(session.minutes || session.durationMinutes || 0);

  subjectPerformanceTotals[subject] =
    (subjectPerformanceTotals[subject] || 0) + minutes;
});

const subjectPerformanceList = Object.entries(subjectPerformanceTotals)
  .sort((a, b) => b[1] - a[1]);

const subjectPerformanceMax = Math.max(
  ...subjectPerformanceList.map(item => item[1]),
  1
);

if (subjectPerformanceList.length === 0) {
  $("subjectPerformanceComparison").innerHTML =
    '<p class="muted">No subject study data available this month.</p>';
} else {
  $("subjectPerformanceComparison").innerHTML =
    subjectPerformanceList.map(([subject, minutes]) => {
      const hours = (minutes / 60).toFixed(1);
      const percentage = (minutes / subjectPerformanceMax) * 100;

      return `
        <div style="margin:15px 0;">
          <div style="display:flex; justify-content:space-between; gap:10px;">
            <strong>${subject}</strong>
            <span class="muted">${hours} hours</span>
          </div>

          <div style="height:10px; background:#1e293b; border-radius:10px; overflow:hidden; margin-top:8px;">
            <div style="height:100%; width:${percentage}%; background:#38bdf8; border-radius:10px;"></div>
          </div>
        </div>
      `;
    }).join("");
}

// TOP PERFORMING SUBJECT
if (subjectPerformanceList.length > 0) {
  const topSubject = subjectPerformanceList[0];

  $("topPerformingSubject").textContent = topSubject[0];
  $("topSubjectHours").textContent =
    (topSubject[1] / 60).toFixed(1) + "h";
} else {
  $("topPerformingSubject").textContent = "--";
  $("topSubjectHours").textContent = "0h";
}

// GLOBAL SUBJECT STUDY GOALS
let subjectGoals = JSON.parse(
  localStorage.getItem("subjectGoals") || "{}"
);

function renderSubjectGoals() {
  const container = $("subjectGoalsList");

  const entries = Object.entries(subjectGoals);

  if (entries.length === 0) {
    container.innerHTML =
      '<p class="muted">No subject goals added yet.</p>';
    return;
  }

  container.innerHTML = entries.map(([subject, hours]) => {
    const studiedMinutes = monthSessions
      .filter(session => session.subject === subject)
      .reduce(
        (total, session) =>
          total + Number(session.minutes || session.durationMinutes || 0),
        0
      );

    const studiedHours = studiedMinutes / 60;
    const progress = Math.min(
      (studiedHours / hours) * 100,
      100
    );

    const remainingHours = Math.max(hours - studiedHours, 0);
    const achievement = progress;

    return `
      <div style="margin:15px 0;">
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <strong>${subject}</strong>
          <span class="muted">
            ${studiedHours.toFixed(1)}h / ${hours}h
          </span>
        </div>

        <div class="muted" style="margin-top:5px;">
          ${remainingHours.toFixed(1)}h remaining
        </div>

        <div class="muted" style="margin-top:5px;">
          ${achievement.toFixed(1)}% achieved
        </div>

        <div style="margin-top:5px;">
          ${studiedHours >= hours
            ? '<span style="color:#22c55e;">✓ Goal Completed</span>'
            : '<span style="color:#f59e0b;">In Progress</span>'}
        </div>

        <div style="height:10px; background:#1e293b; border-radius:10px; overflow:hidden; margin-top:8px;">
          <div style="height:100%; width:${progress}%; background:#38bdf8;"></div>
        </div>
      </div>
    `;
  }).join("");
}
function renderSubjectGoalHistory() {
  const historyContainer = $("subjectGoalHistory");
  const entries = Object.entries(subjectGoals);

  if (entries.length === 0) {
    historyContainer.innerHTML =
      '<p class="muted">No subject goals saved yet.</p>';
    return;
  }

  historyContainer.innerHTML = entries.map(([subject, hours]) => {
    const studiedMinutes = monthSessions
      .filter(session => session.subject === subject)
      .reduce(
        (total, session) =>
          total + Number(session.minutes || session.durationMinutes || 0),
        0
      );

    const studiedHours = studiedMinutes / 60;
    const completed = studiedHours >= hours;
   const progress = Math.min(100, (studiedHours / hours) * 100);
   const remaining = Math.max(0, hours - studiedHours);
   const progressColor =
  progress >= 80 ? "#22c55e" :
  progress >= 40 ? "#f59e0b" :
  "#ef4444";

    return `
      <div style="padding:12px 0; border-bottom:1px solid #334155;">
        <strong>${subject}</strong>

        <p class="muted">
          Target: ${hours}h | Studied: ${studiedHours.toFixed(1)}h
        </p>
                <div style="background:#334155; height:8px; border-radius:10px; overflow:hidden; margin:10px 0;">
          <div style="width:${progress}%; height:100%; background:${progressColor}; border-radius:10px;"></div>
        </div>

        <p class="muted">
          ${progress.toFixed(0)}% Completed | ${remaining.toFixed(1)}h Remaining
        </p>

                  <div style="display:flex; gap:8px;">
            <button
              type="button"
              data-subject="${subject}"
              data-hours="${hours}"
              class="edit-subject-goal"
              style="background:#2563eb; color:white; border:0; padding:6px 12px; border-radius:6px; cursor:pointer;"
            >
              Edit
            </button>

            <button
              type="button"
              data-subject="${subject}"
              class="delete-subject-goal"
              style="background:#dc2626; color:white; border:0; padding:6px 12px; border-radius:6px; cursor:pointer;"
            >
              Delete
            </button>
          </div>
      </div>
    `;
  }).join("");
}

function deleteSubjectGoal(subject) {
  if (!confirm(`Delete ${subject} study goal?`)) {
    return;
  }

  delete subjectGoals[subject];

  localStorage.setItem(
    "subjectGoals",
    JSON.stringify(subjectGoals)
  );

  renderSubjectGoals();
  renderSubjectGoalHistory();
}

document.addEventListener("click", function(event) {

  // Edit Subject Goal
  const editButton = event.target.closest(".edit-subject-goal");

  if (editButton) {
    const subject = editButton.dataset.subject;
    const hours = editButton.dataset.hours;

    $("goalSubject").value = subject;
    $("subjectGoalHours").value = hours;

    $("subjectGoalHours").focus();

    return;
  }

  // Delete Subject Goal
  const deleteButton = event.target.closest(".delete-subject-goal");

  if (deleteButton) {
    deleteSubjectGoal(deleteButton.dataset.subject);
  }

});

  
$("saveSubjectGoal").onclick = () => {
  const subject = $("goalSubject").value;
  const hours = Number($("subjectGoalHours").value);

  if (!hours || hours < 1 || hours > 300) {
    alert("Please enter a target between 1 and 300 hours.");
    return;
  }

  subjectGoals[subject] = hours;

  localStorage.setItem(
    "subjectGoals",
    JSON.stringify(subjectGoals)
  );

  $("subjectGoalHours").value = "";
renderSubjectGoals();
renderSubjectGoalHistory();
};

renderSubjectGoals();
renderSubjectGoalHistory();

renderTasks();
}
function renderSubjects(){$("subjectGrid").innerHTML=SUBJECTS.map(s=>{const p=subjectProgress[s]||0;return `<article class="subject-card"><div class="subject-top"><strong>${esc(s)}</strong><span>${p}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div><small>Self-reported syllabus completion</small><div class="subject-actions"><button data-progress="${esc(s)}" data-delta="-5">−5%</button><button data-progress="${esc(s)}" data-delta="5">+5%</button><button data-progress="${esc(s)}" data-delta="10">+10%</button></div></article>`}).join("")}
function renderAnalytics(){const days=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=d.toLocaleDateString("en-CA");const mins=sessions.filter(s=>s.date===key).reduce((a,s)=>a+s.minutes,0);days.push({key,label:d.toLocaleDateString(undefined,{weekday:"short"}),mins})}const total=days.reduce((a,d)=>a+d.mins,0);
                           // Weekly Performance Summary

$("performanceWeeklyHours").textContent =
  (total / 60).toFixed(1) + "h";

// Find most studied subject this week
const weeklyTopSubjects = {};

days.forEach(day => {
  sessions
    .filter(s => s.date === day.key)
    .forEach(s => {
      const subject = s.subject || "Other";

      weeklyTopSubjects[subject] =
        (weeklyTopSubjects[subject] || 0) +
        Number(s.minutes || 0);
    });
});

const topSubject = Object.entries(weeklyTopSubjects)
  .sort((a, b) => b[1] - a[1])[0];

$("performanceTopSubject").textContent =
  topSubject ? topSubject[0] : "No data";
                           // Weekly Goal Achievement

const dailyTarget = Number(
  (typeof dailyGoal !== "undefined" && dailyGoal) || 6
);

const weeklyTargetMinutes = dailyTarget * 7 * 60;

const achievement = weeklyTargetMinutes > 0
  ? (total / weeklyTargetMinutes) * 100
  : 0;

$("performanceGoalAchievement").textContent =
  achievement.toFixed(0) + "%";
                           // Weekly Study Consistency

const studyDays = days.filter(day => day.mins > 0).length;

$("performanceStudyDays").textContent =
  studyDays + " / 7 Days";
                           // Average Daily Study

const averageDailyStudy = total / 7 / 60;

$("performanceDailyAverage").textContent =
  averageDailyStudy.toFixed(1) + "h";
                           // Weekly Performance Insight

let weeklyInsight = "";

if (total === 0) {
  weeklyInsight = "Start studying today to build your weekly progress.";
} else if (achievement >= 100 && studyDays >= 5) {
  weeklyInsight = "Excellent! You achieved your weekly study target.";
} else if (studyDays >= 5) {
  weeklyInsight = "Great consistency! Keep maintaining your daily routine.";
} else if (achievement >= 70) {
  weeklyInsight = "Good progress! Try to study more regularly.";
} else {
  weeklyInsight = "Focus on completing your weekly study target regularly.";
}

$("weeklyPerformanceInsight").textContent = weeklyInsight;

$("weekHours").textContent =
  (total / 60).toFixed(1) + "h";$("dailyAverage").textContent=(total/7/60).toFixed(1)+"h";$("sessionCount").textContent=days.reduce((a,d)=>a+sessions.filter(s=>s.date===d.key).length,0);$("weeklyChart").innerHTML=days.map(d=>`<div class="bar-item"><b>${(d.mins/60).toFixed(1)}h</b><div class="bar" style="height:${Math.max(3,d.mins/Math.max(360,...days.map(x=>x.mins))*100)}%"></div><small>${d.label}</small></div>`).join("");
                           const subjectTotals = {};

sessions.forEach(s => {
  const subject = s.subject || "Other";
  subjectTotals[subject] = (subjectTotals[subject] || 0) + Number(s.minutes || 0);
});

const subjectEntries = Object.entries(subjectTotals)
  .sort((a, b) => b[1] - a[1]);

$("subjectAnalytics").innerHTML = subjectEntries.map(([subject, minutes]) => `
  <div class="task-row">
    <div class="task-info">
      <div class="task-name">${esc(subject)}</div>
      <div class="task-meta">${(minutes / 60).toFixed(1)} hours studied</div>
    </div>
  </div>
`).join("") || `<div class="empty">No subject study data yet.</div>`;// Weekly Subject Goal Report
const weeklySubjectTotals = {};

days.forEach(day => {
  sessions
    .filter(s => s.date === day.key)
    .forEach(s => {
      const subject = s.subject || "Other";

      weeklySubjectTotals[subject] =
        (weeklySubjectTotals[subject] || 0) +
        Number(s.minutes || 0);
    });
});

const weeklyEntries = Object.entries(weeklySubjectTotals);

$("weeklySubjectGoalReport").innerHTML =
  weeklyEntries.map(([subject, minutes]) => {

    const studiedHours = minutes / 60;
    const targetHours = Number(subjectGoals[subject] || 0);

    const progress = targetHours > 0
      ? Math.min(100, studiedHours / targetHours * 100)
      : 0;

    return `
      <div class="task-row">
        <div class="task-info">
          <div class="task-name">${esc(subject)}</div>
          <div class="task-meta">
            Studied: ${studiedHours.toFixed(1)}h
            | Weekly Target: ${targetHours}h
          </div>
          <div style="background:#334155;height:8px;border-radius:10px;overflow:hidden;margin-top:8px;">
            <div style="width:${progress}%;height:100%;background:#22c55e;"></div>
          </div>
          <small>${progress.toFixed(0)}% of weekly target</small>
        </div>
      </div>
    `;
  }).join("") ||
  `<div class="empty">No study sessions this week.</div>`;
                           // Monthly Performance Insight
const now = new Date();

const currentMonthSessions = sessions.filter(session => {
  const sessionDate = new Date(session.date + "T00:00:00");

  return (
    sessionDate.getMonth() === now.getMonth() &&
    sessionDate.getFullYear() === now.getFullYear()
  );
});

const monthlyMinutes = currentMonthSessions.reduce(
  (sum, session) => sum + Number(session.minutes || 0),
  0
);

const monthlyStudyDays = new Set(
  currentMonthSessions.map(session => session.date)
).size;

const monthlyHours = monthlyMinutes / 60;

let monthlyInsight = "";

if (monthlyMinutes === 0) {
  monthlyInsight = "Start studying today to build your monthly progress.";
} else if (monthlyHours >= 100 && monthlyStudyDays >= 20) {
  monthlyInsight = "Excellent monthly performance! Keep maintaining your consistency.";
} else if (monthlyStudyDays >= 15) {
  monthlyInsight = "Great effort! You are building a consistent study routine.";
} else if (monthlyHours >= 30) {
  monthlyInsight = "Good progress! Try to maintain a more regular study schedule.";
} else {
  monthlyInsight = "Keep working towards your monthly study goals. Every session counts.";
}

$("monthlyPerformanceInsight").textContent = monthlyInsight;
                           // Monthly Study Statistics

const daysInMonth = new Date(
  now.getFullYear(),
  now.getMonth() + 1,
  0
).getDate();

$("monthlyTotalHours").textContent =
  monthlyHours.toFixed(1) + "h";

$("monthlyStudyDays").textContent =
  monthlyStudyDays + (monthlyStudyDays === 1 ? " Day" : " Days");

const monthlyDailyAverage =
  monthlyMinutes / daysInMonth / 60;

$("monthlyDailyAverage").textContent =
  monthlyDailyAverage.toFixed(1) + "h";
                           // Monthly Study Chart

const monthlyDailyData = [];

for (let day = 1; day <= daysInMonth; day++) {
  const dateKey =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const minutes = currentMonthSessions
    .filter(session => session.date === dateKey)
    .reduce((sum, session) => sum + Number(session.minutes || 0), 0);

  monthlyDailyData.push({
    day,
    minutes
  });
}

const maxMonthlyMinutes = Math.max(
  60,
  ...monthlyDailyData.map(item => item.minutes)
);

if (monthlyMinutes === 0) {
  $("monthlyStudyChart").innerHTML =
    '<p class="muted">No study sessions recorded this month. Start studying to see your chart.</p>';
} else {
  $("monthlyStudyChart").innerHTML = monthlyDailyData.map(item => `
    <div
      class="bar-item"
      title="Day ${item.day}: ${(item.minutes / 60).toFixed(1)} hours studied"
    >
      <b>${(item.minutes / 60).toFixed(1)}h</b>
      <div
        class="bar"
        style="height:${Math.max(3, item.minutes / maxMonthlyMinutes * 100)}%"
      ></div>
      <small>${item.day}</small>
    </div>
  `).join("");
}
                           // Monthly Subject Performance

const monthlySubjectTotals = {};

currentMonthSessions.forEach(session => {
  const subject = session.subject || "Other";

  monthlySubjectTotals[subject] =
    (monthlySubjectTotals[subject] || 0) +
    Number(session.minutes || 0);
});

const monthlySubjectEntries = Object.entries(
  monthlySubjectTotals
).sort((a, b) => b[1] - a[1]);

const monthlySubjectContainer = $("monthlySubjectPerformance");

if (monthlySubjectEntries.length === 0) {
  monthlySubjectContainer.innerHTML =
    '<p class="muted">No subject study data available this month.</p>';
} else {
  const maxSubjectMinutes = Math.max(
    ...monthlySubjectEntries.map(item => item[1])
  );

  monthlySubjectContainer.innerHTML = monthlySubjectEntries.map(
    ([subject, minutes]) => `
      <div class="subject-progress" style="margin-top:14px;">
        <div style="display:flex;justify-content:space-between;gap:10px;">
          <strong>${esc(subject)}</strong>
          <span>${(minutes / 60).toFixed(1)}h</span>
        </div>
        <div class="progress-track" style="margin-top:8px;">
          <div
            class="progress-fill"
            style="width:${minutes / maxSubjectMinutes * 100}%"
          ></div>
        </div>
      </div>
    `
  ).join("");
}

// Monthly Study Goal

const monthlyGoalTarget = Number(
  localStorage.getItem("monthlyGoalTarget") || 120
);

$("monthlyGoalInput").value = monthlyGoalTarget;

const monthlyGoalPercentage = Math.min(
  100,
  Math.round((monthlyMinutes / (monthlyGoalTarget * 60)) * 100)
);

$("monthlyGoalTarget").textContent =
  monthlyGoalTarget + "h";

$("monthlyGoalCompleted").textContent =
  monthlyHours.toFixed(1) + "h";

$("monthlyGoalPercentage").textContent =
  monthlyGoalPercentage + "%";

$("monthlyGoalProgressBar").style.width =
  monthlyGoalPercentage + "%";

// Monthly Goal Achievement Insight

let monthlyGoalInsight = "";

const remainingHours = Math.max(
  0,
  monthlyGoalTarget - monthlyHours
);

if (monthlyGoalPercentage >= 100) {
  monthlyGoalInsight =
    "Excellent! You have achieved your monthly study goal.";
} else if (monthlyGoalPercentage >= 75) {
  monthlyGoalInsight =
    `Great progress! ${remainingHours.toFixed(1)} hours remaining.`;
} else if (monthlyGoalPercentage >= 40) {
  monthlyGoalInsight =
    `Good effort! You have completed ${monthlyGoalPercentage}% of your monthly goal.`;
} else if (monthlyHours > 0) {
  monthlyGoalInsight =
    `${monthlyGoalPercentage}% completed. ${remainingHours.toFixed(1)} hours remaining.`;
} else {
  monthlyGoalInsight =
    "Start your monthly study goal with your first study session!";
}

$("monthlyGoalInsight").textContent = monthlyGoalInsight;

$("recentSessions").innerHTML=sessions.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,8).map(s=>`<div class="task-row"><div class="task-info"><div class="task-name">${esc(s.subject)}</div><div class="task-meta">${esc(s.date)} · ${s.minutes} minutes</div></div></div>`).join("")||`<div class="empty">No completed sessions yet.</div>`}

function renderStudyStreak() {
  // Collect unique study dates
  const studyDates = [...new Set(
    sessions
      .filter(s => s.date)
      .map(s => s.date)
  )].sort();

  const totalDays = studyDates.length;

  if (totalDays === 0) {
    $("currentStudyStreak").textContent = "0 Days";
    $("longestStudyStreak").textContent = "0 Days";
    $("totalStudyDays").textContent = "0 Days";
    $("studyStreakInsight").textContent =
      "Start studying to build your streak!";
    return;
  }

  // Convert date strings into local calendar dates
  const dateObjects = studyDates.map(date => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day);
  });

  // Calculate longest streak
  let longestStreak = 1;
  let currentSequence = 1;

  for (let i = 1; i < dateObjects.length; i++) {
    const difference = Math.round(
      (dateObjects[i] - dateObjects[i - 1]) / 86400000
    );

    if (difference === 1) {
      currentSequence++;
    } else {
      currentSequence = 1;
    }

    longestStreak = Math.max(
      longestStreak,
      currentSequence
    );
  }

  // Calculate current streak
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const lastStudyDate = dateObjects[dateObjects.length - 1];

  const daysSinceLastStudy = Math.round(
    (todayDate - lastStudyDate) / 86400000
  );

  let currentStreak = 0;

  if (daysSinceLastStudy <= 1) {
    currentStreak = 1;

    for (let i = dateObjects.length - 1; i > 0; i--) {
      const difference = Math.round(
        (dateObjects[i] - dateObjects[i - 1]) / 86400000
      );

      if (difference === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Display streak statistics
  $("currentStudyStreak").textContent =
    currentStreak + (currentStreak === 1 ? " Day" : " Days");

  $("longestStudyStreak").textContent =
    longestStreak + (longestStreak === 1 ? " Day" : " Days");

  $("totalStudyDays").textContent =
    totalDays + (totalDays === 1 ? " Day" : " Days");

  // Display insight
  let insight = "";

  if (currentStreak >= 7) {
    insight = "Excellent consistency! Keep maintaining your study streak.";
  } else if (currentStreak >= 3) {
    insight = "Great progress! Keep studying daily to extend your streak.";
  } else if (currentStreak > 0) {
    insight = "Good start! Try to study consistently every day.";
  } else {
    insight = "Your streak has ended. Start a new streak with today's study session.";
  }

  $("studyStreakInsight").textContent = insight;
}

function renderAll(){renderStudyStreak();renderDashboard();renderSubjects();renderAnalytics();$("plannerDate").value=selectedDate;$("todayLabel").textContent=dateLabel(today()).toUpperCase()}
// UPSC COMMANDER Reminder Settings

const reminderInputs = [
  "studyStartTime",
  "goalReminderTime",
  "taskReminderTime",
  "studyStartEnabled",
  "goalReminderEnabled",
  "taskReminderEnabled"
];

function loadReminderSettings() {
  reminderInputs.forEach(id => {
    const saved = localStorage.getItem("upsc_reminder_" + id);
    if (saved !== null && $(id)) {
      if ($(id).type === "checkbox") {
        $(id).checked = saved === "true";
      } else {
        $(id).value = saved;
      }
    }
  });
}

$("saveReminderSettings").addEventListener("click", () => {
  reminderInputs.forEach(id => {
    const element = $(id);
    if (element) {
      localStorage.setItem(
        "upsc_reminder_" + id,
        element.type === "checkbox"
          ? String(element.checked)
          : element.value
      );
    }
  });

  $("reminderStatus").textContent =
    "Reminder settings saved successfully.";

  toast("Reminder settings saved!");
});

loadReminderSettings();
// Automatic Study Reminders

function checkStudyReminders() {
  if (Notification.permission !== "granted") return;

  const now = new Date();
  const currentTime =
  String(now.getHours()).padStart(2, "0") + ":" +
  String(now.getMinutes()).padStart(2, "0");
  const today = now.toISOString().slice(0, 10);

    console.log("REMINDER CHECK:", {
    permission: Notification.permission,
    currentTime,
    studyTime: localStorage.getItem("upsc_reminder_studyStartTime"),
    studyEnabled: localStorage.getItem("upsc_reminder_studyStartEnabled")
  });

  const reminders = [
    {
      id: "studyStart",
      time: "studyStartTime",
      enabled: "studyStartEnabled",
      title: "Study Time!",
      body: "Your UPSC study session is waiting."
    },
    {
      id: "goalReminder",
      time: "goalReminderTime",
      enabled: "goalReminderEnabled",
      title: "Daily Goal Reminder",
      body: "Check your daily study target."
    },
    {
      id: "taskReminder",
      time: "taskReminderTime",
      enabled: "taskReminderEnabled",
      title: "Pending Tasks Reminder",
      body: "Review your pending UPSC tasks."
    }
  ];
  reminders.forEach(item => {
    const time = localStorage.getItem("upsc_reminder_" + item.time);
    const enabled = localStorage.getItem("upsc_reminder_" + item.enabled);
    const sentKey = "upsc_sent_" + item.id + "_" + today;

    if (
      enabled === "true" &&
      time === currentTime &&
      localStorage.getItem(sentKey) !== "true"
    ) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(item.title, {
          body: item.body,
          icon: "./icon-192.png"
        });
      });

      localStorage.setItem(sentKey, "true");
    }
  });
}

setInterval(checkStudyReminders, 30000);
checkStudyReminders();
// Test Browser Notification

$("testNotification").addEventListener("click", async () => {
  try {
    if (!("serviceWorker" in navigator)) {
      $("reminderStatus").textContent = "Service Worker not supported.";
      return;
    }

    if (!("Notification" in window)) {
      $("reminderStatus").textContent = "Notifications not supported.";
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      $("reminderStatus").textContent = "Permission not granted.";
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    await registration.showNotification("UPSC COMMANDER", {
      body: "Your study reminder is working!",
      icon: "./icon-192.png"
    });

    $("reminderStatus").textContent = "Test notification sent successfully.";

  } catch (error) {
    console.error(error);
    $("reminderStatus").textContent = "Notification error: " + error.message;
  }
});
function navigate(v){
  view=v;

  document.querySelectorAll(".view").forEach(el=>
    el.classList.add("hidden")
  );

  $("view-"+v).classList.remove("hidden");

  document.querySelectorAll(".nav-item[data-view]").forEach(b=>
    b.classList.toggle("active",b.dataset.view===v)
  );

  $("pageTitle").textContent=({
    dashboard:"Dashboard",
    planner:"Daily Planner",
    subjects:"Subject Tracker",
    timer:"Study Timer",
    analytics:"Analytics",
    reminders:"Reminders"
  })[v];
}
function setAuthMode(m){authMode=m;$("loginTab").classList.toggle("active",m==="login");$("registerTab").classList.toggle("active",m==="register");$("authSubmit").textContent=m==="login"?"Sign in":"Create account";$("password").autocomplete=m==="login"?"current-password":"new-password";$("authMessage").textContent=""}
$("loginTab").onclick=()=>setAuthMode("login");$("registerTab").onclick=()=>setAuthMode("register");


$("authForm").onsubmit = async e => {
  e.preventDefault();
  $("authMessage").textContent = "";

  if (!firebaseReady()) {
    $("authMessage").textContent =
      "Firebase is not configured yet.";
    return;
  }

  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    let credential;

    if (authMode === "register") {
      credential = await createUserWithEmailAndPassword(
        auth, email, password
      );

      const account = credential.user;

      await setDoc(doc(db, "users", account.uid), {
        uid: account.uid,
        email: account.email || "",
        createdAt: account.metadata.creationTime || "",
        lastLogin: account.metadata.lastSignInTime || "",
        accountStatus: "Active"
      });

    } else {
      credential = await signInWithEmailAndPassword(
        auth, email, password
      );
    }

  } catch (err) {
    $("authMessage").textContent = err.message;
  }
};

$("logoutButton").onclick=async()=>{if(!demo&&auth)await signOut(auth);user=null;demo=false;showAuth()};
$("saveDailyGoal").onclick = () => {
  const value = Number($("dailyGoalInput").value);

  if (!Number.isFinite(value) || value < 1 || value > 18) {
    toast("Please enter a goal between 1 and 18 hours.");
    return;
  }

  dailyGoal = value;
  writeLocal();
  renderDashboard();

  $("dailyGoalStatus").textContent =
    `Your daily target is ${dailyGoal} hours.`;

  toast("Daily goal saved!");
};

// Save Monthly Study Goal

$("saveMonthlyGoal").onclick = () => {
  const value = Number($("monthlyGoalInput").value);

  if (!Number.isFinite(value) || value < 1 || value > 500) {
    toast("Please enter a goal between 1 and 500 hours.");
    return;
  }

  localStorage.setItem("monthlyGoalTarget", value);

  $("monthlyGoalStatus").textContent =
    `Your monthly target is ${value} hours.`;

  renderAnalytics();

  toast("Monthly goal saved!");
};
$("taskForm").onsubmit=async e=>{e.preventDefault();await addTask({title:$("taskTitle").value.trim(),subject:$("taskSubject").value,minutes:Number($("taskMinutes").value),date:selectedDate});$("taskTitle").value="";toast("Task added")};
$("plannerDate").onchange=e=>{selectedDate=e.target.value||today();renderTasks()};
document.addEventListener("change",e=>{if(e.target.matches("[data-task-check]"))updateTask(e.target.dataset.taskCheck,{done:e.target.checked})});
document.addEventListener("click",e=>{const del=e.target.closest("[data-task-delete]");if(del)removeTask(del.dataset.taskDelete);const prog=e.target.closest("[data-progress]");if(prog){const s=prog.dataset.progress;subjectProgress[s]=Math.max(0,Math.min(100,(subjectProgress[s]||0)+Number(prog.dataset.delta)));saveProgress().then(renderAll);}});
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>navigate(b.dataset.view));document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>navigate(b.dataset.go));

$("timerStart").onclick = async () => {
  const limit = Number($("subjectTimeLimit").value);

  // Pause
  if (timerRunning) {
    clearInterval(timerInterval);

    timerElapsedBeforePause += Date.now() - timerStartedAt;
    timerStartedAt = null;
    timerRunning = false;

    $("timerStart").textContent = "Resume";
    return;
  }

  // Fresh session only
  if (!timerSessionActive) {
    if (!Number.isFinite(limit) || limit < 5 || limit > 600) {
      alert("Enter time between 5 and 600 minutes.");
      return;
    }

    timerSeconds = limit * 60;
    timerElapsedBeforePause = 0;
    timerSessionActive = true;
    updateTimerDisplay();
  }

  // Start or Resume
  timerRunning = true;
  timerStartedAt = Date.now();
  $("timerStart").textContent = "Pause";

  timerInterval = setInterval(async () => {
    timerSeconds--;
    updateTimerDisplay();

    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;

      const totalElapsed =
        timerElapsedBeforePause + (Date.now() - timerStartedAt);

      const mins = Math.max(1, Math.round(totalElapsed / 60000));

      timerStartedAt = null;
      timerElapsedBeforePause = 0;
      timerSessionActive = false;

      await recordSession($("timerSubject").value, mins);

      timerSeconds = 0;
      updateTimerDisplay();

      $("timerStart").textContent = "Start";
      $("timerStatus").textContent = "Subject time completed!";

      alert("Subject time completed!");
      toast("Focus session recorded!");
    }
  }, 1000);
};

function updateTimerDisplay() {
  $("timerDisplay").textContent =
    `${String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:${String(timerSeconds % 60).padStart(2, "0")}`;
}

$("subjectTimeLimit").addEventListener("change", () => {
  if (timerSessionActive) {
    alert("पहले Timer को Pause या Reset करें।");
    return;
  }

  const limit = Number($("subjectTimeLimit").value);

  if (!Number.isFinite(limit) || limit < 5 || limit > 600) {
    alert("समय 5 से 600 मिनट के बीच रखें।");
    return;
  }

  timerSeconds = limit * 60;
  timerElapsedBeforePause = 0;
  updateTimerDisplay();

  $("subjectTimeStatus").textContent =
    `Your subject time limit is ${limit} minutes.`;
});

$("timerReset").onclick = () => {
  clearInterval(timerInterval);
  timerRunning = false;
  timerStartedAt = null;
  timerElapsedBeforePause = 0;
 timerSessionActive = false;

  const limit = Number($("subjectTimeLimit").value);
  timerSeconds = limit >= 5 && limit <= 600 ? limit * 60 : 25 * 60;

  updateTimerDisplay();
  $("timerStart").textContent = "Start";
  $("timerStatus").textContent = "Timer reset.";
};
document.querySelectorAll("[data-minutes]").forEach(b => {
  b.onclick = () => {
    clearInterval(timerInterval);
    timerRunning = false;
    timerStartedAt = null;

    const minutes = Number(b.dataset.minutes);
    $("subjectTimeLimit").value = minutes;
    timerSeconds = minutes * 60;

    updateTimerDisplay();
    $("timerStart").textContent = "Start";
  };
});
$("exportButton").onclick = () => {
  const blob = new Blob(
    [
      JSON.stringify({
        tasks,
        sessions,
        subjectProgress,
subjectGoals,
dailyGoal,
monthlyGoal: Number(localStorage.getItem("monthlyGoalTarget") || 120),
exportedAt: new Date().toISOString()
      }, null, 2)
    ],
    { type: "application/json" }
  );

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "upsc-commander-backup.json";
  a.click();

  URL.revokeObjectURL(a.href);
  toast("Backup downloaded");
};

// CSV Study Report Export

$("downloadStudyCSV").onclick = () => {
  if (!sessions || sessions.length === 0) {
    $("studyReportStatus").textContent =
      "No study sessions available to export.";
    return;
  }

  const csvEscape = value => {
    let text = String(value ?? "");

    if (/^[=+\-@]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  };

  const rows = [
    ["Subject", "Minutes", "Date"],
    ...sessions.map(session => [
      session.subject,
      session.minutes,
      session.date
    ])
  ];

  const csv = rows
    .map(row => row.map(csvEscape).join(","))
    .join("\n");

  const blob = new Blob(
    ["\uFEFF" + csv],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "upsc-commander-study-report.csv";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  $("studyReportStatus").textContent =
    "CSV study report downloaded successfully.";

  toast("CSV report downloaded!");
};

// Firebase Cloud Data Restore

$("importButton").onclick = () => {
  $("importFile").click();
};

$("importFile").onchange = async (event) => {
  const file = event.target.files[0];

  if (!file) return;

  try {
    if (demo || !user) {
      throw new Error("Please sign in using Firebase Cloud Mode.");
    }

    const data = JSON.parse(await file.text());

    if (
      !data ||
      !Array.isArray(data.tasks) ||
      !Array.isArray(data.sessions) ||
      !data.subjectProgress ||
      typeof data.subjectProgress !== "object" ||
      Array.isArray(data.subjectProgress)
    ) {
      throw new Error("Invalid backup file.");
    }

    const importedTasks = data.tasks;
    const importedSessions = data.sessions;
    const importedProgress = data.subjectProgress;

    if (
      !importedTasks.every(item => item && typeof item === "object" && !Array.isArray(item)) ||
      !importedSessions.every(item => item && typeof item === "object" && !Array.isArray(item))
    ) {
      throw new Error("Backup contains invalid records.");
    }

    const confirmed = confirm(
      "This will replace your existing Cloud Tasks, Sessions and Subject Progress. Continue?"
    );

    if (!confirmed) return;

    $("studyReportStatus").textContent =
      "Preparing Firebase restore...";

    const tasksRef = collection(db, "users", user.uid, "tasks");
    const sessionsRef = collection(db, "users", user.uid, "sessions");
    const progressRef = doc(db, "users", user.uid, "settings", "progress");

    const [oldTasks, oldSessions] = await Promise.all([
      getDocs(tasksRef),
      getDocs(sessionsRef)
    ]);

    const operationCount =
      oldTasks.size +
      oldSessions.size +
      importedTasks.length +
      importedSessions.length +
      1;

    if (operationCount > 500) {
      throw new Error(
        "Too many records for one safe restore operation. No data was changed."
      );
    }

    const batch = writeBatch(db);

    oldTasks.docs.forEach(item => batch.delete(item.ref));
    oldSessions.docs.forEach(item => batch.delete(item.ref));

    const restoredTasks = [];
    const restoredSessions = [];

    importedTasks.forEach(item => {
      const { id, ...taskData } = item;
      const newRef = doc(tasksRef);

      batch.set(newRef, taskData);
      restoredTasks.push({ id: newRef.id, ...taskData });
    });

    importedSessions.forEach(item => {
      const { id, ...sessionData } = item;
      const newRef = doc(sessionsRef);

      batch.set(newRef, sessionData);
      restoredSessions.push({ id: newRef.id, ...sessionData });
    });

    batch.set(
      progressRef,
      { values: importedProgress },
      { merge: true }
    );

    await batch.commit();

    tasks = restoredTasks;
    sessions = restoredSessions;
    subjectProgress = importedProgress;
if (data.subjectGoals && typeof data.subjectGoals === "object") {
  subjectGoals = data.subjectGoals;

  localStorage.setItem(
    "subjectGoals",
    JSON.stringify(subjectGoals)
  );
}
    if (
      Number.isFinite(Number(data.dailyGoal)) &&
      Number(data.dailyGoal) >= 1 &&
      Number(data.dailyGoal) <= 18
    ) {
      const localData = readLocal();
      localData.dailyGoal = Number(data.dailyGoal);

      localStorage.setItem(
        localKey(),
        JSON.stringify(localData)
      );

      dailyGoal = Number(data.dailyGoal);
    }
if (
  Number.isFinite(Number(data.monthlyGoal)) &&
  Number(data.monthlyGoal) >= 1
) {
  localStorage.setItem(
    "monthlyGoalTarget",
    Number(data.monthlyGoal)
  );
 if (typeof monthlyGoal !== "undefined") {
  monthlyGoal = Number(data.monthlyGoal);
}
}
    $("dailyGoalInput").value = dailyGoal;

    renderAll();

    $("studyReportStatus").textContent =
      "Firebase study data restored successfully.";

    toast("Cloud data restored successfully!");

  } catch (error) {
    console.error("Restore error:", error);

    $("studyReportStatus").textContent =
      "Restore failed. Your existing data was not intentionally changed.";

    alert(error.message || "Unable to restore backup.");

  } finally {
    event.target.value = "";
  }
};

// PDF Study Report Export

$("downloadStudyPDF").onclick = () => {
  if (!sessions || sessions.length === 0) {
    $("studyReportStatus").textContent =
      "No study sessions available to export.";
    return;
  }

  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    $("studyReportStatus").textContent =
      "Please allow pop-ups to generate your PDF report.";
    return;
  }

  const totalMinutes = sessions.reduce(
    (sum, session) => sum + Number(session.minutes || 0),
    0
  );

  const totalHours = (totalMinutes / 60).toFixed(2);

  const subjectTotals = {};

  sessions.forEach(session => {
    const subject = session.subject || "Other";

    subjectTotals[subject] =
      (subjectTotals[subject] || 0) +
      Number(session.minutes || 0);
  });

  const subjectRows = Object.entries(subjectTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([subject, minutes]) => `
      <tr>
        <td>${esc(subject)}</td>
        <td>${(minutes / 60).toFixed(2)} hours</td>
      </tr>
    `).join("");

  const sessionRows = sessions
    .slice()
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map(session => `
      <tr>
        <td>${esc(session.date || "")}</td>
        <td>${esc(session.subject || "Other")}</td>
        <td>${Number(session.minutes || 0)} min</td>
      </tr>
    `).join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>UPSC Commander Study Report</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 30px;
          color: #1e293b;
        }

        h1, h2 {
          color: #1d4ed8;
        }

        .summary {
          display: flex;
          gap: 20px;
          margin: 20px 0;
        }

        .summary div {
          border: 1px solid #cbd5e1;
          padding: 15px;
          flex: 1;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }

        th, td {
          border: 1px solid #cbd5e1;
          padding: 10px;
          text-align: left;
        }

        th {
          background: #e2e8f0;
        }

        @media print {
          button { display: none; }
        }
      </style>
    </head>

    <body>
      <h1>UPSC COMMANDER</h1>
      <p>Study Performance Report</p>
      <p>Generated: ${new Date().toLocaleString()}</p>

      <div class="summary">
        <div>
          <h2>${sessions.length}</h2>
          <p>Total Sessions</p>
        </div>
        <div>
          <h2>${totalHours}h</h2>
          <p>Total Study Hours</p>
        </div>
      </div>

      <h2>Subject-wise Performance</h2>
      <table>
        <tr><th>Subject</th><th>Study Hours</th></tr>
        ${subjectRows}
      </table>

      <h2>Study Session History</h2>
      <table>
        <tr><th>Date</th><th>Subject</th><th>Duration</th></tr>
        ${sessionRows}
      </table>

      <button onclick="window.print()">Save as PDF</button>
    </body>
    </html>
  `);

  printWindow.document.close();

  $("studyReportStatus").textContent =
    "PDF report opened. Select Save as PDF in the print window.";
};

if (firebaseReady()) {
  try {
    const app = initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getFirestore(app);

    let authCheckRunning = false;

    onAuthStateChanged(auth, async (u) => {
      if (authCheckRunning) return;

      if (!u) {
        user = null;
        if (!demo) showAuth();
        return;
      }

      authCheckRunning = true;
      user = u;

      try {
        const userRef = doc(db, "users", u.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          throw new Error("User profile not found.");
        }

        const accountStatus = String(userSnap.data().accountStatus || "").trim();

        if (accountStatus !== "Active") {
          user = null;

          $("authMessage").textContent =
            accountStatus === "Suspended"
              ? "Your account is suspended. Please contact the administrator."
              : "Your account status could not be verified.";

          await signOut(auth);
          showAuth();
          return;
        }

        await loadCloud();
        setMode("cloud");
        showApp();

      } catch (e) {
        console.error("Account verification error:", e);

        user = null;
        $("authMessage").textContent =
          "Account verification failed. Please try again.";

        if (auth.currentUser) {
          await signOut(auth);
        }

        showAuth();

      } finally {
        authCheckRunning = false;
      }
    });

  } catch (e) {
    console.error("Firebase init error", e);
  }
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
   
  });
}

