import 'dotenv/config';
import { Command } from 'commander';
import { createScraper, Website } from './scraper-factory';

const program = new Command();

const WEBSITE = (process.env.WEBSITE || 'wca') as Website;

function getCredentials(): { username: string; password: string; country: string } {
  switch (WEBSITE) {
    case 'wca':
      return {
        username: process.env.WCA_USER || '',
        password: process.env.WCA_PASSWORD || '',
        country: process.env.WCA_COUNTRY || 'PL',
      };
    case 'jctrans':
      return {
        username: process.env.JCTRANS_USER || '',
        password: process.env.JCTRANS_PASSWORD || '',
        country: process.env.JCTRANS_COUNTRY || 'CN',
      };
    default:
      return {
        username: process.env.WCA_USER || '',
        password: process.env.WCA_PASSWORD || '',
        country: process.env.WCA_COUNTRY || 'PL',
      };
  }
}

const defaults = getCredentials();

program
  .name('web-agent')
  .description('Multi-website logistics directory scraper')
  .version('2.0.0')
  .option('-u, --username <username>', 'Username', defaults.username)
  .option('-p, --password <password>', 'Password', defaults.password)
  .option('-c, --country <code>', 'Country code (see COUNTRIES.txt)', defaults.country)
  .option('--no-headless', 'Run in visible browser mode')
  .action(async (options) => {
    if (!options.username || !options.password) {
      console.error('Error: Username and password are required.');
      console.error(`Set credentials in .env file for website "${WEBSITE}", or use -u / -p flags.`);
      process.exit(1);
    }

    const country = options.country.toUpperCase();
    const output = `output/${WEBSITE}_${country}`;

    console.log(`=== ${WEBSITE.toUpperCase()} Directory Scraper ===\n`);
    console.log(`Country:  ${country}`);
    console.log(`Output:   ${output}.csv / ${output}.xlsx`);
    console.log(`Headless: ${options.headless}\n`);

    const scraper = createScraper(WEBSITE, {
      username: options.username,
      password: options.password,
      country,
      output,
      headless: options.headless,
      concurrency: 3,
    });

    try {
      await scraper.run();
    } catch (err) {
      console.error('\nScraping failed:', err);
      process.exit(1);
    }
  });

program.parse();
