(function(){
    const savedTheme = localStorage.getItem("scheduleBuilderTheme");

    if(savedTheme === "light"){
        document.documentElement.classList.remove("dark-mode");
    }else{
        document.documentElement.classList.add("dark-mode");
    }

    window.updateThemeToggle = function(){
        const button = document.getElementById("themeToggle");
        if(!button) return;

        const isDark =
            document.documentElement.classList.contains("dark-mode");

        button.textContent = isDark ? "☀" : "☾";
        button.setAttribute(
            "aria-label",
            isDark ? "Switch to light mode" : "Switch to dark mode"
        );
        button.setAttribute(
            "title",
            isDark ? "Switch to light mode" : "Switch to dark mode"
        );
    };

    window.toggleTheme = function(){
        const isDark =
            document.documentElement.classList.toggle("dark-mode");

        localStorage.setItem(
            "scheduleBuilderTheme",
            isDark ? "dark" : "light"
        );

        window.updateThemeToggle();
    };

    document.addEventListener(
        "DOMContentLoaded",
        window.updateThemeToggle
    );
})();
