(() => {
  try {
    // 1. Manually extract contact links (mailto, tel) to ensure they are never lost
    const links = Array.from(document.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]'));
    const contacts = [...new Set(links.map(a => a.href.trim()))];

    // 2. Clone the document body for safe mutation
    const clone = document.body.cloneNode(true);
    
    // 3. Remove non-content elements to clean up the HTML before Markdown conversion
    const elementsToRemove = clone.querySelectorAll('script, style, noscript, svg, canvas, iframe');
    elementsToRemove.forEach(el => el.remove());

    // 4. Convert HTML direct to Markdown using Turndown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    
    // Ensure Turndown keeps links
    turndownService.keep(['a']);

    let markdown = turndownService.turndown(clone.innerHTML);

    // 5. Append missing contacts if any
    if (contacts.length > 0) {
      markdown += '\n\n### Scraped Contact Links\n' + contacts.map(c => `- ${c}`).join('\n');
    }

    // Collapse excessive whitespace/newlines in markdown
    markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

    // 6. Extract .vcf links
    const vcfNodes = Array.from(document.querySelectorAll('a[href$=".vcf"]'));
    const vcfs = [...new Set(vcfNodes.map(a => a.href.trim()))];

    return {
      url: window.location.href,
      markdown: markdown,
      vcfs: vcfs
    };
  } catch (error) {
    console.error("Scraping Error:", error);
    return { error: error.message };
  }
})();