(function () {
  const searchForm = document.querySelector("#guest-search-form");
  const rsvpForm = document.querySelector("#rsvp-form");
  if (!searchForm || !rsvpForm) return;

  const matchResult = document.querySelector("#match-result");
  const confirmation = document.querySelector("#rsvp-confirmation");
  const plusOneFieldset = document.querySelector("#plus-one-fieldset");
  const plusOneCheckbox = document.querySelector("#plus-one-attending");
  const plusOneName = document.querySelector("#plus-one-name");
  const plusOneHelp = document.querySelector("#plus-one-help");
  let selectedGuest = null;

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function getMembers(guest) {
    const members = guest.members && guest.members.length ? guest.members : [guest.name];
    return members.map((member) => {
      if (typeof member === "string") return { name: member, type: "adult" };
      return { name: member.name, type: member.type || "adult" };
    }).filter((member) => member.name);
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function findGuest(query) {
    const needle = normalize(query);
    return HNW.ensureGuests().find((guest) => {
      const haystack = [
        guest.household,
        guest.name,
        guest.phone,
        guest.email,
        guest.code,
        ...getMembers(guest).map((member) => member.name)
      ].map(normalize).join(" ");
      return haystack.includes(needle);
    });
  }

  function showGuest(guest) {
    const members = getMembers(guest);
    const plusOneCount = Number(guest.plusOnes || 0);
    selectedGuest = guest;
    document.querySelector("#household-code").value = guest.code;
    document.querySelector("#household-summary").textContent = `${guest.household}: ${members.map((member) => member.name).join(", ")}.${plusOneCount ? ` Plus ones allowed: ${plusOneCount}.` : ""}`;
    document.querySelector("#invited-members").innerHTML = members.map((member) => `
      <label class="checkbox-card">
        <input type="checkbox" name="attendingMembers" value="${escapeHTML(member.name)}" data-member-type="${escapeHTML(member.type)}" checked>
        <span>
          <strong>${escapeHTML(member.name)}</strong>
          <small>${member.type === "child" ? "Child" : "Adult"}</small>
        </span>
      </label>
    `).join("");
    plusOneCheckbox.checked = false;
    plusOneName.value = "";
    plusOneName.required = false;
    plusOneHelp.textContent = plusOneCount > 1
      ? `This form currently collects one plus one name. Additional guest names can go in the notes.`
      : "Please share their name below.";
    plusOneFieldset.classList.toggle("hidden", plusOneCount <= 0);
    matchResult.innerHTML = `<div class="card"><p class="kicker">Invitation Found</p><h2>${escapeHTML(guest.household)}</h2><p>${members.map((member) => `${escapeHTML(member.name)} (${member.type === "child" ? "child" : "adult"})`).join(", ")}</p><p>Invite code: <strong>${escapeHTML(guest.code)}</strong></p></div>`;
    rsvpForm.classList.remove("hidden");
    confirmation.classList.add("hidden");
  }

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = document.querySelector("#guest-search").value;
    const guest = findGuest(query);
    if (!guest) {
      selectedGuest = null;
      rsvpForm.classList.add("hidden");
      matchResult.innerHTML = `<div class="notice">No invitation matched that search. Try a household name, phone number, or invite code.</div>`;
      return;
    }
    showGuest(guest);
  });

  rsvpForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!selectedGuest) return;

    const formData = new FormData(rsvpForm);
    const attendingMembers = Array.from(rsvpForm.querySelectorAll('input[name="attendingMembers"]:checked')).map((input) => ({
      name: input.value,
      type: input.dataset.memberType || "adult"
    }));
    if (formData.get("status") === "attending" && attendingMembers.length === 0) {
      confirmation.textContent = "Please check at least one invited guest who will attend, or choose regretfully declining.";
      confirmation.classList.remove("hidden");
      return;
    }
    const plusOne = {
      attending: formData.get("status") === "attending" && plusOneCheckbox.checked,
      name: plusOneName.value.trim(),
      type: "adult"
    };
    if (plusOne.attending && !plusOne.name) {
      confirmation.textContent = "Please enter your plus one's name, or uncheck the plus one option.";
      confirmation.classList.remove("hidden");
      plusOneName.focus();
      return;
    }
    const response = {
      guestId: selectedGuest.id,
      household: selectedGuest.household,
      code: selectedGuest.code,
      status: formData.get("status"),
      count: formData.get("status") === "attending" ? attendingMembers.length + (plusOne.attending ? 1 : 0) : 0,
      attendingMembers: formData.get("status") === "attending" ? attendingMembers : [],
      plusOne: plusOne.attending ? plusOne : { attending: false, name: "", type: "adult" },
      song: formData.get("song") || "",
      notes: formData.get("notes") || "",
      submittedAt: new Date().toISOString()
    };

    // TODO: Replace local RSVP persistence with Supabase insert/update.
    const rsvps = HNW.storage.get("hnwRsvps", []);
    const withoutCurrent = rsvps.filter((item) => item.guestId !== response.guestId);
    withoutCurrent.push(response);
    HNW.storage.set("hnwRsvps", withoutCurrent);

    confirmation.textContent = response.status === "attending"
      ? "Thank you. Your RSVP has been saved locally, and we are so excited to celebrate with you."
      : "Thank you. Your RSVP has been saved locally, and we will miss you.";
    confirmation.classList.remove("hidden");
    rsvpForm.classList.add("hidden");
  });

  plusOneCheckbox.addEventListener("change", () => {
    if (plusOneCheckbox.checked) plusOneName.focus();
  });
})();
