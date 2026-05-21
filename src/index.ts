import 'dotenv/config';
import { Command } from 'commander';
import { WcaScraper } from './scraper';

const program = new Command();

program
  .name('wca-scraper')
  .description('WCAworld directory scraper - extract contact information')
  .version('1.0.0')
  .option('-u, --username <username>', 'WCAworld username', process.env.WCA_USER || '')
  .option('-p, --password <password>', 'WCAworld password', process.env.WCA_PASSWORD || '')
  .option('-c, --country <code>', 'Country code (see COUNTRIES.txt)', process.env.WCA_COUNTRY || 'PL')
  .option('--no-headless', 'Run in visible browser mode')
  .action(async (options) => {
    if (!options.username || !options.password) {
      console.error('Error: Username and password are required.');
      console.error('Set WCA_USER and WCA_PASSWORD in .env file, or use -u / -p flags.');
      process.exit(1);
    }

    const country = options.country.toUpperCase();
    const output = `output/contacts_${country}`;

    console.log('=== WCAworld Directory Scraper ===\n');
    console.log(`Country: ${country}`);
    console.log(`Output:  ${output}.csv / ${output}.xlsx`);
    console.log(`Headless: ${options.headless}\n`);

    const scraper = new WcaScraper({
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