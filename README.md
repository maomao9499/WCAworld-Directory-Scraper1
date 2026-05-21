# WCAworld Directory Scraper1

爬取 WCAworld 货运联盟目录中的联系人信息。

## 环境要求

- Node.js >= 18 (推荐使用 Node 24，开发使用 24.15.0)
- 已安装 nvm 可自动切换版本（项目包含 `.nvmrc` 文件）

## 快速开始

```bash
# 1. 切换到正确的 Node 版本
nvm use v24.15.0

# 2. 安装依赖
npm install

# 3. 安装 Playwright 浏览器
npx playwright install chromium

# 4. 配置 .env 文件（复制并修改）
cp .env.example .env
# 编辑 .env，设置 WCA_USER、WCA_PASSWORD、WCA_COUNTRY

# 5. 运行爬虫
npm start
```

## 配置

### .env 文件

```env
# WCAworld 登录凭证
WCA_USER=your_username
WCA_PASSWORD=your_password

# 国家代码 (参考 COUNTRIES.txt 文件)
WCA_COUNTRY=PL
```

### 国家代码

查看 `COUNTRIES.txt` 文件获取支持的国家代码列表。

常用国家代码：
| 代码 | 国家 |
|------|------|
| CN | 中国 |
| US | 美国 |
| PL | 波兰 |
| DE | 德国 |
| GB | 英国 |
| JP | 日本 |
| SG | 新加坡 |
| HK | 香港 |

## 使用

```bash
# 使用 .env 配置运行（推荐）
npm start

# 或通过命令行参数覆盖
npm start -- -c CN          # 爬取中国
npm start -- -c US          # 爬取美国
npm start -- --no-headless  # 显示浏览器窗口（调试用）
```

## 输出

程序会生成两个文件（文件名包含国家代码）：
- `output/contacts_{COUNTRY}.csv` - CSV 格式
- `output/contacts_{COUNTRY}.xlsx` - Excel 格式（带样式表头）

### CSV/XLSX 列说明

| 列名 | 说明 |
|------|------|
| Company ID | 公司成员 ID |
| Company Name | 公司名称 |
| Branch | 分支名称 |
| City | 城市 |
| Country | 国家 |
| Address | 地址 |
| Phone | 总机电话 |
| Fax | 传真 |
| Website | 网站 |
| General Email | 通用邮箱 |
| Contact Title | 联系人职位 |
| Contact Name | 联系人姓名 |
| Contact Email | 联系人邮箱 |
| Contact Direct Line | 联系人直接电话 |
| Contact Mobile | 联系人手机 |

注：每个联系人一行，公司信息会重复。

## 项目结构

```
web-agent/
├── src/
│   ├── index.ts      # CLI 入口
│   ├── scraper.ts    # 主爬虫类
│   ├── login.ts      # 登录模块
│   ├── directory.ts  # 目录列表爬取
│   ├── member.ts     # 成员详情爬取
│   ├── types.ts      # TypeScript 类型
│   └── utils.ts      # 工具函数
├── output/           # 输出目录
├── .env              # 配置文件
├── .nvmrc            # Node 版本配置
├── COUNTRIES.txt     # 国家代码表
└── package.json
```

## 注意事项

1. **登录凭证**：用户名密码从 `.env` 文件读取，不会保存到代码中
2. **请求频率**：程序已内置请求间隔，避免对服务器造成压力
3. **数据可见性**：部分联系人信息需要登录后才能看到
4. **国家代码**：使用 ISO 3166-1 alpha-2 两位字母代码

## License

MIT