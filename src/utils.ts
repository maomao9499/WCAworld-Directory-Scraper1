import { Member, Contact } from './types';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function flattenMembers(members: Member[]): Record<string, string>[] {
  const rows: Record<string, string>[] = [];

  for (const member of members) {
    if (member.contacts.length === 0) {
      rows.push({
        'Company ID': member.id,
        'Company Name': member.companyName,
        'Branch': member.branch || '',
        'City': member.city,
        'Country': member.country,
        'Address': member.address || '',
        'Phone': member.phone || '',
        'Fax': member.fax || '',
        'Website': member.website || '',
        'General Email': member.generalEmail || '',
        'Contact Title': '',
        'Contact Name': '',
        'Contact Email': '',
        'Contact Direct Line': '',
        'Contact Mobile': '',
      });
      continue;
    }

    for (const contact of member.contacts) {
      rows.push({
        'Company ID': member.id,
        'Company Name': member.companyName,
        'Branch': member.branch || '',
        'City': member.city,
        'Country': member.country,
        'Address': member.address || '',
        'Phone': member.phone || '',
        'Fax': member.fax || '',
        'Website': member.website || '',
        'General Email': member.generalEmail || '',
        'Contact Title': contact.title,
        'Contact Name': contact.name || '',
        'Contact Email': contact.email || '',
        'Contact Direct Line': contact.directLine || '',
        'Contact Mobile': contact.mobile || '',
      });
    }
  }

  return rows;
}

export const CSV_HEADERS = [
  'Company ID', 'Company Name', 'Branch', 'City', 'Country', 'Address',
  'Phone', 'Fax', 'Website', 'General Email',
  'Contact Title', 'Contact Name', 'Contact Email', 'Contact Direct Line', 'Contact Mobile',
];
