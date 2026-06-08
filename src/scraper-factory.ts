import { BaseScraper } from './base-scraper';
import { ScraperOptions } from './types';
import { WcaScraper } from './websites/wca/scraper';
import { JcTransScraper } from './websites/jctrans/scraper';

export type Website = 'wca' | 'jctrans' | 'gla';

export function createScraper(website: Website, options: ScraperOptions): BaseScraper {
  switch (website) {
    case 'wca':
      return new WcaScraper(options);
    case 'jctrans':
      return new JcTransScraper(options);
    default:
      throw new Error(`Unsupported website: ${website}. Supported: wca, jctrans, gla`);
  }
}
