# Civic Atlas

An iPhone study app for Andhra Pradesh Group I and UPSC Civil Services. Browse official releases by region, date and syllabus area. Use practice cards, recall drills and saved items to revise.

## Publish free with GitHub Pages from an iPhone

The repository must be **public** for GitHub Pages on a free GitHub account. This makes the app and its source files publicly viewable. GitHub Actions refreshes the official-source edition daily at about **06:17 IST**. Standard Actions runners are free in public repositories.

1. In the iPhone **Files** app, tap **CivicAtlas-RSS.zip** to extract it. Keep the original ZIP.
2. Sign in to GitHub in Safari and create a **public** repository named **civic-atlas**. Select **Add a README file** and keep the default branch **main**.
3. In the repository, choose **Add file → Upload files**. Upload the original ZIP file and commit it to main. The uploaded file must be named **CivicAtlas-RSS.zip** at the repository root.
4. Choose **Add file → Create new file**. Enter **.github/workflows/daily.yml** as the filename. In Files, open the extracted **Daily-workflow.txt**, select all, copy it and paste it into GitHub's editor. Commit to main.
5. Open **Settings → Pages**, set the build source to **GitHub Actions**.
6. Open **Actions → Civic Atlas daily edition**. Enable workflows if GitHub prompts. Choose **Run workflow** on main for an immediate first publication.
7. When the deploy job completes, open its Pages link in Safari. Tap **Share → Add to Home Screen** and choose **Open as Web App** if offered.

The first workflow run imports the source from the ZIP, collects available official reports and publishes the app. Later daily runs refresh the edition and retain older stories for revision. If a feed is temporarily unavailable, the app keeps its bundled or previously downloaded edition. GitHub may delay scheduled jobs, and it can turn off schedules for inactive repositories, so check **Actions** if updates stop.

## Upgrade an existing repository

Upload CivicAtlas-RSS.zip at the repository root. Replace the contents of .github/workflows/daily.yml with Daily-workflow.txt and commit. Set Settings → Pages → Source to GitHub Actions. Run Civic Atlas daily edition on main. The new workflow imports this release once even if the previous app exists.

## Install on iPhone

Open the published HTTPS address in Safari. Choose **Share → Add to Home Screen**, enable **Open as Web App** if shown, then tap **Add**. In some layouts the page menu contains Share. Open the app once while online to cache the reader, practice cards and available edition. Offline, external official-source links will need a connection.

[Apple's web app installation guide](https://support.apple.com/guide/iphone/iphea86e5236/ios)

## Optional on-device tutor

The study tutor sends the selected item’s excerpt and a short study prompt to your own Apple shortcut. Select **On-Device** in that shortcut to run Apple’s local model. Your iPhone 16 Pro Max supports Apple Intelligence. Enable **Settings → Apple Intelligence & Siri → Apple Intelligence** and allow setup and model downloads to finish. Device language and Siri language must be supported and compatible with Apple Intelligence. The reader and practice cards also work independently of this feature.

1. In **Shortcuts**, tap **+**. Name it **Civic Atlas Tutor**.
2. Open the shortcut’s **Details** and enable **Show in Share Sheet**. Choose **Text** as accepted input.
3. Add **Use Model**, select **On-Device**, tap the prompt field and insert the **Shortcut Input** variable chip.
4. Add **Show Content** (or **Show Result**, depending on your Shortcuts version). For input, choose **Response** from Use Model. Save the shortcut.
5. Expand an article or study card in Civic Atlas. Choose **On-device study tutor → Open Civic Atlas Tutor**. The answer appears in Shortcuts. Use **Share prompt** to choose the shortcut from the share sheet, or **Copy prompt** to reuse the text manually.

With the model downloaded, the On-Device option can run offline. Verify generated answers using the linked official material. Apple’s Shortcuts actions and capabilities depend on your software version, region and language. Test once with a cached card before relying on the tutor offline.

[Apple Intelligence requirements](https://support.apple.com/en-in/121115) · [Apple’s Use Model instructions](https://support.apple.com/guide/shortcuts/use-apple-intelligence-in-shortcuts-tpg3vrvwmclv/ios) · [Apple’s shortcut URL reference](https://support.apple.com/guide/shortcuts/apd624386f42/ios)

## Run the source locally

The static app lives in `dist/`. From the project directory run:

```sh
python3 -m unittest discover -s scripts -p 'test_*.py'
python3 scripts/refresh.py
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000/` on the same computer. The source refresh requires network access to official publishers and writes `dist/data/brief.json`. Reopen the reader to load the edition. For phone installation, host the contents of `dist/` together at an HTTPS address. All app paths are relative. For self-hosting, schedule the refresh script daily on a machine with Python, then publish the updated JSON with the app.

Dates beside headlines are release dates. A successful collection can find no new items. Read the official source for full policy wording and figures. Bookmarks stay in local website storage; clearing website data may remove them.

