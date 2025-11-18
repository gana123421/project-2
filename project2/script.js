// ============================================================
// Student Registration System - Main Logic (Detailed Comments)
// ============================================================
//
// WHAT THIS FILE DOES
// -------------------
// 1) Keeps an in-memory array `students` synchronized with `localStorage`.
// 2) Renders the students array into an HTML table (add/edit/delete).
// 3) Validates user input thoroughly (name/ID/email/contact).
// 4) Ensures the display area gets a dynamic vertical scrollbar.
//
// IMPORTANT (per your PDF):
// - Contact number MUST accept AT LEAST 10 digits (not exactly 10).
//   -> We enforce this in two places:
//      a) HTML pattern = ^[0-9]{10,}$
//      b) JS validation regex = /^[0-9]{10,}$/
//   -> We DO NOT limit the typing length to 10 (no maxlength, no slice(0,10)).
//
// ============================================================

/** ---------------- UTILITY SHORTCUT ----------------
 *  $: small helper to select single elements (querySelector).
 *  This keeps code shorter and easier to read.
 */
const $ = (sel) => document.querySelector(sel);

/** ----------------- STORAGE KEY --------------------
 *  Change this key if you want to "reset" stored data without clearing all localStorage.
 */
const STORAGE_KEY = "srs_students_v1";

/** ----------------- APPLICATION STATE --------------
 *  students:   array of student objects { name, id, email, contact }
 *  editIndex:  null when adding new; number (row index) when editing
 */
let students = [];
let editIndex = null;

/** ----------------- ELEMENT REFERENCES --------------
 *  We cache DOM elements once to avoid querying the DOM repeatedly.
 */
const form = $("#studentForm");
const nameInput = $("#studentName");
const idInput = $("#studentId");
const emailInput = $("#email");
const contactInput = $("#contact");
const formMsg = $("#formMsg");
const tbody = $("#tbody");
const emptyState = $("#emptyState");
const submitBtn = $("#submitBtn");
const resetBtn = $("#resetBtn");
const tableContainer = $("#tableContainer");

/** ----------------- INITIALIZATION ------------------
 *  DOMContentLoaded ensures elements exist before we attach handlers.
 *  1) Set footer year
 *  2) Load students from localStorage
 *  3) Render the initial table view
 *  4) Setup dynamic scroll area
 *  5) Add input sanitizers for name/id/contact
 */
document.addEventListener("DOMContentLoaded", () => {
  // 1) Dynamic year in footer
  $("#year").textContent = new Date().getFullYear();

  // 2) Load persisted records (or start empty)
  students = loadStudents();

  // 3) Draw table from `students`
  renderTable();

  // 4) Adjust the scrollable area based on viewport
  adjustScrollContainer();
  window.addEventListener("resize", adjustScrollContainer);

  // 5) Input sanitizers (live)
  nameInput.addEventListener("input", () => {
    // Allow only letters and spaces for name; remove anything else immediately.
    nameInput.value = nameInput.value.replace(/[^A-Za-z ]/g, "");
  });
  idInput.addEventListener("input", () => {
    // Keep ID numeric-only; cut any non-digit instantly.
    idInput.value = idInput.value.replace(/[^0-9]/g, "");
  });
  contactInput.addEventListener("input", () => {
    // Keep contact numeric-only; DO NOT cap length (PDF requires "at least 10").
    contactInput.value = contactInput.value.replace(/[^0-9]/g, "");
  });
});

/** ----------------- LOCAL STORAGE -------------------
 *  loadStudents():  Safely get persisted array from localStorage.
 *  saveStudents():  Persist current in-memory students array.
 */
function loadStudents(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    // If nothing stored yet, return empty array
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.warn("Failed to read localStorage, starting empty.", e);
    return [];
  }
}

function saveStudents(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

/** ----------------- TABLE RENDERING -----------------
 *  renderTable(): Redraw the <tbody> content based on current `students`.
 *  - Shows/hides an "empty" message.
 *  - Wires up Edit/Delete buttons for each row.
 */
function renderTable(){
  // Clear any previous rows
  tbody.innerHTML = "";

  // Show hint text if no data
  emptyState.style.display = students.length === 0 ? "block" : "none";

  // Build rows
  students.forEach((s, idx) => {
    const tr = document.createElement("tr");

    // escapeHtml() prevents HTML injection if someone tries weird input
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.id)}</td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeHtml(s.contact)}</td>
      <td>
        <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
          <button class="icon neutral" aria-label="Edit row ${idx + 1}" data-action="edit" data-index="${idx}">Edit</button>
          <button class="icon danger" aria-label="Delete row ${idx + 1}" data-action="delete" data-index="${idx}">Delete</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Attach click handlers to the newly created buttons
  tbody.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", handleRowAction);
  });
}

/** ----------------- TABLE ACTIONS -------------------
 *  handleRowAction(e): Delegates to edit or delete functions.
 *  startEdit(index):   Puts the row into "edit" mode by populating the form.
 *  deleteRow(index):   Confirms and removes the row, then persists and re-renders.
 */
function handleRowAction(e){
  const btn = e.currentTarget;
  const action = btn.getAttribute("data-action");
  const index = Number(btn.getAttribute("data-index"));

  if(action === "edit"){
    startEdit(index);
  } else if(action === "delete"){
    deleteRow(index);
  }
}

function startEdit(index){
  const s = students[index];
  if(!s) return; // Safety guard (shouldn't happen)

  // Mark we are editing this index
  editIndex = index;

  // Pre-fill the form with selected row values
  nameInput.value = s.name;
  idInput.value = s.id;
  emailInput.value = s.email;
  contactInput.value = s.contact;

  // Change button text so user knows we're in update mode
  submitBtn.textContent = "Update Student";

  // Announce to the screen reader + move focus for a11y
  announce("Editing record. Make changes and press Update.");
  nameInput.focus();
}

function deleteRow(index){
  const s = students[index];
  if(!s) return;

  // Simple confirm dialogue for safety
  const ok = confirm(`Delete record for "${s.name}" (ID: ${s.id})?`);
  if(!ok) return;

  // Remove item from the array
  students.splice(index, 1);

  // Persist the updated array
  saveStudents();

  // Redraw UI + reset form state
  renderTable();
  resetForm();

  announce("Record deleted.");
}

/** ----------------- FORM HELPERS --------------------
 *  resetForm(): Clear all fields, exit edit mode, reset button label.
 *  announce(msg): Visually-hidden live region updates (a11y friendly).
 */
function resetForm(){
  form.reset();
  editIndex = null;
  submitBtn.textContent = "Add Student";
}

function announce(message){
  // Show the message for a short duration (screen reader + visual feedback)
  formMsg.classList.remove("sr-only");
  formMsg.textContent = message;
  setTimeout(() => { formMsg.classList.add("sr-only"); }, 3000);
}

/** ----------------- VALIDATION ----------------------
 *  validateForm(): Returns { ok:true, value:{} } on success OR { ok:false, error:"" } on failure.
 *  Rules as per PDF:
 *   - Name: letters & spaces only
 *   - Student ID: numbers only
 *   - Email: valid format
 *   - Contact: numbers only, AT LEAST 10 digits
 *  Also prevents empty fields.
 */
function validateForm(){
  const name = nameInput.value.trim();
  const id = idInput.value.trim();
  const email = emailInput.value.trim();
  const contact = contactInput.value.trim();

  // 1) Basic empty checks
  if(!name || !id || !email || !contact){
    return fail("Please fill in all required fields.");
  }

  // 2) Name: only letters and spaces
  if(!/^[A-Za-z ]+$/.test(name)){
    return fail("Name must contain letters and spaces only.");
  }

  // 3) Student ID: numbers only
  if(!/^[0-9]+$/.test(id)){
    return fail("Student ID must contain numbers only.");
  }

  // 4) Email: practical regex (not perfect RFC, but good for UI)
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if(!emailOk){
    return fail("Please enter a valid email address.");
  }

  // 5) Contact: AT LEAST 10 digits (PDF requirement)
  if(!/^[0-9]{10,}$/.test(contact)){
    return fail("Contact number must be at least 10 digits (numbers only).");
  }

  // If everything passes, return normalized data object
  return { ok: true, value: { name, id, email, contact } };
}

/** ----------------- FAIL HELPER ---------------------
 *  Centralized way to announce a validation error and standardize the return format.
 */
function fail(msg){
  announce(msg);
  return { ok: false, error: msg };
}

/** ----------------- FORM SUBMISSION -----------------
 *  On submit:
 *   1) Validate inputs
 *   2) Reject exact duplicate rows (basic duplicate prevention)
 *   3) Add or update the array
 *   4) Persist to localStorage
 *   5) Re-render table and reset form
 */
form.addEventListener("submit", (e) => {
  e.preventDefault();

  // Validate everything first
  const v = validateForm();
  if(!v.ok) return;

  // Prevent adding an exact duplicate row (all fields identical)
  const exists = students.some(s =>
    s.name === v.value.name &&
    s.id === v.value.id &&
    s.email === v.value.email &&
    s.contact === v.value.contact
  );
  if(exists && editIndex === null){
    announce("This exact record already exists.");
    return;
  }

  // Insert or update
  if(editIndex === null){
    students.push(v.value);
    announce("Student added.");
  } else {
    students[editIndex] = v.value;
    announce("Student updated.");
  }

  // Persist + refresh UI
  saveStudents();
  renderTable();
  resetForm();
});

/** ----------------- SCROLL AREA ---------------------
 *  adjustScrollContainer():
 *   - Computes a max height for the records container based on viewport.
 *   - The goal is to guarantee a vertical scrollbar dynamically,
 *     and keep UI usable on mobile/tablet/desktop.
 */
function adjustScrollContainer(){
  const viewport = window.innerHeight;
  // Reserved space for header + form + margins (tuned by quick trial)
  const reserved = 340;
  const max = Math.max(200, viewport - reserved);
  tableContainer.style.maxHeight = max + "px";
  tableContainer.style.overflowY = "auto";
}

/** ----------------- SECURITY HELPER -----------------
 *  escapeHtml(str): Prevents users from injecting HTML/JS into the table
 *  by converting special characters into their HTML entities.
 */
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
