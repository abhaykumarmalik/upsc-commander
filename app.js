// UPSC COMMANDER - v1.0
// Firebase config is intentionally blank. Demo mode works without Firebase.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, collection, getDocs, setDoc, addDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBYf0Xh3RSLlxOEDoEEnyTPvw6ZYf9RreI",
  authDomain: "upsc-commander.firebaseapp.com",
  projectId: "upsc-commander",
  storageBucket: "upsc-commander.firebasestorage.app",
  messagingSenderId: "621957377517",
  appId: "1:621957377517:web:57060b9a2d26a7a7d48be4"
};
const SUBJECTS = ["Polity","History","Geography","Economy","Environment","Science & Technology","Current Affairs","CSAT","Ethics"];
const $ = id => document.getElementById(id);
const today = () => new Date().toLocaleDateString("en-CA");
let user = null, demo = false, auth = null, db = null, taskUnsub = null;
let tasks = [], sessions = [], subjectProgress = {}, view = "dashboard", authMode = "login";
let timerSeconds = 25*60, timerInterval = null, timerRunning = false, timerStartedAt = null;
let selectedDate = today();

const localKey = () => "upsc_commander_demo_v1";
function readLocal(){ try{return JSON.parse(localStorage.getItem(localKey())) || {tasks:[],sessions:[],subjectProgress:{}}}catch{return {tasks:[],sessions:[],subjectProgress:{}}} }
function writeLocal(){localStorage.setItem(localKey(),JSON.stringify({tasks,sessions,subjectProgress}));}
function firebaseReady(){return FIREBASE_CONFIG.apiKey.startsWith("AIza") && !FIREBASE_CONFIG.projectId.startsWith("PASTE");}
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dateLabel(d){return new Date(d+"T12:00:00").toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"short"})}
function dayTasks(){return tasks.filter(t=>t.date===selectedDate)}
function todaySessions(){return sessions.filter(s=>s.date===today())}
function minutesToday(){return todaySessions().reduce((a,s)=>a+s.minutes,0)}
function fmtMinutes(m){return `${Math.floor(m/60)}h ${String(m%60).padStart(2,"0")}m`}
function setMode(name){demo=name==="demo";$("modePill").textContent=demo?"● DEMO MODE":"● CLOUD SYNC";$("avatar").textContent=(user?.email||"A")[0].toUpperCase()}
function showApp(){ $("authScreen").classList.add("hidden");$("app").classList.remove("hidden");populateSubjects();renderAll(); }
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
function renderDashboard(){const mins=minutesToday(),hours=mins/60,pct=Math.min(100,mins/360*100);$("todayHours").textContent=hours.toFixed(1)+"h";$("targetRing").style.background=`conic-gradient(var(--green) ${pct*3.6}deg,#254456 0deg)`;$("statStudy").textContent=fmtMinutes(mins);const total=Object.values(subjectProgress).reduce((a,b)=>a+b,0);$("statSyllabus").textContent=Math.round(total/SUBJECTS.length)+"%";renderTasks()}
function renderSubjects(){$("subjectGrid").innerHTML=SUBJECTS.map(s=>{const p=subjectProgress[s]||0;return `<article class="subject-card"><div class="subject-top"><strong>${esc(s)}</strong><span>${p}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div><small>Self-reported syllabus completion</small><div class="subject-actions"><button data-progress="${esc(s)}" data-delta="-5">−5%</button><button data-progress="${esc(s)}" data-delta="5">+5%</button><button data-progress="${esc(s)}" data-delta="10">+10%</button></div></article>`}).join("")}
function renderAnalytics(){const days=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=d.toLocaleDateString("en-CA");const mins=sessions.filter(s=>s.date===key).reduce((a,s)=>a+s.minutes,0);days.push({key,label:d.toLocaleDateString(undefined,{weekday:"short"}),mins})}const total=days.reduce((a,d)=>a+d.mins,0);$("weekHours").textContent=(total/60).toFixed(1)+"h";$("dailyAverage").textContent=(total/7/60).toFixed(1)+"h";$("sessionCount").textContent=days.reduce((a,d)=>a+sessions.filter(s=>s.date===d.key).length,0);$("weeklyChart").innerHTML=days.map(d=>`<div class="bar-item"><b>${(d.mins/60).toFixed(1)}h</b><div class="bar" style="height:${Math.max(3,d.mins/Math.max(360,...days.map(x=>x.mins))*100)}%"></div><small>${d.label}</small></div>`).join("");$("recentSessions").innerHTML=sessions.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,8).map(s=>`<div class="task-row"><div class="task-info"><div class="task-name">${esc(s.subject)}</div><div class="task-meta">${esc(s.date)} · ${s.minutes} minutes</div></div></div>`).join("")||`<div class="empty">No completed sessions yet.</div>`}
function renderAll(){renderDashboard();renderSubjects();renderAnalytics();$("plannerDate").value=selectedDate;$("todayLabel").textContent=dateLabel(today()).toUpperCase()}
function navigate(v){view=v;document.querySelectorAll(".view").forEach(el=>el.classList.add("hidden"));$("view-"+v).classList.remove("hidden");document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===v));$("pageTitle").textContent=({dashboard:"Dashboard",planner:"Daily Planner",subjects:"Subject Tracker",timer:"Study Timer",analytics:"Analytics"})[v]}
function setAuthMode(m){authMode=m;$("loginTab").classList.toggle("active",m==="login");$("registerTab").classList.toggle("active",m==="register");$("authSubmit").textContent=m==="login"?"Sign in":"Create account";$("password").autocomplete=m==="login"?"current-password":"new-password";$("authMessage").textContent=""}
$("loginTab").onclick=()=>setAuthMode("login");$("registerTab").onclick=()=>setAuthMode("register");
$("authForm").onsubmit=async e=>{e.preventDefault();$("authMessage").textContent="";if(!firebaseReady()){ $("authMessage").textContent="Firebase is not configured yet. Use demo mode or follow README setup.";return}try{const email=$("email").value.trim(),password=$("password").value;if(authMode==="register")await createUserWithEmailAndPassword(auth,email,password);else await signInWithEmailAndPassword(auth,email,password)}catch(err){$("authMessage").textContent=err.message}}
$("demoButton").onclick=()=>{user={email:"Demo Aspirant"};const d=readLocal();tasks=d.tasks;sessions=d.sessions;subjectProgress=d.subjectProgress;setMode("demo");showApp();toast("Demo mode ready")};
$("logoutButton").onclick=async()=>{if(!demo&&auth)await signOut(auth);user=null;demo=false;showAuth()};
$("taskForm").onsubmit=async e=>{e.preventDefault();await addTask({title:$("taskTitle").value.trim(),subject:$("taskSubject").value,minutes:Number($("taskMinutes").value),date:selectedDate});$("taskTitle").value="";toast("Task added")};
$("plannerDate").onchange=e=>{selectedDate=e.target.value||today();renderTasks()};
document.addEventListener("change",e=>{if(e.target.matches("[data-task-check]"))updateTask(e.target.dataset.taskCheck,{done:e.target.checked})});
document.addEventListener("click",e=>{const del=e.target.closest("[data-task-delete]");if(del)removeTask(del.dataset.taskDelete);const prog=e.target.closest("[data-progress]");if(prog){const s=prog.dataset.progress;subjectProgress[s]=Math.max(0,Math.min(100,(subjectProgress[s]||0)+Number(prog.dataset.delta)));saveProgress().then(renderAll);}});
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>navigate(b.dataset.view));document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>navigate(b.dataset.go));
$("timerStart").onclick=()=>{if(timerRunning){clearInterval(timerInterval);timerRunning=false;$("timerStart").textContent="Resume";$("timerStatus").textContent="Paused";return}timerRunning=true;if(!timerStartedAt)timerStartedAt=Date.now();$("timerStart").textContent="Pause";$("timerStatus").textContent="Stay with one task.";timerInterval=setInterval(async()=>{timerSeconds--;updateTimerDisplay();if(timerSeconds<=0){clearInterval(timerInterval);timerRunning=false;const mins=Math.max(1,Math.round((Date.now()-timerStartedAt)/60000));await recordSession($("timerSubject").value,mins);timerStartedAt=null;timerSeconds=25*60;updateTimerDisplay();$("timerStart").textContent="Start";$("timerStatus").textContent="Session complete. Take a short break.";toast("Focus session recorded!")}},1000)};
function updateTimerDisplay(){$("timerDisplay").textContent=`${String(Math.floor(timerSeconds/60)).padStart(2,"0")}:${String(timerSeconds%60).padStart(2,"0")}`}
$("timerReset").onclick=()=>{clearInterval(timerInterval);timerRunning=false;timerStartedAt=null;timerSeconds=25*60;updateTimerDisplay();$("timerStart").textContent="Start";$("timerStatus").textContent="Timer reset."};
document.querySelectorAll("[data-minutes]").forEach(b=>b.onclick=()=>{clearInterval(timerInterval);timerRunning=false;timerStartedAt=null;timerSeconds=Number(b.dataset.minutes)*60;updateTimerDisplay();$("timerStart").textContent="Start";document.querySelectorAll(".preset").forEach(x=>x.classList.toggle("active",x===b))});
$("exportButton").onclick=()=>{const blob=new Blob([JSON.stringify({tasks,sessions,subjectProgress,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="upsc-commander-backup.json";a.click();URL.revokeObjectURL(a.href);toast("Backup downloaded")};
if(firebaseReady()){try{const app=initializeApp(FIREBASE_CONFIG);auth=getAuth(app);db=getFirestore(app);onAuthStateChanged(auth,async u=>{if(u){user=u;try{await loadCloud();setMode("cloud");showApp()}catch(e){console.error(e);$("authMessage").textContent="Could not load cloud data: "+e.message;showAuth()}}else if(!demo){showAuth()}})}catch(e){console.error("Firebase init error",e)}}
if("serviceWorker" in navigator && location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn))}
