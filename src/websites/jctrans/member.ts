import { Page, BrowserContext } from 'playwright';
import { Member, MemberLink } from '../../types';
import { sleep } from '../../utils';

const DETAIL_API_URL = 'https://cloudapi.jctrans.com/era/fr/shop/getEraShopInfoDetail';

interface DetailApiResponse {
  msg: string;
  code: number;
  data: {
    compId: number;
    compUid: string;
    nameEn: string;
    nameCn: string;
    countryNameEn: string;
    countryNameCn: string;
    cityNameEn: string;
    cityNameCn: string;
    registeredAddressEn: string;
    registeredAddressCn: string;
    officeAddressEn?: string;
    officeAddressCn?: string;
    website: string;
    profile: string;
    estabYears: string;
    logoFile: string;
    membershipYears: string;
  };
}

// Cache the cookie header at module level to avoid re-extraction
let cachedCookieHeader: string | null = null;

export async function scrapeMemberDetail(
  page: Page,
  link: MemberLink,
): Promise<Member | null> {
  const { id, url } = link;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch {
    console.error(`  Timeout loading ${url}`);
    return null;
  }

  // Wait for Vue SPA to render and contact section to load
  await sleep(2000);

  // Scroll down to trigger lazy loading of contact cards
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.4));
  await sleep(1000);

  // Wait for contact cards to appear (up to 5s)
  try {
    await page.waitForSelector('.contactCard, [class*="contactCard"]', { timeout: 5000 });
  } catch {
    // Some pages may not have visible contact cards
  }
  await sleep(1000);

  try {
    // Get cookies for API call (cached after first call)
    if (!cachedCookieHeader) {
      const cookies = await page.context().cookies();
      cachedCookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    }

    // Try the API first for structured data
    let apiData: DetailApiResponse['data'] | null = null;
    try {
      apiData = await fetchDetailApiNode(cachedCookieHeader, id);
    } catch {
      // API failed, fall back to DOM parsing
    }

    // Parse page text for contact info (not available via API)
    const pageData = await parseDetailPage(page);

    const companyName = apiData?.nameEn || pageData.companyName || id;
    const country = apiData?.countryNameEn || pageData.country || '';
    const city = apiData?.cityNameEn || pageData.city || '';
    const address = apiData?.registeredAddressEn || pageData.address || '';
    const website = apiData?.website || pageData.website || '';
    const generalEmail = pageData.generalEmail || '';

    // Build contacts
    const contacts = pageData.contacts || [];
    if (contacts.length === 0 && generalEmail) {
      contacts.push({ title: '', email: generalEmail });
    }

    return {
      id,
      companyName,
      branch: '',
      city,
      country,
      address,
      phone: pageData.phone || '',
      fax: '',
      website,
      generalEmail,
      contacts,
      sourceUrl: url,
    } as Member;
  } catch (err) {
    console.error(`  Error parsing member ${id}:`, err);
    return null;
  }
}

async function fetchDetailApiNode(
  cookieHeader: string,
  compUid: string,
): Promise<DetailApiResponse['data'] | null> {
  const response = await fetch(DETAIL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
    },
    body: JSON.stringify({ compUid }),
  });

  const result = (await response.json()) as DetailApiResponse;
  if (result && result.code === 0 && result.data) {
    return result.data;
  }
  return null;
}

interface ParsedPageData {
  companyName: string;
  city: string;
  country: string;
  address: string;
  phone: string;
  website: string;
  generalEmail: string;
  contacts: { title: string; name?: string; email?: string; mobile?: string; directLine?: string }[];
}

async function parseDetailPage(page: Page): Promise<ParsedPageData> {
  try {
    return await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

      // Helper: check if a number looks like an ICP/registration number rather than a phone
      const isLikelyPhone = (numStr: string) => {
        const digits = numStr.replace(/[^\d]/g, '');
        if (digits.length < 7 || digits.length > 15) return false;
        // Chinese ICP numbers: 21020202000645 pattern (15 digits, start with area code)
        if (/^\d{2}\d{6}\d{6,}$/.test(digits)) return false;
        // Year patterns: 20240208 etc
        if (/^20\d{6}$/.test(digits)) return false;
        return true;
      };

      // --- Company Name ---
      let companyName = '';
      const h1 = document.querySelector('h1');
      if (h1) companyName = clean(h1.textContent || '');

      // --- Basic Information ---
      let city = '';
      let country = '';
      let address = '';
      let website = '';

      const basicStart = bodyText.indexOf('Basic Information');
      if (basicStart !== -1) {
        const basicBlock = bodyText.substring(basicStart, basicStart + 2000);

        const locMatch = basicBlock.match(/Location\s*([^,]+),\s*(.+?)(?:Address|Establishment|Enterprise|Website|$)/);
        if (locMatch) {
          city = locMatch[1].trim().replace(/\s+/g, ' ');
          country = locMatch[2].trim().replace(/\s+/g, ' ');
        }

        const addrMatch = basicBlock.match(/Address\s*(.+?)(?:Establishment|Enterprise|Website|Certificates|$)/);
        if (addrMatch) {
          address = addrMatch[1].trim().replace(/\s+/g, ' ');
        }

        const webMatch = basicBlock.match(/Website\s*(https?:\/\/[^\s]+)/);
        if (webMatch) {
          website = webMatch[1];
        }
      }

      // --- Contact Information ---
      // Primary: extract from .contactCard elements (most reliable)
      const contacts: { title: string; name?: string; email?: string; mobile?: string; directLine?: string }[] = [];
      const seenContactKeys = new Set<string>();

      const contactCards = document.querySelectorAll('.contactCard, [class*="contactCard"]');
      contactCards.forEach((card) => {
        const cardText = (card as HTMLElement).textContent || '';
        const cleaned = cardText.replace(/\s+/g, ' ').trim();
        if (cleaned.length < 5) return;

        const emails = cleaned.match(emailRegex) || [];

        // Extract name (first FULL CAPS name before job title)
        let cardName = '';
        const nameMatch = cleaned.match(/([A-Z]{2,}(?:\s+[A-Z]{2,})*)\s*(?:Online|Manager|Director|Officer|Executive|Agent|Supervisor|President|Consultant|Representative|$)/);
        if (nameMatch) {
          cardName = nameMatch[1].trim().split(/\s+/).map(w =>
            w.charAt(0) + w.slice(1).toLowerCase()
          ).join(' ');
        }

        // Extract job title
        const titleMatch = cleaned.match(/\b(BD\s+MANAGER|SALES\s+MANAGER|GENERAL\s+MANAGER|MANAGING\s+DIRECTOR|SALES\s+DIRECTOR|OPERATION\s+MANAGER|MARKETING\s+MANAGER|BUSINESS\s+DEVELOPMENT\s+MANAGER|CUSTOMER\s+SERVICE\s+MANAGER|EXPORT\s+MANAGER|IMPORT\s+MANAGER|LOGISTICS\s+MANAGER|DIRECTOR|MANAGER|SUPERVISOR|EXECUTIVE|PRESIDENT|REPRESENTATIVE|CONSULTANT|AGENT)\b/i);
        const cardTitle = titleMatch ? titleMatch[1].trim() : '';

        // Extract phone from card
        let cardPhone = '';
        const phoneMatch = cleaned.match(/Phone\s*([+\d]{7,15})/);
        if (phoneMatch && isLikelyPhone(phoneMatch[1])) {
          cardPhone = phoneMatch[1].trim();
        }

        // Also try general number pattern
        if (!cardPhone) {
          const numbers = cleaned.match(/\b\d{7,15}\b/g) || [];
          for (const n of numbers) {
            if (isLikelyPhone(n)) {
              cardPhone = n;
              break;
            }
          }
        }

        const contactKey = [cardName, emails[0] || '', cardPhone].filter(Boolean).join('|');
        if (contactKey && !seenContactKeys.has(contactKey)) {
          seenContactKeys.add(contactKey);
          contacts.push({
            title: cardTitle,
            name: cardName || undefined,
            email: emails[0] || '',
            mobile: cardPhone || undefined,
          });
        }
      });

      // Fallback: parse from the second "Contact Us" text block (first is nav, second is actual data)
      let phone = '';
      if (contacts.length === 0) {
        const firstIdx = bodyText.indexOf('Contact Us');
        const secondIdx = firstIdx !== -1 ? bodyText.indexOf('Contact Us', firstIdx + 1) : -1;
        const contactBlock = secondIdx !== -1 ? bodyText.substring(secondIdx, secondIdx + 1500) : '';

        if (contactBlock) {
          const blockEmails = contactBlock.match(emailRegex) || [];

          const nameMatch = contactBlock.match(/Contact\s*name\s*([A-Z][A-Z\s]+?)(?:Email|Phone|\s{2,}|$)/);
          const contactName = nameMatch ? nameMatch[1].trim() : '';

          const phoneMatch = contactBlock.match(/Phone\s*([+\d]{7,15})/);
          if (phoneMatch && isLikelyPhone(phoneMatch[1])) {
            phone = phoneMatch[1].trim();
          }

          if (blockEmails.length > 0 || contactName) {
            contacts.push({
              title: '',
              name: contactName || undefined,
              email: blockEmails[0] || '',
              mobile: phone || undefined,
            });
          }
        }
      }

      // Set phone from first contact if not set
      if (!phone && contacts.length > 0) {
        phone = contacts[0].mobile || '';
      }

      // --- Fallbacks from full body ---
      if (!address) {
        const addrMatch = bodyText.match(/Address\s*(.+?)(?:Establishment|Enterprise|Website|Certificates|$)/);
        if (addrMatch) address = addrMatch[1].trim().replace(/\s+/g, ' ');
      }

      if (!website) {
        const webMatch = bodyText.match(/Website\s*(https?:\/\/[^\s]+)/);
        if (webMatch) website = webMatch[1];
      }

      // General email: collect from contact cards only (not body, to avoid noise)
      const cardEmails: string[] = [];
      const cardEmailSet = new Set<string>();
      contacts.forEach(c => {
        if (c.email && !cardEmailSet.has(c.email)) {
          cardEmailSet.add(c.email);
          cardEmails.push(c.email);
        }
      });
      const generalEmail = cardEmails.join('; ');

      return {
        companyName,
        city,
        country,
        address,
        phone,
        website,
        generalEmail,
        contacts,
      };
    });
  } catch {
    return {
      companyName: '', city: '', country: '', address: '',
      phone: '', website: '', generalEmail: '', contacts: [],
    };
  }
}

export async function scrapeAllMembers(
  page: Page,
  links: MemberLink[],
): Promise<Member[]> {
  // Reset cookie cache per run
  cachedCookieHeader = null;

  const members: Member[] = [];
  const total = links.length;

  for (let i = 0; i < total; i++) {
    const link = links[i];
    console.log(`  [${i + 1}/${total}] Scraping ${link.id}...`);

    const member = await scrapeMemberDetail(page, link);
    if (member) {
      members.push(member);
      const ci = member.contacts.length > 0
        ? `${member.contacts[0].name || ''} <${member.contacts[0].email || ''}>`
        : 'no contacts';
      console.log(`    -> ${member.companyName} (${ci})`);
    }

    await sleep(1500);
  }

  return members;
}
