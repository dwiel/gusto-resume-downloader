const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

async function downloadResumes() {
  // Create a persistent browser context to save login session
  const userDataDir = './browser-session';
  
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    acceptDownloads: true
  });
  
  const page = await browser.newPage();
  
  try {
    // First, try to go directly to the recruiting page (in case we're already logged in)
    console.log('Checking if already logged in...');
    await page.goto(config.gusto.recruitingUrl || 'https://app.gusto.com/recruiting');
    
    // Check if we're on the login page or already logged in
    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('accounts.google.com')) {
      console.log('Not logged in, proceeding with login...');
      
      // Navigate to Gusto login if not already there
      if (!currentUrl.includes('app.gusto.com/login')) {
        await page.goto('https://app.gusto.com/login');
      }
      
      // Login with Google
      console.log('Logging in with Google...');
      
      // Click the "Sign in with Google" button
      await page.click('button:has-text("Sign in with Google"), a:has-text("Sign in with Google")');
      
      // Wait for Google login page
      try {
        await page.waitForSelector('input[type="email"]', { timeout: 5000 });
        
        // Enter email
        await page.fill('input[type="email"]', config.gusto.email);
        await page.click('button:has-text("Next")');
      } catch (e) {
        // Email might already be filled or we're on password page
      }
      
      // Wait for password or 2FA - pause here for manual interaction
      console.log('\n⚠️  MANUAL ACTION REQUIRED:');
      console.log('Please complete the Google login in the browser window.');
      console.log('The script will continue once you\'re logged in.\n');
      
      // Wait for redirect back to Gusto
      await page.waitForURL('**/app.gusto.com/**', { 
        timeout: 120000,
        waitUntil: 'domcontentloaded' 
      });
      
      // Navigate to recruiting page after login
      await page.goto(config.gusto.recruitingUrl || 'https://app.gusto.com/recruiting');
    } else {
      console.log('Already logged in!');
    }
    
    // Wait for page to load with a shorter timeout
    console.log('Waiting for page to load...');
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch (e) {
      console.log('Page load timeout - continuing anyway...');
    }
    
    // Debug: Take a screenshot to see what's on the page
    await page.screenshot({ path: 'debug-recruiting-page.png' });
    console.log('Screenshot saved as debug-recruiting-page.png');
    
    // Get all job postings from the table - look for links in the job title column
    console.log('Finding job postings...');
    // Wait for the table to be visible
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Find job posting links - they are in the first column of the table
    const jobPostingLinks = await page.$$eval('table tbody tr td:first-child a[href*="/recruiting/jobs/"]', links => 
      links.map(link => ({
        href: link.href,
        title: link.textContent.trim()
      }))
    );
    
    if (jobPostingLinks.length === 0) {
      console.log('No job postings found. Please check debug-recruiting-page.png');
      return;
    }
    
    console.log(`Found ${jobPostingLinks.length} job postings`);
    
    // Create downloads directory if it doesn't exist
    const downloadsDir = './downloaded-resumes';
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
    
    // Process each job posting
    let totalApplicants = 0;
    let totalResumesDownloaded = 0;
    let totalResumesSkipped = 0;
    
    for (let i = 0; i < jobPostingLinks.length; i++) {
      const job = jobPostingLinks[i];
      console.log(`\nProcessing job posting ${i + 1} of ${jobPostingLinks.length}: ${job.title}`);
      
      // Navigate to job applicants page
      await page.goto(job.href);
      
      // Try to wait for network idle, but don't fail if it times out
      try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
      } catch (e) {
        console.log('  Network idle timeout - continuing...');
      }
      
      // The page automatically redirects to the applicants tab
      // Wait for the applicants tab to be active (URL should contain /applicants)
      try {
        await page.waitForURL('**/applicants', { timeout: 10000 });
      } catch (e) {
        // If URL doesn't change, we might already be on the applicants page
        console.log('  URL wait timeout - checking if already on applicants page...');
      }
      
      // Wait for the applicants table to load and for data to appear
      await page.waitForSelector('table', { timeout: 10000 });
      
      // Additional wait to ensure data is loaded
      await page.waitForTimeout(2000);
      
      // Change items per page to 100 for more efficient processing
      try {
        const itemsPerPageDropdown = await page.getByLabel('Items per page');
        if (itemsPerPageDropdown) {
          await itemsPerPageDropdown.selectOption('100');
          console.log('  Changed items per page to 100');
          // Wait for the table to reload with more items
          await page.waitForTimeout(3000);
        }
      } catch (e) {
        console.log('  Could not change items per page, continuing with default');
      }
      
      let currentPage = 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        console.log(`Processing page ${currentPage} of applicants...`);
        
        // Get all applicant links on this page
        // Applicant links are in the second column of the table
        const applicantLinks = await page.$$eval('table tbody tr td:nth-child(2) a[href*="/recruiting/applicants/"]', links => 
          links.map(link => ({
            href: link.href,
            name: link.textContent.trim()
          }))
        );
        
        console.log(`Found ${applicantLinks.length} applicants on page ${currentPage}`);
        totalApplicants += applicantLinks.length;
        
        // Process each applicant
        for (const applicant of applicantLinks) {
          console.log(`  Processing ${applicant.name}...`);
          
          // Check if we already have this resume BEFORE loading the page
          const sanitizedName = applicant.name.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
          const sanitizedJob = job.title.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
          const fileName = `${sanitizedJob}_${sanitizedName}_resume.pdf`;
          const filePath = path.join(downloadsDir, fileName);
          
          if (fs.existsSync(filePath)) {
            console.log(`    ⏭️  Resume already exists, skipping`);
            totalResumesSkipped++;
            continue;
          }
          
          try {
            // Open applicant in new tab to avoid losing pagination
            const newPage = await browser.newPage();
            await newPage.goto(applicant.href);
            
            // Try to wait for network idle, but don't fail if it times out
            try {
              await newPage.waitForLoadState('networkidle', { timeout: 5000 });
            } catch (e) {
              // Continue anyway
            }
            
            // Wait a bit for all content to load
            await newPage.waitForTimeout(1500);
            
            // Extract PDF URL directly from the page
            const pdfUrl = await newPage.evaluate(() => {
              const pdfLink = document.querySelector('a[href*=".pdf"]');
              return pdfLink ? pdfLink.href : null;
            });
            
            if (pdfUrl) {
              try {
                // Download PDF directly via HTTP GET
                const response = await newPage.request.get(pdfUrl);
                const buffer = await response.body();
                
                // Verify it's a real PDF by checking the first 4 bytes
                if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
                  fs.writeFileSync(filePath, buffer);
                  console.log(`    ✓ Downloaded resume`);
                  totalResumesDownloaded++;
                } else {
                  console.log(`    ✗ Downloaded file is not a valid PDF`);
                }
              } catch (error) {
                console.log(`    ✗ Resume download failed: ${error.message}`);
              }
            } else {
              console.log(`    ✗ No resume PDF link found`);
              // Debug: save screenshot for first few missing resumes
              if (totalApplicants <= 3) {
                await newPage.screenshot({ path: `debug-applicant-${applicant.name.replace(/[^a-z0-9]/gi, '_')}.png` });
              }
            }
            
            await newPage.close();
            
            // Small delay to avoid rate limiting
            await page.waitForTimeout(500);
            
          } catch (error) {
            console.error(`    Error processing applicant:`, error.message);
          }
        }
        
        // Check if there's a next page
        // Look for the "Navigate to next page" button - it's the 3rd button in the pagination list
        try {
          const nextButton = await page.getByRole('button', { name: 'Navigate to next page' });
          const isDisabled = await nextButton.isDisabled();
          
          if (!isDisabled) {
            console.log(`Navigating to page ${currentPage + 1}...`);
            await nextButton.click();
            
            // Wait for the table to update with new data
            await page.waitForTimeout(2000);
            
            // Wait for the loading to complete
            try {
              await page.waitForSelector('table tbody tr td:nth-child(2) a', { timeout: 10000 });
            } catch (e) {
              console.log('  Timeout waiting for applicants to load on next page');
            }
            
            currentPage++;
          } else {
            console.log('No more pages to process');
            hasMorePages = false;
          }
        } catch (e) {
          // If we can't find the next button, assume we're on the last page
          console.log('No next button found - assuming last page');
          hasMorePages = false;
        }
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total job postings processed: ${jobPostingLinks.length}`);
    console.log(`Total applicants found: ${totalApplicants}`);
    console.log(`Total resumes downloaded: ${totalResumesDownloaded}`);
    console.log(`Total resumes skipped (already existed): ${totalResumesSkipped}`);
    console.log(`Resumes saved to: ${path.resolve(downloadsDir)}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

// Run the script
downloadResumes();
