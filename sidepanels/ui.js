import { sendLeadToWebhook } from './api.js';

// Utility to escape HTML and prevent XSS
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

export function renderLeads(leads, leadsContainer) {
  leadsContainer.innerHTML = '';
  const arr = Array.isArray(leads) ? leads : [leads];
  
  arr.forEach(lead => {
    const details = document.createElement('details');
    const lawyerName = escapeHTML(lead.LawyerName || 'Unknown Lawyer');

    details.innerHTML = `<summary role="button" class="outline contrast" style="display: flex; align-items: center; gap: 0.5rem;">
        <input type="checkbox" class="lead-checkbox" style="margin: 0; width: auto; height: auto;" onclick="event.stopPropagation()" checked>
        ${lawyerName}
      </summary>
      <form class="lead-form" style="margin-top: 1rem;">
        <fieldset>
          <label>Lawyer Name
            <input type="text" name="lawyerName" value="${escapeHTML(lead.LawyerName)}" placeholder="Lawyer Name" aria-label="Lawyer Name">
          </label>
          <label>Email
            <input type="email" name="email" value="${escapeHTML(lead.Mail)}" placeholder="Email" aria-label="Email" autocomplete="email">
          </label>
          <label>Phone
            <input type="tel" name="tel" value="${escapeHTML(lead.Phone)}" placeholder="Phone" aria-label="Phone" autocomplete="tel">
          </label>
          <label>Firm Name
            <input type="text" name="firmName" value="${escapeHTML(lead.FirmName)}" placeholder="Firm Name" aria-label="Firm Name">
          </label>
          <label>Title
            <input type="text" name="title" value="${escapeHTML(lead.Title)}" placeholder="Title" aria-label="Title">
          </label>
          <label>Practice Area
            <input type="text" name="practiceArea" value="${escapeHTML(lead['Practice Area'])}" placeholder="Practice Area" aria-label="Practice Area">
          </label>
          <div role="group">
            <label>City
              <input type="text" name="city" value="${escapeHTML(lead.City)}" placeholder="City" aria-label="City">
            </label>
            <label>Country
              <input type="text" name="country" value="${escapeHTML(lead.Country)}" placeholder="Country" aria-label="Country">
            </label>
          </div>
          <label>Profile URL
            <input type="url" name="url" value="${escapeHTML(lead.Url)}" placeholder="Profile URL" aria-label="Profile URL">
          </label>
        </fieldset>
        <input type="submit" value="Send this Lead" />
      </form>`;

    const form = details.querySelector('form');
    
    // Attach the async function to the form so we can call it directly and await it
    form.submitLead = async () => {
      const submitBtn = form.querySelector('input[type="submit"]');
      const originalValue = submitBtn.value;
      
      submitBtn.value = 'Sending...';
      submitBtn.disabled = true;
      submitBtn.classList.add('secondary');

      try {
        const formData = new FormData(form);
        await sendLeadToWebhook(formData);

        submitBtn.value = 'Sent!';
        submitBtn.classList.remove('secondary');
        submitBtn.classList.add('contrast'); // Show success visually
      } catch (error) {
        console.error('Failed to send lead:', error);
        submitBtn.value = 'Error!';
        alert(error.message); // Give the user some feedback
      } finally {
        setTimeout(() => {
          submitBtn.value = originalValue;
          submitBtn.disabled = false;
          submitBtn.classList.remove('secondary', 'contrast');
        }, 2500);
      }
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await form.submitLead();
    });

    leadsContainer.appendChild(details);
  });

  const leadsWrapper = document.getElementById('leads-wrapper');
  if (leadsWrapper) {
    leadsWrapper.style.display = arr.length > 0 ? 'block' : 'none';
  }
}

export function renderCode(data, codeContainer) {
  codeContainer.innerHTML = '';
  const content = data.markdown || data.text || data.code || '';

  const stats = document.createElement('p');
  stats.innerHTML = `<small><strong>URL:</strong> ${escapeHTML(data.url)}<br>
                       <strong>Scraped at:</strong> ${escapeHTML(new Date(data.timestamp).toLocaleString())}<br>
                       <strong>Content Length:</strong> ${content.length} characters</small>`;
  codeContainer.appendChild(stats);

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = content.substring(0, 2000) + (content.length > 2000 ? '\n... [TRUNCATED]' : '');
  pre.appendChild(code);
  codeContainer.appendChild(pre);
}
