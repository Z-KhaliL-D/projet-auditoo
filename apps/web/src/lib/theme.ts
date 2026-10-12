// Dark mode follows the system. The .dark class is what the shadcn tokens key on.
export function followSystemTheme(): void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => document.documentElement.classList.toggle("dark", query.matches);
  apply();
  query.addEventListener("change", apply);
}
