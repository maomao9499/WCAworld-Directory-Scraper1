import { chromium, Browser, BrowserContext } from 'playwright';
import { ScraperOptions, ScrapeResult, Member } from './types';
import { login } from './login';
import { getMemberLinks } from './directory';
import { scrapeAllMembers } from './member';
import { flattenMembers, CSV_HEADERS } from './utils';
import * as fs from 'fs';
import * as path from 'path';

export class WcaScraper {
  private options: ScraperOptions;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(options: ScraperOptions) {
    this.options = options;
  }

  async run(): Promise<ScrapeResult> {
    try {
      // Launch browser
      console.log('Launching browser...');
      this.browser = await chromium.launch({
        headless: this.options.headless,
      });
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      // Login
      const page = await login(this.context, this.options.username, this.options.password);

      // Get member links from directory
      const memberLinks = await getMemberLinks(page, this.options.country);

      // Scrape each member's detail page
      console.log(`\nScraping ${memberLinks.length} member details...`);
      const members = await scrapeAllMembers(page, memberLinks);

      // Export results
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

  private async exportResults(members: Member[]): Promise<void> {
    const rows = flattenMembers(members);
    const baseName = this.options.output.replace(/\.[^.]+$/, '');

    // Ensure output directory exists
    const outputDir = path.dirname(this.options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Export CSV
    const csvPath = `${baseName}.csv`;
    await this.exportCsv(rows, csvPath);
    console.log(`CSV exported to: ${csvPath}`);

    // Export XLSX
    const xlsxPath = `${baseName}.xlsx`;
    await this.exportXlsx(rows, xlsxPath);
    console.log(`XLSX exported to: ${xlsxPath}`);
  }

  private async exportCsv(rows: Record<string, string>[], filePath: string): Promise<void> {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.default.Workbook();
    const worksheet = workbook.addWorksheet('Contacts');

    // Add headers
    worksheet.columns = CSV_HEADERS.map(header => ({
      header,
      key: header,
      width: 25,
    }));

    // Add rows
    for (const row of rows) {
      worksheet.addRow(row);
    }

    // Write as CSV using exceljs csv writer
    await workbook.csv.writeFile(filePath);
  }

  private async exportXlsx(rows: Record<string, string>[], filePath: string): Promise<void> {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.default.Workbook();
    const worksheet = workbook.addWorksheet('Contacts');

    // Style for header row
    const headerStyle: Partial<import('exceljs').Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    // Add headers with style
    const headerRow = worksheet.addRow(CSV_HEADERS);
    headerRow.eachCell((cell) => {
      Object.assign(cell.style, headerStyle);
    });

    // Add data rows
    for (const row of rows) {
      worksheet.addRow(CSV_HEADERS.map(h => row[h] || ''));
    }

    // Auto-fit column widths
    worksheet.columns.forEach((column) => {
      if (column.header) {
        const headerLen = column.header.toString().length;
        let maxLen = headerLen;
        worksheet.eachRow((row) => {
          const cell = row.getCell(column.number || 1);
          const cellLen = cell.value ? cell.value.toString().length : 0;
          if (cellLen > maxLen) maxLen = cellLen;
        });
        column.width = Math.min(maxLen + 2, 50);
      }
    });

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    await workbook.xlsx.writeFile(filePath);
  }

  private async cleanup(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}
