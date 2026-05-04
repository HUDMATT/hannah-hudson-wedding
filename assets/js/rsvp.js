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
  let selectedHousehold = null;

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  async function apiJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
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
      code: household.invite_code,
      members: (household.guests || []).map((guest) => ({
        id: guest.id,
        name: guest.full_name,
        type: guest.guest_type || "adult"
      }))
    };
  }

  function getMembers(household) {
    return household.members && household.members.length ? household.members : [{
      id: "",
      name: household.name,
      type: "adult"
    }];
  }

  function setLoading(isLoading) {
    const button = searchForm.querySelector("button[type='submit']");
    button.disabled = isLoading;
    button.textContent = isLoading ? "Searching..." : "Search";
  }

  function showGuest(household) {
    const members = getMembers(household);
    const plusOneCount = Number(household.plusOnes || 0);
    selectedHousehold = household;
    document.querySelector("#household-code").value = household.code;
    document.querySelector("#household-summary").textContent = `${household.household}: ${members.map((member) => member.name).join(", ")}.${plusOneCount ? ` Plus ones allowed: ${plusOneCount}.` : ""}`;
    document.querySelector("#invited-members").innerHTML = members.map((member) => `
      <label class="checkbox-card">
        <input type="checkbox" name="attendingMembers" value="${escapeHTML(member.name)}" data-member-id="${escapeHTML(member.id)}" data-member-type="${escapeHTML(member.type)}" checked>
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
      ? "This form currently collects one plus one name. Additional guest names can go in the notes."
      : "Please share their name below.";
    plusOneFieldset.classList.toggle("hidden", plusOneCount <= 0);
    matchResult.innerHTML = `<div class="card"><p class="kicker">Invitation Found</p><h2>${escapeHTML(household.household)}</h2><p>${members.map((member) => `${escapeHTML(member.name)} (${member.type === "child" ? "child" : "adult"})`).join(", ")}</p><p>Invite code: <strong>${escapeHTML(household.code)}</strong></p></div>`;
    rsvpForm.classList.remove("hidden");
    confirmation.classList.add("hidden");
  }

  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = document.querySelector("#guest-search").value.trim();
    if (!query) return;

    setLoading(true);
    selectedHousehold = null;
    rsvpForm.classList.add("hidden");
    confirmation.classList.add("hidden");

    try {
      const data = await apiJson(`/api/public/rsvp-search?q=${encodeURIComponent(query)}`);
      showGuest(mapHousehold(data.household));
    } catch (err) {
      matchResult.innerHTML = `<div class="notice">${escapeHTML(err.message || "No invitation matched that search. Try a household name, phone number, or invite code.")}</div>`;
    } finally {
      setLoading(false);
    }
  });

  rsvpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedHousehold) return;

    const submitButton = rsvpForm.querySelector("button[type='submit']");
    const formData = new FormData(rsvpForm);
    const attendingMembers = Array.from(rsvpForm.querySelectorAll('input[name="attendingMembers"]:checked')).map((input) => ({
      guestId: input.dataset.memberId,
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

    const payload = {
      code: selectedHousehold.code,
      status: formData.get("status"),
      attendees: formData.get("status") === "attending" ? attendingMembers : [],
      plusOne: plusOne.attending ? plusOne : null,
      song: formData.get("song") || "",
      notes: formData.get("notes") || ""
    };

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    try {
      await apiJson("/api/public/rsvp", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      confirmation.textContent = payload.status === "attending"
        ? "Thank you. Your RSVP has been saved, and we are so excited to celebrate with you."
        : "Thank you. Your RSVP has been saved, and we will miss you.";
      confirmation.classList.remove("hidden");
      rsvpForm.classList.add("hidden");
    } catch (err) {
      confirmation.textContent = err.message || "We could not save your RSVP. Please try again.";
      confirmation.classList.remove("hidden");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit RSVP";
    }
  });

  plusOneCheckbox.addEventListener("change", () => {
    plusOneName.required = plusOneCheckbox.checked;
    if (plusOneCheckbox.checked) plusOneName.focus();
  });
})();
