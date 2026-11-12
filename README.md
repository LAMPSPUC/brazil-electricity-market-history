# A Short History of the Brazilian Electricity Market and the Loss of Flexibility

Web edition in four languages (Português, English, Español, 中文), with the PDF editions in `downloads/`.

Address: https://lampspuc.github.io/brazil-electricity-market-history/

This folder is the complete site: static HTML, CSS and JavaScript, fonts and PDFs, with no build step and no server code. Every internal link and asset path is relative, so the pages work at the address above (a sub-path of `lampspuc.github.io`), under any other path, and when opened from the disk. Only the canonical links, the share-image addresses, `sitemap.xml` and `robots.txt` carry the full address.

## Folder

```
index.html              landing page: the four editions and the PDFs
pt/ en/ es/ zh/         one page per edition
assets/                 style sheet, script, search indexes, figures, share images
assets/fonts/           web fonts (woff2) and their licences
downloads/              PDF editions (English, Portuguese, Spanish)
sitemap.xml robots.txt  for search engines
.nojekyll               tells GitHub Pages to publish the files as they are
```

## Publishing on GitHub Pages

The repository starts private, so the files can be reviewed on GitHub before anyone else can see them. GitHub Pages is switched on when the repository is made public; on an organization's free plan, Pages is available only for public repositories.

### 1. Create the private repository

On GitHub, in the LAMPSPUC organization: **New repository** → name `brazil-electricity-market-history` → **Private** → no README, no .gitignore, no licence → **Create repository**.

With the GitHub command line instead:

```
gh repo create LAMPSPUC/brazil-electricity-market-history --private
```

### 2. Push the site

Copy this folder to a working folder outside any synced drive (a Git history inside a synced folder is slow and fragile). In that copy:

```
git init -b main
git add -A
git commit -m "Web edition"
git remote add origin https://github.com/LAMPSPUC/brazil-electricity-market-history.git
git push -u origin main
```

On GitHub, check that `.nojekyll`, `index.html`, `assets/` and `downloads/` sit at the top level of the repository.

### 3. Make the repository public and turn on Pages

1. **Settings → General → Danger Zone → Change repository visibility → Public.**
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.**
3. After a minute or two the site is live at https://lampspuc.github.io/brazil-electricity-market-history/. **Settings → Pages** shows the address; the **Actions** tab shows each deployment.

### 4. Check the published site

- Open the landing page, the four editions and one PDF.
- Paste the address into a new message or a link-preview tool to see the title, description and share image.
- Optional: add the site to Google Search Console and submit `https://lampspuc.github.io/brazil-electricity-market-history/sitemap.xml`. Crawlers read `robots.txt` only at the root of a host, so under a sub-path the sitemap is best submitted there directly.

### Updating

Replace the files of the working copy with the new version, then `git add -A`, `git commit` and `git push`. Pages publishes each push.

### Changing the address

If the repository or organization is renamed, or a custom domain is used (**Settings → Pages → Custom domain**, with a `CNAME` record at the domain's DNS pointing to `lampspuc.github.io`), the full address in the canonical links, the share-image addresses, `sitemap.xml` and `robots.txt` must be updated to match.

## Licence

All rights reserved. The book may be read on the site and in the PDF editions for personal use only; it may not be copied, printed, distributed or sold, in whole or in part, without written permission. The full notice, in the four languages, is in `LICENSE.md`. The fonts in `assets/fonts/` keep their own licence (below).

## Fonts

Literata, Source Sans 3, Atkinson Hyperlegible, Noto Serif SC and Noto Sans SC are served from `assets/fonts/` (woff2, split by character range, so a page downloads only the parts it uses); the site makes no request to any other server. The fonts are licensed under the SIL Open Font License 1.1; the licence of each family is in the same folder. Until a font arrives, text shows in a system font with the same proportions. Some browsers do not load fonts for pages opened straight from the disk; they use the system fonts there, and the published site is not affected.
