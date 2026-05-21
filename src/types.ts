export interface Contact {
  title: string;
  name?: string;
  email?: string;
  directLine?: string;
  mobile?: string;
}

export interface Member {
  id: string;
  companyName: string;
  branch?: string;
  city: string;
  country: string;
  address?: string;
  phone?: string;
  fax?: string;
  website?: string;
  generalEmail?: string;
  contacts: Contact[];
  sourceUrl?: string; // The URL where this member was scraped from
}

export interface MemberLink {
  id: string;
  url: string; // Full URL to member detail page
}

export interface ScraperOptions {
  username: string;
  password: string;
  country: string;
  output: string;
  headless: boolean;
  concurrency: number;
}

export interface ScrapeResult {
  totalMembers: number;
  totalContacts: number;
  members: Member[];
}