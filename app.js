(() => {
  const $ = (sel) => document.querySelector(sel);
  const screens = { start: $("#screen-start"), game: $("#screen-game"), end: $("#screen-end") };
  const state = { team: "", caseId: "", data: null, stageList: [], stageIndex: 0, score: { op: 0, hf: 0, eco: 0 }, progress: 0, allowNext: false };

  function announce(el, msg){ el.textContent = msg; }
  function setFog(percent){
    const fog = $("#fog");
    const blur = Math.max(0, 10 - (percent/10));
    fog.style.filter = `blur(${blur}px)`;
    fog.style.opacity = (1 - percent/100) * 0.8 + "";
    $("#progressBar").style.width = percent + "%";
  }

  function buildStageList(caseObj){
    const stages = [];
    caseObj.whys.forEach((why, idx) => {
      stages.push({ type: "main", badge: `WHY ${idx+1}`, title: why.title, q: why.q, options: why.options });
      why.nested?.forEach((nw, j) => stages.push({ type: "nested", badge: `WHY ${idx+1}.${j+1}`, title: nw.title||"Drill-down", q: nw.q, options: nw.options }));
      if(why.hf){ stages.push({ type: "hf", badge: `HF – WHY ${idx+1}`, title: why.hf.title, q: why.hf.q, options: why.hf.options }); }
      if(why.eco){ stages.push({ type: "eco", badge: `ECO – WHY ${idx+1}`, title: why.eco.title, q: why.eco.q, options: why.eco.options }); }
    });
    return stages;
  }

  function renderStage(){
    const st = state.stageList[state.stageIndex];
    if(!st){ return endGame(); }
    $("#stageBadge").textContent = st.badge;
    $("#questionTitle").textContent = st.title;
    $("#questionText").textContent = st.q;
    const form = $("#optionsForm"); form.innerHTML = ""; $("#feedback").textContent = ""; $("#nextBtn").disabled = true; state.allowNext = false;
    st.options.forEach((opt, i) => {
      const id = "opt"+i;
      const wrap = document.createElement("label"); wrap.className = "option"; wrap.setAttribute("for", id);
      const input = document.createElement("input"); input.type = "radio"; input.name = "opt"; input.id = id; input.value = i;
      input.addEventListener("change", () => onSelectOption(opt, wrap, st.type));
      const txt = document.createElement("div"); txt.innerHTML = `<b>${String.fromCharCode(65+i)}.</b> ${opt.text}`;
      wrap.appendChild(input); wrap.appendChild(txt); form.appendChild(wrap);
    });
    setFog(state.progress);
  }

  function onSelectOption(opt, wrap, stageType){
    document.querySelectorAll(".option").forEach(o => o.classList.remove("correct","partial","wrong"));
    if(opt.correct) wrap.classList.add("correct"); else if(opt.partial) wrap.classList.add("partial"); else wrap.classList.add("wrong");
    const fb = $("#feedback");
    if(opt.correct){
      if(stageType === "main" || stageType === "nested"){ state.score.op += 3; state.progress = Math.min(100, state.progress + 10); }
      else if(stageType === "hf"){ state.score.hf += 2; state.progress = Math.min(100, state.progress + 5); }
      else if(stageType === "eco"){ state.score.eco += 2; state.progress = Math.min(100, state.progress + 5); }
      announce(fb, opt.feedback || "Correct. Skies clearing.");
    }else if(opt.partial){
      if(stageType === "main" || stageType === "nested"){ state.score.op += 1; state.progress = Math.min(100, state.progress + 4); }
      else if(stageType === "hf"){ state.score.hf += 1; state.progress = Math.min(100, state.progress + 2); }
      else if(stageType === "eco"){ state.score.eco += 1; state.progress = Math.min(100, state.progress + 2); }
      announce(fb, opt.feedback || "Partially correct. Refine your Why.");
    }else{
      state.progress = Math.max(0, state.progress - 2);
      announce(fb, opt.feedback || "Not quite. Evidence doesn’t support that.");
    }
    $("#scoreOp").textContent = state.score.op; $("#scoreHF").textContent = state.score.hf; $("#scoreEco").textContent = state.score.eco;
    setFog(state.progress); $("#nextBtn").disabled = false; state.allowNext = true;
  }

  function nextStage(){ if(!state.allowNext) return; state.stageIndex += 1; renderStage(); }
  function endGame(){
    screens.game.classList.remove("visible"); screens.end.classList.add("visible");
    $("#finalOp").textContent = state.score.op; $("#finalHF").textContent = state.score.hf; $("#finalEco").textContent = state.score.eco;
    const total = state.score.op + state.score.hf + state.score.eco; $("#finalTotal").textContent = total;
    $("#resultSummary").textContent = `Team ${state.team} completed “${state.data.title}”. Operational ${state.score.op}, Human ${state.score.hf}, Future ${state.score.eco}.`;
    saveToLeaderboard(state.team, state.data.title, total); renderLeaderboard();
  }
  function saveToLeaderboard(team, caseTitle, total){
    const key="skywise_leaderboard"; const arr = JSON.parse(localStorage.getItem(key)||"[]");
    arr.push({team, caseTitle, total, ts: Date.now()}); arr.sort((a,b)=> b.total - a.total);
    localStorage.setItem(key, JSON.stringify(arr.slice(0,20)));
  }
  function renderLeaderboard(){
    const arr = JSON.parse(localStorage.getItem('skywise_leaderboard')||"[]"); const ol = $("#leaderboard"); ol.innerHTML="";
    arr.forEach((r,i)=>{ const li=document.createElement('li'); li.textContent=`#${i+1} ${r.team} – ${r.caseTitle} – ${r.total} pts (${new Date(r.ts).toLocaleString()})`; ol.appendChild(li); });
  }
  function startGame(e){
    e.preventDefault();
    state.team = $("#teamName").value.trim(); state.caseId = $("#caseSelect").value; if(!state.team) return;
    fetch("data/cases.json").then(r=>r.json()).then(data=>{
      const caseObj = data.cases.find(c => c.id === state.caseId); state.data = caseObj;
      state.stageList = buildStageList(caseObj); state.stageIndex=0; state.score={op:0,hf:0,eco:0}; state.progress=0;
      $("#teamLabel").textContent = `👥 ${state.team}`; $("#caseLabel").textContent = `📂 ${caseObj.title}`;
      $("#scoreOp").textContent="0"; $("#scoreHF").textContent="0"; $("#scoreEco").textContent="0"; setFog(0);
      screens.start.classList.remove("visible"); screens.game.classList.add("visible"); renderStage();
    });
  }
  function populateCases(){
    fetch("data/cases.json").then(r=>r.json()).then(data=>{
      const sel=$("#caseSelect"); data.cases.forEach(c=>{ const opt=document.createElement("option"); opt.value=c.id; opt.textContent=c.title; sel.appendChild(opt); });
    });
  }
  $("#shareBtn").addEventListener("click", async ()=>{
    const text = $("#resultSummary").textContent;
    if(navigator.share){ try{ await navigator.share({text, title:"SkyWise results"});}catch{} }
    else{ navigator.clipboard.writeText(text); alert("Summary copied to clipboard."); }
  });
  $("#playAgainBtn").addEventListener("click", ()=>{ screens.end.classList.remove("visible"); screens.start.classList.add("visible"); });
  $("#nextBtn").addEventListener("click", nextStage);
  $("#startForm").addEventListener("submit", startGame);
  let deferred; window.addEventListener("beforeinstallprompt",(e)=>{ e.preventDefault(); deferred=e; $("#installBtn").style.display="inline-flex"; });
  $("#installBtn").addEventListener("click", async ()=>{ if(deferred){ deferred.prompt(); deferred=null; $("#installBtn").style.display="none"; }});
  populateCases(); setFog(0);
})();
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
