import { BaseScraper } from '../../base-scraper';
import { ScrapeResult, Member } from '../../types';
import { login } from './login';
import { getMemberLinks } from './directory';
import { scrapeAllMembers } from './member';

export class WcaScraper extends BaseScraper {
  async run(): Promise<ScrapeResult> {
    try {
      await this.launchBrowser();
      if (!this.context) throw new Error('Browser context not initialized');

      const page = await login(this.context, this.options.username, this.options.password);

      const memberLinks = await getMemberLinks(page, this.options.country);

      console.log(`\nScraping ${memberLinks.length} member details...`);
      const members = await scrapeAllMembers(page, memberLinks);

      await this.exportResults(members);

      const totalContacts = members.reduce((sum, m) => sum + m.contacts.length, 0);
      console.log(`\nDone! Scraped ${members.length} members with ${totalContacts} contacts.`);

      return { totalMembers: members.length, totalContacts, members };
    } catch (err) {
      console.error('Scraper error:', err);
      throw err;
    } finally {
      await this.cleanup();
    }
  }
}
