(function(){
    const savedTheme = localStorage.getItem("scheduleContractManagementTheme");
    if(savedTheme !== "light"){
        document.documentElement.classList.add("dark-mode");
    }
})();
