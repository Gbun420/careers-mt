/* public/script.js – Production Refactor Phase 1 */
"use strict";

import { matchesJobFilter } from "./job-filter.mjs";
import { resolveLoginRole } from "./role-policy.mjs";

const firebaseConfig = window.firebaseConfig || {};
if (!firebase.apps.length && firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
}

const hasFirebase = firebase.apps.length > 0;
const auth = hasFirebase ? firebase.auth() : null;
const db = hasFirebase ? firebase.firestore() : null;

if (!hasFirebase) {
  console.error("Firebase config missing. Run npm run build with NEXT_PUBLIC_FIREBASE_CONFIG.");
}

let currentUser = null;
let userRole = null;
let currentApplyJobId = null;
let currentApplyJobTitle = null;
let currentApplyEmployerId = null;
let currentApplyCompanyName = null;
let pendingApplyJobId = null;

async function ensureUserProfile(role) {
  if (!db || !currentUser) return;
  if (role !== "CANDIDATE") return;
  const userRef = db.collection("users").doc(currentUser.uid);
  await userRef.set(
    {
      role,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function loadUserRoleFromProfile(uid) {
  if (!db) return null;
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return data.role || null;
}

// ---------------------------------------------------------
// UI Navigation & Mode Isolation
// ---------------------------------------------------------
window.switchView = function(view) {
  if (["employer-dashboard", "employer-jobs", "post-job"].includes(view) && userRole !== "EMPLOYER") {
    showToast("Employer login required.");
    showAuthModal();
    return;
  }
  if (view === "candidate-applications" && userRole !== "CANDIDATE") {
    showToast("Candidate login required.");
    showAuthModal();
    return;
  }
  if (view === "admin-dashboard" && userRole !== "ADMIN") {
    showToast("Admin access required.");
    showAuthModal();
    return;
  }

  const sections = document.querySelectorAll(".page-view");
  sections.forEach(el => el.classList.replace("active-view", "hidden-view"));
  
  const target = document.getElementById(view);
  if (target) {
    target.classList.replace("hidden-view", "active-view");
  }

  window.location.hash = `#${view}`;

  if (view === "home") loadFeaturedJobs();
  if (view === "jobs") loadJobs();
  if (view === "candidate-applications") loadApplications();
  if (view === "employer-dashboard") loadEmployerDashboard();
  if (view === "employer-jobs") loadEmployerJobs();
};

function updateAuthUI(user, role) {
  const userInfo = document.getElementById("user-info");
  const btnLogout = document.getElementById("btn-logout");
  const btnLogin = document.getElementById("btn-login");
  const publicLinks = document.querySelector(".public-flow");
  const candidateLinks = document.querySelector(".candidate-flow");
  const employerLinks = document.querySelector(".employer-flow");
  const adminLinks = document.querySelector(".admin-flow");

  if (user) {
    const displayRole = role || "USER";
    userInfo.innerText = `${displayRole}: ${user.uid.slice(0, 5)}...`;
    userInfo.classList.remove("hidden");
    btnLogout.classList.remove("hidden");
    btnLogin.classList.add("hidden");
    if (role) publicLinks.classList.add("hidden");
    else publicLinks.classList.remove("hidden");

    if (role === "CANDIDATE") {
      candidateLinks.classList.remove("hidden");
      employerLinks.classList.add("hidden");
      adminLinks.classList.add("hidden");
    } else if (role === "EMPLOYER") {
      employerLinks.classList.remove("hidden");
      candidateLinks.classList.add("hidden");
      adminLinks.classList.add("hidden");
    } else if (role === "ADMIN") {
      adminLinks.classList.remove("hidden");
      candidateLinks.classList.add("hidden");
      employerLinks.classList.add("hidden");
    } else {
      candidateLinks.classList.add("hidden");
      employerLinks.classList.add("hidden");
      adminLinks.classList.add("hidden");
    }
  } else {
    userInfo.innerText = "";
    userInfo.classList.add("hidden");
    btnLogout.classList.add("hidden");
    btnLogin.classList.remove("hidden");
    publicLinks.classList.remove("hidden");
    candidateLinks.classList.add("hidden");
    employerLinks.classList.add("hidden");
    adminLinks.classList.add("hidden");
  }
}

// ---------------------------------------------------------
// Auth Logic
// ---------------------------------------------------------
window.showAuthModal = function() {
    document.getElementById("auth-modal").classList.remove("hidden");
};

window.login = async function(role) {
  if (!auth || !db) {
    showToast("Firebase is not configured. Check your build config.");
    return;
  }
  try {
    document.getElementById("auth-modal").classList.add("hidden");
    showToast(`Initializing ${role} session...`);
    const cred = await auth.signInAnonymously();
    currentUser = cred.user;

    const existingRole = await loadUserRoleFromProfile(currentUser.uid);
    const loginDecision = resolveLoginRole({
      existingRole,
      requestedRole: role
    });

    if (!loginDecision.allowed || !loginDecision.role) {
      await auth.signOut();
      currentUser = null;
      userRole = null;
      updateAuthUI(null, null);
      showToast(loginDecision.message || "Access denied.");
      return;
    }

    userRole = loginDecision.role;

    if (!existingRole && userRole === "CANDIDATE") {
      await ensureUserProfile(userRole);
    }

    updateAuthUI(currentUser, userRole);
    showToast("✅ Logged in successfully");
    
    if (role === "EMPLOYER") window.switchView("employer-dashboard");
    else window.switchView("jobs");

    if (role === "CANDIDATE" && pendingApplyJobId) {
      const targetJob = pendingApplyJobId;
      pendingApplyJobId = null;
      openApplyModal(targetJob);
    }
  } catch (err) {
    showToast(`❌ Connection Error: ${err.message}`);
  }
};

window.logout = async function() {
  if (!auth) return;
  await auth.signOut();
  currentUser = null;
  userRole = null;
  updateAuthUI(null, null);
  showToast("👋 Logged out");
  window.switchView("home");
};

if (auth) {
  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (!user) {
      userRole = null;
      updateAuthUI(null, null);
      return;
    }

    try {
      const profileRole = await loadUserRoleFromProfile(user.uid);
      if (profileRole) {
        userRole = profileRole;
        updateAuthUI(user, userRole);
        return;
      }
    } catch (e) {
      // ignore read errors, allow login flow to set role
    }

    userRole = null;
    updateAuthUI(user, null);
  });
}

// ---------------------------------------------------------
// Job Logic (Candidate)
// ---------------------------------------------------------
async function loadJobs() {
  const container = document.getElementById("jobs-container");
  container.innerHTML = "<p >Loading jobs...</p>";

  if (!db) {
    container.innerHTML = "<p >Firebase not configured.</p>";
    return;
  }

  try {
    const snap = await db.collection("jobs").where("status", "==", "active").get();
    container.innerHTML = snap.empty ? "<p >No jobs found.</p>" : "";
    
    snap.forEach(doc => {
      const job = doc.data();
      const salaryMin = typeof job.salaryMin === "number" ? job.salaryMin : 0;
      const salaryMax = typeof job.salaryMax === "number" ? job.salaryMax : 0;
      const salaryLabel = salaryMin && salaryMax
        ? `€${(salaryMin/1000).toFixed(0)}k - €${(salaryMax/1000).toFixed(0)}k`
        : "Salary not listed";
      const card = document.createElement("div");
      card.className = "bento-card mt-2 job-card";
      card.dataset.title = job.title || "";
      card.dataset.companyName = job.companyName || job.companyId || "Company";
      card.dataset.location = job.location || "";
      card.innerHTML = `
        <h4 class="job-title">${job.title}</h4>
        <p class="company-name">${job.companyName || job.companyId || 'Company'} • ${job.location || 'Malta'} • ${job.type || 'Full-time'}</p>
        <div class="mt-1">
          <span class="badge-salary">${salaryLabel}</span>
        </div>
        <button class="btn-neuro btn-sm mt-2" onclick="openApplyModal('${doc.id}')">Apply Now</button>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML = "<p >Failed to load jobs.</p>";
  }
}

// Load Featured Jobs for Landing Page
async function loadFeaturedJobs() {
  const container = document.getElementById("featured-jobs-container");
  if (!container) return;
  
  // Clear static placeholder jobs
  container.innerHTML = "<p>Loading featured jobs...</p>";
  
  if (!db) {
    container.innerHTML = "<p>Firebase not configured.</p>";
    return;
  }
  
  try {
    const snap = await db.collection("jobs")
      .where("status", "==", "active")
      .orderBy("createdAt", "desc")
      .limit(3)
      .get();
      
    if (snap.empty) {
      container.innerHTML = "<p>No featured jobs available.</p>";
      return;
    }
    
    container.innerHTML = "";
    
    snap.forEach(doc => {
      const job = doc.data();
      const salaryMin = typeof job.salaryMin === "number" ? job.salaryMin : 0;
      const salaryMax = typeof job.salaryMax === "number" ? job.salaryMax : 0;
      const salaryLabel = salaryMin && salaryMax
        ? `€${(salaryMin/1000).toFixed(0)}k-€${(salaryMax/1000).toFixed(0)}k`
        : "Salary not listed";
        
      const card = document.createElement("div");
      card.className = "job-card-2026";
      card.innerHTML = `
        <div class="job-card-2026__header">
          <div>
            <h3 class="job-card-2026__title">${job.title || "Untitled Position"}</h3>
            <p class="job-card-2026__company">${job.companyName || job.companyId || "Company"}</p>
          </div>
          <span class="job-card-2026__salary">${salaryLabel}</span>
        </div>
        <div class="job-card-2026__meta">
          <span>📍 ${job.location || "Malta"}</span>
          <span>💼 ${job.type || "Full-time"}</span>
          <span>🕒 ${formatTimeAgo(job.createdAt)}</span>
        </div>
        <p class="job-card-2026__description">${truncateText(job.description || "", 120)}</p>
        <button class="btn-neuro w-full job-card-2026__cta" onclick="openApplyModal('${doc.id}')">
          Apply Now
        </button>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    console.error("Error loading featured jobs:", e);
    container.innerHTML = "<p>Failed to load featured jobs.</p>";
  }
}

// Helper function to format time ago
function formatTimeAgo(timestamp) {
  if (!timestamp) return "Recently";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return "Recently";
}

// Helper function to truncate text
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Job Search Filtering Logic
function filterJobs() {
  const searchTerm = (document.getElementById("job-search")?.value || "").toLowerCase();
  const locationTerm = (document.getElementById("job-location")?.value || "").toLowerCase();
  const jobCards = document.querySelectorAll("#jobs-container .job-card");

  jobCards.forEach(card => {
    const job = {
      title: card.dataset.title || card.querySelector(".job-title")?.textContent || "",
      companyName: card.dataset.companyName || card.querySelector(".company-name")?.textContent || "",
      location: card.dataset.location || "",
    };

    card.style.display = matchesJobFilter(job, searchTerm, locationTerm) ? "" : "none";
  });
}

const searchInput = document.getElementById("job-search");
if (searchInput) searchInput.addEventListener("keyup", filterJobs);

const locationSelect = document.getElementById("job-location");
if (locationSelect) locationSelect.addEventListener("change", filterJobs);

async function openApplyModal(jobId) {
  if (userRole !== "CANDIDATE") {
      showToast("Please login as Candidate to apply.");
      pendingApplyJobId = jobId;
      showAuthModal();
      return;
  }
  if (!db || !currentUser) {
    showToast("Please login first.");
    return;
  }
  const modal = document.getElementById("apply-modal");
  modal.querySelector("h3").innerText = "Apply: Loading...";
  modal.classList.remove("hidden");
  document.getElementById("resume-text").value = "";

  currentApplyJobId = jobId;
  currentApplyJobTitle = null;
  currentApplyEmployerId = null;
  currentApplyCompanyName = null;

  try {
    const jobSnap = await db.collection("jobs").doc(jobId).get();
    if (!jobSnap.exists) {
      showToast("Job not found.");
      modal.classList.add("hidden");
      return;
    }
    const job = jobSnap.data() || {};
    currentApplyJobTitle = job.title || "Job Position";
    currentApplyEmployerId = job.employerId || null;
    currentApplyCompanyName = job.companyName || "";
    modal.querySelector("h3").innerText = `Apply: ${currentApplyJobTitle}`;
  } catch (err) {
    showToast("Failed to load job details.");
    modal.classList.add("hidden");
    return;
  }
  
  document.getElementById("submit-application").onclick = async () => {
    const resume = document.getElementById("resume-text").value.trim();
    if (!resume || resume.length < 50) return showToast("Please provide at least 50 characters.");
    if (!currentApplyJobId) return showToast("Job data missing.");

    const btn = document.getElementById("submit-application");
    btn.disabled = true;
    btn.innerText = "Submitting...";

    try {
      const idToken = await currentUser.getIdToken();
      const appCheckToken = await firebase.appCheck().getToken();

      const response = await fetch("/api/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
          "X-Firebase-AppCheck": appCheckToken.token
        },
        body: JSON.stringify({
          jobId: currentApplyJobId,
          resumeText: resume
        })
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.details?.[0]?.message) {
          throw new Error(result.details[0].message);
        }
        throw new Error(result.error || "Failed to submit application");
      }

      const fitMessage = result.fitScore !== undefined
        ? `✅ Application Submitted (AI Fit Score: ${result.fitScore}%)`
        : "✅ Application Submitted";
      showToast(fitMessage);
      modal.classList.add("hidden");
      window.switchView("candidate-applications");
    } catch (err) {
      showToast(`❌ Error: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.innerText = "Submit Application";
    }
  };
}

async function loadApplications() {
    const container = document.getElementById("applications-list");
    container.innerHTML = "<p >Loading applications...</p>";

    if (!currentUser) {
      container.innerHTML = "<p >Please log in to view applications.</p>";
      return;
    }
    if (userRole !== "CANDIDATE") {
      container.innerHTML = "<p >Candidate access only.</p>";
      return;
    }

    try {
      const idToken = await currentUser.getIdToken();
      const appCheckToken = await firebase.appCheck().getToken();

      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
          "X-Firebase-AppCheck": appCheckToken.token
        },
        body: JSON.stringify({ candidateId: currentUser.uid })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to load applications");
      }

      const apps = await response.json();

      if (!apps || apps.length === 0) {
        container.innerHTML = "<p >You have not applied to any jobs yet.</p>";
        return;
      }

      container.innerHTML = "";
      apps.forEach(app => {
        const card = document.createElement("div");
        card.className = "bento-card mt-2";
        const fitScoreDisplay = app.fitScore !== undefined ? ` • Fit: ${app.fitScore}%` : "";
        const aiReasonDisplay = app.aiReason ? `<p class="text-muted" style="font-size:0.85em">AI: ${app.aiReason}</p>` : "";
        card.innerHTML = `
          <h4>${app.jobTitle || "Job Application"}</h4>
          <p >${app.companyName || "Company"} • Status: ${app.status || "applied"}${fitScoreDisplay}</p>
          ${aiReasonDisplay}
        `;
        container.appendChild(card);
      });
    } catch (e) {
      container.innerHTML = "<p >Failed to load applications.</p>";
    }
}

// ---------------------------------------------------------
// Employer Logic
// ---------------------------------------------------------
async function loadEmployerDashboard() {
  if (!db || !currentUser) return;
  if (userRole !== "EMPLOYER") return;

  try {
    const jobsSnap = await db
      .collection("jobs")
      .where("employerId", "==", currentUser.uid)
      .get();

    const appsSnap = await db
      .collection("applications")
      .where("employerId", "==", currentUser.uid)
      .get();

    const activeJobsEl = document.getElementById("stat-active-jobs");
    const applicantsEl = document.getElementById("stat-applicants");
    const spendEl = document.getElementById("stat-spend");

    if (activeJobsEl) activeJobsEl.innerText = String(jobsSnap.size);
    if (applicantsEl) applicantsEl.innerText = String(appsSnap.size);
    if (spendEl) spendEl.innerText = "€0.00";
  } catch (e) {
    // silent fail to keep dashboard usable
  }
}

async function loadEmployerJobs() {
  const container = document.getElementById("employer-jobs-list");
  if (!container) return;
  container.innerHTML = "<p >Loading your jobs...</p>";

  if (!db || !currentUser) {
    container.innerHTML = "<p >Please log in to view jobs.</p>";
    return;
  }
  if (userRole !== "EMPLOYER") {
    container.innerHTML = "<p >Employer access only.</p>";
    return;
  }

  try {
    const snap = await db
      .collection("jobs")
      .where("employerId", "==", currentUser.uid)
      .get();

    if (snap.empty) {
      container.innerHTML = "<p >No jobs posted yet.</p>";
      return;
    }

    container.innerHTML = "";
    snap.forEach(doc => {
      const job = doc.data();
      const card = document.createElement("div");
      card.className = "bento-card mt-2";
      card.innerHTML = `
        <h4>${job.title || "Job Position"}</h4>
        <p >${job.location || "Malta"} • ${job.type || "Full-time"} • ${job.status || "active"}</p>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML = "<p >Failed to load jobs.</p>";
  }
}

window.toggleBudget = function(show) {
    const budgetSection = document.getElementById("budget-section");
    if(show) budgetSection.classList.remove("hidden");
    else budgetSection.classList.add("hidden");
}

// Form Validation & Submission Logic
document.addEventListener("DOMContentLoaded", () => {
  if (!hasFirebase) {
    showToast("Firebase config missing. Run npm run build with NEXT_PUBLIC_FIREBASE_CONFIG.");
  }

  const postForm = document.getElementById("post-job-form");
  if (postForm) {
    postForm.onsubmit = async (e) => {
      e.preventDefault();
      
      // Strict Validation
      const errorDiv = document.getElementById("form-errors");
      errorDiv.innerText = "";

      if (!db || !currentUser) { errorDiv.innerText = "Please log in first."; return; }
      if (userRole !== "EMPLOYER") { errorDiv.innerText = "Employer login required."; return; }

      const title = document.getElementById("post-title").value.trim();
      const companyName = document.getElementById("post-company").value.trim();
      const location = document.getElementById("post-location").value.trim();
      const minSal = parseInt(document.getElementById("post-salary-min").value);
      const maxSal = parseInt(document.getElementById("post-salary-max").value);
      const desc = document.getElementById("post-desc").value.trim();
      
      if(!title) { errorDiv.innerText = "Job title is required."; return; }
      if(!companyName) { errorDiv.innerText = "Company name is required."; return; }
      if(!location) { errorDiv.innerText = "Location is required."; return; }
      if(isNaN(minSal) || isNaN(maxSal) || minSal >= maxSal) { errorDiv.innerText = "Enter a valid salary range."; return; }
      if(desc.length < 50) { errorDiv.innerText = "Description must be at least 50 characters."; return; }
      
      const pricingOptions = document.getElementsByName("pricing");
      let selectedPricing = "free";
      for(let opt of pricingOptions) {
          if(opt.checked) selectedPricing = opt.value;
      }
      
      let budgetCap = null;
      if(selectedPricing === "ppqa" || selectedPricing === "executive") {
        const budget = parseInt(document.getElementById("post-budget").value);
        if(isNaN(budget) || budget < 12) {
          errorDiv.innerText = "Budget cap required for paid plans (Min €12)."; return;
        }
        budgetCap = budget;
      }

      const btn = document.getElementById("btn-publish");
      btn.disabled = true;
      btn.innerText = "Publishing...";

      try {
        const koQuestion = document.getElementById("ko-1").value.trim();
        const koRequired = document.getElementById("ko-1-required").checked;
        const koReject = document.getElementById("ko-1-reject").checked;

        const jobData = {
          title,
          companyName,
          location,
          type: document.getElementById("post-type").value,
          salaryMin: minSal,
          salaryMax: maxSal,
          description: desc,
          pricing: selectedPricing,
          budgetCap,
          knockoutQuestions: koQuestion ? [{
            question: koQuestion,
            required: koRequired,
            rejectIfNo: koReject
          }] : []
        };

        const idToken = await currentUser.getIdToken();
        const appCheckToken = await firebase.appCheck().getToken();

        const response = await fetch("/api/jobs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
            "X-Firebase-AppCheck": appCheckToken.token
          },
          body: JSON.stringify(jobData)
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || result.details?.[0]?.message || "Failed to publish job");
        }

        showToast("✅ Job published successfully");
        postForm.reset();
        window.switchView("employer-dashboard");
      } catch (err) {
        showToast(`❌ Error: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.innerText = "Publish Job";
      }
    };
  }

  const btnDraft = document.getElementById("btn-ai-jd");
  if (btnDraft) {
    btnDraft.addEventListener("click", () => {
      const title = document.getElementById("post-title").value.trim();
      const companyName = document.getElementById("post-company").value.trim();
      const location = document.getElementById("post-location").value.trim();
      const type = document.getElementById("post-type").value;
      const textarea = document.getElementById("post-desc");

      if (!title) {
        showToast("Add a job title first.");
        return;
      }

      const draft = [
        `${companyName || "We"} are hiring a ${title} in ${location || "Malta"} (${type || "Full-time"}).`,
        "",
        "What you'll do:",
        "- Own your work from idea to delivery",
        "- Collaborate with a small, fast-moving team",
        "- Build features that improve the hiring experience",
        "",
        "What we're looking for:",
        "- Proven experience in a similar role",
        "- Clear communication and ownership",
        "- Comfort working in a lean environment",
        "",
        "Why join:",
        "- Impactful work with real users",
        "- Transparent, supportive team culture",
      ].join("\n");

      textarea.value = draft;
      showToast("Sample draft inserted.");
    });
  }

  // Admin Set Role Form Handler
  const setRoleForm = document.getElementById("set-role-form");
  if (setRoleForm) {
    setRoleForm.onsubmit = async (e) => {
      e.preventDefault();

      const errorDiv = document.getElementById("set-role-error");
      errorDiv.innerText = "";

      if (!currentUser) { errorDiv.innerText = "Please log in first."; return; }
      if (userRole !== "ADMIN") { errorDiv.innerText = "Admin access required."; return; }

      const uidOrEmail = document.getElementById("role-uid").value.trim();
      const role = document.getElementById("role-select").value;

      if (!uidOrEmail) { errorDiv.innerText = "User UID or email is required."; return; }

      const btn = setRoleForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.innerText = "Updating...";

      try {
        const idToken = await currentUser.getIdToken();
        const appCheckToken = await firebase.appCheck().getToken();

        const response = await fetch("/api/admin/set-role", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
            "X-Firebase-AppCheck": appCheckToken.token
          },
          body: JSON.stringify({ uid: uidOrEmail, role })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to update role");
        }

        showToast(`✅ Role updated to ${role} for ${uidOrEmail}`);
        setRoleForm.reset();
      } catch (err) {
        errorDiv.innerText = err.message;
      } finally {
        btn.disabled = false;
        btn.innerText = "Update Role";
      }
    };
  }

  // Initial View
  const initialView = window.location.hash ? window.location.hash.replace("#", "") : "home";
  window.switchView(initialView || "home");
});

// ---------------------------------------------------------
// Utilities
// ---------------------------------------------------------
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.classList.remove("hidden");
  toast.style.animation = 'none';
  toast.offsetHeight; /* trigger reflow */
  toast.style.animation = null;
  setTimeout(() => toast.classList.add("hidden"), 3000);
}
