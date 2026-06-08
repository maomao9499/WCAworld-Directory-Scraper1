import { chromium, Browser, BrowserContext } from 'playwright';
import { ScraperOptions, ScrapeResult, Member } from './types';
import { flattenMembers, CSV_HEADERS } from './utils';
import * as fs from 'fs';
import * as path from 'path';

export abstract class BaseScraper {
  protected options: ScraperOptions;
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;

  constructor(options: ScraperOptions) {
    this.options = options;
  }

  abstract run(): Promise<ScrapeResult>;

  protected async launchBrowser(): Promise<void> {
    console.log('Launching browser...');
    this.browser = await chromium.launch({
      headless: this.options.headless,
    });
    this.context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
  }

  protected async exportResults(members: Member[]): Promise<void> {
    const rows = flattenMembers(members);
    const baseName = this.options.output.replace(/\.[^.]+$/, '');

    const outputDir = path.dirname(this.options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const csvPath = `${baseName}.csv`;
    await this.exportCsv(rows, csvPath);
    console.log(`CSV exported to: ${csvPath}`);

    const xlsxPath = `${baseName}.xlsx`;
    await this.exportXlsx(rows, xlsxPath);
    console.log(`XLSX exported to: ${xlsxPath}`);
  }

  protected async exportCsv(rows: Record<string, string>[], filePath: string): Promise<void> {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.default.Workbook();
    const worksheet = workbook.addWorksheet('Contacts');

    worksheet.columns = CSV_HEADERS.map((header) => ({
      header,
      key: header,
      width: 25,
    }));

    for (const row of rows) {
      worksheet.addRow(row);
    }

    await workbook.csv.writeFile(filePath);
  }

  protected async exportXlsx(rows: Record<string, string>[], filePath: string): Promise<void> {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.default.Workbook();
    const worksheet = workbook.addWorksheet('Contacts');

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

    const headerRow = worksheet.addRow(CSV_HEADERS);
    headerRow.eachCell((cell) => {
      Object.assign(cell.style, headerStyle);
    });

    for (const row of rows) {
      worksheet.addRow(CSV_HEADERS.map((h) => row[h] || ''));
    }

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

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    await workbook.xlsx.writeFile(filePath);
  }

  protected async cleanup(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}
