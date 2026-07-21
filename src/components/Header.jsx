import { Moon, Sun,ListUl } from "@gravity-ui/icons";
import { useGeneralData } from "../Context/GeneralContext";
import { useNavigate } from "react-router";
export default function Header({
  collapsed,
  setCollapsed,
  setMobileOpen,
  darkMode,
  setDarkMode,
  activeLabel,
}) {
  const { theme, toggleTheme } = useGeneralData();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const handleMenuClick = () => {
    if (window.innerWidth < 768) {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center px-4 gap-3 bg-white/80 dark:bg-[#0f1117]/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800/70">
      {/* Sidebar toggle */}
      <button
        onClick={handleMenuClick}
        aria-label="Toggle sidebar"
        className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
      >
        <ListUl className="w-5 h-5" />
      </button>

      {/* Page title (hidden on xs) */}
      <h1
        className="hidden sm:block text-base font-semibold text-gray-800 dark:text-gray-100 capitalize select-none"
        style={{ fontFamily: "'Syne', sans-serif" }}
      >
        {activeLabel}
      </h1>

      {/* Right controls */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        <button onClick={() => navigate("/security")} className="px-3 py-2 rounded-xl text-sm font-semibold text-violet-600 hover:bg-violet-50">Login Activity</button>
      
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full transition-all duration-300 hover:bg-default"
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Sun className="size-5 text-foreground" />
          ) : (
            <Moon className="size-5 text-foreground" />
          )}
        </button>

        {/* Profile chip */}
        <button className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            A
          </div>
          <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            Admin
          </span>
          {/* <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" /> */}
        </button>
      </div>
    </header>
  );
}
