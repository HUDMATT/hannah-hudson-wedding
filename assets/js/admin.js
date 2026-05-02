(function () {
  const guestForm = document.querySelector("#guest-form");
  if (!guestForm) return;

  const $ = (selector) => document.querySelector(selector);
  const tableBody = $("#guest-table-body");
  const dashboard = $("#rsvp-dashboard");
  const linkSelect = $("#link-guest-select");

  function getGuests() {
    return HNW.ensureGuests();
  }

  function saveGuests(guests) {
    // TODO: Replace local guest writes with Supabase upserts.
    HNW.storage.set("hnwGuests", guests);
  }

  function getRsvps() {
    return HNW.storage.get("hnwRsvps", []);
  }

  function blankForm() {
    guestForm.reset();
    $("#guest-id").value = "";
    $("#guest-code").value = `FALL${Math.floor(100 + Math.random() * 900)}`;
    $("#guest-form-title").textContent = "Add guest";
  }

  function renderGuests() {
    const guests = getGuests();
    tableBody.innerHTML = guests.map((guest) => `
      <tr>
        <td data-label="Household"><strong>${guest.household}</strong><br>${guest.name}<br><small>${guest.code}</small></td>
        <td data-label="Contact">${guest.phone || "No phone"}<br>${guest.email || "No email"}<br><small>${guest.address || "No address"}</small></td>
        <td data-label="Plus Ones">${guest.plusOnes || 0}</td>
        <td data-label="Tags">${guest.tags || ""}</td>
        <td data-label="Actions"><div class="table-actions"><button class="button button--ghost" type="button" data-edit="${guest.id}">Edit</button><button class="button button--primary" type="button" data-delete="${guest.id}">Delete</button></div></td>
      </tr>
    `).join("");

    linkSelect.innerHTML = guests.map((guest) => `<option value="${guest.id}">${guest.household} (${guest.code})</option>`).join("");
  }

  function renderDashboard() {
    const guests = getGuests();
    const rsvps = getRsvps();
    const attending = rsvps.filter((item) => item.status === "attending");
    const declined = rsvps.filter((item) => item.status === "declined");
    const invitedTotal = guests.reduce((sum, guest) => sum + (guest.members || [guest.name]).length + Number(guest.plusOnes || 0), 0);
    const mealCounts = attending.reduce((counts, item) => {
      counts[item.meal] = (counts[item.meal] || 0) + Number(item.count || 0);
      return counts;
    }, {});
    const allergyItems = attending.filter((item) => item.allergies).map((item) => `${item.household}: ${item.allergies}`);

    dashboard.innerHTML = `
      <article class="card metric"><span class="card__label">Total invited</span><strong>${invitedTotal}</strong></article>
      <article class="card metric"><span class="card__label">Attending</span><strong>${attending.reduce((sum, item) => sum + Number(item.count || 0), 0)}</strong></article>
      <article class="card metric"><span class="card__label">Declined</span><strong>${declined.length}</strong></article>
      <article class="card metric"><span class="card__label">No response</span><strong>${Math.max(guests.length - rsvps.length, 0)}</strong></article>
      <article class="card"><h3>Meal Summary</h3><ul class="summary-list">${Object.entries(mealCounts).map(([meal, count]) => `<li>${meal}: ${count}</li>`).join("") || "<li>No meal responses yet.</li>"}</ul></article>
      <article class="card"><h3>Allergy Summary</h3><ul class="summary-list">${allergyItems.map((item) => `<li>${item}</li>`).join("") || "<li>No allergies submitted yet.</li>"}</ul></article>
    `;
  }

  function fillForm(id) {
    const guest = getGuests().find((item) => item.id === id);
    if (!guest) return;
    $("#guest-form-title").textContent = "Edit guest";
    $("#guest-id").value = guest.id;
    $("#guest-household").value = guest.household;
    $("#guest-name").value = guest.name;
    $("#guest-code").value = guest.code;
    $("#guest-phone").value = guest.phone || "";
    $("#guest-email").value = guest.email || "";
    $("#guest-address").value = guest.address || "";
    $("#guest-plusones").value = guest.plusOnes || 0;
    $("#guest-tags").value = guest.tags || "";
    guestForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deleteGuest(id) {
    saveGuests(getGuests().filter((guest) => guest.id !== id));
    renderAll();
  }

  function guestFromForm() {
    return {
      id: $("#guest-id").value || `g-${Date.now()}`,
      household: $("#guest-household").value.trim(),
      name: $("#guest-name").value.trim(),
      code: $("#guest-code").value.trim().toUpperCase(),
      phone: $("#guest-phone").value.trim(),
      email: $("#guest-email").value.trim(),
      address: $("#guest-address").value.trim(),
      plusOnes: Number($("#guest-plusones").value || 0),
      tags: $("#guest-tags").value.trim(),
      members: [$("#guest-name").value.trim()]
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

  function renderAll() {
    renderGuests();
    renderDashboard();
  }

  guestForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const guest = guestFromForm();
    const guests = getGuests();
    const index = guests.findIndex((item) => item.id === guest.id);
    if (index >= 0) guests[index] = guest;
    else guests.push(guest);
    saveGuests(guests);
    blankForm();
    renderAll();
  });

  tableBody.addEventListener("click", (event) => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    if (editId) fillForm(editId);
    if (deleteId) deleteGuest(deleteId);
  });

  $("#reset-guest-form").addEventListener("click", blankForm);
  $("#seed-demo-data").addEventListener("click", () => {
    HNW.storage.set("hnwGuests", HNW.demoGuests);
    renderAll();
  });

  $("#generate-link").addEventListener("click", () => {
    const guest = getGuests().find((item) => item.id === linkSelect.value);
    if (!guest) return;
    const code = guest.code || Math.random().toString(36).slice(2, 8).toUpperCase();
    const basePath = window.location.pathname.replace("admin.html", "");
    const origin = window.location.origin === "null" ? "" : window.location.origin;
    const url = `${origin}${basePath}guest-info.html?code=${encodeURIComponent(code)}`;
    $("#generated-link").value = url;
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
    const rows = [["Household", "Name", "Phone", "Email", "Address", "Plus Ones", "Tags", "Code"]];
    getGuests().forEach((guest) => rows.push([guest.household, guest.name, guest.phone, guest.email, guest.address, guest.plusOnes, guest.tags, guest.code]));
    csvDownload("wedding-guests.csv", rows);
  });

  $("#export-rsvps").addEventListener("click", () => {
    const rows = [["Household", "Code", "Status", "Count", "Meal", "Allergies", "Song", "Notes", "Submitted At"]];
    getRsvps().forEach((rsvp) => rows.push([rsvp.household, rsvp.code, rsvp.status, rsvp.count, rsvp.meal, rsvp.allergies, rsvp.song, rsvp.notes, rsvp.submittedAt]));
    csvDownload("wedding-rsvps.csv", rows);
  });

  blankForm();
  renderAll();
})();
