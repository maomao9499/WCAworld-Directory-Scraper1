import { Page, BrowserContext } from 'playwright';

const LOGIN_URL = 'https://www.wcaworld.com/Account/Login';

export async function login(
  context: BrowserContext,
  username: string,
  password: string,
): Promise<Page> {
  const page = await context.newPage();

  console.log('Navigating to login page...');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for form to be ready
  await page.waitForSelector('#usr', { timeout: 30000 });
  await page.waitForSelector('#pwd', { timeout: 30000 });

  // Fill in credentials
  await page.fill('#usr', username);
  await page.fill('#pwd', password);

  // Submit and wait for navigation
  await Promise.all([
    page.waitForURL('**/MemberSection**', { timeout: 60000 }).catch(() => {
      // SSO might redirect elsewhere, that's ok
    }),
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {
      // Sometimes navigation doesn't trigger properly with SSO
    }),
    page.click('#login-form-button'),
  ]);

  // Give SSO redirect time to complete
  await page.waitForTimeout(3000);

  // Verify login success
  const currentUrl = page.url();
  if (currentUrl.toLowerCase().includes('/account/login')) {
    const errorEl = await page.$('.validation-summary-errors, .field-validation-error');
    if (errorEl) {
      const errorText = await errorEl.textContent();
      throw new Error(`Login failed: ${errorText?.trim() || 'Invalid credentials'}`);
    }
    throw new Error('Login failed: still on login page after submission');
  }

  console.log(`Login successful! Current URL: ${currentUrl}`);
  return page;
}
