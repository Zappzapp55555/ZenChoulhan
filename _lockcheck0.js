
(function(){
  var CORRECT_CODE = "1903";
  var lockScreen = document.getElementById("lockScreen");
  var input = document.getElementById("lockInput");
  var btn = document.getElementById("lockBtn");
  var errorEl = document.getElementById("lockError");

  if(localStorage.getItem("appUnlocked") === "true"){
    lockScreen.style.display = "none";
  }

  function tryUnlock(){
    if(input.value === CORRECT_CODE){
      localStorage.setItem("appUnlocked", "true");
      lockScreen.style.display = "none";
      errorEl.textContent = "";
      if(typeof quizStartPrefetch === "function"){ quizStartPrefetch(); }
    } else {
      errorEl.textContent = "Code incorrect.";
      input.value = "";
      input.focus();
    }
  }

  btn.addEventListener("click", tryUnlock);
  input.addEventListener("keydown", function(e){
    if(e.key === "Enter") tryUnlock();
  });
})();
