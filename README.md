# EveryLawyer Chrome Extension

EveryLawyer is a powerful Chrome extension built with Manifest V3, designed to streamline the lead collection process for legal professionals. It automatically scans web pages, extracts lawyer contact information using AI, and allows for one-click submission to external tools like Google Sheets via webhooks.

## 🚀 Features

- **Smart Scanning**: Uses AI (GPT-4o or GPT-4o mini) to identify and extract structured contact details from complex web pages.
- **Sidebar Interface**: A modern, non-intrusive sidebar built with Pico CSS for managing leads without leaving the current tab.
- **Data Structuring**: Automatically formats extracted data into clean JSON, handling name, firm, phone, email, and website fields.
- **One-Click Export**: Send individual leads or your entire queue to a custom Webhook URL (ideal for Zapier or Make.com integrations).
- **Persistent Storage**: All leads and configuration settings are stored locally in your browser, ensuring no data loss between sessions.
- **Theme Support**: Clean, responsive layout with dark mode support.

## 🛠️ Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the folder where the EveryLawyer files are located.

## ⚙️ Configuration

Before using the extension, you must configure your settings:

1. Click the "Open EveryLawyer" icon or open the sidebar.
2. Navigate to the **Settings** page via the link at the bottom.
3. Provide your:
   - **OpenAI API Key**: Required for the lead extraction AI.
   - **Webhook URL**: Where you want to send your structured leads.
   - **AI Model**: Choose between `GPT-4o` (more accurate) or `GPT-4o mini` (faster/cheaper).

## 📖 How to Use

1. **Scan**: Click the "Scan Page" button on any lawyer's website or directory.
2. **Review**: The extension will extract leads and display them in the sidebar.
3. **Manage**: You can review the raw data or individual lead cards.
4. **Send**: Click "Send All" to push all extracted leads to your configured Webhook.
5. **Reset**: Clear the current lead queue to start fresh.

## 🛡️ Privacy

EveryLawyer stores your API keys and configuration locally using `chrome.storage.local`. Your data remains in your browser and is only sent to the specified OpenAI endpoint and your chosen Webhook URL.

## 🧰 Built With

- **HTML5/JavaScript**
- **Manifest V3**
- **[Pico CSS](https://picocss.com/)** for styling
- **[Readability.js](https://github.com/mozilla/readability)** & **[Turndown](https://github.com/mixmark-io/turndown)** for content parsing
- **OpenAI API** for intelligent data extraction
