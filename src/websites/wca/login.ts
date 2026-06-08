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

  await page.waitForSelector('#usr', { timeout: 30000 });
  await page.waitForSelector('#pwd', { timeout: 30000 });

  await page.fill('#usr', username);
  await page.fill('#pwd', password);

  await Promise.all([
    page.waitForURL('**/MemberSection**', { timeout: 60000 }).catch(() => {}),
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
    page.click('#login-form-button'),
  ]);

  await page.waitForTimeout(3000);

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
