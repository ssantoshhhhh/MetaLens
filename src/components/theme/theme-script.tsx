export const THEME_STORAGE_KEY = "metalens-theme"

const script = `(function(){var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)})()`

/** Applies the saved or system theme before first paint to prevent a flash. */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
