;(() => {
  // ---------- State ----------
  const state = {
    startScore: 501,
    firstTo: 3,
    players: [],
    turn: 0,
    input: "",
    history: [],
  }

  const aroundState = {
    targets: [...Array.from({ length: 20 }, (_, i) => i + 1), 25, 50],
    currentIndex: 0,
    isRunning: false,
    startTime: null,
    elapsedMs: 0,
    timerId: null,
  }

  // ---------- Elements ----------
  const setupView = document.getElementById("setupView")
  const gameView = document.getElementById("gameView")
  const playerInputs = document.getElementById("playerInputs")
  const startBtn = document.getElementById("startBtn")
  const startScoreEl = document.getElementById("startScore")
  const firstToEl = document.getElementById("firstTo")
  const playersArea = document.getElementById("playersArea")
  const scoreInput = document.getElementById("scoreInput")
  const pad = document.getElementById("pad")
  const doneBtn = document.getElementById("doneBtn")
  const bustBtn = document.getElementById("bustBtn")
  const undoBtn = document.getElementById("undoBtn")
  const modalOverlay = document.getElementById("modalOverlay")
  const modalTitle = document.getElementById("modalTitle")
  const modalMessage = document.getElementById("modalMessage")
  const modalActions = document.getElementById("modalActions")
  const modalPrimaryBtn = document.getElementById("modalPrimaryBtn")
  const modalSecondaryBtn = document.getElementById("modalSecondaryBtn")
  const modalCloseBtn = document.getElementById("modalCloseBtn")
  const scoreFlash = document.getElementById("scoreFlash")
  const scoreFlashValue = document.getElementById("scoreFlashValue")
  const menuView = document.getElementById("menuView")
  const aroundView = document.getElementById("aroundView")
  const menuBtn = document.getElementById("menuBtn")
  const open501Btn = document.getElementById("open501Btn")
  const openAroundBtn = document.getElementById("openAroundBtn")
  const aroundTimer = document.getElementById("aroundTimer")
  const aroundTargets = document.getElementById("aroundTargets")
  const aroundStartBtn = document.getElementById("aroundStartBtn")
  const aroundResetBtn = document.getElementById("aroundResetBtn")

  // ---------- Setup UI ----------
  function buildPlayerInputs() {
    playerInputs.innerHTML = ""
    const defaults = ["player1", "player 2", "player 3", "player 4"]
    for (let i = 0; i < 4; i++) {
      const wrap = document.createElement("div")
      wrap.innerHTML = `
        <input id="p${i}" placeholder="${defaults[i]}" value="${i < 2 ? defaults[i] : ""}" />
      `
      playerInputs.appendChild(wrap)
    }
  }

  // ---------- Helpers ----------
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n))
  }

  function buildPossibleScores() {
    const singles = Array.from({ length: 20 }, (_, i) => i + 1)
    const doubles = singles.map(n => n * 2)
    const trebles = singles.map(n => n * 3)

    const oneDart = new Set([0, ...singles, ...doubles, ...trebles, 25, 50])

    const possible = new Set()

    for (const a of oneDart) {
      for (const b of oneDart) {
        for (const c of oneDart) {
          possible.add(a + b + c)
        }
      }
    }

    return possible
  }

  const POSSIBLE_SCORES = buildPossibleScores()

  function isValidDartsScore(points) {
    return POSSIBLE_SCORES.has(points)
  }

  function snapshot() {
    state.history.push(
      JSON.stringify({
        players: state.players,
        turn: state.turn,
      }),
    )
    if (state.history.length > 50) state.history.shift()
  }

  function restoreLast() {
    const last = state.history.pop()
    if (!last) return
    const obj = JSON.parse(last)
    state.players = obj.players
    state.turn = obj.turn
    render()
  }

  function avg3(p) {
    if (!p.darts) return 0
    return (p.scored / p.darts) * 3
  }

  function nextTurn() {
    state.turn = (state.turn + 1) % state.players.length
  }

  function checkoutHint(rem) {
    const map = {
      170: "T20 T20 BULL",
      167: "T20 T19 BULL",
      164: "T20 T18 BULL",
      161: "T20 T17 BULL",
      160: "T20 T20 D20",
      158: "T20 T20 D19",
      156: "T20 T20 D18",
      155: "T20 T19 D19",
      154: "T20 T18 D20",
      153: "T20 T19 D18",
      152: "T20 T20 D16",
      151: "T20 T17 D20",
      150: "T20 T18 D18",
      141: "T20 T19 D12",
      100: "T20 D20",
      80: "T20 D10",
      60: "20 D20",
      50: "10 D20 / BULL",
      40: "D20",
      32: "D16",
      24: "D12",
      16: "D8",
      8: "D4",
      2: "D1",
    }
    return map[rem] || (rem <= 170 ? "Checkout: vali tee double’isse" : "")
  }

  function closeModal() {
    modalOverlay.classList.add("hidden")
    modalPrimaryBtn.onclick = null
    modalSecondaryBtn.onclick = null
  }

  function openModal({
    title = "Teavitus",
    message = "",
    primaryText = "OK",
    secondaryText = "",
    onPrimary = null,
    onSecondary = null,
  }) {
    modalTitle.textContent = title
    modalMessage.textContent = message

    modalPrimaryBtn.textContent = primaryText
    modalPrimaryBtn.onclick = () => {
      closeModal()
      if (onPrimary) onPrimary()
    }

    if (secondaryText) {
      modalSecondaryBtn.textContent = secondaryText
      modalSecondaryBtn.classList.remove("hidden")
      modalSecondaryBtn.onclick = () => {
        closeModal()
        if (onSecondary) onSecondary()
      }
    } else {
      modalSecondaryBtn.classList.add("hidden")
      modalSecondaryBtn.onclick = null
    }

    modalOverlay.classList.remove("hidden")
  }

  let scoreFlashTimer = null

  function showScoreFlash(value) {
    scoreFlashValue.textContent = value
    scoreFlash.classList.remove("hidden")

    requestAnimationFrame(() => {
      scoreFlash.classList.add("show")
    })

    clearTimeout(scoreFlashTimer)
    scoreFlashTimer = setTimeout(() => {
      scoreFlash.classList.remove("show")

      setTimeout(() => {
        scoreFlash.classList.add("hidden")
      }, 250)
    }, 2000)
  }

  function formatAroundTime(ms) {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0")
    const seconds = String(totalSeconds % 60).padStart(2, "0")
    return `${minutes}:${seconds}`
  }

  function stopAroundTimer() {
    if (aroundState.timerId) {
      clearInterval(aroundState.timerId)
      aroundState.timerId = null
    }
    aroundState.isRunning = false
  }

  function resetAroundGame() {
    stopAroundTimer()
    aroundState.currentIndex = 0
    aroundState.startTime = null
    aroundState.elapsedMs = 0
    renderAround()
  }

  function startAroundGame() {
    resetAroundGame()
    aroundState.isRunning = true
    aroundState.startTime = Date.now()

    aroundState.timerId = setInterval(() => {
      aroundState.elapsedMs = Date.now() - aroundState.startTime
      renderAroundTimer()
    }, 200)

    renderAround()
  }

  // ---------- Rendering ----------
  function renderPlayers() {
    playersArea.innerHTML = ""
    state.players.forEach((p, idx) => {
      const card = document.createElement("div")
      card.className = "playerCard" + (idx === state.turn ? " active" : "")

      const percent = (1 - p.remaining / state.startScore) * 100
      const hint = checkoutHint(p.remaining)

      card.innerHTML = `
        <div class="playerHead">
          <div>Legs: <b>${p.legs}</b></div>
          <div class="name">${p.name}</div>
          <div>Avg: <b>${avg3(p).toFixed(2)}</b></div>
        </div>
        <div class="remaining">${p.remaining}</div>
        <div class="bar"><div style="width:${clamp(percent, 0, 100).toFixed(1)}%"></div></div>
        <div class="hint">${hint}</div>
      `
      playersArea.appendChild(card)
    })
  }

  function render() {
    renderPlayers()
    scoreInput.value = state.input
  }

  function renderAroundTimer() {
    aroundTimer.textContent = formatAroundTime(aroundState.elapsedMs)
  }

  function renderAroundTargets() {
    aroundTargets.innerHTML = ""

    aroundState.targets.forEach((target, index) => {
      const el = document.createElement("div")
      el.className = "aroundTarget"

      if (index < aroundState.currentIndex) {
        el.classList.add("done")
      } else if (index === aroundState.currentIndex) {
        el.classList.add("active")
      } else {
        el.classList.add("locked")
      }

      el.textContent = target

      el.addEventListener("click", () => {
        if (!aroundState.isRunning) return
        if (index !== aroundState.currentIndex) return

        aroundState.currentIndex += 1

        if (aroundState.currentIndex >= aroundState.targets.length) {
          aroundState.elapsedMs = Date.now() - aroundState.startTime
          stopAroundTimer()
          renderAroundTimer()
          renderAroundTargets()

          openModal({
            title: "Finished",
            message: `You completed Around the Board in ${formatAroundTime(aroundState.elapsedMs)}.`,
            primaryText: "Play again",
            secondaryText: "Close",
            onPrimary: () => {
              startAroundGame()
            },
            onSecondary: () => {
              resetAroundGame()
            },
          })
          return
        }

        renderAroundTargets()
      })

      aroundTargets.appendChild(el)
    })
  }

  function renderAround() {
    renderAroundTimer()
    renderAroundTargets()
  }

  // ---------- Keypad ----------
  function buildPad() {
    const keys = [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "DEL",
      "0",
      "CLR",
    ]
    pad.innerHTML = ""
    keys.forEach(k => {
      const el = document.createElement("div")
      el.className = "key" + (k === "DEL" || k === "CLR" ? " small" : "")
      el.textContent = k
      el.addEventListener("click", () => {
        if (k === "DEL") state.input = state.input.slice(0, -1)
        else if (k === "CLR") state.input = ""
        else state.input += k
        if (state.input.length > 3) state.input = state.input.slice(0, 3)
        render()
      })
      pad.appendChild(el)
    })
  }

  // ---------- Game logic ----------
  function applyScore(points) {
    const cur = state.players[state.turn]
    if (!cur) return

    if (
      Number.isNaN(points) ||
      points < 0 ||
      points > 180 ||
      !isValidDartsScore(points)
    ) {
      openModal({
        title: "Invalid score",
        message: "This score is not possible with 3 darts. Please enter a valid score.",
        primaryText: "OK",
      })
      state.input = ""
      render()
      return
    }

    snapshot()

    const newRem = cur.remaining - points

    if (newRem < 0) {
      cur.darts += 3
      cur.legDarts += 3
      state.input = ""
      nextTurn()
      render()
      return
    }

    cur.remaining = newRem
    cur.darts += 3
    cur.legDarts += 3
    cur.scored += points

    showScoreFlash(points)

    if (cur.remaining === 0) {
      cur.legs += 1

      if (cur.legs >= state.firstTo) {
        openModal({
          title: "Match won",
          message: `${cur.name} won the match with ${cur.legDarts} darts in the final leg.`,
          primaryText: "New game",
          secondaryText: "Close",
          onPrimary: () => {
            showMenu()
          },
          onSecondary: () => {
            showMenu()
          },
        })
        return
      }

      openModal({
        title: "Leg won",
        message: `${cur.name} won the leg with ${cur.legDarts} darts.`,
        primaryText: "Play again",
        secondaryText: "Close",
        onPrimary: () => {
          state.players.forEach(p => {
            p.remaining = state.startScore
            p.legDarts = 0
          })
          state.turn = 0
          state.input = ""
          render()
        },
        onSecondary: () => {
          state.players.forEach(p => {
            p.remaining = state.startScore
            p.legDarts = 0
          })
          state.turn = 0
          state.input = ""
          render()
        },
      })
      return
    }

    state.input = ""
    nextTurn()
    render()
  }

  function bust() {
    const cur = state.players[state.turn]
    if (!cur) return
    snapshot()
    cur.darts += 3
    cur.legDarts += 3
    state.input = ""
    showScoreFlash(0)
    nextTurn()
    render()
  }

  // ---------- View switching ----------
  function showMenu() {
    stopAroundTimer()
    menuView.classList.remove("hidden")
    setupView.classList.add("hidden")
    gameView.classList.add("hidden")
    aroundView.classList.add("hidden")
  }

  function showGame() {
    menuView.classList.add("hidden")
    setupView.classList.add("hidden")
    aroundView.classList.add("hidden")
    gameView.classList.remove("hidden")
    render()
    scoreInput.focus()
  }

  function showSetup() {
    stopAroundTimer()
    menuView.classList.add("hidden")
    gameView.classList.add("hidden")
    aroundView.classList.add("hidden")
    setupView.classList.remove("hidden")
    state.players = []
    state.turn = 0
    state.input = ""
    state.history = []
  }

  function showAround() {
    menuView.classList.add("hidden")
    setupView.classList.add("hidden")
    gameView.classList.add("hidden")
    aroundView.classList.remove("hidden")
    renderAround()
  }

  // ---------- Events ----------
  startBtn.addEventListener("click", () => {
    const s = parseInt(startScoreEl.value, 10)
    const ft = Math.max(1, Math.min(parseInt(firstToEl.value, 10) || 3, 25))

    const names = []
    for (let i = 0; i < 4; i++) {
      const v = (document.getElementById(`p${i}`).value || "").trim()
      if (v) names.push(v)
    }

    if (names.length === 0) names.push("Player 1")

    state.startScore = s
    state.firstTo = ft
    state.players = names.slice(0, 4).map(n => ({
      name: n,
      remaining: s,
      legs: 0,
      darts: 0,
      scored: 0,
      legDarts: 0,
    }))
    state.turn = 0
    state.input = ""
    state.history = []
    showGame()
  })

  doneBtn.addEventListener("click", () => {
    const points = parseInt(state.input, 10)
    applyScore(points)
  })

  bustBtn.addEventListener("click", bust)

  undoBtn.addEventListener("click", () => {
    restoreLast()
  })

  menuBtn.addEventListener("click", () => {
    openModal({
      title: "Open menu",
      message: "Do you want to return to the main menu?",
      primaryText: "Yes",
      secondaryText: "Cancel",
      onPrimary: () => {
        showMenu()
      },
    })
  })

  open501Btn.addEventListener("click", () => {
    showSetup()
  })

  openAroundBtn.addEventListener("click", () => {
    showAround()
  })

  scoreInput.addEventListener("input", e => {
    const v = (e.target.value || "").replace(/[^\d]/g, "").slice(0, 3)
    state.input = v
    render()
  })

  scoreInput.addEventListener("keydown", e => {
    if (e.key === "Enter") doneBtn.click()
  })

  modalCloseBtn.addEventListener("click", closeModal)

  modalOverlay.addEventListener("click", e => {
    if (e.target === modalOverlay) {
      closeModal()
    }
  })

  aroundStartBtn.addEventListener("click", () => {
    startAroundGame()
  })

  aroundResetBtn.addEventListener("click", () => {
    openModal({
      title: "Reset Around the Board",
      message: "Do you want to reset this run?",
      primaryText: "Reset",
      secondaryText: "Cancel",
      onPrimary: () => {
        resetAroundGame()
      },
    })
  })

  // ---------- Init ----------
  buildPlayerInputs()
  buildPad()
  renderAround()
})()
