import { Page, BrowserContext } from 'playwright';

const LOGIN_URL = 'https://passport.jctrans.com/login?appId=ERA&path=%2Fen%2Fdirectory%2F&click_source=undefined';

export async function login(
  context: BrowserContext,
  username: string,
  password: string,
): Promise<Page> {
  const page = await context.newPage();

  console.log('Navigating to JC Trans login...');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Fill credentials
  const textInput = page.locator('input.el-input__inner[type="text"]').first();
  await textInput.fill(username);

  const passInput = page.locator('input.el-input__inner[type="password"]').first();
  await passInput.fill(password);

  // Click Sign In
  await page.locator('button:has-text("Sign In")').first().click();
  await page.waitForTimeout(3000);

  // Handle "already logged in" confirmation dialog
  const confirmBtn = page.locator('button:has-text("Confirm")').first();
  if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(5000);
  }

  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  if (currentUrl.includes('passport.jctrans.com')) {
    throw new Error('Login failed: still on passport login page. Check credentials.');
  }

  console.log(`  Logged in, current URL: ${currentUrl}`);
  return page;
}
