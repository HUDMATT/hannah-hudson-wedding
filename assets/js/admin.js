(function () {
  const guestForm = document.querySelector("#guest-form");
  if (!guestForm) return;

  const $ = (selector) => document.querySelector(selector);
  const tableBody = $("#guest-table-body");
  const dashboard = $("#rsvp-dashboard");
  const linkSelect = $("#link-guest-select");
  const memberEditorList = $("#member-editor-list");
  const missingInfoList = $("#missing-info-list");
  const loginPanel = $("#admin-login-panel");
  const loginForm = $("#admin-login-form");
  const loginError = $("#admin-login-error");
  const adminApp = $("#admin-app");
  const logoutButton = $("#admin-logout");
  let adminAuthenticated = false;
  let householdsCache = [];
  let rsvpsCache = [];

  async function apiJson(url, options = {}) {
    return HNW.apiJson(url, options);
  }

  function setAdminLocked(isLocked) {
    document.body.classList.toggle("admin-locked", isLocked);
    document.body.classList.toggle("admin-unlocked", !isLocked);
    loginPanel.hidden = !isLocked;
    adminApp.hidden = isLocked;
  }

  async function unlockAdmin() {
    adminAuthenticated = true;
    setAdminLocked(false);
    blankForm();
    await renderAll();
  }

  function lockAdmin() {
    adminAuthenticated = false;
    setAdminLocked(true);
    loginForm.reset();
  }

  function isAdminAuthenticated() {
    return adminAuthenticated;
  }

  async function checkSession() {
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (response.ok) await unlockAdmin();
      else lockAdmin();
    } catch {
      loginError.textContent = "Admin authentication is waiting on Cloudflare Pages Functions. Deploy or run with Wrangler to use the backend login.";
      loginError.classList.remove("hidden");
      lockAdmin();
    }
  }

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function mapHousehold(household) {
    return {
      id: household.id,
      household: household.household_name,
      name: household.primary_name,
      phone: household.phone,
      email: household.email,
      address: household.mailing_address,
      plusOnes: household.allowed_plus_ones,
      tags: household.tags,
      notes: household.notes,
      code: household.invite_code,
      missingFields: household.missing_fields || getMissingFields({
        phone: household.phone,
        email: household.email,
        address: household.mailing_address
      }),
      members: (household.guests || []).map((guest) => ({
        id: guest.id,
        name: guest.full_name,
        type: guest.guest_type || "adult"
      }))
    };
  }

  function mapRsvp(rsvp) {
    const attendees = rsvp.attendees || [];
    const attendingMembers = attendees.filter((attendee) => attendee.attendee_type !== "plus_one").map((attendee) => ({
      name: attendee.full_name,
      type: attendee.attendee_type || "adult"
    }));
    const plusOneAttendee = attendees.find((attendee) => attendee.attendee_type === "plus_one");
    return {
      householdId: rsvp.household_id,
      household: rsvp.household_name,
      code: rsvp.invite_code,
      status: rsvp.status,
      count: rsvp.status === "attending" ? attendees.length : 0,
      attendingMembers,
      plusOne: plusOneAttendee
        ? { attending: true, name: plusOneAttendee.full_name, type: "adult" }
        : { attending: false, name: "", type: "adult" },
      song: rsvp.song_request || "",
      notes: rsvp.notes || "",
      submittedAt: rsvp.submitted_at || rsvp.updated_at || ""
    };
  }

  function getMembers(guest) {
    const members = guest.members && guest.members.length ? guest.members : [guest.name];
    return members.map((member) => {
      if (typeof member === "string") return { name: member, type: "adult" };
      return { id: member.id || "", name: member.name, type: member.type || "adult" };
    }).filter((member) => member.name);
  }

  function getMissingFields(guest) {
    return [
      ["Phone", guest.phone],
      ["Email", guest.email],
      ["Mailing address", guest.address]
    ].filter((field) => !String(field[1] || "").trim()).map((field) => field[0]);
  }

  function buildGuestInfoUrl(code) {
    const origin = window.location.origin === "null" ? "" : window.location.origin;
    return `${origin}/guest-info.html?code=${encodeURIComponent(code)}`;
  }

  function renderMemberEditor(members = []) {
    const editableMembers = members.length ? members : [{ id: "", name: "", type: "adult" }];
    memberEditorList.innerHTML = editableMembers.map((member) => `
      <div class="member-row">
        <input class="member-id" type="hidden" value="${escapeHTML(member.id || "")}">
        <label>Member name<input class="member-name" type="text" value="${escapeHTML(member.name)}" placeholder="Guest name"></label>
        <label>Type<select class="member-type">
          <option value="adult"${member.type !== "child" ? " selected" : ""}>Adult</option>
          <option value="child"${member.type === "child" ? " selected" : ""}>Child</option>
        </select></label>
        <button class="button button--ghost member-remove" type="button" aria-label="Remove member">Remove</button>
      </div>
    `).join("");
  }

  async function loadData() {
    const [guestData, rsvpData] = await Promise.all([
      apiJson("/api/admin/guests"),
      apiJson("/api/admin/rsvps")
    ]);
    householdsCache = (guestData.households || []).map(mapHousehold);
    rsvpsCache = (rsvpData.rsvps || []).map(mapRsvp);
  }

  function getGuests() {
    return householdsCache;
  }

  function getRsvps() {
    return rsvpsCache;
  }

  function blankForm() {
    guestForm.reset();
    $("#guest-id").value = "";
    $("#guest-code").value = `FALL${Math.floor(100 + Math.random() * 900)}`;
    $("#guest-form-title").textContent = "Add guest";
    renderMemberEditor();
  }

  function renderGuests() {
    const guests = getGuests();
    if (!guests.length) {
      tableBody.innerHTML = `<tr><td colspan="5">No households have been added yet.</td></tr>`;
      linkSelect.innerHTML = "";
      return;
    }

    tableBody.innerHTML = guests.map((guest) => {
      const members = getMembers(guest);
      const adultCount = members.filter((member) => member.type !== "child").length;
      const childCount = members.filter((member) => member.type === "child").length;
      return `
      <tr>
        <td data-label="Household"><strong>${escapeHTML(guest.household)}</strong><br>${escapeHTML(guest.name)}<br><small>${escapeHTML(guest.code)}</small></td>
        <td data-label="Contact">${escapeHTML(guest.phone || "No phone")}<br>${escapeHTML(guest.email || "No email")}<br><small>${escapeHTML(guest.address || "No address")}</small></td>
        <td data-label="Plus Ones">${guest.plusOnes || 0}<br><small>${adultCount} adult${adultCount === 1 ? "" : "s"} · ${childCount} child${childCount === 1 ? "" : "ren"}</small></td>
        <td data-label="Tags">${escapeHTML(guest.tags || "")}<br><small>${members.map((member) => `${escapeHTML(member.name)} (${member.type})`).join(", ")}</small></td>
        <td data-label="Actions"><div class="table-actions"><button class="button button--ghost" type="button" data-edit="${escapeHTML(guest.id)}">Edit</button><button class="button button--primary" type="button" data-delete="${escapeHTML(guest.id)}">Delete</button></div></td>
      </tr>
    `;
    }).join("");

    linkSelect.innerHTML = guests.map((guest) => `<option value="${escapeHTML(guest.id)}">${escapeHTML(guest.household)} (${escapeHTML(guest.code)})</option>`).join("");
  }

  function renderDashboard() {
    const guests = getGuests();
    const rsvps = getRsvps();
    const attending = rsvps.filter((item) => item.status === "attending");
    const declined = rsvps.filter((item) => item.status === "declined");
    const invitedMembers = guests.flatMap(getMembers);
    const invitedTotal = invitedMembers.length + guests.reduce((sum, guest) => sum + Number(guest.plusOnes || 0), 0);
    const attendingMembers = attending.flatMap((item) => item.attendingMembers || []);
    const attendingPlusOnes = attending.filter((item) => item.plusOne && item.plusOne.attending);
    const adultInvited = invitedMembers.filter((member) => member.type !== "child").length;
    const childInvited = invitedMembers.filter((member) => member.type === "child").length;
    const adultAttending = attendingMembers.filter((member) => member.type !== "child").length + attendingPlusOnes.length;
    const childAttending = attendingMembers.filter((member) => member.type === "child").length;
    const missingInfoCount = guests.filter((guest) => getMissingFields(guest).length > 0).length;
    const respondedHouseholdIds = new Set(rsvps.map((rsvp) => rsvp.householdId));

    dashboard.innerHTML = `
      <article class="card metric"><span class="card__label">Total invited</span><strong>${invitedTotal}</strong></article>
      <article class="card metric"><span class="card__label">Attending</span><strong>${attending.reduce((sum, item) => sum + Number(item.count || 0), 0)}</strong></article>
      <article class="card metric"><span class="card__label">Declined</span><strong>${declined.length}</strong></article>
      <article class="card metric"><span class="card__label">No response</span><strong>${Math.max(guests.filter((guest) => !respondedHouseholdIds.has(guest.id)).length, 0)}</strong></article>
      <article class="card metric"><span class="card__label">Missing info</span><strong>${missingInfoCount}</strong></article>
      <article class="card"><h3>Invited Breakdown</h3><ul class="summary-list"><li>Adults: ${adultInvited}</li><li>Children: ${childInvited}</li><li>Possible plus ones: ${guests.reduce((sum, guest) => sum + Number(guest.plusOnes || 0), 0)}</li></ul></article>
      <article class="card"><h3>Attending Breakdown</h3><ul class="summary-list"><li>Adults: ${adultAttending}</li><li>Children: ${childAttending}</li><li>Plus ones: ${attendingPlusOnes.length}</li></ul></article>
    `;
  }

  function renderMissingInfo() {
    const missingGuests = getGuests().map((guest) => ({
      ...guest,
      missingFields: getMissingFields(guest)
    })).filter((guest) => guest.missingFields.length > 0);

    if (missingGuests.length === 0) {
      missingInfoList.innerHTML = `<div class="notice">All guest contact records are complete.</div>`;
      return;
    }

    missingInfoList.innerHTML = missingGuests.map((guest) => `
      <article class="missing-info-item">
        <div>
          <h3>${escapeHTML(guest.household)}</h3>
          <p>${escapeHTML(guest.name)} · Invite code: <strong>${escapeHTML(guest.code)}</strong></p>
          <p class="missing-info-item__fields">Missing: ${guest.missingFields.map(escapeHTML).join(", ")}</p>
        </div>
        <div class="missing-info-item__actions">
          <label>Guest info link<input type="text" value="${escapeHTML(buildGuestInfoUrl(guest.code))}" readonly></label>
          <div class="button-row">
            <button class="button button--secondary" type="button" data-copy-missing-link="${escapeHTML(guest.code)}">Copy Link</button>
            <button class="button button--ghost" type="button" data-edit="${escapeHTML(guest.id)}">Edit</button>
          </div>
        </div>
      </article>
    `).join("");
  }

  function fillForm(id) {
    const guest = getGuests().find((item) => item.id === id);
    if (!guest) return;
    $("#guest-form-title").textContent = "Edit guest";
    $("#guest-id").value = guest.id;
    $("#guest-household").value = guest.household;
    $("#guest-name").value = guest.name || "";
    $("#guest-code").value = guest.code;
    $("#guest-phone").value = guest.phone || "";
    $("#guest-email").value = guest.email || "";
    $("#guest-address").value = guest.address || "";
    $("#guest-plusones").value = guest.plusOnes || 0;
    $("#guest-tags").value = guest.tags || "";
    renderMemberEditor(getMembers(guest));
    guestForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteGuest(id) {
    await apiJson(`/api/admin/guests?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await renderAll();
  }

  function guestFromForm() {
    const members = Array.from(memberEditorList.querySelectorAll(".member-row")).map((row) => ({
      id: row.querySelector(".member-id").value.trim(),
      name: row.querySelector(".member-name").value.trim(),
      type: row.querySelector(".member-type").value
    })).filter((member) => member.name);
    const primaryName = $("#guest-name").value.trim();
    return {
      id: $("#guest-id").value,
      householdName: $("#guest-household").value.trim(),
      primaryName,
      inviteCode: $("#guest-code").value.trim().toUpperCase(),
      phone: $("#guest-phone").value.trim(),
      email: $("#guest-email").value.trim(),
      address: $("#guest-address").value.trim(),
      allowedPlusOnes: Number($("#guest-plusones").value || 0),
      tags: $("#guest-tags").value.trim(),
      guests: members.length ? members : [{ name: primaryName, type: "adult" }]
    };
  }

  function csvDownload(filename, rows) {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function renderAll() {
    dashboard.innerHTML = `<div class="notice">Loading dashboard...</div>`;
    missingInfoList.innerHTML = `<div class="notice">Loading missing information...</div>`;
    await loadData();
    renderGuests();
    renderDashboard();
    renderMissingInfo();
  }

  guestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = guestForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
    try {
      await apiJson("/api/admin/guests", {
        method: "POST",
        body: JSON.stringify(guestFromForm())
      });
      blankForm();
      await renderAll();
    } catch (err) {
      alert(err.message || "Could not save guest.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Save Guest";
    }
  });

  tableBody.addEventListener("click", async (event) => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    if (editId) fillForm(editId);
    if (deleteId && window.confirm("Delete this household?")) {
      await deleteGuest(deleteId);
    }
  });

  missingInfoList.addEventListener("click", (event) => {
    const editId = event.target.dataset.edit;
    if (editId) fillForm(editId);
    const code = event.target.dataset.copyMissingLink;
    if (!code) return;
    const url = buildGuestInfoUrl(code);
    navigator.clipboard.writeText(url).then(() => {
      event.target.textContent = "Copied";
      setTimeout(() => { event.target.textContent = "Copy Link"; }, 1400);
    }).catch(() => {
      const input = event.target.closest(".missing-info-item").querySelector("input[readonly]");
      input.select();
      document.execCommand("copy");
    });
  });

  $("#reset-guest-form").addEventListener("click", blankForm);
  $("#add-member").addEventListener("click", () => {
    const members = Array.from(memberEditorList.querySelectorAll(".member-row")).map((row) => ({
      id: row.querySelector(".member-id").value.trim(),
      name: row.querySelector(".member-name").value.trim(),
      type: row.querySelector(".member-type").value
    }));
    members.push({ id: "", name: "", type: "adult" });
    renderMemberEditor(members);
  });
  memberEditorList.addEventListener("click", (event) => {
    if (!event.target.classList.contains("member-remove")) return;
    const rows = Array.from(memberEditorList.querySelectorAll(".member-row"));
    if (rows.length === 1) {
      rows[0].querySelector(".member-id").value = "";
      rows[0].querySelector(".member-name").value = "";
      rows[0].querySelector(".member-type").value = "adult";
      return;
    }
    event.target.closest(".member-row").remove();
  });

  $("#seed-demo-data").addEventListener("click", async () => {
    const demoHouseholds = [
      {
        id: "demo-fall-101",
        householdName: "Martini Family",
        primaryName: "Lena Martini",
        phone: "555-0101",
        email: "lena@example.com",
        address: "123 Placeholder Lane, City, ST",
        allowedPlusOnes: 2,
        tags: "family, rehearsal",
        inviteCode: "FALL101",
        guests: [
          { name: "Lena Martini", type: "adult" },
          { name: "Marco Martini", type: "adult" },
          { name: "Sofia Martini", type: "child" }
        ]
      },
      {
        id: "demo-fall-102",
        householdName: "Matthews Friends",
        primaryName: "Jordan Blake",
        phone: "555-0102",
        email: "jordan@example.com",
        address: "456 Sample Street, City, ST",
        allowedPlusOnes: 1,
        tags: "friends",
        inviteCode: "FALL102",
        guests: [
          { name: "Jordan Blake", type: "adult" },
          { name: "Taylor Reed", type: "adult" }
        ]
      },
      {
        id: "demo-fall-103",
        householdName: "Avery Household",
        primaryName: "Morgan Avery",
        phone: "555-0103",
        email: "morgan@example.com",
        address: "789 Autumn Road, City, ST",
        allowedPlusOnes: 0,
        tags: "coworkers",
        inviteCode: "FALL103",
        guests: [
          { name: "Morgan Avery", type: "adult" }
        ]
      }
    ];

    if (!window.confirm("Add demo households to D1? Existing households with the same IDs will not be reset.")) return;
    for (const household of demoHouseholds) {
      await apiJson("/api/admin/guests", {
        method: "POST",
        body: JSON.stringify(household)
      });
    }
    await renderAll();
  });

  $("#generate-link").addEventListener("click", () => {
    const guest = getGuests().find((item) => item.id === linkSelect.value);
    if (!guest) return;
    $("#generated-link").value = buildGuestInfoUrl(guest.code);
    $("#generated-link-wrap").classList.remove("hidden");
  });

  $("#copy-link").addEventListener("click", async () => {
    const input = $("#generated-link");
    input.select();
    try {
      await navigator.clipboard.writeText(input.value);
      $("#copy-link").textContent = "Copied";
      setTimeout(() => { $("#copy-link").textContent = "Copy"; }, 1400);
    } catch {
      document.execCommand("copy");
    }
  });

  $("#export-guests").addEventListener("click", () => {
    const rows = [["Household", "Primary Name", "Members", "Adult Count", "Child Count", "Missing Fields", "Phone", "Email", "Address", "Plus Ones", "Tags", "Code"]];
    getGuests().forEach((guest) => {
      const members = getMembers(guest);
      rows.push([
        guest.household,
        guest.name,
        members.map((member) => `${member.name} (${member.type})`).join("; "),
        members.filter((member) => member.type !== "child").length,
        members.filter((member) => member.type === "child").length,
        getMissingFields(guest).join("; "),
        guest.phone,
        guest.email,
        guest.address,
        guest.plusOnes,
        guest.tags,
        guest.code
      ]);
    });
    csvDownload("wedding-guests.csv", rows);
  });

  $("#export-rsvps").addEventListener("click", () => {
    const rows = [["Household", "Code", "Status", "Count", "Attending Members", "Plus One Attending", "Plus One Name", "Song", "Notes", "Submitted At"]];
    getRsvps().forEach((rsvp) => rows.push([
      rsvp.household,
      rsvp.code,
      rsvp.status,
      rsvp.count,
      (rsvp.attendingMembers || []).map((member) => `${member.name} (${member.type})`).join("; "),
      rsvp.plusOne && rsvp.plusOne.attending ? "Yes" : "No",
      rsvp.plusOne && rsvp.plusOne.attending ? rsvp.plusOne.name : "",
      rsvp.song,
      rsvp.notes,
      rsvp.submittedAt
    ]));
    csvDownload("wedding-rsvps.csv", rows);
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.classList.add("hidden");

    const username = $("#admin-username").value.trim();
    const password = $("#admin-password").value;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        await unlockAdmin();
        return;
      }
    } catch {
      loginError.textContent = "Could not reach the admin auth endpoint. Run with Wrangler or deploy to Cloudflare Pages.";
      loginError.classList.remove("hidden");
      return;
    }

    loginError.textContent = "The username or password is incorrect.";
    loginError.classList.remove("hidden");
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      lockAdmin();
    }
  });

  if (window.location.protocol === "file:") {
    loginError.textContent = "Admin login requires Cloudflare Pages Functions. Use Wrangler local dev or deploy to Cloudflare Pages.";
    loginError.classList.remove("hidden");
    lockAdmin();
  } else {
    checkSession();
  }

  window.addEventListener("focus", () => {
    if (isAdminAuthenticated()) renderAll();
  });
})();
