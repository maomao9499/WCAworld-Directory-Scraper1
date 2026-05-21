import { Page } from 'playwright';
import { sleep } from './utils';
import { MemberLink } from './types';

export async function getMemberLinks(
  page: Page,
  countryCode: string,
): Promise<MemberLink[]> {
  const allLinks: MemberLink[] = [];
  let pageIndex = 1;

  console.log(`Scanning directory for country: ${countryCode}`);

  while (true) {
    const url = buildDirectoryUrl(countryCode, pageIndex);
    console.log(`  Fetching page ${pageIndex}...`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('#directory_result', { timeout: 30000 }).catch(() => {});

    const links = await extractMemberLinks(page);

    if (links.length === 0) {
      console.log(`  Page ${pageIndex} has no results, stopping.`);
      break;
    }

    allLinks.push(...links);
    console.log(`  Found ${links.length} members on page ${pageIndex} (total: ${allLinks.length})`);
    pageIndex++;
    await sleep(500);
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  const unique = allLinks.filter(link => {
    if (seen.has(link.id)) return false;
    seen.add(link.id);
    return true;
  });

  console.log(`Total unique members found: ${unique.length}`);
  return unique;
}

function buildDirectoryUrl(countryCode: string, pageIndex: number): string {
  const params = new URLSearchParams({
    siteID: '24',
    au: '',
    pageIndex: String(pageIndex),
    pageSize: '50',
    searchby: 'CountryCode',
    country: countryCode,
    city: '',
    keyword: '',
    orderby: 'CompanyName',
    layout: 'v1',
    submitted: 'search',
  });

  const networkIds = ['1', '2', '3', '4', '61', '98', '108', '118', '5', '22', '13', '18', '15', '16', '38', '107', '124'];
  for (const id of networkIds) {
    params.append('networkIds', id);
  }

  return `https://www.wcaworld.com/Directory?${params.toString()}`;
}

async function extractMemberLinks(page: Page): Promise<MemberLink[]> {
  return page.$$eval(
    'a[href*="/directory/members/"]',
    (anchors: HTMLAnchorElement[]) => {
      const seen = new Map<string, string>();
      for (const a of anchors) {
        const match = a.href.match(/\/directory\/members\/(\d+)/);
        if (match) {
          const id = match[1];
          // Prefer wcaworld.com URLs; fall back to any network URL
          if (!seen.has(id) || a.href.includes('wcaworld.com')) {
            seen.set(id, a.href);
          }
        }
      }
      return Array.from(seen.entries()).map(([id, url]) => ({ id, url }));
    }
  );
}