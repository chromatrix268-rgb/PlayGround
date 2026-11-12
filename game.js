(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    value: $('batteryValue'), fill: $('batteryFill'), track: $('batteryTrack'), button: $('chargeButton'), buttonLabel: $('buttonLabel'),
    feedback: $('chargeFeedback'), scene: $('lanternScene'), caption: $('sceneCaption'), progress: $('journeyProgress'),
    status: $('journeyStatus'), time: $('walkTime'), title: $('journeyTitle'), copy: $('journeyCopy'), label: $('journeyLabel'),
    sparks: $('sparksCount'), nights: $('nightsCount'), reset: $('resetButton'), toast: $('toast'), sound: $('soundToggle'), soundLabel: $('soundLabel'), fireflies: $('fireflies')
  };
  const KEY = 'little-light-save-v1';
  const WALK_SECONDS = 120;
  const DRAIN_PER_SECOND = 0.35;
  const CHARGE = 10;
  let save = { battery: 64, sparks: 0, nights: 0 };
  try { save = { ...save, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (_) {}
  save.battery = Math.max(0, Math.min(100, Number(save.battery) || 0));
  save.sparks = Math.max(0, Number(save.sparks) || 0);
  save.nights = Math.max(0, Number(save.nights) || 0);
  let elapsed = 0;
  let playing = false;
  let completed = false;
  let toastTimer;
  let feedbackTimer;
  let audioContext;
  let ambientGain;
  let soundOn = false;
  let last = performance.now();
  let saveClock = 0;

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (_) {}
  }
  function update() {
    const value = Math.round(save.battery);
    els.value.textContent = value;
    els.fill.style.width = `${save.battery}%`;
    els.fill.classList.toggle('low', save.battery < 25);
    els.track.setAttribute('aria-valuenow', value);
    els.scene.classList.toggle('full-glow', save.battery >= 80);
    els.scene.classList.toggle('low-glow', save.battery < 20);
    els.sparks.textContent = save.sparks;
    els.nights.textContent = save.nights;
    els.progress.style.width = `${Math.min(100, elapsed / WALK_SECONDS * 100)}%`;
    const remaining = Math.max(0, WALK_SECONDS - elapsed);
    els.time.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(Math.floor(remaining % 60)).padStart(2, '0')}`;
    if (completed) {
      els.status.textContent = 'A lovely little journey';
      els.title.textContent = 'You made it through the night';
      els.copy.textContent = 'The fireflies found their way home. Take a breath, then wander again.';
      els.label.textContent = 'NIGHT WALK COMPLETE';
      els.buttonLabel.textContent = 'Begin another night';
      els.caption.textContent = 'A little light, all the way through';
    } else if (!playing) {
      els.status.textContent = 'Your walk begins when you’re ready';
      els.title.textContent = 'A path through the pines';
      els.copy.textContent = 'There’s no rush. Just give your lantern a little love now and then.';
      els.label.textContent = 'THE NIGHT WALK';
      els.buttonLabel.textContent = 'Give it a little glow';
      els.caption.textContent = 'Your lantern is waiting';
    } else if (save.battery <= 0) {
      els.status.textContent = 'Paused · give your lantern a little glow';
      els.title.textContent = 'A pause beneath the pines';
      els.copy.textContent = 'The path will wait. A little warmth will bring your lantern back.';
      els.label.textContent = 'THE NIGHT WALK';
      els.buttonLabel.textContent = 'Bring back the glow';
      els.caption.textContent = 'A quiet moment in the dark';
    } else {
      els.status.textContent = 'A quiet walk is underway';
      els.title.textContent = 'A path through the pines';
      els.copy.textContent = 'There’s no rush. Just give your lantern a little love now and then.';
      els.label.textContent = 'THE NIGHT WALK';
      els.buttonLabel.textContent = 'Give it a little glow';
      els.caption.textContent = save.battery > 70 ? 'Your lantern is lighting the way' : 'A soft glow leads the way';
    }
  }
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
  }
  function addFireflies(count = 1) {
    for (let i = 0; i < count; i++) {
      const bug = document.createElement('i');
      bug.className = 'firefly';
      bug.style.left = `${8 + Math.random() * 84}%`;
      bug.style.top = `${27 + Math.random() * 58}%`;
      bug.style.animationDelay = `${Math.random() * -8}s`;
      bug.style.animationDuration = `${7 + Math.random() * 7}s`;
      els.fireflies.appendChild(bug);
      setTimeout(() => bug.remove(), 15000);
    }
  }
  function audio() {
    if (!audioContext) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext = new Audio();
      const oscillator = audioContext.createOscillator();
      const filter = audioContext.createBiquadFilter();
      ambientGain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 92;
      filter.type = 'lowpass'; filter.frequency.value = 180;
      ambientGain.gain.value = 0;
      oscillator.connect(filter).connect(ambientGain).connect(audioContext.destination);
      oscillator.start();
    }
    if (audioContext.state === 'suspended') audioContext.resume();
  }
  function chime() {
    if (!soundOn || !audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(660, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(990, audioContext.currentTime + .28);
    gain.gain.setValueAtTime(.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.055, audioContext.currentTime + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + .55);
    osc.connect(gain).connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime + .6);
  }
  els.button.addEventListener('click', () => {
    if (completed) { elapsed = 0; completed = false; playing = true; save.battery = Math.max(save.battery, 64); showToast('A new night walk begins ✧'); }
    if (!playing) playing = true;
    const before = save.battery;
    save.battery = Math.min(100, save.battery + CHARGE);
    if (save.battery > before) {
      save.sparks++;
      addFireflies(3);
      els.feedback.textContent = before >= 100 ? 'Your lantern is already full ✨' : `A warm little +${Math.round(save.battery - before)}%`;
      els.feedback.classList.add('show');
      els.scene.classList.remove('charge-pop');
      void els.scene.offsetWidth;
      els.scene.classList.add('charge-pop');
      chime();
      clearTimeout(feedbackTimer);
      feedbackTimer = setTimeout(() => els.feedback.classList.remove('show'), 1300);
    } else {
      els.feedback.textContent = 'Your lantern is already full ✨';
      els.feedback.classList.add('show');
      clearTimeout(feedbackTimer);
      feedbackTimer = setTimeout(() => els.feedback.classList.remove('show'), 1300);
    }
    persist(); update();
  });
  els.reset.addEventListener('click', () => {
    save.battery = 64; elapsed = 0; playing = false; completed = false; persist(); update();
    showToast('A fresh night, whenever you’re ready');
  });
  els.sound.addEventListener('click', () => {
    soundOn = !soundOn;
    if (soundOn) {
      audio();
      if (ambientGain && audioContext) ambientGain.gain.setTargetAtTime(.012, audioContext.currentTime, .8);
      els.soundLabel.textContent = 'Sound on';
      els.sound.setAttribute('aria-label', 'Turn ambient sound off');
    } else {
      if (ambientGain && audioContext) ambientGain.gain.setTargetAtTime(0, audioContext.currentTime, .3);
      els.soundLabel.textContent = 'Sound off';
      els.sound.setAttribute('aria-label', 'Turn ambient sound on');
    }
  });
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  addFireflies(8);
  update();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(1, (now - last) / 1000);
    last = now;
    if (document.hidden || completed) return;
    saveClock += dt;
    if (save.battery > 0) {
      save.battery = Math.max(0, save.battery - DRAIN_PER_SECOND * dt);
      if (playing) elapsed = Math.min(WALK_SECONDS, elapsed + dt);
    }
    if (elapsed >= WALK_SECONDS && !completed) {
      completed = true;
      playing = false;
      save.nights++;
      showToast('Night walk complete · lovely work ✦');
      addFireflies(12);
    }
    update();
    if (saveClock >= 1) { persist(); saveClock = 0; }
  }, 200);
  setInterval(() => addFireflies(1), 6500);
})();
