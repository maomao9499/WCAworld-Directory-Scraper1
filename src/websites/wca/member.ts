import { Page } from 'playwright';
import { Member, MemberLink } from '../../types';
import { sleep } from '../../utils';

const WCA_BASE = 'https://www.wcaworld.com/directory/members';

export async function scrapeMemberDetail(
  page: Page,
  link: MemberLink,
): Promise<Member | null> {
  const { id, url } = link;

  const urls = [url];
  if (!url.includes('wcaworld.com')) {
    urls.push(`${WCA_BASE}/${id}`);
  }

  let pageLoaded = false;
  for (const tryUrl of urls) {
    try {
      await page.goto(tryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      pageLoaded = true;
      break;
    } catch {
      console.error(`  Timeout loading ${tryUrl}, trying next...`);
    }
  }

  if (!pageLoaded) {
    console.error(`  Failed to load member ${id} from all URLs`);
    return null;
  }

  await sleep(500);

  try {
    const member = await page.evaluate((mId: string) => {
      const cleanText = (s: string) => s.replace(/\s+/g, ' ').trim();

      const companyEl = document.querySelector('.company_name .company, h1.company');
      const companyName = companyEl ? cleanText(companyEl.textContent || '') : '';

      const branchEl = document.querySelector('.company_name .branchname');
      const branch = branchEl ? cleanText(branchEl.textContent || '').replace(/^\(|\)$/g, '') : '';

      const idEl = document.querySelector('.compid span');
      const id = idEl ? (idEl.textContent || '').replace('ID:', '').trim() : mId;

      let address = '';
      document.querySelectorAll('.row').forEach((row: Element) => {
        const headline = row.querySelector('.profile_headline');
        if (headline && headline.textContent?.trim() === 'Address:') {
          const span = row.querySelector('span:not(.profile_headline)');
          if (span) address = cleanText(span.textContent || '');
        }
      });

      let city = '';
      let country = '';
      const cityCountryMatch = companyName.match(/,\s*([^,]+),\s*([^,]+)$/);
      if (cityCountryMatch) {
        city = cityCountryMatch[1].trim();
        country = cityCountryMatch[2].trim();
      }

      const countryEl = document.querySelector('.office_country.countryname');
      if (countryEl) {
        country = cleanText(countryEl.textContent || '');
      }

      if (address && !city) {
        const parts = address.split(',').map((p) => p.trim());
        if (parts.length >= 2) {
          if (!country) country = parts[parts.length - 1];
          const beforeLast = parts[parts.length - 2];
          const cityMatch = beforeLast.match(/\d+\s+(.+)/);
          city = cityMatch ? cityMatch[1] : beforeLast;
        }
      }

      let phone = '';
      let fax = '';
      let website = '';
      let generalEmail = '';

      const profileRows = document.querySelectorAll('.profile_row');
      let inContactDetails = false;

      profileRows.forEach((row: Element) => {
        const label = row.querySelector('.profile_label');
        const value = row.querySelector('.profile_val');
        if (!label || !value) return;

        const labelText = cleanText(label.textContent || '');
        const valueText = cleanText(value.textContent || '');

        if (labelText === 'Phone:' && !inContactDetails) {
          inContactDetails = true;
        }

        if (inContactDetails || labelText === 'Phone:') {
          if (labelText === 'Phone:') phone = valueText;
          else if (labelText === 'Fax:') fax = valueText;
          else if (labelText === 'Website:') {
            const link = value.querySelector('a');
            website = link ? (link as HTMLAnchorElement).href : valueText;
          } else if (labelText === 'Email:') {
            const mailLinks = value.querySelectorAll('a[href^="mailto:"]');
            if (mailLinks.length > 0) {
              generalEmail = Array.from(mailLinks)
                .map((a: Element) => (a as HTMLAnchorElement).href.replace('mailto:', ''))
                .join('; ');
            } else {
              generalEmail = valueText;
            }
            inContactDetails = false;
          }
        }
      });

      interface ContactData {
        title: string;
        name?: string;
        email?: string;
        directLine?: string;
        mobile?: string;
      }

      const contacts: ContactData[] = [];
      const contactRows = document.querySelectorAll('.contactperson_row');

      contactRows.forEach((contactRow: Element) => {
        const contact: ContactData = { title: '' };
        const rows = contactRow.querySelectorAll('.profile_row');

        rows.forEach((row: Element) => {
          const label = row.querySelector('.profile_label');
          const value = row.querySelector('.profile_val');
          if (!label || !value) return;

          const labelText = cleanText(label.textContent || '');
          const loginRequired = value.querySelector('.warning_login_text');
          if (loginRequired) return;

          const valueText = cleanText(value.textContent || '');

          if (labelText === 'Title:') contact.title = valueText;
          else if (labelText === 'Name:') contact.name = valueText;
          else if (labelText === 'Email:') {
            const mailLink = value.querySelector('a[href^="mailto:"]');
            contact.email = mailLink
              ? (mailLink as HTMLAnchorElement).href.replace('mailto:', '')
              : valueText;
          } else if (labelText === 'Direct Line:') contact.directLine = valueText;
          else if (labelText === 'Mobile:') contact.mobile = valueText;
        });

        if (contact.title) {
          contacts.push(contact);
        }
      });

      return {
        id,
        companyName,
        branch,
        city,
        country,
        address,
        phone,
        fax,
        website,
        generalEmail,
        contacts,
      };
    }, id);

    return { ...member, sourceUrl: url } as Member;
  } catch (err) {
    console.error(`  Error parsing member ${id}:`, err);
    return null;
  }
}

export async function scrapeAllMembers(
  page: Page,
  links: MemberLink[],
): Promise<Member[]> {
  const members: Member[] = [];
  const total = links.length;

  for (let i = 0; i < total; i++) {
    const link = links[i];
    console.log(`  Scraping member ${link.id} (${i + 1}/${total})...`);

    const member = await scrapeMemberDetail(page, link);
    if (member) {
      members.push(member);
      console.log(`    -> ${member.companyName} (${member.contacts.length} contacts)`);
    }

    await sleep(300);
  }

  return members;
}
