const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let chatHistory = [];

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

async function getHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    const pill = $("#statusPill");
    pill.innerHTML = `<span></span> ${data.aiConfigured ? "AI online" : "Demo mode"}`;
    $("#chatMode").textContent = data.aiConfigured ? "AI online" : "Demo mode";
  } catch {
    $("#statusPill").innerHTML = "<span></span> Offline";
    $("#chatMode").textContent = "Offline";
  }
}

$$(".chip").forEach(chip => {
  chip.addEventListener("click", () => chip.classList.toggle("active"));
});

$$(".destination-card").forEach(card => {
  card.addEventListener("click", () => {
    $("#destination").value = card.dataset.destination;
    $("#planner").scrollIntoView({ behavior: "smooth" });
  });
});

function collectForm() {
  return {
    destination: $("#destination").value.trim(),
    startDate: $("#startDate").value,
    days: Number($("#days").value),
    travellers: Number($("#travellers").value),
    budget: $("#budget").value,
    style: $("#style").value,
    interests: $$(".chip.active").map(x => x.dataset.interest)
  };
}

function setLoading(isLoading) {
  $("#generateText").textContent = isLoading ? "Planning your adventure..." : "Generate my itinerary";
  $("#generateSpinner").classList.toggle("hidden", !isLoading);
  $("#plannerForm button[type=submit]").disabled = isLoading;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function renderPlan(plan, destination) {
  $("#results").classList.remove("hidden");
  $("#resultTitle").textContent = `${destination} · ${plan.days.length} days`;
  $("#resultSummary").textContent = plan.summary || "Your personalised travel plan is ready.";
  $("#resultBudget").textContent = plan.budget || "Plan your daily spend and keep a small emergency buffer.";

  $("#timeline").innerHTML = plan.days.map(day => `
    <article class="day-card">
      <div class="day-number">DAY ${escapeHtml(day.day)}</div>
      <div>
        <h3>${escapeHtml(day.title)}</h3>
        <div class="plan-parts">
          <div class="plan-part"><b>MORNING</b><p>${escapeHtml(day.morning)}</p></div>
          <div class="plan-part"><b>AFTERNOON</b><p>${escapeHtml(day.afternoon)}</p></div>
          <div class="plan-part"><b>EVENING</b><p>${escapeHtml(day.evening)}</p></div>
        </div>
      </div>
      <div class="day-tip">✦ ${escapeHtml(day.tip || "Verify current details before travelling.")}</div>
    </article>
  `).join("");

  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#plannerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = collectForm();

  if (!data.destination) return showToast("Please enter a destination.");
  if (data.days < 1 || data.days > 30) return showToast("Choose 1–30 days.");
  if (data.travellers < 1 || data.travellers > 20) return showToast("Choose 1–20 travellers.");

  setLoading(true);
  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to generate your itinerary.");
    renderPlan(result, data.destination);
    showToast(result.mode === "demo" ? "Demo itinerary generated." : "AI itinerary ready!");
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(false);
  }
});

$("#printBtn").addEventListener("click", () => window.print());

function addMessage(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `message ${role}`;
  wrap.innerHTML = role === "assistant"
    ? `<div class="avatar">✦</div><div class="bubble">${escapeHtml(text)}</div>`
    : `<div class="bubble">${escapeHtml(text)}</div>`;
  $("#messages").appendChild(wrap);
  $("#messages").scrollTop = $("#messages").scrollHeight;
}

async function sendChat(message) {
  if (!message.trim()) return;

  addMessage("user", message);
  chatHistory.push({ role: "user", content: message });
  $("#chatInput").value = "";

  const thinking = document.createElement("div");
  thinking.className = "message assistant";
  thinking.id = "thinking";
  thinking.innerHTML = `<div class="avatar">✦</div><div class="bubble">Thinking…</div>`;
  $("#messages").appendChild(thinking);
  $("#messages").scrollTop = $("#messages").scrollHeight;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: chatHistory.slice(-10) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The assistant is unavailable.");
    chatHistory.push({ role: "assistant", content: data.reply });
    thinking.remove();
    addMessage("assistant", data.reply);
  } catch (error) {
    thinking.remove();
    addMessage("assistant", `Sorry — ${error.message}`);
  }
}

$("#chatForm").addEventListener("submit", event => {
  event.preventDefault();
  sendChat($("#chatInput").value);
});

$$(".suggestions button").forEach(button => {
  button.addEventListener("click", () => sendChat(button.dataset.prompt));
});

getHealth();
