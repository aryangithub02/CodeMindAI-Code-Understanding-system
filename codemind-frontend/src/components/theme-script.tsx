"use client"

export function ThemeScript() {
    const code = `
    (function() {
      try {
        var stored = localStorage.getItem('codemind-settings');
        if (stored) {
          var parsed = JSON.parse(stored);
          var theme = parsed?.state?.settings?.theme || parsed?.settings?.theme || 'dark';
        } else {
          var theme = 'dark';
        }
        if (theme === 'light') {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
        } else {
          document.documentElement.classList.remove('light');
          document.documentElement.classList.add('dark');
        }
      } catch (e) {
        document.documentElement.classList.add('dark');
      }
    })();
  `

    return <script dangerouslySetInnerHTML={{ __html: code }} />
}