# Gusto Resume Downloader

Automated tool to download resumes from Gusto recruiting platform using Playwright.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `config.json` with your Gusto credentials:
   ```json
   {
     "gusto": {
       "email": "your-email@example.com",
       "recruitingUrl": "https://app.gusto.com/recruiting"
     }
   }
   ```

## Usage

```bash
npm start
```

The script will:
1. Open a browser and navigate to Gusto
2. Prompt you to complete Google login manually
3. Find all job postings
4. Process all applicants across all jobs
5. Download resumes to `./downloaded-resumes/`

## Features

- ✅ Handles pagination (processes all applicants across multiple pages)
- ✅ Opens applicant resumes in new tabs and downloads them
- ✅ Resilient error handling for network timeouts
- ✅ Fallback methods for resume downloads
- ✅ Saves resumes with job title and applicant name
- ✅ Provides summary statistics

## Output

Resumes are saved as: `{JobTitle}_{ApplicantName}_resume.pdf`

Example: `Software_Engineer_Junior_John_Doe_resume.pdf`