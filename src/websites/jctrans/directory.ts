import { Page, BrowserContext } from 'playwright';
import { MemberLink } from '../../types';

const LISTING_URL = 'https://www.jctrans.com/en/company/';
const API_URL = 'https://cloudapi.jctrans.com/era/fr/shop/companyDirectory';

interface CompanyRecord {
  compUid: string;
  compName: string;
  countryName: string;
  cityName: string;
  profile?: string;
  staffName?: string;
  email?: string;
}

interface ApiResponse {
  msg: string;
  code: number;
  data: {
    records: CompanyRecord[];
    total: number;
    size: number;
    current: number;
  };
}

const PAGE_SIZE = 50;
const MAX_PAGES = parseInt(process.env.JCTRANS_MAX_PAGES || '20', 10);

export async function getMemberLinks(
  page: Page,
  countryCode: string,
): Promise<MemberLink[]> {
  console.log(`Fetching JC Trans company directory for ${countryCode}...`);

  // Navigate to listing page to ensure auth cookies are fresh
  await page.goto(LISTING_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Extract cookies for Node.js-side API calls
  const context = page.context();
  const cookies = await context.cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const countryName = countryCodeToName(countryCode);
  const allLinks: MemberLink[] = [];
  const seen = new Set<string>();

  // Fetch page 1 to get total count
  const firstPage = await fetchDirectoryApiNode(cookieHeader, 1, PAGE_SIZE);
  if (!firstPage || firstPage.code !== 0) {
    throw new Error(`API returned error: ${JSON.stringify(firstPage)}`);
  }

  const total = firstPage.data.total;
  const totalPages = Math.min(Math.ceil(total / PAGE_SIZE), MAX_PAGES);
  console.log(`  Total companies in directory: ${total}`);
  console.log(`  Pages to scan: ${totalPages} (${PAGE_SIZE} per page, max ${MAX_PAGES})`);

  // Extract from first page
  extractLinks(firstPage.data.records, allLinks, seen, countryName);

  // Fetch remaining pages
  for (let p = 2; p <= totalPages; p++) {
    console.log(`  Fetching page ${p}/${totalPages}...`);
    const resp = await fetchDirectoryApiNode(cookieHeader, p, PAGE_SIZE);
    if (!resp || resp.code !== 0) {
      console.warn(`  Failed to fetch page ${p}, skipping`);
      continue;
    }
    extractLinks(resp.data.records, allLinks, seen, countryName);
  }

  console.log(`  Found ${allLinks.length} companies matching country "${countryName}"`);
  return allLinks;
}

async function fetchDirectoryApiNode(
  cookieHeader: string,
  pageNum: number,
  pageSize: number,
): Promise<ApiResponse | null> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      body: JSON.stringify({
        current: pageNum,
        size: pageSize,
        advCodeList: [],
        vipCodeList: [],
        minVipTotalYears: 0,
        maxVipTotalYears: 150,
        certificatesType: [],
        jcvfFlag: null,
        routes: [],
        creditFlag: '0',
        cooperationCaseFlag: '0',
        goodServiceFlag: '0',
        shippings: [],
        airs: [],
      }),
    });
    return (await response.json()) as ApiResponse;
  } catch (err) {
    console.warn(`  API fetch error on page ${pageNum}:`, err);
    return null;
  }
}

function extractLinks(
  records: CompanyRecord[],
  links: MemberLink[],
  seen: Set<string>,
  targetCountry?: string,
): void {
  for (const record of records) {
    const { compUid, countryName } = record;

    if (targetCountry && countryName.toLowerCase() !== targetCountry.toLowerCase()) {
      continue;
    }

    if (seen.has(compUid)) continue;
    seen.add(compUid);

    links.push({
      id: compUid,
      url: `https://www.jctrans.com/en/company/${compUid}/`,
    });
  }
}

function countryCodeToName(code: string): string {
  const map: Record<string, string> = {
    CN: 'China',
    US: 'United States',
    DE: 'Germany',
    GB: 'United Kingdom',
    JP: 'Japan',
    KR: 'South Korea',
    FR: 'France',
    IT: 'Italy',
    ES: 'Spain',
    NL: 'Netherlands',
    BE: 'Belgium',
    PL: 'Poland',
    GR: 'Greece',
    TR: 'Turkiye',
    AE: 'United Arab Emirates',
    IN: 'India',
    SG: 'Singapore',
    TH: 'Thailand',
    VN: 'Vietnam',
    MY: 'Malaysia',
    ID: 'Indonesia',
    PH: 'Philippines',
    AU: 'Australia',
    NZ: 'New Zealand',
    BR: 'Brazil',
    MX: 'Mexico',
    CA: 'Canada',
    ZA: 'South Africa',
    RU: 'Russia',
    TW: 'Taiwan',
    HK: 'Hong Kong',
    SE: 'Sweden',
    DK: 'Denmark',
    NO: 'Norway',
    FI: 'Finland',
    PT: 'Portugal',
    AT: 'Austria',
    CH: 'Switzerland',
    IE: 'Ireland',
    CZ: 'Czech Republic',
    HU: 'Hungary',
    RO: 'Romania',
    BG: 'Bulgaria',
    HR: 'Croatia',
    SK: 'Slovakia',
    SI: 'Slovenia',
    LT: 'Lithuania',
    LV: 'Latvia',
    EE: 'Estonia',
    AR: 'Argentina',
    CL: 'Chile',
    PE: 'Peru',
    CO: 'Colombia',
    EG: 'Egypt',
    NG: 'Nigeria',
    KE: 'Kenya',
    MA: 'Morocco',
    PK: 'Pakistan',
    BD: 'Bangladesh',
    LK: 'Sri Lanka',
    SA: 'Saudi Arabia',
    KW: 'Kuwait',
    QA: 'Qatar',
    OM: 'Oman',
    BH: 'Bahrain',
    IL: 'Israel',
  };
  return map[code] || code;
}
