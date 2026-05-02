(function () {
  const searchForm = document.querySelector("#guest-search-form");
  const rsvpForm = document.querySelector("#rsvp-form");
  if (!searchForm || !rsvpForm) return;

  const matchResult = document.querySelector("#match-result");
  const confirmation = document.querySelector("#rsvp-confirmation");
  let selectedGuest = null;

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
        ...(guest.members || [])
      ].map(normalize).join(" ");
      return haystack.includes(needle);
    });
  }

  function showGuest(guest) {
    selectedGuest = guest;
    document.querySelector("#household-code").value = guest.code;
    document.querySelector("#household-summary").textContent = `${guest.household}: ${(guest.members || [guest.name]).join(", ")}. Allowed plus ones: ${guest.plusOnes}.`;
    document.querySelector("#count-attending").max = String((guest.members || [guest.name]).length + Number(guest.plusOnes || 0));
    matchResult.innerHTML = `<div class="card"><p class="kicker">Invitation Found</p><h2>${guest.household}</h2><p>${(guest.members || [guest.name]).join(", ")}</p><p>Invite code: <strong>${guest.code}</strong></p></div>`;
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
    const response = {
      guestId: selectedGuest.id,
      household: selectedGuest.household,
      code: selectedGuest.code,
      status: formData.get("status"),
      count: Number(formData.get("count") || 0),
      meal: formData.get("meal"),
      allergies: formData.get("allergies") || "",
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
})();
